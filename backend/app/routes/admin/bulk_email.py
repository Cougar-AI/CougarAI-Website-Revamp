from __future__ import annotations

import os
import re
import smtplib
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack

from flask import current_app, request, jsonify
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from werkzeug.utils import secure_filename

from app import db
from app.routes.admin import admin_bp
from app.utils.auth_decorators import require_admin, caller_id
from app.services.mailer import send_email, smtp_session, smtp_configured

_RECIPIENT_FILTERS = {
    "all":      "is_active = TRUE",
    "members":  "is_active = TRUE AND role IN ('member', 'officer', 'admin')",
    "officers": "is_active = TRUE AND role IN ('officer', 'admin')",
    "admins":   "is_active = TRUE AND role = 'admin'",
}

MAX_ATTACHMENTS = 10
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
MAX_ATTACHMENTS_TOTAL = 18 * 1024 * 1024  # stays under MAX_CONTENT_LENGTH (20 MB) and Gmail's 25 MB message cap
PROGRESS_EVERY = 10  # sends between progress/heartbeat writes
STALE_AFTER = "10 minutes"  # a 'sending' row with no heartbeat this long belongs to a dead worker

_ZIP = (b"PK\x03\x04",)
# extension -> (mimetype the browser must declare, accepted leading bytes)
_ATTACHMENT_TYPES = {
    ".pdf":  ("application/pdf", (b"%PDF-",)),
    ".png":  ("image/png", (b"\x89PNG\r\n\x1a\n",)),
    ".jpg":  ("image/jpeg", (b"\xff\xd8\xff",)),
    ".jpeg": ("image/jpeg", (b"\xff\xd8\xff",)),
    ".gif":  ("image/gif", (b"GIF87a", b"GIF89a")),
    ".webp": ("image/webp", (b"RIFF",)),  # plus "WEBP" at offset 8, checked below
    ".docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", _ZIP),
    ".pptx": ("application/vnd.openxmlformats-officedocument.presentationml.presentation", _ZIP),
}

_HTML_TAG = re.compile(r"<[a-zA-Z/][^>]*>")

# One send at a time per process; the DB index enforces one at a time across all gunicorn workers.
# Tests swap this for an executor that runs the job inline.
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="bulk-email")


def _expire_stale(conn) -> None:
    conn.execute(text(f"""
        UPDATE bulk_email_logs
           SET status = 'interrupted',
               error_message = COALESCE(error_message, 'Send stopped (server restarted?) — check the sent count before re-sending')
         WHERE status = 'sending'
           AND COALESCE(heartbeat_at, sent_at) < NOW() - INTERVAL '{STALE_AFTER}'
    """))


def _read_attachments(files):
    """Validate uploaded files. Returns (attachments, error_message)."""
    if len(files) > MAX_ATTACHMENTS:
        return None, f"At most {MAX_ATTACHMENTS} attachments are allowed"
    attachments, total = [], 0
    for i, f in enumerate(files, 1):
        raw_name = f.filename or ""
        ext = os.path.splitext(raw_name.lower())[1]
        expected = _ATTACHMENT_TYPES.get(ext)
        if not expected or f.mimetype != expected[0]:
            return None, f"{raw_name}: only PDF, PNG, JPG, WEBP, GIF, DOCX and PPTX files are allowed"
        data = f.read(MAX_ATTACHMENT_BYTES + 1)
        if len(data) > MAX_ATTACHMENT_BYTES:
            return None, f"{raw_name}: exceeds the 10 MB per-file limit"
        total += len(data)
        if total > MAX_ATTACHMENTS_TOTAL:
            return None, "Attachments exceed the 18 MB total limit"
        if not data.startswith(expected[1]) or (ext == ".webp" and data[8:12] != b"WEBP"):
            return None, f"{raw_name}: file contents do not match its type"
        name = secure_filename(raw_name)
        if not name.lower().endswith(ext):  # secure_filename drops non-ASCII names entirely
            name = f"attachment-{i}{ext}"
        attachments.append((name, expected[0], data))
    return attachments, None


def _update_log(log_id, **fields):
    sets = ", ".join(f"{k} = :{k}" for k in fields)
    with db.engine.begin() as conn:
        conn.execute(
            text(f"UPDATE bulk_email_logs SET {sets}, heartbeat_at = NOW() WHERE log_id = :log_id"),
            {**fields, "log_id": log_id},
        )


