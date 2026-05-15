from __future__ import annotations
import json
import secrets
import uuid, hashlib, jwt
import os
from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import Blueprint, request, jsonify, current_app, make_response, redirect
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from flask_jwt_extended import create_access_token
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from app import db
from app.utils.passwords import validate_password, hash_password, verify_password
from app.services.mailer import send_email

auth_bp = Blueprint("auth", __name__)

# ---------------------------- Helpers ----------------------------

UTC = timezone.utc
def _utcnow() -> datetime:
    return datetime.now(UTC)

def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def _jwt_encode(claims: dict, secret: str, minutes: Optional[int]=None, delta: Optional[timedelta]=None) -> str:
    now = _utcnow()
    if delta is None and minutes is not None:
        delta = timedelta(minutes=minutes)
    elif delta is None:
        delta = timedelta(minutes=15)
    payload = {
        "iat": int(now.timestamp()),
        "exp": int((now + delta).timestamp()),
        **claims,
    }
    return jwt.encode(payload, secret, algorithm="HS256")

def _jwt_decode(token: str, secret: str) -> dict:
    return jwt.decode(token, secret, algorithms=["HS256"])

def _build_link(path: str, token: str) -> str:
    fe = current_app.config["FRONTEND_URL"].rstrip("/")
    return f"{fe}{path}?token={token}"

def _cookie_secure() -> bool:
    frontend_url = (current_app.config.get("FRONTEND_URL") or "").lower()
    return frontend_url.startswith("https://")

def _set_refresh_cookie(resp, refresh_token: str, expires_at: datetime):
    resp.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=int((expires_at - _utcnow()).total_seconds()),
        expires=expires_at,
        httponly=True,
        secure=_cookie_secure(),
        samesite="Lax",
        path="/auth",
    )
    return resp

def _clear_refresh_cookie(resp):
    resp.set_cookie(
        "refresh_token",
        "",
        expires=0,
        max_age=0,
        httponly=True,
        secure=_cookie_secure(),
        samesite="Lax",
        path="/auth",
    )
    return resp

def _issue_access_jwt(user_id: int, email: str) -> str:
    # Flask-JWT-Extended access token with correct claims
    claims = {"typ": "access", "sub": str(user_id)}
    # create_access_token will add jti, iat, exp automatically
    token = create_access_token(identity=str(user_id), additional_claims=claims)
    return token

