"""
Integration tests for /auth routes.

Requires Docker (PostgreSQL). Run with:
    pytest tests/integration/test_auth.py -v

Email sending is mocked via unittest.mock.patch throughout.
Because the app uses raw psycopg2, DB writes are NOT rolled back between
tests — each test uses a unique email (uuid suffix) to stay isolated.
"""
from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PATCH_SEND = "app.routes.auth._helpers.send_email"
STRONG_PW  = "TestPass1!"


def _email() -> str:
    """Return a globally unique test email."""
    return f"test_{uuid.uuid4().hex[:10]}@uh.edu"


def _register(client, email: str, password: str = STRONG_PW):
    """Register a user, mocking email delivery. Returns response."""
    with patch(PATCH_SEND):
        return client.post("/auth/register", json={"email": email, "password": password})


def _verify_email_token(mock_send) -> str:
    """Extract the verify JWT from the mocked send_email call's text body."""
    text_body: str = mock_send.call_args.args[2]
    # text_body contains: "Or copy this token into the app:\n<token>\n\n"
    return text_body.split("copy this token into the app:\n")[1].split("\n")[0].strip()


def _mark_verified(app, email: str):
    """Directly mark a user's email as verified in the DB."""
    from sqlalchemy import text as sqlt
    from app import db
    with app.app_context():
        with db.engine.begin() as conn:
            conn.execute(
                sqlt("UPDATE users SET email_verified_at = NOW() WHERE email = :e"),
                {"e": email},
            )


def _login(client, email: str, password: str = STRONG_PW):
    return client.post("/auth/login", json={"email": email, "password": password})


def _refresh_cookie(response) -> str | None:
    """Extract the Set-Cookie refresh_token value from a response."""
    for h in response.headers.getlist("Set-Cookie"):
        if "refresh_token=" in h:
            return h
    return None


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------

class TestRegister:
    def test_register_success(self, client, db_session):
        email = _email()
        with patch(PATCH_SEND) as mock_send:
            resp = client.post("/auth/register", json={"email": email, "password": STRONG_PW})

        assert resp.status_code == 201
        assert resp.get_json()["ok"] is True
        mock_send.assert_called_once()
        # First arg to send_email is the recipient address
        assert mock_send.call_args.args[0] == email

    def test_register_missing_email(self, client, db_session):
        resp = client.post("/auth/register", json={"password": STRONG_PW})
        assert resp.status_code == 422
        body = resp.get_json()
        assert "email" in body.get("field_errors", {})

    def test_register_weak_password(self, client, db_session):
        resp = client.post("/auth/register", json={"email": _email(), "password": "weak"})
        assert resp.status_code == 422
        body = resp.get_json()
        assert "password" in body.get("field_errors", {})
        assert len(body["field_errors"]["password"]) > 0

    def test_register_duplicate_email(self, client, db_session):
        """Duplicate registration is idempotent — returns 201 without leaking existence."""
        email = _email()
        _register(client, email)
        with patch(PATCH_SEND):
            resp = client.post("/auth/register", json={"email": email, "password": STRONG_PW})
        assert resp.status_code == 201
        assert resp.get_json()["ok"] is True

    def test_register_empty_body(self, client, db_session):
        resp = client.post("/auth/register", json={})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

class TestLogin:
    def test_login_unverified(self, client, db_session):
        email = _email()
        _register(client, email)
        resp = _login(client, email)
        assert resp.status_code == 401

    def test_login_wrong_password(self, client, app, db_session):
        email = _email()
        _register(client, email)
        _mark_verified(app, email)
        resp = _login(client, email, password="WrongPass9!")
        assert resp.status_code == 401

    def test_login_unknown_email(self, client, db_session):
        resp = _login(client, "nobody_" + _email())
        assert resp.status_code == 401

    def test_login_success(self, client, app, db_session):
        email = _email()
        _register(client, email)
        _mark_verified(app, email)
        resp = _login(client, email)

        assert resp.status_code == 200
        body = resp.get_json()
        assert "access_token" in body
        assert body["user"]["email"] == email
        # Refresh cookie should be set
        assert _refresh_cookie(resp) is not None

    def test_login_returns_role(self, client, app, db_session):
        email = _email()
        _register(client, email)
        _mark_verified(app, email)
        resp = _login(client, email)
        assert resp.get_json()["user"]["role"] == "non-member"


