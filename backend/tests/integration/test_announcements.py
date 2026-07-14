"""Integration tests for pinned announcement endpoints.

Routes covered:
  GET    /admin/pinned-announcement   — admin (returns active announcement)
  POST   /admin/pinned-announcement   — admin (create/replace active announcement)
  DELETE /admin/pinned-announcement   — admin (deactivates active announcement)
"""
from __future__ import annotations

import pytest

from tests.integration.helpers import make_user


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def admin(app):
    user_id, headers = make_user(app, "admin")
    return {"user_id": user_id, "headers": headers}


@pytest.fixture(scope="module")
def member(app):
    user_id, headers = make_user(app, "member")
    return {"user_id": user_id, "headers": headers}


# ---------------------------------------------------------------------------
# GET /admin/pinned-announcement
# ---------------------------------------------------------------------------

class TestGetPinnedAnnouncement:
    def test_admin_can_get(self, client, admin, db_session):
        resp = client.get("/admin/pinned-announcement", headers=admin["headers"])
        assert resp.status_code == 200
        body = resp.get_json()
        assert "announcement" in body

    def test_unauthenticated_returns_401(self, client, db_session):
        resp = client.get("/admin/pinned-announcement")
        assert resp.status_code in (401, 422)

    def test_member_cannot_get(self, client, member, db_session):
        resp = client.get("/admin/pinned-announcement", headers=member["headers"])
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /admin/pinned-announcement
# ---------------------------------------------------------------------------

class TestCreatePinnedAnnouncement:
    def test_admin_can_create(self, client, admin, db_session):
        resp = client.post(
            "/admin/pinned-announcement",
            json={"message": "Test announcement"},
            headers=admin["headers"],
        )
        assert resp.status_code == 201
        body = resp.get_json()
        assert "id" in body

    def test_missing_message_returns_400(self, client, admin, db_session):
        resp = client.post(
            "/admin/pinned-announcement",
            json={},
            headers=admin["headers"],
        )
        assert resp.status_code == 400

    def test_member_cannot_create(self, client, member, db_session):
        resp = client.post(
            "/admin/pinned-announcement",
            json={"message": "hi"},
            headers=member["headers"],
        )
        assert resp.status_code == 403

    def test_unauthenticated_returns_401(self, client, db_session):
        resp = client.post("/admin/pinned-announcement", json={"message": "hi"})
        assert resp.status_code in (401, 422)


# ---------------------------------------------------------------------------
# DELETE /admin/pinned-announcement
# ---------------------------------------------------------------------------

class TestDeletePinnedAnnouncement:
    def test_admin_can_delete(self, client, admin, db_session):
        # Create one first
        client.post(
            "/admin/pinned-announcement",
            json={"message": "To delete"},
            headers=admin["headers"],
        )
        resp = client.delete("/admin/pinned-announcement", headers=admin["headers"])
        assert resp.status_code == 200

    def test_member_cannot_delete(self, client, member, db_session):
        resp = client.delete("/admin/pinned-announcement", headers=member["headers"])
        assert resp.status_code == 403

    def test_unauthenticated_returns_401(self, client, db_session):
        resp = client.delete("/admin/pinned-announcement")
        assert resp.status_code in (401, 422)
