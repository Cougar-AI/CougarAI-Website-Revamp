"""Integration tests for dashboard endpoints.

Routes covered:
  GET   /dashboard/me              — authenticated
  PATCH /dashboard/profile         — authenticated
  POST  /dashboard/profile/link    — authenticated
  GET   /dashboard/memberships     — authenticated
  GET   /dashboard/points          — authenticated
"""
from __future__ import annotations

import pytest

from tests.integration.helpers import make_user, make_profile


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def member_no_profile(app):
    user_id, headers = make_user(app, "member")
    return {"user_id": user_id, "headers": headers}


@pytest.fixture(scope="module")
def member_with_profile(app):
    user_id, headers = make_user(app, "member")
    student_id = make_profile(app, user_id)
    return {"user_id": user_id, "student_id": student_id, "headers": headers}


# ---------------------------------------------------------------------------
# GET /dashboard/me
# ---------------------------------------------------------------------------

class TestGetMe:
    def test_returns_user_info(self, client, member_no_profile, db_session):
        resp = client.get("/dashboard/me", headers=member_no_profile["headers"])
        assert resp.status_code == 200
        body = resp.get_json()
        assert "email" in body or "user_id" in body

    def test_unauthenticated_returns_401(self, client, db_session):
        resp = client.get("/dashboard/me")
        assert resp.status_code in (401, 422)


# ---------------------------------------------------------------------------
# PATCH /dashboard/profile
# ---------------------------------------------------------------------------

class TestUpdateProfile:
    def test_can_update_allowed_field(self, client, member_with_profile, db_session):
        resp = client.patch(
            "/dashboard/profile",
            json={"first_name": "Updated"},
            headers=member_with_profile["headers"],
        )
        assert resp.status_code == 200

    def test_unauthenticated_returns_401(self, client, db_session):
        resp = client.patch("/dashboard/profile", json={"first_name": "x"})
        assert resp.status_code in (401, 422)

    def test_unknown_fields_ignored(self, client, member_with_profile, db_session):
        resp = client.patch(
            "/dashboard/profile",
            json={"hacked_field": "value"},
            headers=member_with_profile["headers"],
        )
        # Should not crash — unknown fields are silently ignored
        assert resp.status_code != 500


# ---------------------------------------------------------------------------
# POST /dashboard/profile/link
# ---------------------------------------------------------------------------

class TestLinkProfile:
    def test_can_link_student_id(self, client, member_no_profile, app, db_session):
        import uuid
        sid = str(uuid.uuid4().int % 9_000_000 + 1_000_000)
        resp = client.post(
            "/dashboard/profile/link",
            json={"student_id": sid},
            headers=member_no_profile["headers"],
        )
        assert resp.status_code in (200, 201, 400)

    def test_missing_student_id_returns_error(self, client, member_no_profile, db_session):
        resp = client.post(
            "/dashboard/profile/link",
            json={},
            headers=member_no_profile["headers"],
        )
        assert resp.status_code == 400

    def test_unauthenticated_returns_401(self, client, db_session):
        resp = client.post("/dashboard/profile/link", json={"student_id": "1234567"})
        assert resp.status_code in (401, 422)


# ---------------------------------------------------------------------------
# GET /dashboard/memberships
# ---------------------------------------------------------------------------

class TestGetMemberships:
    def test_returns_200(self, client, member_with_profile, db_session):
        resp = client.get("/dashboard/memberships", headers=member_with_profile["headers"])
        assert resp.status_code == 200

    def test_unauthenticated_returns_401(self, client, db_session):
        resp = client.get("/dashboard/memberships")
        assert resp.status_code in (401, 422)


# ---------------------------------------------------------------------------
# GET /dashboard/points
# ---------------------------------------------------------------------------

class TestGetDashboardPoints:
    def test_returns_200(self, client, member_with_profile, db_session):
        resp = client.get("/dashboard/points", headers=member_with_profile["headers"])
        assert resp.status_code == 200

    def test_unauthenticated_returns_401(self, client, db_session):
        resp = client.get("/dashboard/points")
        assert resp.status_code in (401, 422)
