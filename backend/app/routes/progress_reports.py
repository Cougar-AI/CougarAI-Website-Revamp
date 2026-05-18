from datetime import date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from app.raw_db import get_db
from app.utils.auth_decorators import require_officer
from app.services.progress_report_service import ProgressReportService

progress_bp = Blueprint("progress", __name__)


def _parse_week_of(value: str | None, fallback: bool = False) -> tuple[date | None, str | None]:
    """Parse and normalise a week_of query/body string to its Monday.

    Returns (week_date, error_message). If fallback=True and value is None,
    returns (today's Monday, None) instead of (None, None).
    """
    if not value:
        if fallback:
            return ProgressReportService._monday_of_week(date.today()), None
        return None, None
    try:
        return ProgressReportService._monday_of_week(date.fromisoformat(value)), None
    except ValueError:
        return None, "Invalid week_of format (use YYYY-MM-DD)"


# ---------------------------------------------------------------------------
# GET /progress-reports/  — all reports; officer+ only
# ---------------------------------------------------------------------------

@progress_bp.route("/", methods=["GET", "OPTIONS"])
@require_officer
def list_reports():
    week_of_str = request.args.get("week_of")
    filter_user_id = request.args.get("user_id", type=int)
    page = max(1, request.args.get("page", 1, type=int))
    limit = min(100, max(1, request.args.get("limit", 20, type=int)))

    week_date, err = _parse_week_of(week_of_str)
    if err:
        return jsonify({"error": err}), 400

    svc = ProgressReportService(get_db())
    reports, total = svc.list_reports(week_date, filter_user_id, page, limit)

    return jsonify({
        "reports": reports,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),
    }), 200


# ---------------------------------------------------------------------------
# GET /progress-reports/mine  — current user's reports
# ---------------------------------------------------------------------------

@progress_bp.route("/mine", methods=["GET", "OPTIONS"])
@require_officer
def my_reports():
    user_id = int(get_jwt_identity())
    svc = ProgressReportService(get_db())
    return jsonify({"reports": svc.my_reports(user_id)}), 200


# ---------------------------------------------------------------------------
# POST /progress-reports/  — submit/upsert for a week
# ---------------------------------------------------------------------------

@progress_bp.route("/", methods=["POST", "OPTIONS"])
@require_officer
def submit_report():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    week_date, err = _parse_week_of(data.get("week_of"))
    if err:
        return jsonify({"error": err}), 400
    if week_date is None:
        return jsonify({"error": "week_of is required"}), 400

    fields = ["summary", "tasks_completed", "tasks_in_progress", "tasks_on_hold",
              "upcoming_tasks", "comments", "feedback", "questions"]
    values = {f: data.get(f) or None for f in fields}

    svc = ProgressReportService(get_db())
    report_id, week_of_str = svc.submit_report(user_id, week_date, values)

    return jsonify({"report_id": report_id, "week_of": week_of_str, "message": "Report saved"}), 200


# ---------------------------------------------------------------------------
# PATCH /progress-reports/<report_id>  — edit own report
# ---------------------------------------------------------------------------

@progress_bp.route("/<int:report_id>", methods=["PATCH", "OPTIONS"])
@require_officer
def update_report(report_id):
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}

    svc = ProgressReportService(get_db())
    success, error, status_code = svc.update_report(report_id, user_id, data)

    if not success:
        return jsonify({"error": error}), status_code

    return jsonify({"message": "Report updated"}), 200


# ---------------------------------------------------------------------------
# GET /progress-reports/status?week_of=<date>  — submission status for all officers
# ---------------------------------------------------------------------------

@progress_bp.route("/status", methods=["GET", "OPTIONS"])
@require_officer
def report_status():
    week_date, err = _parse_week_of(
        request.args.get("week_of"), fallback=True
    )
    if err:
        return jsonify({"error": err}), 400

    svc = ProgressReportService(get_db())
    return jsonify(svc.report_status(week_date)), 200