def _run_send(app, log_id, emails, subject, text_body, html_body, attachments):
    with app.app_context():
        sent, errors = 0, []
        try:
            if (app.config.get("MAILER_BACKEND") or "smtp").lower() != "console" and not smtp_configured():
                _update_log(log_id, status="skipped_unconfigured",
                            error_message="SMTP is not configured on the server — nothing was sent")
                return
            with ExitStack() as stack:
                smtp = stack.enter_context(smtp_session())
                reconnected = False
                for i, address in enumerate(emails, 1):
                    try:
                        try:
                            send_email(address, subject, text_body, html_body, attachments, smtp=smtp)
                        except smtplib.SMTPServerDisconnected:
                            # Long lists outlive some servers' session limits: reconnect once, then give up.
                            if reconnected:
                                raise
                            reconnected = True
                            stack.close()
                            smtp = stack.enter_context(smtp_session())
                            send_email(address, subject, text_body, html_body, attachments, smtp=smtp)
                        sent += 1
                    except smtplib.SMTPServerDisconnected as exc:
                        errors.append(f"Connection lost after {sent} sends: {exc}")
                        break
                    except Exception as exc:
                        errors.append(f"{address}: {exc}")
                    if i % PROGRESS_EVERY == 0:
                        _update_log(log_id, recipients_count=sent)
        except Exception as exc:
            current_app.logger.exception("bulk email %s failed", log_id)
            errors.append(str(exc))
        status = "sent" if not errors else ("partial" if sent else "failed")
        _update_log(log_id, recipients_count=sent, status=status,
                    error_message="; ".join(errors[:5]) if errors else None)


@admin_bp.get("/bulk-email/logs")
@require_admin
def bulk_email_logs():
    if request.method == "OPTIONS":
        return "", 200
    with db.engine.begin() as conn:
        _expire_stale(conn)
        rows = conn.execute(
            text("""
                SELECT log_id, subject, recipient_filter, recipients_count, recipients_total,
                       attachment_names, status, error_message, sent_at,
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
    if request.mimetype == "multipart/form-data":
        data = request.form
        files = [f for f in request.files.getlist("attachments") if f.filename]
    else:
        data = request.get_json(silent=True) or {}
        files = []
    subject = (data.get("subject") or "").strip()
    body = (data.get("body") or "").strip()
    recipient_filter = (data.get("recipient_filter") or "").strip()

    if not subject:
        return jsonify({"error": "subject_required"}), 422
    if not body:
        return jsonify({"error": "body_required"}), 422
    if recipient_filter not in _RECIPIENT_FILTERS:
        return jsonify({"error": "invalid_recipient_filter", "valid": list(_RECIPIENT_FILTERS)}), 422

    attachments, error = _read_attachments(files)
    if error:
        return jsonify({"error": error}), 422

    # The hint promises HTML support: add an HTML part only when the body actually has tags.
    html_body = None
    if _HTML_TAG.search(body):
        html_body = f'<div style="white-space:pre-wrap">{body}</div>'
        text_body = _HTML_TAG.sub("", body)
    else:
        text_body = body

    where = _RECIPIENT_FILTERS[recipient_filter]
    try:
        with db.engine.begin() as conn:
            emails = [r["email"] for r in conn.execute(
                text(f"SELECT email FROM users WHERE {where} AND email IS NOT NULL")
            ).mappings()]
            _expire_stale(conn)
            # The partial unique index allows one 'sending' row: a second concurrent send fails here.
            log_id = conn.execute(
                text("""
                    INSERT INTO bulk_email_logs
                      (subject, recipient_filter, recipients_count, recipients_total, attachment_names,
                       sent_by, status, heartbeat_at)
                    VALUES (:subject, :filter, 0, :total, :names, :sent_by, 'sending', NOW())
                    RETURNING log_id
                """),
                {
                    "subject": subject,
                    "filter": recipient_filter,
                    "total": len(emails),
                    "names": [a[0] for a in attachments],
                    "sent_by": caller_id(),
                },
            ).scalar_one()
    except IntegrityError as exc:
        if getattr(exc.orig, "pgcode", None) != "23505":
            raise
        return jsonify({"error": "Another bulk email is still sending — wait for it to finish"}), 409

    _executor.submit(_run_send, current_app._get_current_object(), log_id, emails,
                     subject, text_body, html_body, attachments)
    return jsonify({"log_id": log_id, "recipients_total": len(emails)}), 202
