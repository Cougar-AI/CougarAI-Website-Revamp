import os
import string
import secrets
import uuid
from datetime import date, datetime
from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.utils import secure_filename
from app.raw_db import connect

UPLOADS_BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_CATEGORIES = {"sponsors", "partners"}

admin_bp = Blueprint("admin", __name__)

ADMIN_ROLES = {"admin"}
OFFICER_ROLES = {"officer", "admin"}
ALL_VALID_ROLES = {"admin", "officer", "partner", "member", "non-member"}


def _require_admin():
    """Return 403 response if the caller is not admin, else None."""
    claims = get_jwt()
    if claims.get("role") not in ADMIN_ROLES:
        return jsonify({"error": "Admin access required"}), 403
    return None


def _caller_role() -> str:
    claims = get_jwt()
    return claims.get("role", "")


def _gen_checkin_code(length: int = 12) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ---------------------------------------------------------------------------
# GET /admin/stats
# ---------------------------------------------------------------------------

@admin_bp.route("/stats", methods=["GET", "OPTIONS"])
@jwt_required()
def get_stats():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) as total FROM users")
        total_users = cur.fetchone()["total"]

        cur.execute(
            """
            SELECT COUNT(DISTINCT p.payment_id) as active
            FROM payments p
            WHERE p.expires_at >= CURRENT_DATE
            """
        )
        active_members = cur.fetchone()["active"]

        cur.execute(
            """
            SELECT COUNT(*) as count FROM users
            WHERE created_at >= NOW() - INTERVAL '7 days'
            """
        )
        new_signups_7d = cur.fetchone()["count"]

        cur.execute(
            """
            SELECT COUNT(*) as count FROM events
            WHERE DATE_TRUNC('month', starts_at) = DATE_TRUNC('month', CURRENT_DATE)
            """
        )
        events_this_month = cur.fetchone()["count"]

        cur.execute(
            "SELECT COUNT(*) as count FROM events WHERE starts_at > NOW()"
        )
        upcoming_events_count = cur.fetchone()["count"]

        cur.execute(
            """
            SELECT COALESCE(SUM(amount), 0) as revenue FROM payments
            WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
            """
        )
        revenue_this_month = float(cur.fetchone()["revenue"])

        cur.execute("SELECT COALESCE(SUM(points), 0) as total FROM points")
        total_points = int(cur.fetchone()["total"])

    return jsonify({
        "total_users": total_users,
        "active_members": active_members,
        "new_signups_7d": new_signups_7d,
        "events_this_month": events_this_month,
        "upcoming_events_count": upcoming_events_count,
        "revenue_this_month": revenue_this_month,
        "total_points_awarded": total_points,
    }), 200


# ---------------------------------------------------------------------------
# GET /admin/users
# ---------------------------------------------------------------------------

@admin_bp.route("/users", methods=["GET", "OPTIONS"])
@jwt_required()
def list_users():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    page = max(1, request.args.get("page", 1, type=int))
    limit = min(100, max(1, request.args.get("limit", 25, type=int)))
    offset = (page - 1) * limit
    search = (request.args.get("search") or "").strip()
    role_filter = request.args.get("role") or None
    membership_filter = request.args.get("membership_status") or None  # active|expired|none

    conn = connect()
    with conn.cursor() as cur:
        conditions = []
        params: list = []

        if search:
            conditions.append(
                "(u.email ILIKE %s OR p.first_name ILIKE %s OR p.last_name ILIKE %s)"
            )
            like = f"%{search}%"
            params += [like, like, like]

        if role_filter:
            conditions.append("u.role = %s")
            params.append(role_filter)

        where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        # Membership status is derived: active = has payment with expires_at >= today
        membership_join = """
            LEFT JOIN LATERAL (
                SELECT MAX(expires_at) as expires_at
                FROM payments pay
                WHERE pay.student_id = p.student_id
                   OR pay.email = u.email
            ) mem ON TRUE
        """

        having_clause = ""
        if membership_filter == "active":
            having_clause = "AND mem.expires_at >= CURRENT_DATE"
        elif membership_filter == "expired":
            having_clause = "AND mem.expires_at < CURRENT_DATE AND mem.expires_at IS NOT NULL"
        elif membership_filter == "none":
            having_clause = "AND mem.expires_at IS NULL"

        base = f"""
            SELECT
                u.user_id, u.email, u.role, u.is_active, u.created_at, u.last_login,
                p.first_name, p.last_name, p.student_id, p.avatar_url,
                mem.expires_at as membership_expires_at,
                CASE
                    WHEN mem.expires_at >= CURRENT_DATE THEN 'active'
                    WHEN mem.expires_at < CURRENT_DATE THEN 'expired'
                    ELSE 'none'
                END as membership_status
            FROM users u
            LEFT JOIN profile p ON p.user_id = u.user_id
            {membership_join}
            {where_clause}
            {"AND" if where_clause else "WHERE"} TRUE {having_clause}
        """

        # Count
        count_q = f"SELECT COUNT(*) as total FROM ({base}) sub"
        cur.execute(count_q, params * 2 if membership_filter else params)
        # Re-run with proper params — simpler: just do two separate queries
        count_params = list(params)
        cur.execute(
            f"""
            SELECT COUNT(*) as total
            FROM users u
            LEFT JOIN profile p ON p.user_id = u.user_id
            {membership_join}
            {where_clause}
            {"AND" if where_clause else "WHERE"} TRUE {having_clause}
            """,
            count_params,
        )
        total = cur.fetchone()["total"]

        cur.execute(
            f"""
            SELECT
                u.user_id, u.email, u.role, u.is_active, u.created_at, u.last_login,
                p.first_name, p.last_name, p.student_id, p.avatar_url,
                mem.expires_at as membership_expires_at,
                CASE
                    WHEN mem.expires_at >= CURRENT_DATE THEN 'active'
                    WHEN mem.expires_at < CURRENT_DATE THEN 'expired'
                    ELSE 'none'
                END as membership_status
            FROM users u
            LEFT JOIN profile p ON p.user_id = u.user_id
            {membership_join}
            {where_clause}
            {"AND" if where_clause else "WHERE"} TRUE {having_clause}
            ORDER BY u.created_at DESC
            LIMIT %s OFFSET %s
            """,
            count_params + [limit, offset],
        )
        rows = cur.fetchall()

    users = []
    for r in rows:
        users.append({
            "user_id": r["user_id"],
            "email": r["email"],
            "role": r["role"],
            "is_active": r["is_active"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "last_login": r["last_login"].isoformat() if r["last_login"] else None,
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "student_id": r["student_id"],
            "avatar_url": r["avatar_url"],
            "membership_expires_at": r["membership_expires_at"].isoformat() if r["membership_expires_at"] else None,
            "membership_status": r["membership_status"],
            "has_profile": r["student_id"] is not None,
        })

    return jsonify({
        "users": users,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),  # ceiling division
    }), 200


