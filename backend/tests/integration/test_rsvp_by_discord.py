"""Integration tests for POST/DELETE /events/rsvp/by-discord (backend/app/routes/events/rsvp.py)
and the google_event_id filter on GET /events/.

The Discord bot RSVPs people by Discord ID against an event's Google Calendar ID.
"""
import uuid

import pytest
from flask_jwt_extended import create_access_token

URL = "/events/rsvp/by-discord"


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """The app-wide default limit (60/hour, in-memory) is shared by the whole test
    session; these files issue many requests, so start each test with a clean bucket."""
    from app import limiter
    limiter.reset()


def _make_user(app, role, with_profile_discord_id=None):
    """Insert a user (+ profile when a discord_id is given). Returns (user_id, headers)."""
    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, role, email_verified_at) VALUES (%s, %s, NOW()) RETURNING user_id",
                (f"rbd_{role}_{uuid.uuid4().hex}@test.com", role),
            )
            user_id = cur.fetchone()["user_id"]
            if with_profile_discord_id is not None:
                cur.execute(
                    "INSERT INTO profile (user_id, student_id, first_name, last_name, discord_id) "
                    "VALUES (%s, %s, 'T', 'U', %s)",
                    (user_id, uuid.uuid4().hex[:12], with_profile_discord_id),
                )
            conn.commit()
        token = create_access_token(identity=str(user_id), additional_claims={"role": role})
        return user_id, {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _make_event(app, rsvp_enabled=True):
    """Insert an event with a unique google_event_id. Returns (event_id, google_event_id)."""
    gid = f"gcal_{uuid.uuid4().hex}"
    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO events (name, event_type, starts_at, rsvp_enabled, google_event_id) "
                "VALUES (%s, 'meeting', NOW(), %s, %s) RETURNING event_id",
                (f"Discord RSVP {uuid.uuid4().hex[:8]}", rsvp_enabled, gid),
            )
            event_id = cur.fetchone()["event_id"]
            conn.commit()
        return event_id, gid


def _rsvp_rows(app, event_id, user_id):
    with app.test_request_context():
        from app.raw_db import get_db
        with get_db().cursor() as cur:
            cur.execute("SELECT source FROM event_rsvps WHERE event_id = %s AND user_id = %s", (event_id, user_id))
            return [r["source"] for r in cur.fetchall()]


@pytest.fixture(scope="module")
def admin_headers(app):
    return _make_user(app, "admin")[1]


@pytest.fixture
def discord_id():
    return str(int(uuid.uuid4().int % 10**18) + 10**18)


@pytest.fixture
def linked(app, discord_id):
    user_id, headers = _make_user(app, "member", with_profile_discord_id=discord_id)
    return user_id, headers, discord_id


# --- auth ------------------------------------------------------------------

@pytest.mark.parametrize("method", ["post", "delete"])
def test_requires_token(client, method):
    res = getattr(client, method)(URL, json={"google_event_id": "x", "discord_id": "1"})
    assert res.status_code == 401


@pytest.mark.parametrize("method", ["post", "delete"])
@pytest.mark.parametrize("role", ["member", "officer"])
def test_non_admin_forbidden(app, client, method, role):
    _, headers = _make_user(app, role)
    res = getattr(client, method)(URL, json={"google_event_id": "x", "discord_id": "1"}, headers=headers)
    assert res.status_code == 403


# --- validation / resolution -----------------------------------------------

@pytest.mark.parametrize("body", [
    {}, {"google_event_id": "x"}, {"discord_id": "1"},
    {"google_event_id": "  ", "discord_id": "1"}, {"google_event_id": "x", "discord_id": ""},
    {"google_event_id": 5, "discord_id": "1"},
])
@pytest.mark.parametrize("method", ["post", "delete"])
def test_missing_fields_422(client, admin_headers, method, body):
    res = getattr(client, method)(URL, json=body, headers=admin_headers)
    assert res.status_code == 422
    assert res.get_json() == {"error": "google_event_id_and_discord_id_required"}


@pytest.mark.parametrize("method", ["post", "delete"])
def test_unknown_event_404(client, admin_headers, linked, method):
    _, _, did = linked
    res = getattr(client, method)(URL, json={"google_event_id": "nope", "discord_id": did}, headers=admin_headers)
    assert res.status_code == 404
    assert res.get_json() == {"error": "event_not_found"}


@pytest.mark.parametrize("method", ["post", "delete"])
def test_unknown_discord_id_404(app, client, admin_headers, discord_id, method):
    _, gid = _make_event(app)
    res = getattr(client, method)(URL, json={"google_event_id": gid, "discord_id": discord_id}, headers=admin_headers)
    assert res.status_code == 404
    assert res.get_json() == {"error": "profile_not_found"}


