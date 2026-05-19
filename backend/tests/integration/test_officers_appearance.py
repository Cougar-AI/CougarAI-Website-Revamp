"""Integration tests for officer appearance endpoints:
  GET  /admin/officers/directory  (no auth)
  GET  /admin/officers/self       (officer+)
  PATCH /admin/officers/self      (officer+)
  POST  /admin/officers/self/photo (officer+)
"""
import io
import uuid
import pytest
from flask_jwt_extended import create_access_token


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_user(app, role: str) -> tuple[int, dict]:
    """Insert a user with the given role and return (user_id, auth_headers)."""
    with app.test_request_context():
        from app.raw_db import get_db
        email = f"ofc_{role}_{uuid.uuid4().hex}@test.com"
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, role, email_verified_at) VALUES (%s, %s, NOW()) RETURNING user_id",
                (email, role),
            )
            user_id = cur.fetchone()["user_id"]
            conn.commit()
        token = create_access_token(identity=str(user_id), additional_claims={"role": role})
        return user_id, {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _add_officer_with_profile(app, user_id: int, first_name: str, last_name: str) -> str:
    """Insert a profile + officer row for the user. Returns the student_id."""
    with app.test_request_context():
        from app.raw_db import get_db
        student_id = str(uuid.uuid4().int % 9_000_000 + 1_000_000)
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO profile (user_id, student_id, first_name, last_name) VALUES (%s, %s, %s, %s)",
                (user_id, student_id, first_name, last_name),
            )
            cur.execute(
                "INSERT INTO officers (student_id, role, join_date) VALUES (%s, 'officer', CURRENT_DATE)",
                (student_id,),
            )
            conn.commit()
        return student_id


@pytest.fixture(scope="module")
def officer_user(app):
    user_id, headers = _make_user(app, "officer")
    student_id = _add_officer_with_profile(app, user_id, "Test", "Officer")
    return {"user_id": user_id, "student_id": student_id, "headers": headers}


@pytest.fixture(scope="module")
def admin_headers(app):
    _, headers = _make_user(app, "admin")
    return headers


@pytest.fixture(scope="module")
def member_headers(app):
    _, headers = _make_user(app, "member")
    return headers


# ---------------------------------------------------------------------------
# GET /admin/officers/directory (no auth required)
# ---------------------------------------------------------------------------

def test_directory_no_auth(client, officer_user):
    res = client.get("/admin/officers/directory")
    assert res.status_code == 200
    data = res.get_json()
    assert "officers" in data
    # The officer we inserted should appear
    names = [f"{o['first_name']} {o['last_name']}" for o in data["officers"]]
    assert "Test Officer" in names


def test_directory_returns_appearance_fields(client, officer_user):
    res = client.get("/admin/officers/directory")
    assert res.status_code == 200
    officers = res.get_json()["officers"]
    match = next((o for o in officers if o.get("first_name") == "Test"), None)
    assert match is not None
    assert "photo_url" in match
    assert "photo_object_position" in match
    assert "linkedin_url" in match
    assert "position_title" in match
    assert "position_department" in match


# ---------------------------------------------------------------------------
# GET /admin/officers/self (officer auth required)
# ---------------------------------------------------------------------------

def test_get_self_returns_appearance(client, officer_user):
    res = client.get("/admin/officers/self", headers=officer_user["headers"])
    assert res.status_code == 200
    data = res.get_json()
    assert data["student_id"] == officer_user["student_id"]
    assert "photo_url" in data
    assert "photo_object_position" in data
    assert "linkedin_url" in data


def test_get_self_requires_auth(client):
    res = client.get("/admin/officers/self")
    assert res.status_code == 401


def test_get_self_requires_officer_role(client, member_headers):
    res = client.get("/admin/officers/self", headers=member_headers)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# PATCH /admin/officers/self (officer auth required)
# ---------------------------------------------------------------------------

def test_patch_self_updates_linkedin(client, officer_user):
    res = client.patch(
        "/admin/officers/self",
        json={"linkedin_url": "https://linkedin.com/in/testofficer"},
        headers=officer_user["headers"],
    )
    assert res.status_code == 200
    # Verify persisted
    get_res = client.get("/admin/officers/self", headers=officer_user["headers"])
    assert get_res.get_json()["linkedin_url"] == "https://linkedin.com/in/testofficer"


