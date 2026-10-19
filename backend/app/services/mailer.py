import smtplib
from contextlib import contextmanager
from email.message import EmailMessage
from typing import Optional
from flask import current_app

SMTP_TIMEOUT = 30  # seconds per socket operation; without it a stalled server hangs the caller forever


def _console_backend() -> bool:
    return (current_app.config.get("MAILER_BACKEND") or "smtp").lower() == "console"


def smtp_configured() -> bool:
    host = (current_app.config.get("SMTP_HOST") or "").strip()
    return bool(host) and host != "localhost"


@contextmanager
def smtp_session():
    """One connected, logged-in SMTP session to reuse across many sends.

    Yields None for the console backend or when SMTP is unconfigured — send_email handles those itself.
    """
    if _console_backend() or not smtp_configured():
        yield None
        return
    cfg = current_app.config
    user = cfg.get("SMTP_USER") or None
    password = cfg.get("SMTP_PASSWORD") or None
    with smtplib.SMTP(cfg["SMTP_HOST"].strip(), cfg["SMTP_PORT"], timeout=SMTP_TIMEOUT) as smtp:
        if cfg.get("SMTP_USE_TLS", True):
            smtp.starttls()
        if user and password:
            smtp.login(user, password)
        yield smtp


def send_email(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: Optional[str] = None,
    attachments=None,
    smtp=None,
) -> bool:
    """Send one email. Returns False when it was skipped because SMTP is not configured.

    attachments: list of (filename, mimetype, bytes). smtp: an open session from smtp_session().
    """
    attachments = attachments or []
    if _console_backend():
        current_app.logger.info(
            "=== CONSOLE MAIL ===\nTo: %s\nSubject: %s\nAttachments: %s\n\n%s",
            to_email, subject, [a[0] for a in attachments], text_body,
        )
        return True

    if not smtp_configured():
        current_app.logger.warning("send_email skipped — SMTP_HOST not configured (to=%s subject=%s)", to_email, subject)
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = current_app.config.get("SMTP_USER") or "no-reply@example.com"
    msg["To"] = to_email
    msg.set_content(text_body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")
    for filename, mimetype, data in attachments:
        maintype, subtype = mimetype.split("/", 1)
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)

    if smtp is not None:
        smtp.send_message(msg)
    else:
        with smtp_session() as session:
            session.send_message(msg)
    return True