# ---------------------------------------------------------------------------
# GET /admin/users/<user_id>
# ---------------------------------------------------------------------------

@admin_bp.route("/users/<int:user_id>", methods=["GET", "OPTIONS"])
@jwt_required()
def get_user(user_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT u.user_id, u.email, u.role, u.is_active, u.created_at, u.last_login,
                   u.stripe_customer_id,
                   p.student_id, p.first_name, p.last_name, p.grade_level, p.major,
                   p.shirt_size, p.discord_id, p.avatar_url, p.is_public,
                   p.current_streak, p.max_streak
            FROM users u
            LEFT JOIN profile p ON p.user_id = u.user_id
            WHERE u.user_id = %s
            """,
            (user_id,),
        )
        user = cur.fetchone()
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Membership history
        cur.execute(
            """
            SELECT payment_id, date, amount, plan_id, expires_at, stripe_session_id,
                   COALESCE(is_manual, FALSE) as is_manual, note
            FROM payments
            WHERE student_id = %s OR email = (SELECT email FROM users WHERE user_id = %s)
            ORDER BY date DESC
            LIMIT 10
            """,
            (user["student_id"], user_id),
        )
        payments = cur.fetchall()

        # Points summary
        cur.execute(
            "SELECT COALESCE(SUM(points), 0) as total, COUNT(*) as events FROM points WHERE student_id = %s",
            (user["student_id"],),
        )
        pts = cur.fetchone()

        # Check-in count
        cur.execute(
            "SELECT COUNT(*) as count FROM event_checkins WHERE user_id = %s",
            (user_id,),
        )
        checkin_count = cur.fetchone()["count"]

    def _iso(v):
        return v.isoformat() if v else None

    result = {
        "user_id": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "is_active": user["is_active"],
        "created_at": _iso(user["created_at"]),
        "last_login": _iso(user["last_login"]),
        "stripe_customer_id": user["stripe_customer_id"],
        "profile": {
            "student_id": user["student_id"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "grade_level": user["grade_level"],
            "major": user["major"],
            "shirt_size": user["shirt_size"],
            "discord_id": user["discord_id"],
            "avatar_url": user["avatar_url"],
            "is_public": user["is_public"],
            "current_streak": user["current_streak"],
            "max_streak": user["max_streak"],
        } if user["student_id"] else None,
        "payments": [
            {
                "payment_id": p["payment_id"],
                "date": _iso(p["date"]),
                "amount": float(p["amount"]) if p["amount"] else 0,
                "plan_id": p["plan_id"],
                "expires_at": _iso(p["expires_at"]),
                "stripe_session_id": p["stripe_session_id"],
                "is_manual": bool(p["is_manual"]),
                "note": p["note"],
            }
            for p in payments
        ],
        "points_total": int(pts["total"]),
        "events_attended": int(pts["events"]),
        "checkin_count": checkin_count,
    }
    return jsonify(result), 200


# ---------------------------------------------------------------------------
# PATCH /admin/users/<user_id>
# ---------------------------------------------------------------------------

@admin_bp.route("/users/<int:user_id>", methods=["PATCH", "OPTIONS"])
@jwt_required()
def update_user(user_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    new_role = data.get("role")
    is_active = data.get("is_active")
    new_email = data.get("email")

    if new_role is not None and new_role not in ALL_VALID_ROLES:
        return jsonify({"error": f"Invalid role. Must be one of: {', '.join(sorted(ALL_VALID_ROLES))}"}), 400
    if new_email is not None:
        new_email = new_email.strip()
        if not new_email:
            return jsonify({"error": "Email cannot be empty"}), 400

    caller_role = _caller_role()

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT role, user_id FROM users WHERE user_id = %s", (user_id,))
        existing = cur.fetchone()
        if not existing:
            return jsonify({"error": "User not found"}), 404

        updates: list[str] = []
        params: list = []

        if new_role is not None:
            updates.append("role = %s")
            params.append(new_role)
        if is_active is not None:
            updates.append("is_active = %s")
            params.append(bool(is_active))
        if new_email is not None:
            updates.append("email = %s")
            params.append(new_email)

        if not updates:
            return jsonify({"error": "Nothing to update"}), 400

        params.append(user_id)
        cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE user_id = %s", params)
        conn.commit()

    return jsonify({"message": "User updated"}), 200


# ---------------------------------------------------------------------------
# DELETE /admin/users/<user_id>  (soft delete — sets is_active = false)
# ---------------------------------------------------------------------------

@admin_bp.route("/users/<int:user_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def deactivate_user(user_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    # Only admin can deactivate other admins
    caller_role = _caller_role()
    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT role FROM users WHERE user_id = %s", (user_id,))
        target = cur.fetchone()
        if not target:
            return jsonify({"error": "User not found"}), 404
        if target["role"] == "admin" and caller_role != "admin":
            return jsonify({"error": "Only admins can deactivate other admins"}), 403

        cur.execute("UPDATE users SET is_active = FALSE WHERE user_id = %s", (user_id,))
        conn.commit()

    return jsonify({"message": "User deactivated"}), 200


# ---------------------------------------------------------------------------
# GET /admin/events/<event_id>/attendance
# ---------------------------------------------------------------------------

@admin_bp.route("/events/<int:event_id>/attendance", methods=["GET", "OPTIONS"])
@jwt_required()
def get_event_attendance(event_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT name, capacity, starts_at FROM events WHERE event_id = %s", (event_id,))
        event = cur.fetchone()
        if not event:
            return jsonify({"error": "Event not found"}), 404

        cur.execute(
            """
            SELECT
                ec.checkin_id, ec.checked_in_at,
                ec.student_id, ec.user_id,
                p.first_name, p.last_name, p.avatar_url,
                pt.points
            FROM event_checkins ec
            LEFT JOIN profile p ON p.student_id = ec.student_id
            LEFT JOIN points pt ON pt.student_id = ec.student_id AND pt.event_id = ec.event_id
            WHERE ec.event_id = %s
            ORDER BY ec.checked_in_at ASC
            """,
            (event_id,),
        )
        rows = cur.fetchall()

    attendees = [
        {
            "checkin_id": r["checkin_id"],
            "checked_in_at": r["checked_in_at"].isoformat() if r["checked_in_at"] else None,
            "student_id": r["student_id"],
            "user_id": r["user_id"],
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "avatar_url": r["avatar_url"],
            "points": r["points"],
        }
        for r in rows
    ]

    return jsonify({
        "event_id": event_id,
        "event_name": event["name"],
        "capacity": event["capacity"],
        "starts_at": event["starts_at"].isoformat() if event["starts_at"] else None,
        "attendance_count": len(attendees),
        "attendees": attendees,
    }), 200


# ---------------------------------------------------------------------------
# POST /admin/events/<event_id>/regenerate-code
# ---------------------------------------------------------------------------

@admin_bp.route("/events/<int:event_id>/regenerate-code", methods=["POST", "OPTIONS"])
@jwt_required()
def regenerate_checkin_code(event_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    new_code = _gen_checkin_code()
    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT event_id FROM events WHERE event_id = %s", (event_id,))
        if not cur.fetchone():
            return jsonify({"error": "Event not found"}), 404

        cur.execute(
            "UPDATE events SET check_in_code = %s WHERE event_id = %s",
            (new_code, event_id),
        )
        conn.commit()

    return jsonify({"check_in_code": new_code}), 200


# ---------------------------------------------------------------------------
# GET /admin/officer-positions
# ---------------------------------------------------------------------------

@admin_bp.route("/officer-positions", methods=["GET", "OPTIONS"])
@jwt_required()
def list_officer_positions():
    if request.method == "OPTIONS":
        return "", 200
    claims = get_jwt()
    if claims.get("role") not in OFFICER_ROLES:
        return jsonify({"error": "Officer or admin access required"}), 403

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT position_id, title, department, sort_order "
            "FROM officer_positions ORDER BY sort_order ASC, title ASC"
        )
        rows = cur.fetchall()

    return jsonify({
        "positions": [
            {
                "position_id": r["position_id"],
                "title": r["title"],
                "department": r["department"],
                "sort_order": r["sort_order"],
            }
            for r in rows
        ]
    }), 200


# ---------------------------------------------------------------------------
# GET /admin/officers
# ---------------------------------------------------------------------------

@admin_bp.route("/officers", methods=["GET", "OPTIONS"])
@jwt_required()
def list_officers():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                o.student_id, o.role as officer_role, o.join_date, o.end_date,
                o.position_id,
                op.title as position_title, op.department as position_department,
                p.first_name, p.last_name, p.avatar_url,
                u.user_id, u.email, u.role as user_role
            FROM officers o
            LEFT JOIN officer_positions op ON op.position_id = o.position_id
            LEFT JOIN profile p ON p.student_id::text = o.student_id::text
            LEFT JOIN users u ON u.user_id = p.user_id
            ORDER BY o.join_date DESC
            """
        )
        rows = cur.fetchall()

    officers = [
        {
            "student_id": r["student_id"],
            "officer_role": r["officer_role"],
            "join_date": r["join_date"].isoformat() if r["join_date"] else None,
            "end_date": r["end_date"].isoformat() if r["end_date"] else None,
            "position_id": r["position_id"],
            "position_title": r["position_title"],
            "position_department": r["position_department"],
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "avatar_url": r["avatar_url"],
            "user_id": r["user_id"],
            "email": r["email"],
            "is_active": r["end_date"] is None or r["end_date"] >= date.today(),
        }
        for r in rows
    ]
    return jsonify({"officers": officers}), 200


