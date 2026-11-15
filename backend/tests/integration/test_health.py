"""Integration tests for the public health endpoint."""

from app.routes.health import API_VERSION


def test_health_endpoint_returns_version(client):
    res = client.get("/health")
    assert res.status_code == 200

    body = res.get_json()
    assert body["status"] == "ok"
    assert body["version"] == API_VERSION


def test_health_endpoint_uses_env_version(client, monkeypatch):
    monkeypatch.setenv("API_VERSION", "2026.07.01")

    res = client.get("/health")
    assert res.status_code == 200
    assert res.get_json()["version"] == "2026.07.01"


def test_resume_worker_health_reports_missing_worker(client):
    res = client.get("/health/resume-worker")
    assert res.status_code == 503
    assert res.get_json() == {"status": "unavailable", "worker": "ats"}


def test_resume_worker_health_reports_recent_heartbeat(app, client):
    with app.app_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("INSERT INTO resume_worker_heartbeats (worker_name) VALUES ('ats')")
        conn.commit()

    res = client.get("/health/resume-worker")
    assert res.status_code == 200
    assert res.get_json()["status"] == "ok"
    assert res.get_json()["worker"] == "ats"
