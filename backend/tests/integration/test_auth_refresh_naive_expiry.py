"""POST /auth/refresh against production's refresh_tokens schema.

Production's refresh_tokens.expires_at is a plain TIMESTAMP (the committed
001_auth.sql says TIMESTAMPTZ). Comparing that naive value with an aware Python
datetime raised TypeError, so every refresh returned 500. These tests switch the
column to TIMESTAMP for their duration.
"""
import pytest
from sqlalchemy import text

from tests.integration.test_auth import (
    _email, _register, _mark_verified, _login, _refresh_cookie, _origin_headers,
)


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    from app import limiter
    limiter.reset()


@pytest.fixture
def naive_expiry_column(app):
    from app import db
    with app.app_context():
        with db.engine.begin() as conn:
            conn.execute(text("ALTER TABLE refresh_tokens ALTER COLUMN expires_at TYPE TIMESTAMP"))
    try:
        yield
    finally:
        with app.app_context():
            with db.engine.begin() as conn:
                conn.execute(text("ALTER TABLE refresh_tokens ALTER COLUMN expires_at TYPE TIMESTAMPTZ"))


def _logged_in(client, app):
    email = _email()
    _register(client, email)
    _mark_verified(app, email)
    cookie = _refresh_cookie(_login(client, email))
    value = cookie.split("refresh_token=")[1].split(";")[0]
    client.set_cookie("refresh_token", value, path="/auth")
    return email


def test_refresh_works_with_a_naive_timestamp_column(client, app, naive_expiry_column):
    _logged_in(client, app)
    resp = client.post("/auth/refresh", headers=_origin_headers(app))
    assert resp.status_code == 200, resp.get_data(as_text=True)
    assert "access_token" in resp.get_json()


def test_expired_token_is_refused_with_a_naive_timestamp_column(client, app, naive_expiry_column):
    email = _logged_in(client, app)
    from app import db
    with app.app_context():
        with db.engine.begin() as conn:
            conn.execute(
                text("UPDATE refresh_tokens SET expires_at = NOW() - INTERVAL '1 hour' "
                     "WHERE user_id = (SELECT user_id FROM users WHERE LOWER(email) = :e)"),
                {"e": email.lower()},
            )
    resp = client.post("/auth/refresh", headers=_origin_headers(app))
    assert resp.status_code == 401


def test_expired_token_is_refused_with_the_tz_column(client, app):
    email = _logged_in(client, app)
    from app import db
    with app.app_context():
        with db.engine.begin() as conn:
            conn.execute(
                text("UPDATE refresh_tokens SET expires_at = NOW() - INTERVAL '1 hour' "
                     "WHERE user_id = (SELECT user_id FROM users WHERE LOWER(email) = :e)"),
                {"e": email.lower()},
            )
    assert client.post("/auth/refresh", headers=_origin_headers(app)).status_code == 401