def _issue_refresh_jwt_and_persist(user_id: int) -> Tuple[str, str, datetime]:
    """Returns (token, jti, expires_at). Also persists hash row."""
    now = _utcnow()
    expires = now + current_app.config["REFRESH_EXPIRES"]
    jti = str(uuid.uuid4())
    claims = {"typ": "refresh", "sub": str(user_id), "jti": jti}
    token = _jwt_encode(claims, current_app.config["JWT_REFRESH_SECRET"], delta=current_app.config["REFRESH_EXPIRES"])
    token_hash = _sha256(token)
    with db.engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO refresh_tokens (jti, user_id, expires_at, token_hash)
                VALUES (:jti, :user_id, :expires_at, :token_hash)
            """),
            {"jti": jti, "user_id": user_id, "expires_at": expires, "token_hash": token_hash}
        )
    return token, jti, expires

def _delete_refresh_by_jti(jti: str):
    with db.engine.begin() as conn:
        conn.execute(text("DELETE FROM refresh_tokens WHERE jti = :jti"), {"jti": jti})

def _delete_all_refresh_for_user(user_id: int):
    with db.engine.begin() as conn:
        conn.execute(text("DELETE FROM refresh_tokens WHERE user_id = :uid"), {"uid": user_id})

def _send_verify_email(user_id: int, email: str):
    token = _jwt_encode(
        {"typ": "verify_email", "sub": str(user_id), "jti": str(uuid.uuid4())},
        current_app.config["JWT_EMAIL_SECRET"],
        delta=current_app.config["VERIFY_EXPIRES"],
    )
    url = _build_link("/verify-email", token)
    subject = "Verify your email"
    text_body = (
        "Welcome!\n\n"
        "Please verify your email address using this link:\n"
        f"{url}\n\n"
        "Or copy this token into the app:\n"
        f"{token}\n\n"
        "This link expires in 24 hours."
    )
    html_body = f"""
    <p>Welcome!</p>
    <p>Please verify your email address by clicking:</p>
    <p><a href="{url}">Verify Email</a></p>
    <p>Or copy this token into the app:</p>
    <pre style="white-space:pre-wrap;word-break:break-all">{token}</pre>
    <p><small>Expires in 24 hours.</small></p>
    """
    send_email(email, subject, text_body, html_body)

def _send_reset_email(user_id: int, email: str):
    token = _jwt_encode(
        {"typ": "reset_password", "sub": str(user_id), "jti": str(uuid.uuid4())},
        current_app.config["JWT_RESET_SECRET"],
        delta=current_app.config["RESET_EXPIRES"],
    )
    url = _build_link("/reset-password", token)
    subject = "Reset your password"
    text_body = (
        "We received a request to reset your password.\n\n"
        "Use this link within 30 minutes:\n"
        f"{url}\n\n"
        "Or paste this token in the app:\n"
        f"{token}\n"
    )
    html_body = f"""
    <p>We received a request to reset your password.</p>
    <p>Use this link within 30 minutes:</p>
    <p><a href="{url}">Reset Password</a></p>
    <p>Or paste this token in the app:</p>
    <pre style="white-space:pre-wrap;word-break:break-all">{token}</pre>
    """
    send_email(email, subject, text_body, html_body)

def _build_auth_response(user_id: int, email: str, role: str = "member", onboarding_completed: bool = False):
    access_jwt = _issue_access_jwt(user_id, email)
    refresh_token, _, expires_at = _issue_refresh_jwt_and_persist(user_id)

    with db.engine.begin() as conn:
        conn.execute(text("UPDATE users SET last_login = NOW() WHERE user_id = :uid"), {"uid": user_id})

    resp = make_response(jsonify({
        "access_token": access_jwt,
        "user": {"user_id": user_id, "email": email, "role": role, "onboarding_completed": onboarding_completed},
    }), 201)
    _set_refresh_cookie(resp, refresh_token, expires_at)
    return resp

def _build_oauth_redirect_response(user_id: int, email: str, provider: str, role: str = "member", onboarding_completed: bool = False):
    access_jwt = _issue_access_jwt(user_id, email)
    refresh_token, _, expires_at = _issue_refresh_jwt_and_persist(user_id)

    with db.engine.begin() as conn:
        conn.execute(text("UPDATE users SET last_login = NOW() WHERE user_id = :uid"), {"uid": user_id})

    frontend_url = current_app.config["FRONTEND_URL"].rstrip("/")
    query = urlencode(
        {
            "provider": provider,
            "user_id": user_id,
            "email": email,
            "role": role,
            "onboarding_completed": "true" if onboarding_completed else "false",
            "access_token": access_jwt,
        }
    )
    resp = redirect(f"{frontend_url}/auth/success?{query}")
    _set_refresh_cookie(resp, refresh_token, expires_at)
    return resp

def _provision_oauth_user(email: str):
    with db.engine.begin() as conn:
        user = conn.execute(
            text("""
                SELECT user_id, email, email_verified_at, is_active, role, onboarding_completed_at
                FROM users
                WHERE email = :email
            """),
            {"email": email}
        ).mappings().first()

        if user and not user["is_active"]:
            raise PermissionError("inactive_user")

        if not user:
            user = conn.execute(
                text("""
                    INSERT INTO users (email, email_verified_at)
                    VALUES (:email, NOW())
                    RETURNING user_id, email, email_verified_at, is_active, role, onboarding_completed_at
                """),
                {"email": email}
            ).mappings().first()
        elif user["email_verified_at"] is None:
            conn.execute(
                text("UPDATE users SET email_verified_at = NOW() WHERE user_id = :uid"),
                {"uid": user["user_id"]}
            )

    return user

def _microsoft_tenant():
    return (os.getenv("MICROSOFT_TENANT_ID") or "common").strip() or "common"

def _microsoft_client_id():
    return (os.getenv("MICROSOFT_CLIENT_ID") or "").strip()

def _microsoft_client_secret():
    return (os.getenv("MICROSOFT_CLIENT_SECRET") or "").strip()

def _microsoft_redirect_uri():
    override = (os.getenv("MICROSOFT_REDIRECT_URI") or "").strip()
    if override:
        return override
    return f"{request.url_root.rstrip('/')}/auth/microsoft/callback"

def _microsoft_authority_base():
    return f"https://login.microsoftonline.com/{_microsoft_tenant()}/oauth2/v2.0"

def _microsoft_fetch_json(url: str, *, method: str = "GET", headers: Optional[dict] = None, body: Optional[str] = None):
    request_obj = Request(
        url,
        data=body.encode("utf-8") if body is not None else None,
        headers=headers or {},
        method=method,
    )
    with urlopen(request_obj) as response:
        return json.loads(response.read().decode("utf-8"))

def _microsoft_exchange_code(code: str):
    body = urlencode({
        "client_id": _microsoft_client_id(),
        "client_secret": _microsoft_client_secret(),
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": _microsoft_redirect_uri(),
        "scope": "openid profile email offline_access User.Read",
    })
    return _microsoft_fetch_json(
        f"{_microsoft_authority_base()}/token",
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        body=body,
    )

def _microsoft_get_profile(access_token: str):
    return _microsoft_fetch_json(
        "https://graph.microsoft.com/v1.0/me",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
    )

# --------------------- Existing: Register & Verify ---------------------

@auth_bp.post("/register")
def register():
    """
    Body: { "email": "...", "password": "..." }
    - Password policy enforced
    - Idempotent, no enumeration
    - Always returns 201 { "ok": true } if policy passes
    - 422 with field_errors.password when policy fails
    """
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
        # Insert if not exists
        row = conn.execute(
            text("""
                INSERT INTO users (email, password_hash)
                VALUES (:email, :hash)
                ON CONFLICT (email) DO NOTHING
                RETURNING user_id, email
            """),
            {"email": email_raw, "hash": password_hash}
        ).mappings().first()

        # Always fetch to get user_id for email
        if not row:
            row = conn.execute(
                text("SELECT user_id, email, email_verified_at FROM users WHERE email = :email"),
                {"email": email_raw}
            ).mappings().first()

    # Send verification email unconditionally (no enumeration leak)
    try:
        _send_verify_email(row["user_id"], email_raw)
    except Exception as e:
        current_app.logger.error("Send verify mail failed for %s: %r", email_raw, e)

    return jsonify({"ok": True}), 201


@auth_bp.post("/verify-email")
def verify_email():
    """
    Body: { "token": "<verify_email_jwt>" }
    Status:
      200 { "ok": true }
      400 { "error": "token_required" | "user_not_found" }
      401 { "error": "invalid_or_expired_token" | "invalid_token_type" }
      409 { "error": "already_verified" }
    """
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

# --------------------- New: Login / Resend / Forgot / Reset / Refresh / Logout ---------------------

@auth_bp.post("/login")
def login():
    """
    Body: { "email": "user@example.com", "password": "Secret@123" }
    Responses:
      201 Created; { "access_token": "<jwt>", "user": { "user_id": ..., "email": "..." } }
      401 invalid credentials (generic; do not reveal reason)
    Behavior:
      - Reject if !email_verified or !is_active
      - On success: issue access (JSON) + refresh (HttpOnly cookie), persist refresh row, update last_login
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "invalid_credentials"}), 401

    with db.engine.begin() as conn:
        user = conn.execute(
            text("""
                SELECT user_id, email, password_hash, email_verified_at, is_active
                FROM users WHERE email = :email
            """),
            {"email": email}
        ).mappings().first()

    if not user or not user["password_hash"] or not verify_password(password, user["password_hash"]):
        # Do not disclose whether user exists
        return jsonify({"error": "invalid_credentials"}), 401

    if user["email_verified_at"] is None or not user["is_active"]:
        return jsonify({"error": "invalid_credentials"}), 401

    return _build_auth_response(user["user_id"], user["email"])


