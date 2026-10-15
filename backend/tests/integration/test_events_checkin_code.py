"""GET /events/ must only reveal check-in codes to officers/admins."""
import uuid
from datetime import timedelta

import pytest
from flask_jwt_extended import create_access_token


@pytest.fixture(scope="module")
def event_code(app):
    code = f"T{uuid.uuid4().hex[:5].upper()}"
    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO events (name, event_type, starts_at, check_in_code, check_in_enabled)
                   VALUES (%s, 'meeting', NOW(), %s, TRUE)""",
                (f"Check-in Code Event {uuid.uuid4().hex[:8]}", code),
            )
            conn.commit()
    return code


def _token(app, role, expires=None):
    with app.app_context():
        return create_access_token(identity="1", additional_claims={"role": role}, expires_delta=expires)


def _codes(res):
    assert res.status_code == 200, res.get_json()
    return [row.get("check_in_code") for row in res.get_json()]


def test_anonymous_never_sees_codes(client, event_code):
    rows = client.get("/events/").get_json()
    assert all("check_in_code" not in row for row in rows)
    assert event_code not in _codes(client.get("/events/"))


@pytest.mark.parametrize("role", ["member", "non-member", "partner"])
def test_non_officers_never_see_codes(app, client, event_code, role):
    res = client.get("/events/", headers={"Authorization": f"Bearer {_token(app, role)}"})
    assert event_code not in _codes(res)


@pytest.mark.parametrize("role", ["officer", "admin"])
def test_officers_still_see_codes(app, client, event_code, role):
    # Admin → Events reads codes from this same endpoint.
    res = client.get("/events/", headers={"Authorization": f"Bearer {_token(app, role)}"})
    assert event_code in _codes(res)


def test_expired_or_bad_token_is_treated_as_anonymous(app, client, event_code):
    expired = _token(app, "officer", expires=timedelta(seconds=-1))
    for header in (f"Bearer {expired}", "Bearer not-a-jwt"):
        res = client.get("/events/", headers={"Authorization": header})
        assert event_code not in _codes(res)  # 200, just without codes
