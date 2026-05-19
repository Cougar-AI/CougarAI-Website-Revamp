from __future__ import annotations

from flask import request, jsonify
from sqlalchemy import text

from app import db
from app.routes.admin import admin_bp
from app.utils.auth_decorators import require_admin, caller_id
from app.services.mailer import send_email

_RECIPIENT_FILTERS = {
    "all":      "is_active = TRUE",
    "members":  "is_active = TRUE AND role IN ('member', 'officer', 'admin')",
    "officers": "is_active = TRUE AND role IN ('officer', 'admin')",
    "admins":   "is_active = TRUE AND role = 'admin'",
}


@admin_bp.get("/bulk-email/logs")
@require_admin
def bulk_email_logs():
    if request.method == "OPTIONS":
        return "", 200
    with db.engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT log_id, subject, recipient_filter, recipients_count,
                       status, error_message, sent_at,
                       sent_by
                FROM bulk_email_logs
                ORDER BY sent_at DESC
                LIMIT 50
            """)
        ).mappings().all()
    return jsonify([dict(r) for r in rows]), 200


@admin_bp.post("/bulk-email/send")
@require_admin
def bulk_email_send():
    data = request.get_json(silent=True) or {}
    subject = (data.get("subject") or "").strip()
    body = (data.get("body") or "").strip()
    recipient_filter = (data.get("recipient_filter") or "").strip()

    if not subject:
        return jsonify({"error": "subject_required"}), 422
    if not body:
        return jsonify({"error": "body_required"}), 422
    if recipient_filter not in _RECIPIENT_FILTERS:
        return jsonify({"error": "invalid_recipient_filter", "valid": list(_RECIPIENT_FILTERS)}), 422

    where = _RECIPIENT_FILTERS[recipient_filter]

    with db.engine.connect() as conn:
        rows = conn.execute(
            text(f"SELECT user_id, email FROM users WHERE {where} AND email IS NOT NULL")
        ).mappings().all()

    emails = [r["email"] for r in rows]
    sent_count = 0
    errors = []

    for address in emails:
        try:
            send_email(address, subject, body)
            sent_count += 1
        except Exception as exc:
            errors.append(str(exc))

    status = "sent" if not errors else ("partial" if sent_count else "failed")
    error_message = "; ".join(errors[:5]) if errors else None

    sender_id = caller_id()

    with db.engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO bulk_email_logs
                  (subject, recipient_filter, recipients_count, sent_by, status, error_message)
                VALUES (:subject, :filter, :count, :sent_by, :status, :error)
            """),
            {
                "subject": subject,
                "filter": recipient_filter,
                "count": sent_count,
                "sent_by": sender_id,
                "status": status,
                "error": error_message,
            },
        )

    return jsonify({
        "ok": True,
        "recipients_count": sent_count,
        "status": status,
    }), 200
