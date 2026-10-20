"""Integration tests for PATCH /events/<event_id> (backend/app/routes/events/crud.py).

A body with nothing to update used to reach SQL as `UPDATE events WHERE ...`
and come back as a 500; a missing / null / non-object body crashed on
request.json. Both are client errors now.
"""
import uuid

import pytest
from flask_jwt_extended import create_access_token


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """The app-wide default limit (60/hour, in-memory) is shared by the whole test
    session; these files issue many requests, so start each test with a clean bucket."""
    from app import limiter
    limiter.reset()


@pytest.fixture(autouse=True)
def synced(monkeypatch):
    """Record Google Calendar syncs instead of running them."""
    calls = []
    monkeypatch.setattr("app.routes.events.crud.schedule_google_sync", calls.append)
    return calls


@pytest.fixture
def officer(app):
    with app.test_request_context():
        token = create_access_token(identity="1", additional_claims={"role": "officer"})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def event_id(app):
    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO events (name, event_type, starts_at) VALUES (%s, 'meeting', NOW()) RETURNING event_id",
                (f"Patch {uuid.uuid4().hex[:8]}",),
            )
            eid = cur.fetchone()["event_id"]
        conn.commit()
    return eid


def _name(app, eid):
    with app.test_request_context():
        from app.raw_db import get_db
        with get_db().cursor() as cur:
            cur.execute("SELECT name FROM events WHERE event_id = %s", (eid,))
            return cur.fetchone()["name"]


@pytest.mark.parametrize("body", [{}, {"name": None}, {"unknown_field": "x"}])
def test_nothing_to_update_is_400(app, client, officer, event_id, synced, body):
    before = _name(app, event_id)
    res = client.patch(f"/events/{event_id}", json=body, headers=officer)
    assert res.status_code == 400
    assert res.get_json() == {"error": "No fields to update"}
    assert _name(app, event_id) == before
    assert synced == []


def test_nothing_to_update_on_missing_event_is_400_not_404(client, officer, synced):
    res = client.patch("/events/999999999", json={}, headers=officer)
    assert res.status_code == 400


@pytest.mark.parametrize("kwargs", [
    {},                                                    # no body at all
    {"data": "not json", "content_type": "text/plain"},    # wrong content type
    {"data": "{broken", "content_type": "application/json"},
    {"json": None},
    {"json": []},
    {"json": "a string"},
])
def test_non_object_body_is_400(client, officer, event_id, synced, kwargs):
    res = client.patch(f"/events/{event_id}", headers=officer, **kwargs)
    assert res.status_code == 400
    assert res.get_json() == {"error": "JSON object body required"}
    assert synced == []


def test_real_update_still_works_and_syncs(app, client, officer, event_id, synced):
    res = client.patch(f"/events/{event_id}", json={"name": "Renamed"}, headers=officer)
    assert res.status_code == 200
    assert _name(app, event_id) == "Renamed"
    assert synced == [event_id]


def test_check_in_toggle_false_is_an_update(client, officer, event_id, synced):
    """`False` is not None: the bot's /events toggle sends exactly this body."""
    res = client.patch(f"/events/{event_id}", json={"check_in_enabled": False}, headers=officer)
    assert res.status_code == 200


def test_unknown_event_with_fields_is_still_404(client, officer, synced):
    res = client.patch("/events/999999999", json={"name": "x"}, headers=officer)
    assert res.status_code == 404


@pytest.mark.parametrize("value", ["nope", 1700000000, ["2026-10-20"], {"a": 1}, True, ""])
@pytest.mark.parametrize("key", ["starts_at", "ends_at"])
def test_bad_datetime_400(client, officer, event_id, synced, key, value):
    """A non-string (TypeError in fromisoformat) used to fall to the catch-all 500."""
    res = client.patch(f"/events/{event_id}", json={key: value}, headers=officer)
    assert res.status_code == 400
    assert res.get_json() == {"error": "Invalid datetime format"}
    assert synced == []


def test_valid_iso_datetime_accepted(client, officer, event_id):
    res = client.patch(f"/events/{event_id}", json={"starts_at": "2026-10-20T18:00:00"}, headers=officer)
    assert res.status_code == 200


def test_auth_checked_before_body(client, event_id):
    assert client.patch(f"/events/{event_id}", json={}).status_code == 401
