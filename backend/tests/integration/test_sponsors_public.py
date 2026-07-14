"""Integration tests for GET /sponsors/ public endpoint."""
from __future__ import annotations


class TestListSponsors:
    def test_returns_200_with_seeded_sponsors(self, client, db_session):
        resp = client.get("/sponsors/")
        assert resp.status_code == 200
        body = resp.get_json()
        assert "sponsors" in body
        assert isinstance(body["sponsors"], list)

    def test_sponsors_have_required_fields(self, client, db_session):
        resp = client.get("/sponsors/")
        assert resp.status_code == 200
        sponsors = resp.get_json()["sponsors"]
        if sponsors:
            s = sponsors[0]
            for field in ("sponsor_id", "name", "tier"):
                assert field in s, f"Missing field: {field}"

    def test_only_active_sponsors_returned(self, client, app, db_session):
        with app.test_request_context():
            from app.raw_db import get_db
            conn = get_db()
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO sponsors (name, tier, is_active) VALUES (%s, %s, FALSE) "
                    "RETURNING sponsor_id",
                    (f"Inactive Sponsor", "community"),
                )
                inactive_id = cur.fetchone()["sponsor_id"]
                conn.commit()

        resp = client.get("/sponsors/")
        assert resp.status_code == 200
        ids = [s["sponsor_id"] for s in resp.get_json()["sponsors"]]
        assert inactive_id not in ids

    def test_options_preflight(self, client, db_session):
        resp = client.options("/sponsors/")
        assert resp.status_code == 200