@pytest.mark.parametrize("method", ["post", "delete"])
def test_duplicate_discord_id_is_ambiguous(app, client, admin_headers, discord_id, method):
    u1, _ = _make_user(app, "member", with_profile_discord_id=discord_id)
    u2, _ = _make_user(app, "member", with_profile_discord_id=discord_id)
    event_id, gid = _make_event(app)
    res = getattr(client, method)(URL, json={"google_event_id": gid, "discord_id": discord_id}, headers=admin_headers)
    assert res.status_code == 404
    assert res.get_json() == {"error": "ambiguous_profile"}
    assert _rsvp_rows(app, event_id, u1) == [] and _rsvp_rows(app, event_id, u2) == []


# --- add / remove ----------------------------------------------------------

def test_add_creates_discord_rsvp(app, client, admin_headers, linked):
    user_id, _, did = linked
    event_id, gid = _make_event(app)
    res = client.post(URL, json={"google_event_id": gid, "discord_id": did}, headers=admin_headers)
    assert res.status_code == 201
    assert res.get_json() == {"success": True, "created": True}
    assert _rsvp_rows(app, event_id, user_id) == ["discord"]


def test_repeat_add_not_created(app, client, admin_headers, linked):
    user_id, _, did = linked
    event_id, gid = _make_event(app)
    body = {"google_event_id": gid, "discord_id": did}
    client.post(URL, json=body, headers=admin_headers)
    res = client.post(URL, json=body, headers=admin_headers)
    assert res.status_code == 201
    assert res.get_json() == {"success": True, "created": False}
    assert _rsvp_rows(app, event_id, user_id) == ["discord"]


def test_add_rejected_when_rsvp_disabled(app, client, admin_headers, linked):
    user_id, _, did = linked
    event_id, gid = _make_event(app, rsvp_enabled=False)
    res = client.post(URL, json={"google_event_id": gid, "discord_id": did}, headers=admin_headers)
    assert res.status_code == 400
    assert res.get_json() == {"error": "rsvp_disabled"}
    assert _rsvp_rows(app, event_id, user_id) == []


def test_remove_deletes_discord_rsvp(app, client, admin_headers, linked):
    user_id, _, did = linked
    event_id, gid = _make_event(app)
    body = {"google_event_id": gid, "discord_id": did}
    client.post(URL, json=body, headers=admin_headers)
    res = client.delete(URL, json=body, headers=admin_headers)
    assert res.status_code == 200
    assert res.get_json() == {"success": True, "deleted": True}
    assert _rsvp_rows(app, event_id, user_id) == []
    # Removing again is a no-op
    res = client.delete(URL, json=body, headers=admin_headers)
    assert res.get_json() == {"success": True, "deleted": False}


def test_remove_allowed_when_rsvp_disabled(app, client, admin_headers, linked):
    user_id, _, did = linked
    event_id, gid = _make_event(app)
    body = {"google_event_id": gid, "discord_id": did}
    client.post(URL, json=body, headers=admin_headers)
    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("UPDATE events SET rsvp_enabled = FALSE WHERE event_id = %s", (event_id,))
            conn.commit()
    res = client.delete(URL, json=body, headers=admin_headers)
    assert res.status_code == 200
    assert res.get_json() == {"success": True, "deleted": True}
    assert _rsvp_rows(app, event_id, user_id) == []


def test_website_rsvp_survives_discord_add_and_remove(app, client, admin_headers, linked):
    user_id, user_headers, did = linked
    event_id, gid = _make_event(app)
    assert client.post(f"/events/{event_id}/rsvp", headers=user_headers).status_code == 201
    assert _rsvp_rows(app, event_id, user_id) == ["website"]

    body = {"google_event_id": gid, "discord_id": did}
    res = client.post(URL, json=body, headers=admin_headers)
    assert res.status_code == 201
    assert res.get_json() == {"success": True, "created": False}
    assert _rsvp_rows(app, event_id, user_id) == ["website"]

    res = client.delete(URL, json=body, headers=admin_headers)
    assert res.status_code == 200
    assert res.get_json() == {"success": True, "deleted": False}
    assert _rsvp_rows(app, event_id, user_id) == ["website"]


def test_per_event_route_not_shadowed(app, client, admin_headers):
    """/events/<id>/rsvp/stats still routes to the stats view for an admin token."""
    event_id, _ = _make_event(app)
    res = client.get(f"/events/{event_id}/rsvp/stats", headers=admin_headers)
    assert res.status_code == 200
    assert set(res.get_json()) == {"event_id", "rsvp_count", "attended", "conversion_pct"}


# --- GET /events/?google_event_id= -----------------------------------------

def test_events_google_event_id_filter(app, client):
    event_id, gid = _make_event(app)
    _make_event(app)  # a different event that must not match
    res = client.get(f"/events/?google_event_id={gid}")
    assert res.status_code == 200
    rows = res.get_json()
    assert [r["event_id"] for r in rows] == [event_id]
    assert rows[0]["google_event_id"] == gid


def test_events_google_event_id_filter_no_match(client):
    res = client.get("/events/?google_event_id=does-not-exist")
    assert res.status_code == 404