@auth_bp.post("/google")
def google_login():
    """
    Body: { "credential": "<google_id_token>" }
    Responses:
      201 Created; same payload/cookie behavior as password login
      401 invalid credentials/token
      503 Google OAuth not configured
    """
    data = request.get_json(silent=True) or {}
    credential = (data.get("credential") or "").strip()
    if not credential:
        return jsonify({"error": "credential_required"}), 400

    client_id = (os.getenv("GOOGLE_OAUTH_CLIENT_ID") or "").strip()
    if not client_id:
        return jsonify({"error": "google_oauth_not_configured"}), 503

    try:
        claims = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            client_id,
        )
    except Exception:
        return jsonify({"error": "invalid_credentials"}), 401

    email = (claims.get("email") or "").strip()
    if not email or not claims.get("email_verified"):
        return jsonify({"error": "invalid_credentials"}), 401

    try:
        user = _provision_oauth_user(email)
        return _build_auth_response(
            user["user_id"],
            user["email"],
            role=user["role"] or "member",
            onboarding_completed=user["onboarding_completed_at"] is not None,
        )
    except PermissionError:
        return jsonify({"error": "invalid_credentials"}), 401
    except SQLAlchemyError:
        current_app.logger.exception("Google OAuth database failure for %s", email)
        return jsonify({"error": "database_unavailable"}), 503


