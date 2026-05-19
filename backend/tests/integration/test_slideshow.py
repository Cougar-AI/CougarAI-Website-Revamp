"""Integration tests for /admin/slideshow-photos routes."""
import uuid
import pytest
from flask_jwt_extended import create_access_token


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def admin_headers(app):
    """Insert a real admin user and return auth headers."""
    with app.test_request_context():
        from app.raw_db import get_db
        email = f"slide_admin_{uuid.uuid4().hex}@test.com"
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, role, email_verified_at) VALUES (%s, 'admin', NOW()) RETURNING user_id",
                (email,),
            )
            user_id = cur.fetchone()["user_id"]
            conn.commit()
        token = create_access_token(identity=str(user_id), additional_claims={"role": "admin"})
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def member_headers(app):
    """Insert a member user and return auth headers."""
    with app.test_request_context():
        from app.raw_db import get_db
        email = f"slide_member_{uuid.uuid4().hex}@test.com"
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


def add_photo(client, headers, page="home", url="/test.jpg", position="center", caption=None):
    """Helper to add a photo and return the response."""
    body = {"page": page, "url": url, "object_position": position}
    if caption is not None:
        body["caption"] = caption
    return client.post("/admin/slideshow-photos", json=body, headers=headers)


# ---------------------------------------------------------------------------
# GET /admin/slideshow-photos
# ---------------------------------------------------------------------------

def test_get_slideshow_photos_empty(client):
    res = client.get("/admin/slideshow-photos?page=home")
    assert res.status_code == 200
    data = res.get_json()
    assert "photos" in data
    assert isinstance(data["photos"], list)


def test_get_slideshow_photos_invalid_page(client):
    res = client.get("/admin/slideshow-photos?page=invalid")
    assert res.status_code == 400


def test_get_slideshow_photos_ordered(client, admin_headers):
    uid = uuid.uuid4().hex
    add_photo(client, admin_headers, url=f"/a_{uid}.jpg")
    add_photo(client, admin_headers, url=f"/b_{uid}.jpg")
    res = client.get("/admin/slideshow-photos?page=home")
    assert res.status_code == 200
    photos = res.get_json()["photos"]
    orders = [p["display_order"] for p in photos]
    assert orders == sorted(orders)


# ---------------------------------------------------------------------------
# POST /admin/slideshow-photos
# ---------------------------------------------------------------------------

def test_add_photo_requires_admin(client, member_headers):
    res = add_photo(client, member_headers)
    assert res.status_code == 403


def test_add_photo_success(client, admin_headers):
    uid = uuid.uuid4().hex
    res = add_photo(client, admin_headers, url=f"/success_{uid}.jpg")
    assert res.status_code == 201
    assert "photo_id" in res.get_json()


def test_add_photo_invalid_page(client, admin_headers):
    res = client.post(
        "/admin/slideshow-photos",
        json={"page": "invalid", "url": "/x.jpg"},
        headers=admin_headers,
    )
    assert res.status_code == 400


def test_add_photo_with_caption(client, admin_headers):
    uid = uuid.uuid4().hex
    res = add_photo(client, admin_headers, url=f"/cap_{uid}.jpg", caption="Test caption")
    assert res.status_code == 201
    photo_id = res.get_json()["photo_id"]

    get_res = client.get("/admin/slideshow-photos?page=home&include_inactive=true")
    photos = get_res.get_json()["photos"]
    match = next((p for p in photos if p["photo_id"] == photo_id), None)
    assert match is not None
    assert match["caption"] == "Test caption"


# ---------------------------------------------------------------------------
# PATCH /admin/slideshow-photos/<id>
# ---------------------------------------------------------------------------

def test_update_photo_object_position(client, admin_headers):
    uid = uuid.uuid4().hex
    photo_id = add_photo(client, admin_headers, url=f"/upd_{uid}.jpg").get_json()["photo_id"]

    res = client.patch(
        f"/admin/slideshow-photos/{photo_id}",
        json={"object_position": "top left"},
        headers=admin_headers,
    )
    assert res.status_code == 200

    photos = client.get("/admin/slideshow-photos?page=home&include_inactive=true").get_json()["photos"]
    match = next(p for p in photos if p["photo_id"] == photo_id)
    assert match["object_position"] == "top left"


def test_update_photo_not_found(client, admin_headers):
    res = client.patch(
        "/admin/slideshow-photos/999999",
        json={"object_position": "top"},
        headers=admin_headers,
    )
    assert res.status_code == 404


def test_toggle_inactive_hidden_from_public(client, admin_headers):
    uid = uuid.uuid4().hex
    photo_id = add_photo(client, admin_headers, url=f"/tog_{uid}.jpg").get_json()["photo_id"]

    client.patch(
        f"/admin/slideshow-photos/{photo_id}",
        json={"is_active": False},
        headers=admin_headers,
    )

    public_photos = client.get("/admin/slideshow-photos?page=home").get_json()["photos"]
    assert not any(p["photo_id"] == photo_id for p in public_photos)

    all_photos = client.get("/admin/slideshow-photos?page=home&include_inactive=true").get_json()["photos"]
    assert any(p["photo_id"] == photo_id for p in all_photos)


# ---------------------------------------------------------------------------
# DELETE /admin/slideshow-photos/<id>
# ---------------------------------------------------------------------------

def test_delete_photo_success(client, admin_headers):
    uid = uuid.uuid4().hex
    photo_id = add_photo(client, admin_headers, url=f"/del_{uid}.jpg").get_json()["photo_id"]

    res = client.delete(f"/admin/slideshow-photos/{photo_id}", headers=admin_headers)
    assert res.status_code == 200

    photos = client.get("/admin/slideshow-photos?page=home&include_inactive=true").get_json()["photos"]
    assert not any(p["photo_id"] == photo_id for p in photos)


def test_delete_photo_not_found(client, admin_headers):
    res = client.delete("/admin/slideshow-photos/999999", headers=admin_headers)
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /admin/slideshow-photos/reorder
# ---------------------------------------------------------------------------

def test_reorder_photos(client, admin_headers):
    uid = uuid.uuid4().hex
    id_a = add_photo(client, admin_headers, page="about", url=f"/r_a_{uid}.jpg").get_json()["photo_id"]
    id_b = add_photo(client, admin_headers, page="about", url=f"/r_b_{uid}.jpg").get_json()["photo_id"]

    res = client.patch(
        "/admin/slideshow-photos/reorder",
        json={"order": [id_b, id_a]},
        headers=admin_headers,
    )
    assert res.status_code == 200

    photos = client.get("/admin/slideshow-photos?page=about&include_inactive=true").get_json()["photos"]
    ids_in_order = [p["photo_id"] for p in photos if p["photo_id"] in (id_a, id_b)]
    assert ids_in_order.index(id_b) < ids_in_order.index(id_a)
