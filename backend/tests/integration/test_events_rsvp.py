"""
Integration tests for the /events/<id>/rsvp routes (backend/app/routes/events/rsvp.py).

Covers the RSVP member-state fix and the non-member RSVP follow-up from
`fix/rsvp-member-state`:
  - non-member/member/officer can POST an RSVP (2xx)
  - the RSVP shows up in GET /events/my-rsvps
  - DELETE removes the RSVP
  - GET /<id>/rsvp (the officer-only roster) is 403 for member/non-member and
    2xx for officer
  - unauthenticated POST is rejected

Requires Docker/Postgres via tests/conftest.py::app. Each test uses a unique
uuid-suffixed email and creates its own event row to stay isolated from other
tests (Phase-1 limitation — see CLAUDE.md).
"""
from __future__ import annotations

import uuid

import pytest
from flask_jwt_extended import create_access_token


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(app, role: str) -> tuple[int, str]:
    """Insert a user with the given role, return (user_id, auth_header_token)."""
    with app.test_request_context():
        from app.raw_db import get_db

        email = f"rsvp_{role.replace('-', '_')}_{uuid.uuid4().hex}@test.com"
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, role, email_verified_at) VALUES (%s, %s, NOW()) RETURNING user_id",
                (email, role),
            )
            user_id = cur.fetchone()["user_id"]
            conn.commit()
        token = create_access_token(identity=str(user_id), additional_claims={"role": role})
        return user_id, token


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _make_event(app, rsvp_enabled: bool = True) -> int:
    """Insert a bare-minimum event row, return its event_id."""
    with app.test_request_context():
        from app.raw_db import get_db

        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO events (name, event_type, starts_at, rsvp_enabled)
                   VALUES (%s, %s, NOW(), %s)
                   RETURNING event_id""",
                (f"RSVP Test Event {uuid.uuid4().hex[:8]}", "meeting", rsvp_enabled),
            )
            event_id = cur.fetchone()["event_id"]
            conn.commit()
        return event_id


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def member(app):
    return _make_user(app, "member")


@pytest.fixture
def non_member(app):
    return _make_user(app, "non-member")


@pytest.fixture
def officer(app):
    return _make_user(app, "officer")


@pytest.fixture
def event_id(app):
    return _make_event(app, rsvp_enabled=True)


# ---------------------------------------------------------------------------
# POST /events/<id>/rsvp
# ---------------------------------------------------------------------------

class TestCreateRsvp:
    def test_member_can_rsvp_and_it_appears_in_my_rsvps(self, client, app, member, event_id):
        _, token = member
        resp = client.post(f"/events/{event_id}/rsvp", headers=_auth_headers(token))
        assert resp.status_code in (200, 201)

        resp = client.get("/events/my-rsvps", headers=_auth_headers(token))
        assert resp.status_code == 200
        assert event_id in resp.get_json()["rsvped_event_ids"]

    def test_non_member_can_rsvp(self, client, app, non_member, event_id):
        """Regression test for the non-member RSVP follow-up (previously 403)."""
        _, token = non_member
        resp = client.post(f"/events/{event_id}/rsvp", headers=_auth_headers(token))
        assert resp.status_code in (200, 201)

        resp = client.get("/events/my-rsvps", headers=_auth_headers(token))
        assert resp.status_code == 200
        assert event_id in resp.get_json()["rsvped_event_ids"]

    def test_officer_can_rsvp(self, client, app, officer, event_id):
        _, token = officer
        resp = client.post(f"/events/{event_id}/rsvp", headers=_auth_headers(token))
        assert resp.status_code in (200, 201)

    def test_rsvp_is_idempotent(self, client, app, member, event_id):
        _, token = member
        resp1 = client.post(f"/events/{event_id}/rsvp", headers=_auth_headers(token))
        resp2 = client.post(f"/events/{event_id}/rsvp", headers=_auth_headers(token))
        assert resp1.status_code in (200, 201)
        assert resp2.status_code in (200, 201)

        resp = client.get("/events/my-rsvps", headers=_auth_headers(token))
        ids = resp.get_json()["rsvped_event_ids"]
        assert ids.count(event_id) == 1

    def test_rsvp_disabled_event_rejected(self, client, app, member):
        disabled_event_id = _make_event(app, rsvp_enabled=False)
        _, token = member
        resp = client.post(f"/events/{disabled_event_id}/rsvp", headers=_auth_headers(token))
        assert resp.status_code == 400

    def test_rsvp_nonexistent_event(self, client, app, member):
        _, token = member
        resp = client.post("/events/999999999/rsvp", headers=_auth_headers(token))
        assert resp.status_code == 404

    def test_unauthenticated_rsvp_rejected(self, client, event_id):
        resp = client.post(f"/events/{event_id}/rsvp")
        assert resp.status_code in (401, 422)


# ---------------------------------------------------------------------------
# DELETE /events/<id>/rsvp
# ---------------------------------------------------------------------------

class TestCancelRsvp:
    def test_delete_removes_rsvp(self, client, app, member, event_id):
        _, token = member
        client.post(f"/events/{event_id}/rsvp", headers=_auth_headers(token))

        resp = client.delete(f"/events/{event_id}/rsvp", headers=_auth_headers(token))
        assert resp.status_code == 200

        resp = client.get("/events/my-rsvps", headers=_auth_headers(token))
        assert event_id not in resp.get_json()["rsvped_event_ids"]

    def test_delete_when_not_rsvped_is_a_noop(self, client, app, member, event_id):
        _, token = member
        resp = client.delete(f"/events/{event_id}/rsvp", headers=_auth_headers(token))
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /events/<id>/rsvp (officer-only roster)
# ---------------------------------------------------------------------------

class TestListEventRsvps:
    def test_member_forbidden(self, client, app, member, event_id):
        _, token = member
        resp = client.get(f"/events/{event_id}/rsvp", headers=_auth_headers(token))
        assert resp.status_code == 403

    def test_non_member_forbidden(self, client, app, non_member, event_id):
        _, token = non_member
        resp = client.get(f"/events/{event_id}/rsvp", headers=_auth_headers(token))
        assert resp.status_code == 403

    def test_officer_allowed(self, client, app, officer, member, event_id):
        officer_user_id, officer_token = officer
        member_user_id, member_token = member
        client.post(f"/events/{event_id}/rsvp", headers=_auth_headers(member_token))

        resp = client.get(f"/events/{event_id}/rsvp", headers=_auth_headers(officer_token))
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["count"] >= 1
        assert any(r["user_id"] == member_user_id for r in body["rsvps"])

    def test_unauthenticated_forbidden(self, client, event_id):
        resp = client.get(f"/events/{event_id}/rsvp")
        assert resp.status_code in (401, 422)