# ---------------------------------------------------------------------------
# POST /admin/officers  — assign officer role to an existing user
# ---------------------------------------------------------------------------

@admin_bp.route("/officers", methods=["POST", "OPTIONS"])
@jwt_required()
def add_officer():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    officer_role = data.get("officer_role")
    join_date_str = data.get("join_date") or date.today().isoformat()
    position_id = data.get("position_id") or None

    if not user_id or not officer_role:
        return jsonify({"error": "user_id and officer_role are required"}), 400

    if officer_role not in OFFICER_ROLES:
        return jsonify({"error": f"officer_role must be one of: {', '.join(sorted(OFFICER_ROLES))}"}), 400

    try:
        join_date = date.fromisoformat(join_date_str)
    except ValueError:
        return jsonify({"error": "Invalid join_date format (use YYYY-MM-DD)"}), 400

    conn = connect()
    with conn.cursor() as cur:
        # Get the student_id linked to this user
        cur.execute(
            "SELECT student_id FROM profile WHERE user_id = %s",
            (user_id,),
        )
        profile = cur.fetchone()
        if not profile or not profile["student_id"]:
            return jsonify({"error": "User has no linked profile/student_id"}), 400

        student_id = profile["student_id"]

        # Upsert into officers table
        cur.execute(
            """
            INSERT INTO officers (student_id, role, join_date, position_id)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (student_id) DO UPDATE
                SET role = EXCLUDED.role, join_date = EXCLUDED.join_date,
                    end_date = NULL, position_id = EXCLUDED.position_id
            """,
            (student_id, officer_role, join_date, position_id),
        )

        # Update users.role
        cur.execute(
            "UPDATE users SET role = %s WHERE user_id = %s",
            (officer_role, user_id),
        )
        conn.commit()

    return jsonify({"message": "Officer added", "student_id": student_id}), 201


