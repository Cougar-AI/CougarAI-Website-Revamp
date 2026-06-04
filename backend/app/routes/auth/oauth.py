from __future__ import annotations
import json
import os
import secrets
from datetime import timedelta
from typing import Optional
from urllib.parse import urlencode
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from flask import request, jsonify, current_app, redirect, make_response
from flask_jwt_extended import get_jwt_identity
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.routes.auth import auth_bp
from app.routes.auth._helpers import (
    _jwt_encode, _jwt_decode,
    _build_auth_response, _build_oauth_redirect_response,
    _provision_oauth_user, _clear_refresh_cookie, _delete_refresh_by_jti,
)
from app.utils.auth_decorators import require_authenticated


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

def _microsoft_post_logout_redirect_uri():
    frontend_url = current_app.config["FRONTEND_URL"].rstrip("/")
    return f"{frontend_url}/?logged_out=1"

def _microsoft_frontend_auth_redirect(error: str, message: str | None = None):
    frontend_url = current_app.config["FRONTEND_URL"].rstrip("/")
    query = {"mode": "login", "error": error}
    if message:
        query["message"] = message
    return _frontend_redirect_response(f"{frontend_url}/auth?{urlencode(query)}")

def _frontend_redirect_response(url: str):
    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0;url={url}" />
    <title>Redirecting...</title>
    <script>
      window.location.replace({json.dumps(url)});
    </script>
  </head>
  <body style="font-family: Arial, sans-serif; padding: 24px;">
    <p>Redirecting...</p>
    <p><a href="{url}">Continue</a></p>
  </body>
