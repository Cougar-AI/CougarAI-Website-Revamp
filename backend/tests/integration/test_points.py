"""Integration tests for points and leaderboard endpoints.

Routes covered:
  GET /points/leaderboard
  GET /points/streak-leaderboard
  GET /points/total/by-month
  GET /points/student/<id>
  POST /points/add/<student_id>   — officer+
"""
from __future__ import annotations

import uuid
import pytest

from tests.integration.helpers import make_user, make_profile


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def officer(app):
    user_id, headers = make_user(app, "officer")
    return {"user_id": user_id, "headers": headers}


@pytest.fixture(scope="module")
def public_student(app):
    """A member with a public profile and some points."""
    user_id, _ = make_user(app, "member")
    sid = make_profile(app, user_id)

    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO points (student_id, date, points, reason) VALUES (%s, CURRENT_DATE, 50, 'Test')",
                (sid,),
            )
            conn.commit()
    return {"user_id": user_id, "student_id": sid}


# ---------------------------------------------------------------------------
# GET /points/leaderboard
# ---------------------------------------------------------------------------

class TestLeaderboard:
    def test_returns_200(self, client, public_student, db_session):
        resp = client.get("/points/leaderboard")
        assert resp.status_code == 200
        body = resp.get_json()
        assert "entries" in body
        assert "caller_rank" in body
        assert "caller_total" in body

    def test_entries_are_list(self, client, public_student, db_session):
        resp = client.get("/points/leaderboard")
        assert isinstance(resp.get_json()["entries"], list)

    def test_date_filter_accepted(self, client, db_session):
        resp = client.get("/points/leaderboard?start_date=2026-01-01&end_date=2026-12-31")
        assert resp.status_code == 200

    def test_options_preflight(self, client, db_session):
        resp = client.options("/points/leaderboard")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /points/streak-leaderboard
# ---------------------------------------------------------------------------

class TestStreakLeaderboard:
    def test_returns_200(self, client, public_student, db_session):
        resp = client.get("/points/streak-leaderboard")
        assert resp.status_code == 200
        assert isinstance(resp.get_json(), list)

    def test_options_preflight(self, client, db_session):
        resp = client.options("/points/streak-leaderboard")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /points/total/by-month
# ---------------------------------------------------------------------------

class TestMonthlyTotals:
    def test_returns_200_when_data_exists(self, client, public_student, db_session):
        resp = client.get(f"/points/total/by-month?student_id={public_student['student_id']}")
        assert resp.status_code == 200

    def test_date_filter_params_accepted(self, client, db_session):
        resp = client.get("/points/total/by-month?start_date=2026-01-01&end_date=2026-12-31")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /points/student/<student_id>
# ---------------------------------------------------------------------------

class TestStudentPoints:
    def test_returns_student_points(self, client, public_student, db_session):
        sid = public_student["student_id"]
        resp = client.get(f"/points/student/{sid}")
        assert resp.status_code == 200

    def test_nonexistent_student_returns_404(self, client, db_session):
        resp = client.get("/points/student/9999999")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /points/add/<student_id>
# ---------------------------------------------------------------------------

class TestAddPoints:
    def test_officer_can_award_points(self, client, officer, public_student, db_session):
        sid = public_student["student_id"]
        resp = client.post(
            f"/points/add/{sid}",
            json={"points": 20, "date": "2026-06-01"},
            headers=officer["headers"],
        )
        assert resp.status_code == 201

    def test_missing_points_returns_400(self, client, officer, public_student, db_session):
        sid = public_student["student_id"]
        resp = client.post(
            f"/points/add/{sid}",
            json={"date": "2026-06-01"},
            headers=officer["headers"],
        )
        assert resp.status_code == 400

    def test_invalid_student_returns_400(self, client, officer, db_session):
        resp = client.post(
            "/points/add/9999999",
            json={"points": 10},
            headers=officer["headers"],
        )
        assert resp.status_code == 400

    def test_unauthenticated_returns_401(self, client, public_student, db_session):
        sid = public_student["student_id"]
        resp = client.post(f"/points/add/{sid}", json={"points": 10})
        assert resp.status_code in (401, 422)