# ---------------------------------------------------------------------------
# PATCH /admin/officers/<student_id>
# ---------------------------------------------------------------------------

@admin_bp.route("/officers/<student_id>", methods=["PATCH", "OPTIONS"])
@jwt_required()
def update_officer(student_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    officer_role = data.get("officer_role")
    join_date_str = data.get("join_date")
    end_date_str = data.get("end_date")

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT student_id FROM officers WHERE student_id = %s", (student_id,))
        if not cur.fetchone():
            return jsonify({"error": "Officer not found"}), 404

        updates: list[str] = []
        params: list = []

        if officer_role:
            if officer_role not in OFFICER_ROLES:
                return jsonify({"error": f"officer_role must be one of: {', '.join(sorted(OFFICER_ROLES))}"}), 400
            updates.append("role = %s")
            params.append(officer_role)

        if join_date_str:
            try:
                date.fromisoformat(join_date_str)
            except ValueError:
                return jsonify({"error": "Invalid join_date"}), 400
            updates.append("join_date = %s")
            params.append(join_date_str)

        if end_date_str is not None:
            if end_date_str:
                try:
                    date.fromisoformat(end_date_str)
                except ValueError:
                    return jsonify({"error": "Invalid end_date"}), 400
            updates.append("end_date = %s")
            params.append(end_date_str or None)

        if "position_id" in data:
            updates.append("position_id = %s")
            params.append(data["position_id"] or None)

        if not updates:
            return jsonify({"error": "Nothing to update"}), 400

        params.append(student_id)
        cur.execute(f"UPDATE officers SET {', '.join(updates)} WHERE student_id = %s", params)

        # Sync users.role if officer_role changed
        if officer_role:
            cur.execute(
                "UPDATE users SET role = %s WHERE user_id = (SELECT user_id FROM profile WHERE student_id = %s)",
                (officer_role, student_id),
            )

        conn.commit()

    return jsonify({"message": "Officer updated"}), 200


# ---------------------------------------------------------------------------
# DELETE /admin/officers/<student_id>  — sets end_date to today
# ---------------------------------------------------------------------------

@admin_bp.route("/officers/<student_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def remove_officer(student_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT student_id FROM officers WHERE student_id = %s", (student_id,))
        if not cur.fetchone():
            return jsonify({"error": "Officer not found"}), 404

        today = date.today()
        cur.execute(
            "UPDATE officers SET end_date = %s WHERE student_id = %s",
            (today, student_id),
        )

        # Downgrade user role: back to member if they have active payment, else non-member
        cur.execute(
            """
            UPDATE users SET role = CASE
                WHEN EXISTS (
                    SELECT 1 FROM payments pay
                    JOIN profile p ON pay.student_id = p.student_id
                    WHERE p.student_id = %s AND pay.expires_at >= CURRENT_DATE
                ) THEN 'member'
                ELSE 'non-member'
            END
            WHERE user_id = (SELECT user_id FROM profile WHERE student_id = %s)
            """,
            (student_id, student_id),
        )
        conn.commit()

    return jsonify({"message": "Officer removed (end_date set to today)"}), 200


# ---------------------------------------------------------------------------
# PATCH /admin/users/<user_id>/membership  — manual membership grant (admin only)
# ---------------------------------------------------------------------------

@admin_bp.route("/users/<int:user_id>/membership", methods=["PATCH", "OPTIONS"])
@jwt_required()
def admin_set_membership(user_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    expires_at = data.get("expires_at")
    note = data.get("note") or None

    if not expires_at:
        return jsonify({"error": "expires_at is required (YYYY-MM-DD)"}), 400
    try:
        date.fromisoformat(expires_at)
    except ValueError:
        return jsonify({"error": "Invalid expires_at format (use YYYY-MM-DD)"}), 400

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT u.user_id, u.email, p.student_id
            FROM users u
            LEFT JOIN profile p ON p.user_id = u.user_id
            WHERE u.user_id = %s
            """,
            (user_id,),
        )
        user = cur.fetchone()
        if not user:
            return jsonify({"error": "User not found"}), 404

        cur.execute(
            """
            INSERT INTO payments (student_id, email, date, amount, plan_id, expires_at, is_manual, note)
            VALUES (%s, %s, CURRENT_DATE, 0, 'manual', %s, TRUE, %s)
            """,
            (user["student_id"], user["email"], expires_at, note),
        )

        # Upgrade to member if not already privileged
        cur.execute(
            """
            UPDATE users SET role = 'member'
            WHERE user_id = %s AND role IN ('non-member', 'member')
            """,
            (user_id,),
        )
        conn.commit()

    return jsonify({"message": "Membership manually granted"}), 200


# ---------------------------------------------------------------------------
# GET  /admin/event-types          — list all event types (used by dropdowns)
# POST /admin/event-types          — create new type (admin)
# PATCH /admin/event-types/<id>    — update type (admin)
# DELETE /admin/event-types/<id>   — soft delete (admin)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# GET /admin/events-stats  — events with attendance count, date-filterable
# ---------------------------------------------------------------------------

@admin_bp.route("/events-stats", methods=["GET", "OPTIONS"])
@jwt_required()
def list_events_stats():
    if request.method == "OPTIONS":
        return "", 200
    claims = get_jwt()
    if claims.get("role") not in OFFICER_ROLES:
        return jsonify({"error": "Officer or admin access required"}), 403

    start_date = request.args.get("start_date")  # ISO YYYY-MM-DD
    end_date   = request.args.get("end_date")    # ISO YYYY-MM-DD
    limit      = min(500, max(1, request.args.get("limit", 200, type=int)))

    conn = connect()
    with conn.cursor() as cur:
        conditions: list[str] = []
        params: list = []

        if start_date:
            conditions.append("e.starts_at >= %s::date")
            params.append(start_date)
        if end_date:
            conditions.append("e.starts_at < (%s::date + INTERVAL '1 day')")
            params.append(end_date)

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        cur.execute(
            f"""
            SELECT
                e.event_id, e.name, e.event_type, e.description,
                e.location, e.location_url, e.starts_at, e.ends_at,
                e.capacity, e.check_in_code, e.check_in_enabled, e.points_value,
                COUNT(ec.checkin_id) AS attendance_count
            FROM events e
            LEFT JOIN event_checkins ec ON ec.event_id = e.event_id
            {where}
            GROUP BY e.event_id
            ORDER BY e.starts_at DESC
            LIMIT %s
            """,
            params + [limit],
        )
        rows = cur.fetchall()

    events = [
        {
            "event_id":         r["event_id"],
            "name":             r["name"],
            "event_type":       r["event_type"],
            "description":      r["description"],
            "location":         r["location"],
            "location_url":     r["location_url"],
            "starts_at":        r["starts_at"].isoformat() if r["starts_at"] else None,
            "ends_at":          r["ends_at"].isoformat() if r["ends_at"] else None,
            "capacity":         r["capacity"],
            "check_in_code":    r["check_in_code"],
            "check_in_enabled": r["check_in_enabled"],
            "points_value":     r["points_value"],
            "attendance_count": int(r["attendance_count"]),
        }
        for r in rows
    ]
    return jsonify({"events": events}), 200


@admin_bp.route("/event-types", methods=["GET", "OPTIONS"])
@jwt_required()
def list_event_types():
    if request.method == "OPTIONS":
        return "", 200
    # Officers also need to read event types for the dropdown — allow OFFICER_ROLES
    claims = get_jwt()
    if claims.get("role") not in OFFICER_ROLES:
        return jsonify({"error": "Officer or admin access required"}), 403

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT type_id, name, default_points, color, description, is_active, created_at "
            "FROM event_types ORDER BY name ASC"
        )
        rows = cur.fetchall()

    return jsonify({
        "event_types": [
            {
                "type_id": r["type_id"],
                "name": r["name"],
                "default_points": r["default_points"],
                "color": r["color"],
                "description": r["description"],
                "is_active": r["is_active"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            }
            for r in rows
        ]
    }), 200


@admin_bp.route("/event-types", methods=["POST", "OPTIONS"])
@jwt_required()
def create_event_type():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    default_points = int(data.get("default_points", 10))
    color = (data.get("color") or "#b91c1c").strip()
    description = data.get("description") or None

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO event_types (name, default_points, color, description) VALUES (%s, %s, %s, %s) RETURNING type_id",
            (name, default_points, color, description),
        )
        type_id = cur.fetchone()["type_id"]
        conn.commit()

    return jsonify({"type_id": type_id, "message": "Event type created"}), 201


@admin_bp.route("/event-types/<int:type_id>", methods=["PATCH", "OPTIONS"])
@jwt_required()
def update_event_type(type_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    updates = []
    params = []

    for field in ("name", "color", "description"):
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data[field])
    if "default_points" in data:
        updates.append("default_points = %s")
        params.append(int(data["default_points"]))
    if "is_active" in data:
        updates.append("is_active = %s")
        params.append(bool(data["is_active"]))

    if not updates:
        return jsonify({"error": "Nothing to update"}), 400

    params.append(type_id)
    conn = connect()
    with conn.cursor() as cur:
        cur.execute(f"UPDATE event_types SET {', '.join(updates)} WHERE type_id = %s", params)
        if cur.rowcount == 0:
            return jsonify({"error": "Event type not found"}), 404
        conn.commit()

    return jsonify({"message": "Event type updated"}), 200


@admin_bp.route("/event-types/<int:type_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def delete_event_type(type_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        # Count events using this type
        cur.execute("SELECT COUNT(*) as cnt FROM events WHERE type_id = %s", (type_id,))
        count = cur.fetchone()["cnt"]
        if count > 0:
            return jsonify({"error": f"Cannot delete: {count} event(s) reference this type"}), 409

        cur.execute("UPDATE event_types SET is_active = FALSE WHERE type_id = %s", (type_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "Event type not found"}), 404
        conn.commit()

    return jsonify({"message": "Event type deactivated"}), 200


# ---------------------------------------------------------------------------
# POST /admin/upload-image?category=sponsors|partners
# ---------------------------------------------------------------------------

@admin_bp.route("/upload-image", methods=["POST", "OPTIONS"])
@jwt_required()
def upload_image():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    category = request.args.get("category", "").strip()
    if category not in ALLOWED_CATEGORIES:
        return jsonify({"error": f"category must be one of: {', '.join(sorted(ALLOWED_CATEGORIES))}"}), 400

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]
    if f.mimetype not in ALLOWED_MIME:
        return jsonify({"error": "Only JPEG, PNG, and WebP images are allowed"}), 400

    f.seek(0, 2)
    size = f.tell()
    f.seek(0)
    if size > MAX_UPLOAD_BYTES:
        return jsonify({"error": "File exceeds 5 MB limit"}), 400

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[f.mimetype]
    filename = secure_filename(f"{uuid.uuid4().hex}.{ext}")
    upload_dir = os.path.join(UPLOADS_BASE, category)
    os.makedirs(upload_dir, exist_ok=True)
    f.save(os.path.join(upload_dir, filename))

    url = f"/admin/uploads/{category}/{filename}"
    return jsonify({"url": url}), 200


# ---------------------------------------------------------------------------
# GET /admin/uploads/<category>/<filename>  — serve uploaded images
# ---------------------------------------------------------------------------

@admin_bp.route("/uploads/<category>/<filename>", methods=["GET"])
def serve_upload(category, filename):
    if category not in ALLOWED_CATEGORIES:
        return jsonify({"error": "Not found"}), 404
    upload_dir = os.path.join(UPLOADS_BASE, category)
    return send_from_directory(upload_dir, secure_filename(filename))


# ---------------------------------------------------------------------------
# Sponsors — admin CRUD
# GET  /admin/sponsors
# POST /admin/sponsors
# PATCH /admin/sponsors/<id>
# DELETE /admin/sponsors/<id>
# ---------------------------------------------------------------------------

TIER_ORDER = {"platinum": 0, "gold": 1, "silver": 2, "bronze": 3, "community": 4}
VALID_TIERS = set(TIER_ORDER.keys())


def _sponsor_row(r):
    return {
        "sponsor_id": r["sponsor_id"],
        "name": r["name"],
        "logo_url": r["logo_url"],
        "website": r["website"],
        "tier": r["tier"],
        "description": r["description"],
        "contact_name": r["contact_name"],
        "contact_email": r["contact_email"],
        "is_active": r["is_active"],
        "start_date": r["start_date"].isoformat() if r["start_date"] else None,
        "end_date": r["end_date"].isoformat() if r["end_date"] else None,
        "display_order": r["display_order"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    }


@admin_bp.route("/sponsors", methods=["GET", "OPTIONS"])
@jwt_required()
def admin_list_sponsors():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM sponsors ORDER BY display_order ASC, name ASC"
        )
        rows = cur.fetchall()

    return jsonify({"sponsors": [_sponsor_row(r) for r in rows]}), 200


@admin_bp.route("/sponsors", methods=["POST", "OPTIONS"])
@jwt_required()
def admin_create_sponsor():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    tier = data.get("tier", "community")
    if tier not in VALID_TIERS:
        return jsonify({"error": f"tier must be one of: {', '.join(sorted(VALID_TIERS))}"}), 400

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT sponsor_id FROM sponsors WHERE name = %s", (name,))
        if cur.fetchone():
            return jsonify({"error": f"A sponsor named '{name}' already exists"}), 409

        cur.execute(
            """
            INSERT INTO sponsors
              (name, logo_url, website, tier, description, contact_name, contact_email,
               is_active, start_date, end_date, display_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING sponsor_id
            """,
            (
                name,
                data.get("logo_url") or None,
                data.get("website") or None,
                tier,
                data.get("description") or None,
                data.get("contact_name") or None,
                data.get("contact_email") or None,
                bool(data.get("is_active", True)),
                data.get("start_date") or None,
                data.get("end_date") or None,
                int(data.get("display_order", 0)),
            ),
        )
        sponsor_id = cur.fetchone()["sponsor_id"]
        conn.commit()

    return jsonify({"sponsor_id": sponsor_id, "message": "Sponsor created"}), 201


@admin_bp.route("/sponsors/<int:sponsor_id>", methods=["PATCH", "OPTIONS"])
@jwt_required()
def admin_update_sponsor(sponsor_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    updates = []
    params = []

    for field in ("name", "logo_url", "website", "description", "contact_name", "contact_email"):
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data[field] or None)

    if "tier" in data:
        if data["tier"] not in VALID_TIERS:
            return jsonify({"error": f"tier must be one of: {', '.join(sorted(VALID_TIERS))}"}), 400
        updates.append("tier = %s")
        params.append(data["tier"])

    for field in ("is_active",):
        if field in data:
            updates.append(f"{field} = %s")
            params.append(bool(data[field]))

    for field in ("start_date", "end_date"):
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data[field] or None)

    if "display_order" in data:
        updates.append("display_order = %s")
        params.append(int(data["display_order"]))

    if not updates:
        return jsonify({"error": "Nothing to update"}), 400

    params.append(sponsor_id)
    conn = connect()
    with conn.cursor() as cur:
        if "name" in data and data["name"]:
            new_name = data["name"].strip()
            cur.execute(
                "SELECT sponsor_id FROM sponsors WHERE name = %s AND sponsor_id != %s",
                (new_name, sponsor_id),
            )
            if cur.fetchone():
                return jsonify({"error": f"A sponsor named '{new_name}' already exists"}), 409

        cur.execute(f"UPDATE sponsors SET {', '.join(updates)} WHERE sponsor_id = %s", params)
        if cur.rowcount == 0:
            return jsonify({"error": "Sponsor not found"}), 404
        conn.commit()

    return jsonify({"message": "Sponsor updated"}), 200


@admin_bp.route("/sponsors/<int:sponsor_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def admin_delete_sponsor(sponsor_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM sponsors WHERE sponsor_id = %s", (sponsor_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "Sponsor not found"}), 404
        conn.commit()

    return jsonify({"message": "Sponsor deleted"}), 200


# ---------------------------------------------------------------------------
# Partners — admin CRUD
# GET  /admin/partners
# POST /admin/partners
# PATCH /admin/partners/<id>
# DELETE /admin/partners/<id>
# GET  /admin/partners/<id>/members
# POST /admin/partners/<id>/members
# DELETE /admin/partners/<id>/members/<user_id>
# ---------------------------------------------------------------------------

VALID_PARTNER_TYPES = {"company", "university_org", "nonprofit", "other"}
VALID_PARTNER_ROLES = {"lead", "member", "liaison"}


def _partner_row(r):
    return {
        "partner_id": r["partner_id"],
        "name": r["name"],
        "type": r["type"],
        "logo_url": r["logo_url"],
        "website": r["website"],
        "description": r["description"],
        "contact_name": r["contact_name"],
        "contact_email": r["contact_email"],
        "manager_user_id": r["manager_user_id"],
        "is_active": r["is_active"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        "member_count": r.get("member_count", 0),
    }


@admin_bp.route("/partners", methods=["GET", "OPTIONS"])
@jwt_required()
def admin_list_partners():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.*, COUNT(pm.user_id) as member_count
            FROM partners p
            LEFT JOIN partner_members pm ON pm.partner_id = p.partner_id
            GROUP BY p.partner_id
            ORDER BY p.name ASC
            """
        )
        rows = cur.fetchall()

    return jsonify({"partners": [_partner_row(r) for r in rows]}), 200


@admin_bp.route("/partners", methods=["POST", "OPTIONS"])
@jwt_required()
def admin_create_partner():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    ptype = data.get("type", "other")
    if ptype not in VALID_PARTNER_TYPES:
        return jsonify({"error": f"type must be one of: {', '.join(sorted(VALID_PARTNER_TYPES))}"}), 400

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO partners
              (name, type, logo_url, website, description, contact_name, contact_email,
               manager_user_id, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING partner_id
            """,
            (
                name,
                ptype,
                data.get("logo_url") or None,
                data.get("website") or None,
                data.get("description") or None,
                data.get("contact_name") or None,
                data.get("contact_email") or None,
                data.get("manager_user_id") or None,
                bool(data.get("is_active", True)),
            ),
        )
        partner_id = cur.fetchone()["partner_id"]
        conn.commit()

    return jsonify({"partner_id": partner_id, "message": "Partner created"}), 201


@admin_bp.route("/partners/<int:partner_id>", methods=["PATCH", "OPTIONS"])
@jwt_required()
def admin_update_partner(partner_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    updates = []
    params = []

    for field in ("name", "logo_url", "website", "description", "contact_name", "contact_email"):
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data[field] or None)

    if "type" in data:
        if data["type"] not in VALID_PARTNER_TYPES:
            return jsonify({"error": f"type must be one of: {', '.join(sorted(VALID_PARTNER_TYPES))}"}), 400
        updates.append("type = %s")
        params.append(data["type"])

    if "is_active" in data:
        updates.append("is_active = %s")
        params.append(bool(data["is_active"]))

    if "manager_user_id" in data:
        updates.append("manager_user_id = %s")
        params.append(data["manager_user_id"] or None)

    if not updates:
        return jsonify({"error": "Nothing to update"}), 400

    params.append(partner_id)
    conn = connect()
    with conn.cursor() as cur:
        cur.execute(f"UPDATE partners SET {', '.join(updates)} WHERE partner_id = %s", params)
        if cur.rowcount == 0:
            return jsonify({"error": "Partner not found"}), 404
        conn.commit()

    return jsonify({"message": "Partner updated"}), 200


@admin_bp.route("/partners/<int:partner_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def admin_delete_partner(partner_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM partners WHERE partner_id = %s", (partner_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "Partner not found"}), 404
        conn.commit()

    return jsonify({"message": "Partner deleted"}), 200


@admin_bp.route("/partners/<int:partner_id>/members", methods=["GET", "OPTIONS"])
@jwt_required()
def admin_list_partner_members(partner_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT partner_id FROM partners WHERE partner_id = %s", (partner_id,))
        if not cur.fetchone():
            return jsonify({"error": "Partner not found"}), 404

        cur.execute(
            """
            SELECT pm.user_id, pm.partner_role, pm.joined_at,
                   u.email, p.first_name, p.last_name, p.avatar_url
            FROM partner_members pm
            JOIN users u ON u.user_id = pm.user_id
            LEFT JOIN profile p ON p.user_id = pm.user_id
            WHERE pm.partner_id = %s
            ORDER BY pm.joined_at ASC
            """,
            (partner_id,),
        )
        rows = cur.fetchall()

    members = [
        {
            "user_id": r["user_id"],
            "partner_role": r["partner_role"],
            "joined_at": r["joined_at"].isoformat() if r["joined_at"] else None,
            "email": r["email"],
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "avatar_url": r["avatar_url"],
        }
        for r in rows
    ]
    return jsonify({"members": members}), 200


@admin_bp.route("/partners/<int:partner_id>/members", methods=["POST", "OPTIONS"])
@jwt_required()
def admin_add_partner_member(partner_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    partner_role = data.get("partner_role", "member")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    if partner_role not in VALID_PARTNER_ROLES:
        return jsonify({"error": f"partner_role must be one of: {', '.join(sorted(VALID_PARTNER_ROLES))}"}), 400

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT partner_id FROM partners WHERE partner_id = %s", (partner_id,))
        if not cur.fetchone():
            return jsonify({"error": "Partner not found"}), 404

        cur.execute("SELECT role FROM users WHERE user_id = %s", (user_id,))
        user_row = cur.fetchone()
        if not user_row:
            return jsonify({"error": "User not found"}), 404

        cur.execute(
            """
            INSERT INTO partner_members (partner_id, user_id, partner_role)
            VALUES (%s, %s, %s)
            ON CONFLICT (partner_id, user_id) DO UPDATE SET partner_role = EXCLUDED.partner_role
            """,
            (partner_id, user_id, partner_role),
        )

        # Upgrade role to 'partner' if currently member/non-member
        if user_row["role"] in ("member", "non-member"):
            cur.execute("UPDATE users SET role = 'partner' WHERE user_id = %s", (user_id,))

        conn.commit()

    return jsonify({"message": "Member added to partner"}), 201


@admin_bp.route("/partners/<int:partner_id>/members/<int:user_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def admin_remove_partner_member(partner_id, user_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM partner_members WHERE partner_id = %s AND user_id = %s",
            (partner_id, user_id),
        )
        if cur.rowcount == 0:
            return jsonify({"error": "Member not found in this partner"}), 404

        # Revert role if not in any other partner org
        cur.execute(
            "SELECT COUNT(*) as cnt FROM partner_members WHERE user_id = %s",
            (user_id,),
        )
        remaining = cur.fetchone()["cnt"]
        if remaining == 0:
            # Revert to member or non-member based on active payment
            cur.execute(
                """
                UPDATE users SET role = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM payments pay
                        JOIN profile pr ON pay.student_id = pr.student_id
                        WHERE pr.user_id = %s AND pay.expires_at >= CURRENT_DATE
                    ) THEN 'member'
                    ELSE 'non-member'
                END
                WHERE user_id = %s AND role = 'partner'
                """,
                (user_id, user_id),
            )

        conn.commit()

    return jsonify({"message": "Member removed from partner"}), 200


# ---------------------------------------------------------------------------
# Admin Points — officer+
# GET  /admin/points?user_id=&page=1&limit=50
# POST /admin/points
# GET  /admin/points/summary
# ---------------------------------------------------------------------------

def _require_officer():
    claims = get_jwt()
    if claims.get("role") not in OFFICER_ROLES:
        return jsonify({"error": "Officer or admin access required"}), 403
    return None


@admin_bp.route("/points/summary", methods=["GET", "OPTIONS"])
@jwt_required()
def admin_points_summary():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_officer()
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(SUM(points), 0) as total
            FROM points
            WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
            """
        )
        total_this_month = int(cur.fetchone()["total"])

        cur.execute(
            """
            SELECT p.student_id, pr.first_name, pr.last_name, SUM(p.points) as total
            FROM points p
            LEFT JOIN profile pr ON pr.student_id = p.student_id
            GROUP BY p.student_id, pr.first_name, pr.last_name
            ORDER BY total DESC
            LIMIT 5
            """
        )
        top_earners = [
            {
                "student_id": r["student_id"],
                "first_name": r["first_name"],
                "last_name": r["last_name"],
                "total": int(r["total"]),
            }
            for r in cur.fetchall()
        ]

    return jsonify({
        "total_this_month": total_this_month,
        "top_earners": top_earners,
    }), 200


@admin_bp.route("/points", methods=["GET", "OPTIONS"])
@jwt_required()
def admin_list_points():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_officer()
    if err:
        return err

    page = max(1, request.args.get("page", 1, type=int))
    limit = min(100, max(1, request.args.get("limit", 20, type=int)))
    offset = (page - 1) * limit
    user_id = request.args.get("user_id", type=int)

    conn = connect()
    with conn.cursor() as cur:
        cond = ""
        params: list = []
        if user_id:
            cond = "WHERE p.student_id = (SELECT student_id FROM profile WHERE user_id = %s)"
            params.append(user_id)

        cur.execute(
            f"""
            SELECT COUNT(*) as total FROM points p {cond}
            """,
            params,
        )
        total = cur.fetchone()["total"]

        cur.execute(
            f"""
            SELECT p.points_id, p.student_id, p.event_id, p.date, p.points,
                   COALESCE(p.reason, '') as reason,
                   p.officer_user_id,
                   pr.first_name, pr.last_name,
                   ou.email as officer_email
            FROM points p
            LEFT JOIN profile pr ON pr.student_id = p.student_id
            LEFT JOIN users ou ON ou.user_id = p.officer_user_id
            {cond}
            ORDER BY p.date DESC, p.points_id DESC
            LIMIT %s OFFSET %s
            """,
            params + [limit, offset],
        )
        rows = cur.fetchall()

    records = [
        {
            "points_id": r["points_id"],
            "student_id": r["student_id"],
            "event_id": r["event_id"],
            "date": r["date"].isoformat() if r["date"] else None,
            "points": r["points"],
            "reason": r["reason"],
            "officer_email": r["officer_email"],
            "first_name": r["first_name"],
            "last_name": r["last_name"],
        }
        for r in rows
    ]

    return jsonify({
        "records": records,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),
    }), 200