</html>"""
    resp = make_response(html, 200)
    resp.headers["Content-Type"] = "text/html; charset=utf-8"
    return resp

def _microsoft_logout_url():
    post_logout_redirect_uri = _microsoft_post_logout_redirect_uri()
    query = urlencode({
        "client_id": _microsoft_client_id(),
        "post_logout_redirect_uri": post_logout_redirect_uri,
    })
    return f"{_microsoft_authority_base()}/logout?{query}"

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
        return _microsoft_frontend_auth_redirect(
            "microsoft_oauth_failed",
            request.args.get("error_description") or error,
        )

    code = (request.args.get("code") or "").strip()
    state = (request.args.get("state") or "").strip()
    if not error and not code and not state:
        return _microsoft_frontend_auth_redirect("logged_out")
    if not code or not state:
        return _microsoft_frontend_auth_redirect("invalid_oauth_callback")

    try:
        claims = _jwt_decode(state, current_app.config["SECRET_KEY"])
    except Exception:
        return _microsoft_frontend_auth_redirect("invalid_oauth_state")

    if claims.get("typ") != "microsoft_oauth_state":
        return _microsoft_frontend_auth_redirect("invalid_oauth_state")

    try:
        token_payload = _microsoft_exchange_code(code)
        access_token = (token_payload.get("access_token") or "").strip()
        if not access_token:
            return _microsoft_frontend_auth_redirect("invalid_credentials")

        profile = _microsoft_get_profile(access_token)
        email = (profile.get("mail") or profile.get("userPrincipalName") or "").strip()
        if not email:
            return _microsoft_frontend_auth_redirect("invalid_credentials")

        user = _provision_oauth_user(email)
        oauth_redirect = _build_oauth_redirect_response(
            user["user_id"],
            user["email"],
            "microsoft",
            role=user["role"] or "member",
            onboarding_completed=user["onboarding_completed_at"] is not None,
        )
        destination = oauth_redirect.headers.get("Location")
        if not destination:
            return _microsoft_frontend_auth_redirect("microsoft_oauth_failed")
        resp = _frontend_redirect_response(destination)
        cookie = oauth_redirect.headers.get("Set-Cookie")
        if cookie:
            resp.headers.add("Set-Cookie", cookie)
        return resp
    except PermissionError:
        return _microsoft_frontend_auth_redirect("invalid_credentials")
    except SQLAlchemyError:
        current_app.logger.exception("Microsoft OAuth database failure")
        return _microsoft_frontend_auth_redirect("database_unavailable")
    except HTTPError as exc:
        current_app.logger.exception("Microsoft OAuth HTTP failure")
        return _microsoft_frontend_auth_redirect("microsoft_oauth_failed", str(exc))
    except Exception:
        current_app.logger.exception("Microsoft OAuth callback failed")
        return _microsoft_frontend_auth_redirect("microsoft_oauth_failed")


@auth_bp.get("/microsoft/logout")
def microsoft_logout():
    token = request.cookies.get("refresh_token") or ""
    if token:
        try:
            claims = _jwt_decode(token, current_app.config["JWT_REFRESH_SECRET"])
            if claims.get("typ") == "refresh" and claims.get("jti"):
                _delete_refresh_by_jti(claims["jti"])
        except Exception:
            pass

    resp = _frontend_redirect_response(_microsoft_logout_url())
    _clear_refresh_cookie(resp)
    return resp


# ── Discord OAuth helpers ─────────────────────────────────────────────────────

def _discord_client_id():
    return (os.getenv("DISCORD_CLIENT_ID") or "").strip()

def _discord_client_secret():
    return (os.getenv("DISCORD_CLIENT_SECRET") or "").strip()

def _discord_bot_token():
    return (os.getenv("DISCORD_BOT_TOKEN") or "").strip()

def _discord_redirect_uri():
    override = (os.getenv("DISCORD_REDIRECT_URI") or "").strip()
    if override:
        return override
    return f"{request.url_root.rstrip('/')}/auth/discord/callback"

def _discord_fetch_json(url: str, *, method: str = "GET", headers: Optional[dict] = None, body: Optional[str] = None):
    req = Request(
        url,
        data=body.encode("utf-8") if body is not None else None,
        headers=headers or {},
        method=method,
    )
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        raise HTTPError(e.url, e.code, f"{e.reason} — body: {error_body}", e.headers, None) from e

def _discord_exchange_code(code: str) -> dict:
    body = urlencode({
        "client_id": _discord_client_id(),
        "client_secret": _discord_client_secret(),
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": _discord_redirect_uri(),
    })
    return _discord_fetch_json(
        "https://discord.com/api/v10/oauth2/token",
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": f"CougarAIBot (https://cougarai.org, 1.0)",
        },
        body=body,
    )

def _discord_get_profile(access_token: str) -> dict:
    return _discord_fetch_json(
        "https://discord.com/api/v10/users/@me",
        headers={
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "CougarAIBot (https://cougarai.org, 1.0)",
        },
    )

def _discord_authorize_url(state: str) -> str:
    query = urlencode({
        "client_id": _discord_client_id(),
        "redirect_uri": _discord_redirect_uri(),
        "response_type": "code",
        "scope": "identify email",
        "state": state,
        "prompt": "consent",
    })
    return f"https://discord.com/oauth2/authorize?{query}"

def _discord_assign_auto_role(discord_user_id: str):
    """Assign auto_role from discord_config if configured. Silently skips if not set."""
    bot_token = _discord_bot_token()
    if not bot_token:
        return
    try:
        from app.raw_db import get_db
        from app.services.discord_service import assign_guild_role, get_guild_config
        conn = get_db()
        cfg = get_guild_config(conn)
        if cfg and cfg.get("auto_role") and cfg.get("guild_id"):
            assign_guild_role(cfg["guild_id"], discord_user_id, cfg["auto_role"], bot_token)
    except Exception:
        current_app.logger.warning("Discord auto_role assignment failed for user %s", discord_user_id)


# ── Discord OAuth endpoints ───────────────────────────────────────────────────

@auth_bp.get("/discord/start")
def discord_start():
    client_id = _discord_client_id()
    client_secret = _discord_client_secret()
    if not client_id or not client_secret:
        return jsonify({"error": "discord_oauth_not_configured"}), 503

    intent = (request.args.get("intent") or "login").strip().lower()
    if intent not in {"login", "register"}:
        intent = "login"

    state = _jwt_encode(
        {
            "typ": "discord_oauth_state",
            "nonce": secrets.token_urlsafe(16),
            "intent": intent,
        },
        current_app.config["SECRET_KEY"],
        delta=timedelta(minutes=10),
    )
    return redirect(_discord_authorize_url(state))


@auth_bp.route("/discord/connect-start", methods=["POST", "OPTIONS"])
@require_authenticated
def discord_connect_start():
    if request.method == "OPTIONS":
        return "", 200

    client_id = _discord_client_id()
    client_secret = _discord_client_secret()
    if not client_id or not client_secret:
        return jsonify({"error": "discord_oauth_not_configured"}), 503

    user_id = int(get_jwt_identity())
    state = _jwt_encode(
        {
            "typ": "discord_oauth_state",
            "nonce": secrets.token_urlsafe(16),
            "intent": "connect",
            "user_id": user_id,
        },
        current_app.config["SECRET_KEY"],
        delta=timedelta(minutes=10),
    )
    return jsonify({"url": _discord_authorize_url(state)}), 200


@auth_bp.get("/discord/callback")
def discord_callback():
    frontend_url = current_app.config["FRONTEND_URL"].rstrip("/")

    # Discord error redirect
    if request.args.get("error"):
        query = urlencode({"error": "discord_oauth_failed"})
        return redirect(f"{frontend_url}/login?{query}")

    code = (request.args.get("code") or "").strip()
    state = (request.args.get("state") or "").strip()
    if not code or not state:
        return jsonify({"error": "invalid_oauth_callback"}), 400

    try:
        claims = _jwt_decode(state, current_app.config["SECRET_KEY"])
    except Exception:
        return jsonify({"error": "invalid_oauth_state"}), 401

    if claims.get("typ") != "discord_oauth_state":
        return jsonify({"error": "invalid_oauth_state"}), 401

    intent = claims.get("intent", "login")

    try:
        token_payload = _discord_exchange_code(code)
        access_token = (token_payload.get("access_token") or "").strip()
        if not access_token:
            return jsonify({"error": "invalid_credentials"}), 401

        profile = _discord_get_profile(access_token)
        discord_user_id = str(profile.get("id") or "").strip()
        discord_username = (profile.get("username") or "").strip()
        email = (profile.get("email") or "").strip()
        verified = profile.get("verified", False)

        if not discord_user_id:
            return jsonify({"error": "invalid_credentials"}), 401

        if intent == "connect":
            user_id = claims.get("user_id")
            if not user_id:
                return jsonify({"error": "invalid_oauth_state"}), 401

            from app.raw_db import get_db
            conn = get_db()
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE profile SET discord_id = %s, discord_username = %s WHERE user_id = %s",
                    (discord_user_id, discord_username, user_id),
                )
            conn.commit()

            _discord_assign_auto_role(discord_user_id)

            return redirect(f"{frontend_url}/dashboard?discord_connected=1")

        # login / register intent — find any account that has this Discord linked
        _linked = None
        try:
            from app.raw_db import get_db as _get_db
            _raw = _get_db()
            with _raw.cursor() as _cur:
                _cur.execute(
                    """
                    SELECT u.user_id, u.email, u.email_verified_at, u.is_active,
                           u.role, u.onboarding_completed_at
                    FROM profile p
                    JOIN users u ON u.user_id = p.user_id
                    WHERE p.discord_id::text = %s
                    """,
                    (discord_user_id,),
                )
                _linked = _cur.fetchone()
        except Exception:
            current_app.logger.warning("discord linked-account lookup failed, falling back to email", exc_info=True)

        if _linked:
            if not _linked["is_active"]:
                raise PermissionError("inactive_user")
            user = _linked
        else:
            if not email or not verified:
                query = urlencode({"error": "discord_email_unverified"})
                return redirect(f"{frontend_url}/login?{query}")
            user = _provision_oauth_user(email)

        # Store discord_id + discord_username on profile if it exists
        from app.raw_db import get_db as _get_db2
        _raw2 = _get_db2()
        with _raw2.cursor() as _cur2:
            _cur2.execute(
                "UPDATE profile SET discord_id = %s, discord_username = %s WHERE user_id = %s",
                (discord_user_id, discord_username, user["user_id"]),
            )
        _raw2.commit()

        _discord_assign_auto_role(discord_user_id)

        return _build_oauth_redirect_response(
            user["user_id"],
            user["email"],
            "discord",
            role=user["role"] or "member",
            onboarding_completed=user["onboarding_completed_at"] is not None,
        )

    except PermissionError:
        return jsonify({"error": "invalid_credentials"}), 401
    except Exception:
        current_app.logger.exception("Discord OAuth callback failed")
        return jsonify({"error": "discord_oauth_failed"}), 500
