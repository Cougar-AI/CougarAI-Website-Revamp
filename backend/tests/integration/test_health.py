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