@admin_bp.route("/points", methods=["POST", "OPTIONS"])
@jwt_required()
def admin_award_points():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_officer()
    if err:
        return err

    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    points_val = data.get("points")
    reason = (data.get("reason") or "").strip()
    event_id = data.get("event_id") or None

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    if points_val is None:
        return jsonify({"error": "points is required"}), 400
    if not reason:
        return jsonify({"error": "reason is required"}), 400

    caller_user_id = int(get_jwt_identity())

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT student_id FROM profile WHERE user_id = %s", (user_id,))
        profile = cur.fetchone()
        if not profile or not profile["student_id"]:
            return jsonify({"error": "User has no linked profile/student_id"}), 400

        student_id = profile["student_id"]

        cur.execute(
            """
            INSERT INTO points (student_id, event_id, date, points, reason, officer_user_id)
            VALUES (%s, %s, CURRENT_DATE, %s, %s, %s)
            RETURNING points_id
            """,
            (student_id, event_id, int(points_val), reason, caller_user_id),
        )
        points_id = cur.fetchone()["points_id"]
        conn.commit()

    return jsonify({"points_id": points_id, "message": "Points awarded"}), 201


# ---------------------------------------------------------------------------
# GET /admin/pinned-announcement
# POST /admin/pinned-announcement
# DELETE /admin/pinned-announcement
# ---------------------------------------------------------------------------