# ---------------------------------------------------------------------------
# POST /auth/verify-email
# ---------------------------------------------------------------------------

class TestVerifyEmail:
    def test_verify_valid_token(self, client, db_session):
        email = _email()
        with patch(PATCH_SEND) as mock_send:
            client.post("/auth/register", json={"email": email, "password": STRONG_PW})
            token = _verify_email_token(mock_send)

        resp = client.post("/auth/verify-email", json={"token": token})
        assert resp.status_code == 200
        assert resp.get_json()["ok"] is True

    def test_verify_invalid_token(self, client, db_session):
        resp = client.post("/auth/verify-email", json={"token": "not.a.valid.jwt"})
        assert resp.status_code == 401

    def test_verify_missing_token(self, client, db_session):
        resp = client.post("/auth/verify-email", json={})
        assert resp.status_code == 400

    def test_verify_already_verified(self, client, app, db_session):
        email = _email()
        with patch(PATCH_SEND) as mock_send:
            client.post("/auth/register", json={"email": email, "password": STRONG_PW})
            token = _verify_email_token(mock_send)

        client.post("/auth/verify-email", json={"token": token})
        resp = client.post("/auth/verify-email", json={"token": token})
        assert resp.status_code == 409
        assert resp.get_json()["error"] == "already_verified"


# ---------------------------------------------------------------------------
# POST /auth/refresh  &  DELETE /auth/logout
# ---------------------------------------------------------------------------

class TestRefreshAndLogout:
    def _authenticated_client(self, client, app):
        """Register, verify, and login — returns (client, refresh_cookie_header)."""
        email = _email()
        _register(client, email)
        _mark_verified(app, email)
        resp = _login(client, email)
        cookie_header = _refresh_cookie(resp)
        return cookie_header

    def test_refresh_no_cookie(self, client, db_session):
        resp = client.post("/auth/refresh")
        assert resp.status_code == 401

    def test_refresh_with_valid_cookie(self, client, app, db_session):
        cookie_header = self._authenticated_client(client, app)
        assert cookie_header is not None

        # Parse out the cookie value to set it on the next request
        cookie_value = cookie_header.split("refresh_token=")[1].split(";")[0]
        client.set_cookie("refresh_token", cookie_value, path="/auth")

        resp = client.post("/auth/refresh")
        assert resp.status_code == 200
        assert "access_token" in resp.get_json()

    def test_logout_clears_cookie(self, client, app, db_session):
        cookie_header = self._authenticated_client(client, app)
        assert cookie_header is not None

        cookie_value = cookie_header.split("refresh_token=")[1].split(";")[0]
        client.set_cookie("refresh_token", cookie_value, path="/auth")

        resp = client.delete("/auth/logout")
        assert resp.status_code == 200
        # The response should clear the cookie (Max-Age=0 or empty value)
        set_cookie = _refresh_cookie(resp)
        assert set_cookie is not None
        assert "Max-Age=0" in set_cookie or 'refresh_token=""' in set_cookie or "refresh_token=;" in set_cookie


# ---------------------------------------------------------------------------
# POST /auth/resend-verification  &  POST /auth/forgot-password
# ---------------------------------------------------------------------------

class TestSafeEndpoints:
    """These endpoints always return 200 regardless of email existence (no info leak)."""

    def test_resend_unknown_email(self, client, db_session):
        resp = client.post("/auth/resend-verification", json={"email": _email()})
        assert resp.status_code == 200
        assert resp.get_json()["ok"] is True

    def test_resend_empty_body(self, client, db_session):
        resp = client.post("/auth/resend-verification", json={})
        assert resp.status_code == 200

    def test_forgot_password_unknown_email(self, client, db_session):
        resp = client.post("/auth/forgot-password", json={"email": _email()})
        assert resp.status_code == 200
        assert resp.get_json()["ok"] is True

    def test_resend_sends_email_for_unverified(self, client, db_session):
        email = _email()
        _register(client, email)
        with patch(PATCH_SEND) as mock_send:
            resp = client.post("/auth/resend-verification", json={"email": email})
        assert resp.status_code == 200
        mock_send.assert_called_once()
        assert mock_send.call_args.args[0] == email
