from __future__ import annotations
import time

from flask import request, jsonify, current_app, make_response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import db
from app.routes.auth import auth_bp
from app.routes.auth._helpers import (
    _jwt_decode, _sha256, _utcnow,
    _issue_access_jwt, _issue_refresh_jwt_and_persist,
    _delete_refresh_by_jti,
    _send_verify_email, _send_reset_email,
    _build_auth_response, _set_refresh_cookie, _clear_refresh_cookie,
)
from app.utils.passwords import validate_password, hash_password, verify_password
from app.utils.auth_decorators import require_authenticated, caller_id


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email_raw = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not email_raw:
        return jsonify({"ok": False, "field_errors": {"email": ["Email is required."]}}), 422

    pw_errors = validate_password(password)
    if pw_errors:
        return jsonify({"ok": False, "field_errors": {"password": pw_errors}}), 422

    password_hash = hash_password(password)

    with db.engine.begin() as conn:
        row = conn.execute(
            text("""
                INSERT INTO users (email, password_hash)
                VALUES (:email, :hash)
                ON CONFLICT (email) DO NOTHING
                RETURNING user_id, email
            """),
            {"email": email_raw, "hash": password_hash}
        ).mappings().first()

        if not row:
            row = conn.execute(
                text("SELECT user_id, email, email_verified_at FROM users WHERE email = :email"),
                {"email": email_raw}
            ).mappings().first()

    try:
        _send_verify_email(row["user_id"], email_raw)
    except Exception as e:
        current_app.logger.error("Send verify mail failed for %s: %r", email_raw, e)

    return jsonify({"ok": True}), 201


@auth_bp.post("/verify-email")
def verify_email():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    if not token:
        return jsonify({"error": "token_required"}), 400

    try:
        claims = _jwt_decode(token, current_app.config["JWT_EMAIL_SECRET"])
    except Exception:
        return jsonify({"error": "invalid_or_expired_token"}), 401

    if claims.get("typ") != "verify_email":
        return jsonify({"error": "invalid_token_type"}), 401

    user_id = int(claims.get("sub") or 0)
    if not user_id:
        return jsonify({"error": "invalid_or_expired_token"}), 401

    with db.engine.begin() as conn:
        user = conn.execute(
            text("SELECT user_id, email_verified_at FROM users WHERE user_id = :uid"),
            {"uid": user_id}
        ).mappings().first()
        if not user:
            return jsonify({"error": "user_not_found"}), 400
        if user["email_verified_at"] is not None:
            return jsonify({"error": "already_verified"}), 409
        conn.execute(
            text("UPDATE users SET email_verified_at = NOW() WHERE user_id = :uid"),
            {"uid": user_id}
        )

    return jsonify({"ok": True}), 200


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "invalid_credentials"}), 401

    with db.engine.begin() as conn:
        user = conn.execute(
            text("""
                SELECT user_id, email, password_hash, email_verified_at, is_active,
                       role, onboarding_completed_at
                FROM users WHERE email = :email
            """),
            {"email": email}
        ).mappings().first()

    if not user or not user["password_hash"] or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "invalid_credentials"}), 401

    if user["email_verified_at"] is None or not user["is_active"]:
        return jsonify({"error": "invalid_credentials"}), 401

    return _build_auth_response(
        user["user_id"], user["email"],
        role=user["role"],
        onboarding_completed=user["onboarding_completed_at"] is not None,
    )


@auth_bp.post("/resend-verification")
def resend_verification():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    if not email:
        return jsonify({"ok": True}), 200

    try:
        with db.engine.begin() as conn:
            user = conn.execute(
                text("SELECT user_id, email_verified_at FROM users WHERE email = :email"),
                {"email": email}
            ).mappings().first()
        if user and user["email_verified_at"] is None:
            _send_verify_email(user["user_id"], email)
    except Exception as e:
        current_app.logger.error("Resend verify failed for %s: %r", email, e)

    return jsonify({"ok": True}), 200


@auth_bp.post("/forgot-password")
def forgot_password():
    _start = time.monotonic()
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()

    if email:
        try:
            with db.engine.begin() as conn:
                user = conn.execute(
                    text("SELECT user_id, email_verified_at FROM users WHERE email = :email"),
                    {"email": email}
                ).mappings().first()
            if user and user["email_verified_at"] is not None:
                _send_reset_email(user["user_id"], email)
        except Exception as e:
            current_app.logger.error("Forgot-password mail failed for %s: %r", email, e)

    elapsed = time.monotonic() - _start
    if elapsed < 0.2:
        time.sleep(0.2 - elapsed)

    return jsonify({"ok": True}), 200


