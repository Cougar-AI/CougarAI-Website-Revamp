from __future__ import annotations
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional
from urllib.parse import urlencode

import jwt
from flask import current_app, make_response, jsonify, redirect, request
from flask_jwt_extended import create_access_token
from sqlalchemy import text

from app import db
from app.services.mailer import send_email

UTC = timezone.utc


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _jwt_encode(claims: dict, secret: str, minutes: Optional[int] = None, delta: Optional[timedelta] = None) -> str:
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
        secure=True,
        samesite="None",
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
        secure=True,
        samesite="None",
        path="/auth",
    )
    return resp


def _issue_access_jwt(user_id: int, email: str, role: str = "non-member") -> str:
    claims = {"typ": "access", "sub": str(user_id), "role": role}
    return create_access_token(identity=str(user_id), additional_claims=claims)


def _issue_refresh_jwt_and_persist(user_id: int) -> Tuple[str, str, datetime]:
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
    <p>Please verify your email address by clicking the button below:</p>
    <p><a href="{url}" style="display:inline-block;background:#b91c1c;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Verify Email</a></p>
    <p><small>Expires in 24 hours. If the button doesn't work, paste this URL into your browser:</small></p>
    <p><small style="word-break:break-all">{url}</small></p>
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
        "If you didn't request this, you can ignore this email."
    )
    html_body = f"""
    <p>We received a request to reset your password.</p>
    <p>Click the button below — this link expires in 30 minutes:</p>
    <p><a href="{url}" style="display:inline-block;background:#b91c1c;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Reset Password</a></p>
    <p><small>If the button doesn't work, paste this URL into your browser:</small></p>
    <p><small style="word-break:break-all">{url}</small></p>
    <p><small>If you didn't request this, you can safely ignore this email.</small></p>
    """
    send_email(email, subject, text_body, html_body)


def _build_auth_response(user_id: int, email: str, role: str = "member", onboarding_completed: bool = False):
    access_jwt = _issue_access_jwt(user_id, email, role)
    refresh_token, _, expires_at = _issue_refresh_jwt_and_persist(user_id)

    with db.engine.begin() as conn:
        conn.execute(text("UPDATE users SET last_login = NOW() WHERE user_id = :uid"), {"uid": user_id})

    resp = make_response(jsonify({
        "access_token": access_jwt,
        "user": {"user_id": user_id, "email": email, "role": role, "onboarding_completed": onboarding_completed},
    }), 200)
    _set_refresh_cookie(resp, refresh_token, expires_at)
    return resp


def _build_oauth_redirect_response(user_id: int, email: str, provider: str, role: str = "member", onboarding_completed: bool = False):
    access_jwt = _issue_access_jwt(user_id, email, role)
    refresh_token, _, expires_at = _issue_refresh_jwt_and_persist(user_id)

    with db.engine.begin() as conn:
        conn.execute(text("UPDATE users SET last_login = NOW() WHERE user_id = :uid"), {"uid": user_id})

    frontend_url = current_app.config["FRONTEND_URL"].rstrip("/")
    query = urlencode({
        "provider": provider,
        "user_id": user_id,
        "email": email,
        "role": role,
        "onboarding_completed": "true" if onboarding_completed else "false",
        "access_token": access_jwt,
    })
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
