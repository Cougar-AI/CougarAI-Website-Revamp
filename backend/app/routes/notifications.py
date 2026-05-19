from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from app.raw_db import get_db
from app.utils.auth_decorators import require_admin, require_authenticated
from app.services.notification_service import NotificationService

notifications_bp = Blueprint("notifications", __name__)

_VALID_TYPES = {"progress_report_reminder", "event_reminder"}


def _reload():
    from app.services.notification_scheduler import reload_schedules
    from flask import current_app
    try:
        reload_schedules(current_app._get_current_object())
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Admin: schedule CRUD
# ---------------------------------------------------------------------------

@notifications_bp.route("/schedules", methods=["GET", "OPTIONS"])
@require_admin
def list_schedules():
    svc = NotificationService(get_db())
    return jsonify({"schedules": svc.list_schedules()})


@notifications_bp.route("/schedules", methods=["POST"])
@require_admin
def create_schedule():
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    stype = data.get("type")
    if not name:
        return jsonify({"error": "name is required"}), 400
    if stype not in _VALID_TYPES:
        return jsonify({"error": f"type must be one of: {', '.join(_VALID_TYPES)}"}), 400

    data["name"] = name
    svc = NotificationService(get_db())
    schedule_id, error = svc.create_schedule(data)
    if error:
        return jsonify({"error": error}), 500

    _reload()
    return jsonify({"schedule_id": schedule_id}), 201


@notifications_bp.route("/schedules/<int:schedule_id>", methods=["PATCH", "OPTIONS"])
@require_admin
def update_schedule(schedule_id):
    data = request.get_json() or {}
    allowed = ("name", "is_active", "send_email", "send_in_app",
               "cron_day_of_week", "cron_hour", "cron_minute",
               "hours_before", "target_roles", "subject", "body_template")
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        return jsonify({"error": "No valid fields"}), 400

    svc = NotificationService(get_db())
    success, error = svc.update_schedule(schedule_id, updates)
    if not success:
        status = 404 if error == "Schedule not found" else 500
        return jsonify({"error": error}), status

    _reload()
    return jsonify({"success": True})


@notifications_bp.route("/schedules/<int:schedule_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def delete_schedule(schedule_id):
    svc = NotificationService(get_db())
    success, error = svc.delete_schedule(schedule_id)
    if not success:
        status = 404 if error == "Schedule not found" else 500
        return jsonify({"error": error}), status

    _reload()
    return jsonify({"success": True})


@notifications_bp.route("/schedules/<int:schedule_id>/test", methods=["POST", "OPTIONS"])
@require_admin
def test_schedule(schedule_id):
    svc = NotificationService(get_db())
    row = svc.get_schedule(schedule_id)
    if not row:
        return jsonify({"error": "Schedule not found"}), 404

    from flask import current_app
    from app.services.notification_scheduler import _send_progress_report_reminder, _send_event_reminders
    app = current_app._get_current_object()

    try:
        if row["type"] == "progress_report_reminder":
            _send_progress_report_reminder(app, schedule_id)
        elif row["type"] == "event_reminder":
            _send_event_reminders(app, schedule_id, row["hours_before"] or 2, row["target_roles"] or ["officer", "admin"])
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    return jsonify({"success": True, "message": "Test notification sent (check logs)"})


@notifications_bp.route("/logs", methods=["GET", "OPTIONS"])
@require_admin
def list_logs():
    svc = NotificationService(get_db())
    return jsonify({"logs": svc.list_logs()})


# ---------------------------------------------------------------------------
# User-facing: in-app notification inbox (any authenticated user)
# ---------------------------------------------------------------------------

@notifications_bp.route("/user", methods=["GET", "OPTIONS"])
@require_authenticated
def get_user_notifications():
    user_id = int(get_jwt_identity())
    svc = NotificationService(get_db())
    return jsonify({"notifications": svc.get_user_notifications(user_id)})


@notifications_bp.route("/user/<int:notification_id>/read", methods=["PATCH", "OPTIONS"])
@require_authenticated
def mark_notification_read(notification_id):
    user_id = int(get_jwt_identity())
    svc = NotificationService(get_db())
    svc.mark_notification_read(notification_id, user_id)
    return jsonify({"success": True})


@notifications_bp.route("/user/read-all", methods=["POST", "OPTIONS"])
@require_authenticated
def mark_all_read():
    user_id = int(get_jwt_identity())
    svc = NotificationService(get_db())
    svc.mark_all_read(user_id)
    return jsonify({"success": True})


@notifications_bp.route("/user/clear", methods=["DELETE", "OPTIONS"])
@require_authenticated
def clear_read_notifications():
    user_id = int(get_jwt_identity())
    svc = NotificationService(get_db())
    svc.clear_read_notifications(user_id)
    return jsonify({"success": True})