@auth_bp.get("/microsoft/start")
def microsoft_start():
    client_id = _microsoft_client_id()
    client_secret = _microsoft_client_secret()
    if not client_id or not client_secret:
        return jsonify({"error": "microsoft_oauth_not_configured"}), 503

    intent = (request.args.get("intent") or "login").strip().lower()
    if intent not in {"login", "register"}:
        intent = "login"

    state = _jwt_encode(
        {
            "typ": "microsoft_oauth_state",
            "nonce": secrets.token_urlsafe(16),
            "intent": intent,
        },
        current_app.config["SECRET_KEY"],
        delta=timedelta(minutes=10),
    )

    query = urlencode({
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": _microsoft_redirect_uri(),
        "response_mode": "query",
        "scope": "openid profile email offline_access User.Read",
        "state": state,
        "prompt": "select_account",
    })
    return redirect(f"{_microsoft_authority_base()}/authorize?{query}")


@auth_bp.get("/microsoft/callback")
def microsoft_callback():
    error = (request.args.get("error") or "").strip()
    if error:
        frontend_url = current_app.config["FRONTEND_URL"].rstrip("/")
        query = urlencode({
            "error": "microsoft_oauth_failed",
            "message": request.args.get("error_description") or error,
        })
        return redirect(f"{frontend_url}/auth?mode=login&{query}")

    code = (request.args.get("code") or "").strip()
    state = (request.args.get("state") or "").strip()
    if not code or not state:
        return jsonify({"error": "invalid_oauth_callback"}), 400

    try:
        claims = _jwt_decode(state, current_app.config["SECRET_KEY"])
    except Exception:
        return jsonify({"error": "invalid_oauth_state"}), 401

    if claims.get("typ") != "microsoft_oauth_state":
        return jsonify({"error": "invalid_oauth_state"}), 401

    try:
        token_payload = _microsoft_exchange_code(code)
        access_token = (token_payload.get("access_token") or "").strip()
        if not access_token:
            return jsonify({"error": "invalid_credentials"}), 401

        profile = _microsoft_get_profile(access_token)
        email = (profile.get("mail") or profile.get("userPrincipalName") or "").strip()
        if not email:
            return jsonify({"error": "invalid_credentials"}), 401

        user = _provision_oauth_user(email)
        return _build_oauth_redirect_response(
            user["user_id"],
            user["email"],
            "microsoft",
            role=user["role"] or "member",
            onboarding_completed=user["onboarding_completed_at"] is not None,
        )
    except PermissionError:
        return jsonify({"error": "invalid_credentials"}), 401
    except SQLAlchemyError:
        current_app.logger.exception("Microsoft OAuth database failure")
        return jsonify({"error": "database_unavailable"}), 503
    except Exception:
        current_app.logger.exception("Microsoft OAuth callback failed")
        return jsonify({"error": "microsoft_oauth_failed"}), 500


