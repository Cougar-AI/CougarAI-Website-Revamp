"""Receipt photos: admin-only upload, never served by the public /admin/uploads route."""
import io
import uuid

import pytest
from flask_jwt_extended import create_access_token

MISC = "app.routes.admin.misc"
JPEG = b"\xff\xd8\xff\xe0receipt-bytes"


def _headers(app, role):
    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, role, email_verified_at) VALUES (%s, %s, NOW()) RETURNING user_id",
                (f"receipt_{role}_{uuid.uuid4().hex}@test.com", role),
            )
            user_id = cur.fetchone()["user_id"]
            conn.commit()
        token = create_access_token(identity=str(user_id), additional_claims={"role": role})
        return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin(app):
    return _headers(app, "admin")


@pytest.fixture(scope="module")
def officer(app):
    return _headers(app, "officer")


@pytest.fixture(autouse=True)
def uploads_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(f"{MISC}.UPLOADS_BASE", str(tmp_path))
    return tmp_path


def _upload(client, headers):
    return client.post("/admin/upload-image?category=receipts", headers=headers,
                       data={"file": (io.BytesIO(JPEG), "r.jpg", "image/jpeg")},
                       content_type="multipart/form-data")


def test_admin_upload_then_admin_read(client, admin, uploads_dir):
    resp = _upload(client, admin)
    assert resp.status_code == 200
    url = resp.get_json()["url"]
    assert url.startswith("/admin/receipts/image/")
    filename = url.rsplit("/", 1)[1]
    assert (uploads_dir / "receipts" / filename).read_bytes() == JPEG

    got = client.get(url, headers=admin)
    assert got.status_code == 200
    assert got.data == JPEG
    assert "no-store" in got.headers["Cache-Control"]
    assert got.headers.get("Access-Control-Allow-Origin") != "*"


def test_officer_cannot_upload_receipts(client, officer):
    assert _upload(client, officer).status_code == 403


def test_public_route_never_serves_receipts(client, admin, monkeypatch):
    filename = _upload(client, admin).get_json()["url"].rsplit("/", 1)[1]
    assert client.get(f"/admin/uploads/receipts/{filename}").status_code == 404
    # Even if someone later adds 'receipts' to the public categories, it stays private.
    from app.routes.admin import ALLOWED_CATEGORIES
    monkeypatch.setattr(f"{MISC}.ALLOWED_CATEGORIES", ALLOWED_CATEGORIES | {"receipts"})
    assert client.get(f"/admin/uploads/receipts/{filename}").status_code == 404


def test_admin_route_requires_admin(client, app, admin, officer):
    filename = _upload(client, admin).get_json()["url"].rsplit("/", 1)[1]
    url = f"/admin/receipts/image/{filename}"
    assert client.get(url).status_code == 401
    assert client.get(url, headers=officer).status_code == 403
    assert client.get(url, headers=_headers(app, "member")).status_code == 403


def test_path_traversal_rejected(client, admin, uploads_dir):
    (uploads_dir / "secret.txt").write_text("outside receipts/")
    for path in ("..%2Fsecret.txt", "..%2F..%2Fconfig.py", "%2E%2E%2Fsecret.txt"):
        resp = client.get(f"/admin/receipts/image/{path}", headers=admin)
        assert resp.status_code == 404, path
        assert b"outside receipts" not in resp.data