def test_patch_self_updates_photo_position(client, officer_user):
    res = client.patch(
        "/admin/officers/self",
        json={"photo_url": "/test/photo.jpg", "photo_object_position": "30% 70%", "linkedin_url": None},
        headers=officer_user["headers"],
    )
    assert res.status_code == 200
    data = client.get("/admin/officers/self", headers=officer_user["headers"]).get_json()
    assert data["photo_url"] == "/test/photo.jpg"
    assert data["photo_object_position"] == "30% 70%"


def test_patch_self_clears_photo(client, officer_user):
    # First set a photo
    client.patch(
        "/admin/officers/self",
        json={"photo_url": "/test/photo.jpg", "photo_object_position": "50% 50%", "linkedin_url": None},
        headers=officer_user["headers"],
    )
    # Then clear it
    res = client.patch(
        "/admin/officers/self",
        json={"photo_url": None, "photo_object_position": "50% 50%", "linkedin_url": None},
        headers=officer_user["headers"],
    )
    assert res.status_code == 200
    data = client.get("/admin/officers/self", headers=officer_user["headers"]).get_json()
    assert data["photo_url"] is None


def test_patch_self_requires_auth(client):
    res = client.patch("/admin/officers/self", json={"linkedin_url": "https://linkedin.com/in/x"})
    assert res.status_code == 401


def test_patch_self_requires_officer_role(client, member_headers):
    res = client.patch(
        "/admin/officers/self",
        json={"linkedin_url": "https://linkedin.com/in/x"},
        headers=member_headers,
    )
    assert res.status_code == 403


def test_patch_self_nothing_to_update(client, officer_user):
    res = client.patch("/admin/officers/self", json={}, headers=officer_user["headers"])
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# POST /admin/officers/self/photo (officer auth required)
# ---------------------------------------------------------------------------

def test_upload_photo_valid_jpeg(client, officer_user):
    # Minimal valid JPEG header
    jpeg_bytes = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        b"\xff\xd9"
    )
    data = {"file": (io.BytesIO(jpeg_bytes), "photo.jpg", "image/jpeg")}
    res = client.post(
        "/admin/officers/self/photo",
        data=data,
        content_type="multipart/form-data",
        headers={"Authorization": officer_user["headers"]["Authorization"]},
    )
    assert res.status_code == 200
    body = res.get_json()
    assert "url" in body
    assert body["url"].startswith("/admin/uploads/officers/")


def test_upload_photo_rejects_invalid_mime(client, officer_user):
    data = {"file": (io.BytesIO(b"not an image"), "file.txt", "text/plain")}
    res = client.post(
        "/admin/officers/self/photo",
        data=data,
        content_type="multipart/form-data",
        headers={"Authorization": officer_user["headers"]["Authorization"]},
    )
    assert res.status_code == 400


def test_upload_photo_rejects_oversized(client, officer_user):
    big = b"x" * (6 * 1024 * 1024)  # 6 MB
    data = {"file": (io.BytesIO(big), "big.jpg", "image/jpeg")}
    res = client.post(
        "/admin/officers/self/photo",
        data=data,
        content_type="multipart/form-data",
        headers={"Authorization": officer_user["headers"]["Authorization"]},
    )
    assert res.status_code == 400


def test_upload_photo_requires_auth(client):
    data = {"file": (io.BytesIO(b"\xff\xd8\xff"), "photo.jpg", "image/jpeg")}
    res = client.post(
        "/admin/officers/self/photo",
        data=data,
        content_type="multipart/form-data",
    )
    assert res.status_code == 401


def test_upload_photo_requires_officer_role(client, member_headers):
    data = {"file": (io.BytesIO(b"\xff\xd8\xff"), "photo.jpg", "image/jpeg")}
    res = client.post(
        "/admin/officers/self/photo",
        data=data,
        content_type="multipart/form-data",
        headers={"Authorization": member_headers["Authorization"]},
    )
    assert res.status_code == 403
