from datetime import timedelta, datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import text
from flask_jwt_extended import create_access_token
from flask_jwt_extended.utils import decode_token
from app import db
from app.utils.passwords import validate_password, hash_password
from app.services.mailer import send_email

auth_bp = Blueprint("auth", __name__)

# Helper: build the verification URL shown to users
def _build_verify_link(token: str) -> str:
    fe = current_app.config["FRONTEND_URL"].rstrip("/")
    # Frontend will POST the token to /auth/verify-email; this link just lands them on the FE screen
    return f"{fe}/verify-email?token={token}"

# === POST /auth/register ======================================================
@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Request Body: { "email": "user@example.com", "password": "Secret@123" }
    Always returns: 201 { "ok": true } on success (idempotent).
    Fails password policy: 422 with { field_errors: { password: [...] } }
    """
    data = request.get_json(silent=True) or {}
    email_raw = (data.get("email") or "").strip()
    password = data.get("password") or ""

    # Basic input guardrails
    if not email_raw:
        return jsonify({"ok": False, "field_errors": {"email": ["Email is required."]}}), 422

    # Password policy
    pw_errors = validate_password(password)
    if pw_errors:
        return jsonify({"ok": False, "field_errors": {"password": pw_errors}}), 422

    # Store as given; uniqueness & case-insensitivity handled by citext unique index
    password_hash = hash_password(password)

    # Insert user if not exists (idempotent)
    # Keep email_verified_at NULL initially
    insert_sql = text("""
        INSERT INTO users (email, password_hash)
        VALUES (:email, :password_hash)
        ON CONFLICT (email) DO NOTHING
        RETURNING user_id
    """)

    # We want to always send a verification email (even if account already exists),
    # without leaking user enumeration via responses.
    with db.engine.begin() as conn:
        res = conn.execute(insert_sql, {"email": email_raw, "password_hash": password_hash})
        # Lookup user info (for completeness; also handles existing)
        row = conn.execute(text("SELECT user_id, email_verified_at FROM users WHERE email = :email"),
                           {"email": email_raw}).mappings().first()

    # Make email verification JWT
    expires = timedelta(hours=24)
    token = create_access_token(
        identity=email_raw,
        additional_claims={"type": "verify_email"},
        expires_delta=expires,
        fresh=False,
    )

    # Email contents
    verify_url = _build_verify_link(token)
    subject = "Verify your email"
    text_body = (
        "Welcome!\n\n"
        "Please verify your email address by opening this link:\n\n"
        f"{verify_url}\n\n"
        "If the button/link doesn't work, copy the token below and paste it into the app:\n\n"
        f"{token}\n\n"
        "This link expires in 24 hours."
    )
    html_body = f"""
        <p>Welcome!</p>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="{verify_url}">Verify Email</a></p>
        <p>If that doesn't work, copy this token into the app:</p>
        <pre style="white-space: pre-wrap; word-break: break-all;">{token}</pre>
        <p><small>This link expires in 24 hours.</small></p>
    """

    # Try to send; never leak success/failure to the client (idempotent/generic response)
    try:
        send_email(email_raw, subject, text_body, html_body=html_body)
    except Exception as e:
        current_app.logger.error("Email send failed for %s: %r", email_raw, e)

    # Always generic success (201)
    return jsonify({"ok": True}), 201


# === POST /auth/verify-email ==================================================
@auth_bp.route("/verify-email", methods=["POST"])
def verify_email():
    """
    Request Body: { "token": "<verify_email_jwt>" }
    Responses:
      200 { "ok": true }                 -> marked verified (or already verified treated explicitly)
      401 { "error": "invalid_or_expired_token" }
      400 { "error": "user_not_found" }
      409 { "error": "already_verified" }
    """
    data = request.get_json(silent=True) or {}
    token = data.get("token")
    if not token:
        return jsonify({"error": "token_required"}), 400

    # Decode & validate token
    try:
        decoded = decode_token(token, allow_expired=False)
    except Exception:
        return jsonify({"error": "invalid_or_expired_token"}), 401

    # Ensure correct token type
    if decoded.get("type") != "verify_email":
        return jsonify({"error": "invalid_token_type"}), 401

    email = decoded.get("sub") or decoded.get("identity")
    if not email:
        return jsonify({"error": "invalid_token"}), 401

    # Attempt to mark verified
    with db.engine.begin() as conn:
        user = conn.execute(
            text("SELECT user_id, email_verified_at FROM users WHERE email = :email"),
            {"email": email}
        ).mappings().first()

        if not user:
            return jsonify({"error": "user_not_found"}), 400

        if user["email_verified_at"] is not None:
            return jsonify({"error": "already_verified"}), 409

        # Mark as verified
        conn.execute(
            text("UPDATE users SET email_verified_at = NOW() WHERE user_id = :uid"),
            {"uid": user["user_id"]}
        )

    return jsonify({"ok": True}), 200