"""Integration tests for public /projects and officer /admin/projects routes."""
import io
import os
import uuid

import pytest
from flask_jwt_extended import create_access_token


def _user_headers(app, role):
    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, role, email_verified_at) VALUES (%s, %s, NOW()) RETURNING user_id",
                (f"projects_{role}_{uuid.uuid4().hex}@test.com", role),
            )
            user_id = cur.fetchone()["user_id"]
            conn.commit()
        token = create_access_token(identity=str(user_id), additional_claims={"role": role})
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def officer_headers(app):
    return _user_headers(app, "officer")


@pytest.fixture(scope="module")
def admin_headers(app):
    return _user_headers(app, "admin")


@pytest.fixture(scope="module")
def member_headers(app):
    return _user_headers(app, "member")


def _create(client, headers, **overrides):
    body = {"title": f"Project {uuid.uuid4().hex[:8]}", "summary": "A test project", **overrides}
    res = client.post("/admin/projects", json=body, headers=headers)
    assert res.status_code == 201, res.get_json()
    return res.get_json()["project_id"], body["title"]


# ---------------------------------------------------------------------------
# Public listing
# ---------------------------------------------------------------------------

def test_public_list_shows_published_and_hides_drafts(client, officer_headers):
    _, published = _create(client, officer_headers, tags=["nlp", "vision"], team_members=["Ana", "Ben"])
    draft_id, draft = _create(client, officer_headers, is_published=False)

    res = client.get("/projects/")
    assert res.status_code == 200
    titles = [p["title"] for p in res.get_json()["projects"]]
    assert published in titles
    assert draft not in titles

    # Drafts aren't reachable by id publicly, but officers see them in the admin list.
    assert client.get(f"/projects/{draft_id}").status_code == 404
    admin_titles = [p["title"] for p in client.get("/admin/projects", headers=officer_headers).get_json()["projects"]]
    assert draft in admin_titles


def test_public_get_returns_lists_and_defaults(client, officer_headers):
    project_id, title = _create(client, officer_headers, tags="nlp, vision, nlp", team_members=["Ana"])
    res = client.get(f"/projects/{project_id}")
    assert res.status_code == 200
    project = res.get_json()["project"]
    assert project["title"] == title
    assert project["status"] == "active"
    assert project["tags"] == ["nlp", "vision"]  # comma string accepted, duplicates dropped
    assert project["team_members"] == ["Ana"]
    assert project["sponsor"] is None


def test_public_status_filter(client, officer_headers):
    _, done = _create(client, officer_headers, status="completed")
    _, active = _create(client, officer_headers, status="active")
    titles = [p["title"] for p in client.get("/projects/?status=completed").get_json()["projects"]]
    assert done in titles and active not in titles
    assert client.get("/projects/?status=bogus").status_code == 400


def test_public_get_unknown_project_404(client):
    assert client.get("/projects/999999").status_code == 404


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------

def test_admin_routes_require_officer(client, member_headers, admin_headers):
    assert client.post("/admin/projects", json={"title": "x"}).status_code == 401
    assert client.post("/admin/projects", json={"title": "x"}, headers=member_headers).status_code == 403
    assert client.get("/admin/projects", headers=member_headers).status_code == 403
    # Admins can manage projects too.
    _create(client, admin_headers)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("body, message", [
    ({}, "title is required"),
    ({"title": "   "}, "title is required"),
    ({"title": "x", "status": "paused"}, "status must be one of"),
    ({"title": "x", "github_url": "javascript:alert(1)"}, "github_url must be an http(s) URL"),
    ({"title": "x", "demo_url": "ftp://example.com"}, "demo_url must be an http(s) URL"),
    ({"title": "x", "cover_image_url": "data:image/png;base64,AAAA"}, "cover_image_url must be an http(s) URL"),
    ({"title": "x", "tags": [1, 2]}, "tags must be a list of strings"),
    ({"title": "x", "tags": [f"t{i}" for i in range(11)]}, "tags can have at most 10"),
    ({"title": "x" * 201}, "title must be at most 200"),
    ({"title": "x", "sponsor_id": "abc"}, "sponsor_id must be a number"),
])
def test_create_validation(client, officer_headers, body, message):
    res = client.post("/admin/projects", json=body, headers=officer_headers)
    assert res.status_code == 400
    assert message in res.get_json()["error"]