@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    new_pw = data.get("password") or ""

    if not token:
        return jsonify({"error": "token_required"}), 400

    try:
        claims = _jwt_decode(token, current_app.config["JWT_RESET_SECRET"])
    except Exception:
        return jsonify({"error": "invalid_or_expired_token"}), 401

    if claims.get("typ") != "reset_password":
        return jsonify({"error": "invalid_token_type"}), 401

    try:
        user_id = int(claims.get("sub") or 0)
    except Exception:
        return jsonify({"error": "invalid_or_expired_token"}), 401
    if not user_id:
        return jsonify({"error": "invalid_or_expired_token"}), 401

    pw_errors = validate_password(new_pw)
    if pw_errors:
        return jsonify({"field_errors": {"password": pw_errors}}), 422

    with db.engine.begin() as conn:
        user = conn.execute(
            text("SELECT user_id, email FROM users WHERE user_id = :uid"),
            {"uid": user_id}
        ).mappings().first()
        if not user:
            return jsonify({"error": "user_not_found"}), 400

        new_hash = hash_password(new_pw)
        conn.execute(
            text("UPDATE users SET password_hash = :h WHERE user_id = :uid"),
            {"h": new_hash, "uid": user_id}
        )
        conn.execute(text("DELETE FROM refresh_tokens WHERE user_id = :uid"), {"uid": user_id})

    try:
        from app.services.mailer import send_email
        send_email(
            user["email"],
            "Your password was changed",
            "Your password was changed successfully. If this wasn't you, contact support immediately."
        )
    except Exception as e:
        current_app.logger.error("Password-changed email failed for uid=%s: %r", user_id, e)

    return jsonify({"ok": True}), 200


@auth_bp.post("/refresh")
def refresh():
    token = request.cookies.get("refresh_token") or ""
    if not token:
        return jsonify({"error": "unauthorized"}), 401

    try:
        claims = _jwt_decode(token, current_app.config["JWT_REFRESH_SECRET"])
    except Exception:
        return jsonify({"error": "unauthorized"}), 401

    if claims.get("typ") != "refresh":
        return jsonify({"error": "unauthorized"}), 401

    jti = claims.get("jti")
    sub = claims.get("sub")
    try:
        user_id = int(sub or 0)
    except Exception:
        return jsonify({"error": "unauthorized"}), 401
    if not jti or not user_id:
        return jsonify({"error": "unauthorized"}), 401

    token_hash = _sha256(token)
    now = _utcnow()

    with db.engine.begin() as conn:
        row = conn.execute(
            text("SELECT jti, user_id, expires_at, token_hash FROM refresh_tokens WHERE jti = :jti"),
            {"jti": jti}
        ).mappings().first()

        if not row:
            conn.execute(text("DELETE FROM refresh_tokens WHERE user_id = :uid"), {"uid": user_id})
            return jsonify({"error": "unauthorized"}), 401

        if row["user_id"] != user_id or row["token_hash"] != token_hash or row["expires_at"] <= now:
            conn.execute(text("DELETE FROM refresh_tokens WHERE jti = :jti"), {"jti": jti})
            return jsonify({"error": "unauthorized"}), 401

        conn.execute(text("DELETE FROM refresh_tokens WHERE jti = :jti"), {"jti": jti})

    new_refresh, new_jti, new_expires = _issue_refresh_jwt_and_persist(user_id)

    with db.engine.begin() as conn:
        user = conn.execute(
            text("SELECT email, role FROM users WHERE user_id = :uid"),
            {"uid": user_id}
        ).mappings().first()
    access_jwt = _issue_access_jwt(
        user_id,
        user["email"] if user else "",
        user["role"] if user else "non-member",
    )

    resp = make_response(jsonify({"access_token": access_jwt}), 200)
    _set_refresh_cookie(resp, new_refresh, new_expires)
    return resp


