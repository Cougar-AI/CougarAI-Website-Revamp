"""Integration tests for /knowledge-base routes."""
from __future__ import annotations

import uuid

from flask_jwt_extended import create_access_token


def _member_headers(app):
    with app.test_request_context():
        from app.raw_db import get_db

        email = f"kb_member_{uuid.uuid4().hex}@test.com"
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, role, email_verified_at) VALUES (%s, 'member', NOW()) RETURNING user_id",
                (email,),
            )
            user_id = cur.fetchone()["user_id"]
            conn.commit()

        token = create_access_token(identity=str(user_id), additional_claims={"role": "member"})
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_list_entries_returns_seeded_content(client):
    res = client.get("/knowledge-base/entries")
    assert res.status_code == 200
    body = res.get_json()
    assert "entries" in body
    assert len(body["entries"]) >= 1


def test_filter_entries_by_type(client):
    res = client.get("/knowledge-base/entries?type=ai_news")
    assert res.status_code == 200
    entries = res.get_json()["entries"]
    assert all(entry["content_type"] == "ai_news" for entry in entries)


def test_search_entries(client):
    res = client.get("/knowledge-base/entries?q=open%20models")
    assert res.status_code == 200
    entries = res.get_json()["entries"]
    assert any("open models" in entry["title"].lower() for entry in entries)


def test_get_entry_includes_comments(client):
    entries = client.get("/knowledge-base/entries").get_json()["entries"]
    entry_id = entries[0]["entry_id"]

    res = client.get(f"/knowledge-base/entries/{entry_id}")
    assert res.status_code == 200
    body = res.get_json()["entry"]
    assert body["entry_id"] == entry_id
    assert "comments" in body


def test_comment_requires_auth(client):
    entries = client.get("/knowledge-base/entries").get_json()["entries"]
    entry_id = entries[0]["entry_id"]

    res = client.post(f"/knowledge-base/entries/{entry_id}/comments", json={"body": "Nice note"})
    assert res.status_code in {401, 422}


def test_add_comment_success(client, app):
    headers = _member_headers(app)
    entries = client.get("/knowledge-base/entries").get_json()["entries"]
    entry_id = entries[0]["entry_id"]

    res = client.post(
        f"/knowledge-base/entries/{entry_id}/comments",
        json={"body": "This is a helpful archive."},
        headers=headers,
    )
    assert res.status_code == 201
    comment = res.get_json()["comment"]
    assert comment["entry_id"] == entry_id
    assert comment["body"] == "This is a helpful archive."

    detail = client.get(f"/knowledge-base/entries/{entry_id}").get_json()["entry"]
    assert any(c["comment_id"] == comment["comment_id"] for c in detail["comments"])