def test_create_accepts_uploaded_cover_and_links(client, officer_headers):
    project_id, _ = _create(
        client, officer_headers,
        cover_image_url="/admin/uploads/projects/abc.png",
        github_url="https://github.com/Cougar-AI/example",
        demo_url="http://demo.example.com",
    )
    project = client.get(f"/projects/{project_id}").get_json()["project"]
    assert project["cover_image_url"] == "/admin/uploads/projects/abc.png"
    assert project["github_url"] == "https://github.com/Cougar-AI/example"


def test_sponsor_link_and_unknown_sponsor(client, officer_headers):
    with client.application.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("INSERT INTO sponsors (name, website) VALUES (%s, 'https://acme.example') RETURNING sponsor_id",
                        (f"Acme {uuid.uuid4().hex[:6]}",))
            sponsor_id = cur.fetchone()["sponsor_id"]
            conn.commit()

    project_id, _ = _create(client, officer_headers, sponsor_id=sponsor_id)
    sponsor = client.get(f"/projects/{project_id}").get_json()["project"]["sponsor"]
    assert sponsor["sponsor_id"] == sponsor_id and sponsor["name"].startswith("Acme")

    res = client.post("/admin/projects", json={"title": "x", "sponsor_id": 999999}, headers=officer_headers)
    assert res.status_code == 400
    assert "sponsor_id does not match" in res.get_json()["error"]


# ---------------------------------------------------------------------------
# Update / delete
# ---------------------------------------------------------------------------

def test_update_is_partial(client, officer_headers):
    project_id, title = _create(client, officer_headers, tags=["a"])
    res = client.patch(f"/admin/projects/{project_id}", json={"status": "completed", "summary": ""}, headers=officer_headers)
    assert res.status_code == 200

    project = client.get(f"/projects/{project_id}").get_json()["project"]
    assert project["status"] == "completed"
    assert project["summary"] is None
    assert project["title"] == title  # untouched
    assert project["tags"] == ["a"]   # untouched


def test_update_can_unpublish(client, officer_headers):
    project_id, _ = _create(client, officer_headers)
    client.patch(f"/admin/projects/{project_id}", json={"is_published": False}, headers=officer_headers)
    assert client.get(f"/projects/{project_id}").status_code == 404


def test_update_errors(client, officer_headers):
    project_id, _ = _create(client, officer_headers)
    assert client.patch(f"/admin/projects/{project_id}", json={}, headers=officer_headers).status_code == 400
    assert client.patch(f"/admin/projects/{project_id}", json={"title": ""}, headers=officer_headers).status_code == 400
    assert client.patch("/admin/projects/999999", json={"title": "x"}, headers=officer_headers).status_code == 404


def test_delete(client, officer_headers):
    project_id, _ = _create(client, officer_headers)
    assert client.delete(f"/admin/projects/{project_id}", headers=officer_headers).status_code == 200
    assert client.get(f"/projects/{project_id}").status_code == 404
    assert client.delete(f"/admin/projects/{project_id}", headers=officer_headers).status_code == 404


# ---------------------------------------------------------------------------
# Image upload permissions
# ---------------------------------------------------------------------------

def _png():
    return (io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * 64), "cover.png")


def test_officer_can_upload_project_images_only(client, officer_headers, admin_headers):
    auth = {"Authorization": officer_headers["Authorization"]}
    res = client.post("/admin/upload-image?category=projects", data={"file": _png()}, headers=auth, content_type="multipart/form-data")
    assert res.status_code == 200, res.get_json()
    url = res.get_json()["url"]
    assert url.startswith("/admin/uploads/projects/")

    res = client.post("/admin/upload-image?category=sponsors", data={"file": _png()}, headers=auth, content_type="multipart/form-data")
    assert res.status_code == 403

    # Admins keep access to every category.
    admin_auth = {"Authorization": admin_headers["Authorization"]}
    res = client.post("/admin/upload-image?category=sponsors", data={"file": _png()}, headers=admin_auth, content_type="multipart/form-data")
    assert res.status_code == 200
    sponsor_url = res.get_json()["url"]

    # Clean up files written by this test.
    from app.routes.admin import UPLOADS_BASE
    for uploaded in (url, sponsor_url):
        path = os.path.join(UPLOADS_BASE, *uploaded.split("/")[3:])
        if os.path.exists(path):
            os.remove(path)
