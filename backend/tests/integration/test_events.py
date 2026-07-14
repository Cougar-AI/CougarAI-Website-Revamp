"""Integration tests for core event CRUD and event-types endpoints.

Routes covered:
  GET  /events/event-types     — public
  GET  /events/               — public
  POST /events/               — officer+
  PATCH /events/<id>          — officer+
  DELETE /events/<id>         — admin
"""
from __future__ import annotations

import uuid
import pytest

from tests.integration.helpers import make_user


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def officer(app):
    user_id, headers = make_user(app, "officer")
    return {"user_id": user_id, "headers": headers}


@pytest.fixture(scope="module")
def admin(app):
    user_id, headers = make_user(app, "admin")
    return {"user_id": user_id, "headers": headers}


def _unique_name():
    return f"Test Event {uuid.uuid4().hex[:6]}"


def _create_event(client, headers, name=None, event_type="other"):
    return client.post(
        "/events/",
        json={
            "name": name or _unique_name(),
            "event_type": event_type,
            "starts_at": "2026-09-01 10:00:00",
            "ends_at": "2026-09-01 11:00:00",
            "points_value": 10,
        },
        headers=headers,
    )


# ---------------------------------------------------------------------------
# GET /events/event-types
# ---------------------------------------------------------------------------

class TestEventTypes:
    def test_returns_list(self, client, db_session):
        resp = client.get("/events/event-types")
        assert resp.status_code == 200
        body = resp.get_json()
        assert "event_types" in body
        assert isinstance(body["event_types"], list)

    def test_seeded_types_present(self, client, db_session):
        resp = client.get("/events/event-types")
        names = [t["name"] for t in resp.get_json()["event_types"]]
        assert len(names) > 0

    def test_options_preflight(self, client, db_session):
        resp = client.options("/events/event-types")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /events/
# ---------------------------------------------------------------------------

class TestCreateEvent:
    def test_officer_can_create(self, client, officer, db_session):
        resp = _create_event(client, officer["headers"])
        assert resp.status_code == 201
        assert "event_id" in resp.get_json()

    def test_missing_required_fields_returns_400(self, client, officer, db_session):
        resp = client.post(
            "/events/",
            json={"name": "No Type Event"},
            headers=officer["headers"],
        )
        assert resp.status_code == 400

    def test_unauthenticated_returns_401(self, client, db_session):
        resp = _create_event(client, {})
        assert resp.status_code in (401, 422)


# ---------------------------------------------------------------------------
# GET /events/
# ---------------------------------------------------------------------------

class TestGetEvents:
    def test_returns_list_when_events_exist(self, client, officer, db_session):
        _create_event(client, officer["headers"])
        resp = client.get("/events/")
        assert resp.status_code == 200
        assert isinstance(resp.get_json(), list)

    def test_invalid_date_format_returns_400(self, client, db_session):
        resp = client.get("/events/?starts_at=not-a-date")
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# PATCH /events/<id>
# ---------------------------------------------------------------------------

class TestUpdateEvent:
    def test_officer_can_update(self, client, officer, db_session):
        create_resp = _create_event(client, officer["headers"])
        event_id = create_resp.get_json()["event_id"]

        resp = client.patch(
            f"/events/{event_id}",
            json={"name": "Updated Name"},
            headers=officer["headers"],
        )
        assert resp.status_code == 200

    def test_nonexistent_event_returns_404(self, client, officer, db_session):
        resp = client.patch(
            "/events/999999",
            json={"name": "Ghost"},
            headers=officer["headers"],
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /events/<id>
# ---------------------------------------------------------------------------

class TestDeleteEvent:
    def test_admin_can_delete(self, client, officer, admin, db_session):
        create_resp = _create_event(client, officer["headers"])
        event_id = create_resp.get_json()["event_id"]

        resp = client.delete(f"/events/{event_id}", headers=admin["headers"])
        assert resp.status_code == 200

    def test_officer_cannot_delete(self, client, officer, db_session):
        create_resp = _create_event(client, officer["headers"])
        event_id = create_resp.get_json()["event_id"]

        resp = client.delete(f"/events/{event_id}", headers=officer["headers"])
        assert resp.status_code == 403

    def test_nonexistent_returns_404(self, client, admin, db_session):
        resp = client.delete("/events/999999", headers=admin["headers"])
        assert resp.status_code == 404
