from datetime import date, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.raw_db import connect

progress_bp = Blueprint("progress", __name__)

OFFICER_ROLES = {"officer", "admin"}


def _require_officer():
    claims = get_jwt()
    if claims.get("role") not in OFFICER_ROLES:
        return jsonify({"error": "Officer or admin access required"}), 403
    return None


def _monday_of_week(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _serialize(r) -> dict:
    return {
        "report_id": r["report_id"],
        "user_id": r["user_id"],
        "week_of": r["week_of"].isoformat() if r["week_of"] else None,
        "summary": r["summary"],
        "tasks_completed": r["tasks_completed"],
        "tasks_in_progress": r["tasks_in_progress"],
        "tasks_on_hold": r["tasks_on_hold"],
        "upcoming_tasks": r["upcoming_tasks"],
        "comments": r["comments"],
        "feedback": r["feedback"],
        "questions": r["questions"],
        "submitted_at": r["submitted_at"].isoformat() if r["submitted_at"] else None,
        "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
        "first_name": r.get("first_name"),
        "last_name": r.get("last_name"),
        "email": r.get("email"),
    }


# ---------------------------------------------------------------------------
# GET /progress-reports/  — all reports; officer+ only
# ---------------------------------------------------------------------------

@progress_bp.route("/", methods=["GET", "OPTIONS"])
@jwt_required()
def list_reports():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_officer()
    if err:
        return err

    week_of_str = request.args.get("week_of")
    filter_user_id = request.args.get("user_id", type=int)
    page = max(1, request.args.get("page", 1, type=int))
    limit = min(100, max(1, request.args.get("limit", 20, type=int)))
    offset = (page - 1) * limit

    conds = []
    params: list = []

    if week_of_str:
        try:
            week_date = _monday_of_week(date.fromisoformat(week_of_str))
            conds.append("pr.week_of = %s")
            params.append(week_date)
        except ValueError:
            return jsonify({"error": "Invalid week_of format (use YYYY-MM-DD)"}), 400

    if filter_user_id:
        conds.append("pr.user_id = %s")
        params.append(filter_user_id)

    where = ("WHERE " + " AND ".join(conds)) if conds else ""

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT COUNT(*) as total FROM progress_reports pr {where}",
            params,
        )
        total = cur.fetchone()["total"]

        cur.execute(
            f"""
            SELECT pr.*, u.email, p.first_name, p.last_name
            FROM progress_reports pr
            JOIN users u ON u.user_id = pr.user_id
            LEFT JOIN profile p ON p.user_id = pr.user_id
            {where}
            ORDER BY pr.week_of DESC, pr.submitted_at DESC
            LIMIT %s OFFSET %s
            """,
            params + [limit, offset],
        )
        rows = cur.fetchall()

    return jsonify({
        "reports": [_serialize(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),
    }), 200


# ---------------------------------------------------------------------------
# GET /progress-reports/mine  — current user's reports
# ---------------------------------------------------------------------------

@progress_bp.route("/mine", methods=["GET", "OPTIONS"])
@jwt_required()
def my_reports():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_officer()
    if err:
        return err

    user_id = int(get_jwt_identity())

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT pr.*, u.email, p.first_name, p.last_name
            FROM progress_reports pr
            JOIN users u ON u.user_id = pr.user_id
            LEFT JOIN profile p ON p.user_id = pr.user_id
            WHERE pr.user_id = %s
            ORDER BY pr.week_of DESC
            LIMIT 20
            """,
            (user_id,),
        )
        rows = cur.fetchall()

    return jsonify({"reports": [_serialize(r) for r in rows]}), 200


# ---------------------------------------------------------------------------
# POST /progress-reports/  — submit/upsert for a week
# ---------------------------------------------------------------------------

@progress_bp.route("/", methods=["POST", "OPTIONS"])
@jwt_required()
def submit_report():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_officer()
    if err:
        return err

    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    week_of_str = data.get("week_of")
    if not week_of_str:
        return jsonify({"error": "week_of is required"}), 400
    try:
        week_date = _monday_of_week(date.fromisoformat(week_of_str))
    except ValueError:
        return jsonify({"error": "Invalid week_of format (use YYYY-MM-DD)"}), 400

    fields = ["summary", "tasks_completed", "tasks_in_progress", "tasks_on_hold",
              "upcoming_tasks", "comments", "feedback", "questions"]
    values = {f: data.get(f) or None for f in fields}

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO progress_reports
              (user_id, week_of, summary, tasks_completed, tasks_in_progress, tasks_on_hold,
               upcoming_tasks, comments, feedback, questions, submitted_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (user_id, week_of) DO UPDATE SET
              summary = EXCLUDED.summary,
              tasks_completed = EXCLUDED.tasks_completed,
              tasks_in_progress = EXCLUDED.tasks_in_progress,
              tasks_on_hold = EXCLUDED.tasks_on_hold,
              upcoming_tasks = EXCLUDED.upcoming_tasks,
              comments = EXCLUDED.comments,
              feedback = EXCLUDED.feedback,
              questions = EXCLUDED.questions,
              updated_at = NOW()
            RETURNING report_id
            """,
            (
                user_id, week_date,
                values["summary"], values["tasks_completed"], values["tasks_in_progress"],
                values["tasks_on_hold"], values["upcoming_tasks"], values["comments"],
                values["feedback"], values["questions"],
            ),
        )
        report_id = cur.fetchone()["report_id"]
        conn.commit()

    return jsonify({"report_id": report_id, "week_of": week_date.isoformat(), "message": "Report saved"}), 200


