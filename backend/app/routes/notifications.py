from app.imports import *
from app.raw_db import connect
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import datetime, timezone

notifications_bp = Blueprint("notifications", __name__)

_ADMIN_ROLES = {"admin"}
_VALID_TYPES = {"progress_report_reminder", "event_reminder"}
_VALID_DOW = set(range(7))  # 0=Mon … 6=Sun


def _is_admin(claims):
    return claims.get("role") in _ADMIN_ROLES


def _require_admin():
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({"error": "Admin access required"}), 403
    return None


def _reload():
    from app.services.notification_scheduler import reload_schedules
    from flask import current_app
    try:
        reload_schedules(current_app._get_current_object())
    except Exception:
        pass


def _row_to_dict(row):
    return {
        "schedule_id": row["schedule_id"],
        "name": row["name"],
        "type": row["type"],
        "is_active": row["is_active"],
        "send_email": row["send_email"],
        "send_in_app": row["send_in_app"],
        "cron_day_of_week": row["cron_day_of_week"],
        "cron_hour": row["cron_hour"],
        "cron_minute": row["cron_minute"],
        "hours_before": row["hours_before"],
        "target_roles": row["target_roles"] or [],
        "subject": row["subject"],
        "body_template": row["body_template"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


# ---------------------------------------------------------------------------
# Admin: schedule CRUD
# ---------------------------------------------------------------------------

@notifications_bp.route("/schedules", methods=["GET", "OPTIONS"])
@jwt_required()
def list_schedules():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT ns.*,
                  (SELECT sent_at FROM notification_logs nl
                   WHERE nl.schedule_id = ns.schedule_id
                   ORDER BY nl.sent_at DESC LIMIT 1) AS last_sent,
                  (SELECT status FROM notification_logs nl
                   WHERE nl.schedule_id = ns.schedule_id
                   ORDER BY nl.sent_at DESC LIMIT 1) AS last_status
                FROM notification_schedules ns
                ORDER BY ns.created_at DESC
            """)
            schedules = []
            for row in cur.fetchall():
                d = _row_to_dict(row)
                d["last_sent"] = row["last_sent"].isoformat() if row.get("last_sent") else None
                d["last_status"] = row.get("last_status")
                schedules.append(d)
        return jsonify({"schedules": schedules})
    finally:
        conn.close()


@notifications_bp.route("/schedules", methods=["POST"])
@jwt_required()
def create_schedule():
    err = _require_admin()
    if err:
        return err
    data = request.get_json() or {}

    name = (data.get("name") or "").strip()
    stype = data.get("type")
    if not name:
        return jsonify({"error": "name is required"}), 400
    if stype not in _VALID_TYPES:
        return jsonify({"error": f"type must be one of: {', '.join(_VALID_TYPES)}"}), 400

    target_roles = data.get("target_roles") or ["officer", "admin"]

    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO notification_schedules
                   (name, type, is_active, send_email, send_in_app,
                    cron_day_of_week, cron_hour, cron_minute,
                    hours_before, target_roles, subject, body_template)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING schedule_id""",
                (
                    name,
                    stype,
                    data.get("is_active", True),
                    data.get("send_email", False),
                    data.get("send_in_app", True),
                    data.get("cron_day_of_week"),
                    data.get("cron_hour", 9),
                    data.get("cron_minute", 0),
                    data.get("hours_before"),
                    target_roles,
                    data.get("subject"),
                    data.get("body_template"),
                ),
            )
            schedule_id = cur.fetchone()["schedule_id"]
        conn.commit()
    finally:
        conn.close()

    _reload()
    return jsonify({"schedule_id": schedule_id}), 201


@notifications_bp.route("/schedules/<int:schedule_id>", methods=["PATCH", "OPTIONS"])
@jwt_required()
def update_schedule(schedule_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err
    data = request.get_json() or {}
    allowed = ("name", "is_active", "send_email", "send_in_app",
               "cron_day_of_week", "cron_hour", "cron_minute",
               "hours_before", "target_roles", "subject", "body_template")
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        return jsonify({"error": "No valid fields"}), 400

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    set_clause = ", ".join(f"{k} = %s" for k in updates)

    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE notification_schedules SET {set_clause} WHERE schedule_id = %s",
                (*updates.values(), schedule_id),
            )
            if cur.rowcount == 0:
                return jsonify({"error": "Schedule not found"}), 404
        conn.commit()
    finally:
        conn.close()

    _reload()
    return jsonify({"success": True})


@notifications_bp.route("/schedules/<int:schedule_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def delete_schedule(schedule_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM notification_schedules WHERE schedule_id = %s", (schedule_id,))
            if cur.rowcount == 0:
                return jsonify({"error": "Schedule not found"}), 404
        conn.commit()
    finally:
        conn.close()

    _reload()
    return jsonify({"success": True})


@notifications_bp.route("/schedules/<int:schedule_id>/test", methods=["POST", "OPTIONS"])
@jwt_required()
def test_schedule(schedule_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT type, hours_before, target_roles FROM notification_schedules WHERE schedule_id = %s",
                (schedule_id,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

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
@jwt_required()
def list_logs():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT nl.log_id, nl.schedule_id, nl.sent_at, nl.recipients_count,
                       nl.status, nl.error_message, ns.name AS schedule_name
                FROM notification_logs nl
                LEFT JOIN notification_schedules ns ON ns.schedule_id = nl.schedule_id
                ORDER BY nl.sent_at DESC
                LIMIT 50
            """)
            logs = []
            for row in cur.fetchall():
                logs.append({
                    "log_id": row["log_id"],
                    "schedule_id": row["schedule_id"],
                    "schedule_name": row["schedule_name"],
                    "sent_at": row["sent_at"].isoformat() if row["sent_at"] else None,
                    "recipients_count": row["recipients_count"],
                    "status": row["status"],
                    "error_message": row["error_message"],
                })
        return jsonify({"logs": logs})
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# User-facing: in-app notification inbox (any authenticated user)
# ---------------------------------------------------------------------------

@notifications_bp.route("/user", methods=["GET", "OPTIONS"])
@jwt_required()
def get_user_notifications():
    if request.method == "OPTIONS":
        return "", 200
    user_id = int(get_jwt_identity())
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT notification_id, title, body, is_read, created_at, schedule_id
                   FROM user_notifications
                   WHERE user_id = %s
                   ORDER BY created_at DESC
                   LIMIT 30""",
                (user_id,),
            )
            notifications = [
                {
                    "notification_id": r["notification_id"],
                    "title": r["title"],
                    "body": r["body"],
                    "is_read": r["is_read"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    "schedule_id": r["schedule_id"],
                }
                for r in cur.fetchall()
            ]
        return jsonify({"notifications": notifications})
    finally:
        conn.close()


@notifications_bp.route("/user/<int:notification_id>/read", methods=["PATCH", "OPTIONS"])
@jwt_required()
def mark_notification_read(notification_id):
    if request.method == "OPTIONS":
        return "", 200
    user_id = int(get_jwt_identity())
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE user_notifications SET is_read = TRUE WHERE notification_id = %s AND user_id = %s",
                (notification_id, user_id),
            )
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True})


@notifications_bp.route("/user/read-all", methods=["POST", "OPTIONS"])
@jwt_required()
def mark_all_read():
    if request.method == "OPTIONS":
        return "", 200
    user_id = int(get_jwt_identity())
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE user_notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE",
                (user_id,),
            )
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True})


@notifications_bp.route("/user/clear", methods=["DELETE", "OPTIONS"])
@jwt_required()
def clear_read_notifications():
    if request.method == "OPTIONS":
        return "", 200
    user_id = int(get_jwt_identity())
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM user_notifications WHERE user_id = %s AND is_read = TRUE",
                (user_id,),
            )
        conn.commit()
    finally:
        conn.close()
    return jsonify({"success": True})