@auth_bp.post("/resend-verification")
def resend_verification():
    """
    Body: { "email": "user@example.com" }
    Behavior:
      - If user exists and unverified, email a fresh verify token
      - Always respond 200 { "ok": true } (no enumeration)
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    if not email:
        # Keep generic
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
    """
    Body: { "email": "user@example.com" }
    Behavior:
      - Only send if account exists AND is verified
      - Always return 200 { "ok": true } (no enumeration)
    """
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
        if user and user["email_verified_at"] is not None:
            _send_reset_email(user["user_id"], email)
    except Exception as e:
        current_app.logger.error("Forgot-password mail failed for %s: %r", email, e)

    return jsonify({"ok": True}), 200


@auth_bp.post("/reset-password")
def reset_password():
    """
    Body: { "token": "<reset_jwt>", "password": "<new-password>" }
    Behavior:
      - Validate token; enforce password policy; set new bcrypt hash
      - Delete ALL refresh tokens for the user (global sign-out)
      - Send “password changed” email
    Responses:
      200 { "ok": true }
      422 { "field_errors": { "password": [...] } }
      400/401 on token issues
    """
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

    # Password policy
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
        # Global sign-out
        conn.execute(text("DELETE FROM refresh_tokens WHERE user_id = :uid"), {"uid": user_id})

    # Notify
    try:
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
    """
    Auth: refresh cookie only (HttpOnly; Secure; Path=/auth; SameSite=Lax)
    Body: {}
    Behavior:
      - Validate refresh JWT (typ=refresh) using JWT_REFRESH_SECRET
      - Check DB row (jti, user_id, token_hash, expires_at)
      - Rotate: delete old, create new, set-cookie new refresh
      - Reuse detection: if token is valid but DB row missing -> delete ALL user refresh tokens and 401
    Responses:
      200 { "access_token": "<jwt>" } (with rotated cookie)
      401 invalid/expired
    """
    token = request.cookies.get("refresh_token") or ""
    if not token:
        return jsonify({"error": "unauthorized"}), 401

    # Validate cryptographically first
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
            # Reuse detection: token is valid but DB row missing => revoke all user tokens
            conn.execute(text("DELETE FROM refresh_tokens WHERE user_id = :uid"), {"uid": user_id})
            return jsonify({"error": "unauthorized"}), 401

        if row["user_id"] != user_id or row["token_hash"] != token_hash or row["expires_at"] <= now:
            # Any mismatch/expired -> treat as invalid
            conn.execute(text("DELETE FROM refresh_tokens WHERE jti = :jti"), {"jti": jti})
            return jsonify({"error": "unauthorized"}), 401

        # Rotation: delete old, create new
        conn.execute(text("DELETE FROM refresh_tokens WHERE jti = :jti"), {"jti": jti})

    # Issue new refresh row & access token
    new_refresh, new_jti, new_expires = _issue_refresh_jwt_and_persist(user_id)

    # Access token
    # Fetch email for returned access claims (optional)
    with db.engine.begin() as conn:
        user = conn.execute(
            text("SELECT email FROM users WHERE user_id = :uid"),
            {"uid": user_id}
        ).mappings().first()
    access_jwt = _issue_access_jwt(user_id, user["email"] if user else "")

    resp = make_response(jsonify({"access_token": access_jwt}), 200)
    _set_refresh_cookie(resp, new_refresh, new_expires)
    return resp


@auth_bp.delete("/logout")
def logout():
    """
    Auth: refresh cookie
    - Delete the current refresh token row if valid & present
    - Clear cookie
    Always 200 { "ok": true } if cookie present (noisy failures are avoided)
    """
    token = request.cookies.get("refresh_token") or ""

    if token:
        try:
            claims = _jwt_decode(token, current_app.config["JWT_REFRESH_SECRET"])
            if claims.get("typ") == "refresh" and claims.get("jti"):
                _delete_refresh_by_jti(claims["jti"])
        except Exception:
            # Ignore; still clear cookie
            pass

    resp = make_response(jsonify({"ok": True}), 200)
    _clear_refresh_cookie(resp)
    return resp
