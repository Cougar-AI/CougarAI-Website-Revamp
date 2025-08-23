import smtplib
from email.message import EmailMessage
from flask import current_app

def send_email(to_email: str, subject: str, text_body: str, html_body: str | None = None):
    backend = (current_app.config.get("MAILER_BACKEND") or "smtp").lower()
    if backend == "console":
        current_app.logger.info("=== CONSOLE MAIL ===\nTo: %s\nSubject: %s\n\n%s", to_email, subject, text_body)
        return

    host = current_app.config["SMTP_HOST"]
    port = current_app.config["SMTP_PORT"]
    user = current_app.config.get("SMTP_USER") or None
    password = current_app.config.get("SMTP_PASSWORD") or None
    use_tls = bool(current_app.config.get("SMTP_USE_TLS", True))

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = user or "no-reply@example.com"
    msg["To"] = to_email
    if html_body:
        msg.set_content(text_body)
        msg.add_alternative(html_body, subtype="html")
    else:
        msg.set_content(text_body)

    with smtplib.SMTP(host, port) as smtp:
        if use_tls:
            smtp.starttls()
        if user and password:
            smtp.login(user, password)
        smtp.send_message(msg)