# ---------------------------------------------------------------------------
# PATCH /progress-reports/<report_id>  — edit own report
# ---------------------------------------------------------------------------

@progress_bp.route("/<int:report_id>", methods=["PATCH", "OPTIONS"])
@jwt_required()
def update_report(report_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_officer()
    if err:
        return err

    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT user_id FROM progress_reports WHERE report_id = %s", (report_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Report not found"}), 404
        if row["user_id"] != user_id:
            return jsonify({"error": "Cannot edit another officer's report"}), 403

        fields = ["summary", "tasks_completed", "tasks_in_progress", "tasks_on_hold",
                  "upcoming_tasks", "comments", "feedback", "questions"]
        updates = []
        params = []
        for f in fields:
            if f in data:
                updates.append(f"{f} = %s")
                params.append(data[f] or None)

        if not updates:
            return jsonify({"error": "Nothing to update"}), 400

        updates.append("updated_at = NOW()")
        params.append(report_id)
        cur.execute(
            f"UPDATE progress_reports SET {', '.join(updates)} WHERE report_id = %s",
            params,
        )
        conn.commit()

    return jsonify({"message": "Report updated"}), 200


# ---------------------------------------------------------------------------
# GET /progress-reports/status?week_of=<date>  — submission status for all officers
# ---------------------------------------------------------------------------

@progress_bp.route("/status", methods=["GET", "OPTIONS"])
@jwt_required()
def report_status():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_officer()
    if err:
        return err

    week_of_str = request.args.get("week_of") or date.today().isoformat()
    try:
        week_date = _monday_of_week(date.fromisoformat(week_of_str))
    except ValueError:
        return jsonify({"error": "Invalid week_of format"}), 400

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                u.user_id, u.email, p.first_name, p.last_name,
                pr.report_id, pr.submitted_at
            FROM users u
            LEFT JOIN profile p ON p.user_id = u.user_id
            LEFT JOIN progress_reports pr
                ON pr.user_id = u.user_id AND pr.week_of = %s
            WHERE u.role IN ('officer', 'admin')
              AND u.is_active = TRUE
            ORDER BY p.last_name ASC, p.first_name ASC
            """,
            (week_date,),
        )
        rows = cur.fetchall()

    deadline = week_date + timedelta(days=7)  # next Monday
    now = date.today()
    is_overdue = now >= deadline

    status_list = [
        {
            "user_id": r["user_id"],
            "email": r["email"],
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "submitted": r["report_id"] is not None,
            "submitted_at": r["submitted_at"].isoformat() if r["submitted_at"] else None,
            "overdue": is_overdue and r["report_id"] is None,
        }
        for r in rows
    ]

    return jsonify({
        "week_of": week_date.isoformat(),
        "deadline": deadline.isoformat(),
        "is_overdue": is_overdue,
        "officers": status_list,
    }), 200