@auth_bp.get("/password-status")
@require_authenticated
def password_status():
    uid = caller_id()
    with db.engine.connect() as conn:
        row = conn.execute(
            text("SELECT password_hash FROM users WHERE user_id = :uid"),
            {"uid": uid},
        ).mappings().first()
    return jsonify({"has_password": bool(row and row["password_hash"])}), 200


@auth_bp.post("/change-password/request")
@require_authenticated
def change_password_request():
    uid = caller_id()
    data = request.get_json(silent=True) or {}
    current_pw = data.get("current_password") or ""
    new_pw = data.get("new_password") or ""
    confirm_pw = data.get("confirm_password") or ""

    with db.engine.connect() as conn:
        user = conn.execute(
            text("SELECT email, password_hash FROM users WHERE user_id = :uid"),
            {"uid": uid},
        ).mappings().first()

    if not user:
        return jsonify({"error": "user_not_found"}), 400

    has_password = bool(user["password_hash"])

    if has_password:
        if not current_pw:
            return jsonify({"field_errors": {"current_password": ["Current password is required."]}}), 422
        if not verify_password(current_pw, user["password_hash"]):
            return jsonify({"field_errors": {"current_password": ["Current password is incorrect."]}}), 401

    if not new_pw:
        return jsonify({"field_errors": {"new_password": ["New password is required."]}}), 422
    if new_pw != confirm_pw:
        return jsonify({"field_errors": {"confirm_password": ["Passwords do not match."]}}), 422

    pw_errors = validate_password(new_pw)
    if pw_errors:
        return jsonify({"field_errors": {"new_password": pw_errors}}), 422

    new_hash = hash_password(new_pw)
    import uuid as _uuid
    token = _jwt_encode(
        {"typ": "change_password", "sub": str(uid), "new_hash": new_hash, "jti": str(_uuid.uuid4())},
        current_app.config["JWT_RESET_SECRET"],
        delta=current_app.config["RESET_EXPIRES"],
    )

    fe = current_app.config["FRONTEND_URL"].rstrip("/")
    confirm_url = f"{fe}/dashboard?tab=profile&change_pw_token={token}"
    action = "set" if not has_password else "change"
    subject = "Confirm your password change"
    text_body = (
        f"You requested to {action} your CougarAI password.\n\n"
        "Click the link below within 30 minutes to confirm:\n"
        f"{confirm_url}\n\n"
        "If you didn't request this, you can ignore this email."
    )
    html_body = f"""
    <p>You requested to {action} your CougarAI password.</p>
    <p>Click the link below within 30 minutes to confirm:</p>
    <p><a href="{confirm_url}">Confirm Password Change</a></p>
    <p><small>If you didn't request this, you can ignore this email.</small></p>
    """
    try:
        from app.services.mailer import send_email
        send_email(user["email"], subject, text_body, html_body)
    except Exception as e:
        current_app.logger.error("Change-password email failed for uid=%s: %r", uid, e)

    return jsonify({"ok": True}), 200


@auth_bp.post("/change-password/confirm")
def change_password_confirm():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    if not token:
        return jsonify({"error": "token_required"}), 400

    try:
        claims = _jwt_decode(token, current_app.config["JWT_RESET_SECRET"])
    except Exception:
        return jsonify({"error": "invalid_or_expired_token"}), 401

    if claims.get("typ") != "change_password":
        return jsonify({"error": "invalid_token_type"}), 401

    try:
        uid = int(claims.get("sub") or 0)
    except Exception:
        return jsonify({"error": "invalid_or_expired_token"}), 401
    if not uid:
        return jsonify({"error": "invalid_or_expired_token"}), 401

    new_hash = claims.get("new_hash") or ""
    if not new_hash:
        return jsonify({"error": "invalid_token_type"}), 401

    with db.engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET password_hash = :h WHERE user_id = :uid"),
            {"h": new_hash, "uid": uid},
        )

    return jsonify({"ok": True}), 200


@auth_bp.delete("/logout")
def logout():
    token = request.cookies.get("refresh_token") or ""

    if token:
        try:
            claims = _jwt_decode(token, current_app.config["JWT_REFRESH_SECRET"])
            if claims.get("typ") == "refresh" and claims.get("jti"):
                _delete_refresh_by_jti(claims["jti"])
        except Exception:
            pass

    resp = make_response(jsonify({"ok": True}), 200)
    _clear_refresh_cookie(resp)
    return resp