@admin_bp.route("/pinned-announcement", methods=["GET", "OPTIONS"])
@jwt_required()
def get_pinned_announcement():
    if request.method == "OPTIONS":
        return "", 200
    claims = get_jwt()
    if claims.get("role") not in OFFICER_ROLES:
        return jsonify({"error": "Officer access required"}), 403
    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, message, created_at, expires_at, is_active
            FROM pinned_announcements
            WHERE is_active = TRUE
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
            LIMIT 1
            """,
        )
        row = cur.fetchone()
    if not row:
        return jsonify({"announcement": None}), 200
    return jsonify({
        "announcement": {
            "id": row["id"],
            "message": row["message"],
            "created_at": row["created_at"].isoformat(),
            "expires_at": row["expires_at"].isoformat() if row["expires_at"] else None,
        }
    }), 200


@admin_bp.route("/pinned-announcement", methods=["POST"])
@jwt_required()
def set_pinned_announcement():
    claims = get_jwt()
    if claims.get("role") not in OFFICER_ROLES:
        return jsonify({"error": "Officer access required"}), 403
    data = request.get_json() or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400
    expires_at = data.get("expires_at")
    caller_id = get_jwt_identity()
    conn = connect()
    with conn.cursor() as cur:
        cur.execute("UPDATE pinned_announcements SET is_active = FALSE WHERE is_active = TRUE")
        cur.execute(
            """
            INSERT INTO pinned_announcements (message, created_by, expires_at)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (message, caller_id, expires_at or None),
        )
        new_id = cur.fetchone()["id"]
        conn.commit()
    return jsonify({"id": new_id, "message": "Announcement pinned"}), 201


@admin_bp.route("/pinned-announcement", methods=["DELETE"])
@jwt_required()
def delete_pinned_announcement():
    claims = get_jwt()
    if claims.get("role") not in OFFICER_ROLES:
        return jsonify({"error": "Officer access required"}), 403
    conn = connect()
    with conn.cursor() as cur:
        cur.execute("UPDATE pinned_announcements SET is_active = FALSE WHERE is_active = TRUE")
        conn.commit()
    return jsonify({"message": "Announcement removed"}), 200
