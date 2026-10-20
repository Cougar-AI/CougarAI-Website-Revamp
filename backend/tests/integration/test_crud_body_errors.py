"""Client mistakes in the CRUD routes are 400s, not 500s.

- build_sql_querys(mode="SET") raises NothingToUpdate instead of emitting
  `UPDATE t WHERE ...`; every PATCH caller answers it with 400.
- A missing / null / non-object body is 400 "JSON object body required"
  (app/utils/request_body.py) instead of crashing on request.json.
- A database failure in POST/PATCH/DELETE /events surfaces as itself, not as
  the UnboundLocalError the old `except: connection.rollback()` raised.
"""
import uuid

import psycopg2
import pytest
from flask_jwt_extended import create_access_token

BAD_BODIES = [
    {},                                                    # no body at all
    {"data": "not json", "content_type": "text/plain"},
    {"data": "{broken", "content_type": "application/json"},
    {"json": None},
    {"json": []},
    {"json": "a string"},
]


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    from app import limiter
    limiter.reset()


@pytest.fixture(autouse=True)
def synced(monkeypatch):
    calls = []
    monkeypatch.setattr("app.routes.events.crud.schedule_google_sync", calls.append)
    return calls


def _headers(app, role):
    with app.test_request_context():
        token = create_access_token(identity="1", additional_claims={"role": role})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def officer(app):
    return _headers(app, "officer")


@pytest.fixture
def admin(app):
    return _headers(app, "admin")


def _sql(app, query, params=()):
    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(query, params)
            row = cur.fetchone() if cur.description else None
        conn.commit()
        return row


@pytest.fixture
def student_id(app):
    sid = uuid.uuid4().hex[:12]
    uid = _sql(app, "INSERT INTO users (email, role) VALUES (%s, 'member') RETURNING user_id",
               (f"crud_{uuid.uuid4().hex}@test.com",))["user_id"]
    _sql(app, "INSERT INTO profile (user_id, student_id, first_name) VALUES (%s, %s, 'Old')", (uid, sid))
    return sid


# --- POST /events/ -----------------------------------------------------------

@pytest.mark.parametrize("kwargs", BAD_BODIES)
def test_create_event_non_object_body_400(client, officer, synced, kwargs):
    res = client.post("/events/", headers=officer, **kwargs)
    assert res.status_code == 400
    assert res.get_json() == {"error": "JSON object body required"}
    assert synced == []


def test_create_event_missing_fields_still_400(client, officer):
    res = client.post("/events/", json={"name": "x"}, headers=officer)
    assert res.status_code == 400
    assert res.get_json() == {"error": "name, starts_at and event_type are required"}


@pytest.mark.parametrize("starts_at", ["2026-11-03T18:00:00", "11-03-2026"])
def test_create_event_still_accepts_iso_and_the_bots_mm_dd_yyyy(client, officer, synced, starts_at):
    """Older Discord bot builds sent MM-DD-YYYY (Postgres parses it); keep accepting it."""
    res = client.post("/events/", json={"name": f"E {uuid.uuid4().hex[:6]}", "event_type": "meeting",
                                        "starts_at": starts_at}, headers=officer)
    assert res.status_code == 201
    assert synced == [res.get_json()["event_id"]]


# --- database failure surfaces as itself ------------------------------------------

def _db_down():
    raise psycopg2.OperationalError("database is down")


@pytest.mark.parametrize("method,path,body", [
    ("POST", "/events/", {"name": "x", "event_type": "meeting", "starts_at": "2026-11-03T18:00:00"}),
    ("PATCH", "/events/1", {"name": "x"}),
    ("DELETE", "/events/1", None),
])
def test_db_failure_is_not_masked(client, admin, monkeypatch, method, path, body):
    monkeypatch.setattr("app.routes.events.crud.get_db", _db_down)
    with pytest.raises(psycopg2.OperationalError, match="database is down"):
        client.open(path, method=method, json=body, headers=admin)


# --- the other build_sql_querys(mode="SET") callers ---------------------------------

PATCH_ROUTES = ["/announcements/999999", "/points/999999", "/profile/nobody"]


@pytest.mark.parametrize("path", PATCH_ROUTES + ["/events/999999"])
@pytest.mark.parametrize("body", [{}, {"unknown": 1}])
def test_patch_nothing_to_update_400(client, officer, path, body):
    res = client.patch(path, json=body, headers=officer)
    assert res.status_code == 400
    assert res.get_json() == {"error": "No fields to update"}


@pytest.mark.parametrize("path", PATCH_ROUTES + ["/officers/1234567"])
@pytest.mark.parametrize("kwargs", BAD_BODIES)
def test_patch_non_object_body_400(client, officer, path, kwargs):
    res = client.patch(path, headers=officer, **kwargs)
    assert res.status_code == 400
    assert res.get_json() == {"error": "JSON object body required"}


def test_profile_patch_still_updates(app, client, officer, student_id):
    res = client.patch(f"/profile/{student_id}", json={"first_name": "New"}, headers=officer)
    assert res.status_code == 200
    assert _sql(app, "SELECT first_name FROM profile WHERE student_id = %s", (student_id,))["first_name"] == "New"


def test_points_patch_still_updates(app, client, officer, student_id):
    pid = _sql(app, "INSERT INTO points (student_id, points) VALUES (%s, 5) RETURNING points_id",
               (student_id,))["points_id"]
    res = client.patch(f"/points/{pid}", json={"points": 7}, headers=officer)
    assert res.status_code == 200
    assert _sql(app, "SELECT points FROM points WHERE points_id = %s", (pid,))["points"] == 7


def test_points_patch_zero_is_a_value(app, client, officer, student_id):
    pid = _sql(app, "INSERT INTO points (student_id, points) VALUES (%s, 5) RETURNING points_id",
               (student_id,))["points_id"]
    assert client.patch(f"/points/{pid}", json={"points": 0}, headers=officer).status_code == 200


def test_discord_config_patch_new_fields_only_still_works(app, client, admin):
    """discord.py appends its own SET columns, so it opts out with allow_empty_set."""
    guild = str(10**17 + uuid.uuid4().int % 10**17)
    assert client.post(f"/discord/config/{guild}", json={}, headers=admin).status_code == 201
    assert client.patch(f"/discord/config/{guild}", json={"gcal_sync_enabled": True}, headers=admin).status_code == 200
    res = client.patch(f"/discord/config/{guild}", json={}, headers=admin)
    assert res.status_code == 400 and res.get_json() == {"error": "No fields to update"}


@pytest.mark.parametrize("path", PATCH_ROUTES + ["/events/1"])
def test_auth_still_checked_before_body(client, path):
    assert client.patch(path, json={}).status_code == 401
