from __future__ import annotations
import json
import os
import secrets
from datetime import timedelta
from typing import Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import request, jsonify, current_app, redirect
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy.exc import SQLAlchemyError

from app.routes.auth import auth_bp
from app.routes.auth._helpers import (
    _jwt_encode, _jwt_decode,
    _build_auth_response, _build_oauth_redirect_response,
    _provision_oauth_user,
)


# ── Microsoft OAuth helpers ──────────────────────────────────────────────────

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


# ── Google OAuth ──────────────────────────────────────────────────────────────

@auth_bp.route("/google", methods=["POST", "OPTIONS"])
def google_login():
    if request.method == "OPTIONS":
        return "", 200
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


# ── Microsoft OAuth ───────────────────────────────────────────────────────────

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
