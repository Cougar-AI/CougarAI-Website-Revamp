"""Integration tests for /discord/config/<guild_id> (backend/app/routes/discord.py).

Covers the calendar-sync fields added on top of the original seven columns:
admin-only writes, a full POST->GET round trip, PATCH persisting `false`,
legacy-style POSTs not resetting the new fields, and input validation.
"""
import uuid

import pytest
from flask_jwt_extended import create_access_token

NEW_FIELDS = {
    "gcal_sync_enabled": True,
    "gcal_calendar_id": "abc123@group.calendar.google.com",
    "event_announce_enabled": True,
    "event_announce_channel": "1111111111111111111",
    "event_announce_role": "2222222222222222222",
    "event_recap_enabled": True,
    "event_recap_channel": "3333333333333333333",
}


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """The app-wide default limit (60/hour, in-memory) is shared by the whole test
    session; these files issue many requests, so start each test with a clean bucket."""
    from app import limiter
    limiter.reset()


def _headers(app, role):
    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, role, email_verified_at) VALUES (%s, %s, NOW()) RETURNING user_id",
                (f"dcfg_{role}_{uuid.uuid4().hex}@test.com", role),
            )
            user_id = cur.fetchone()["user_id"]
            conn.commit()
        token = create_access_token(identity=str(user_id), additional_claims={"role": role})
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_headers(app):
    return _headers(app, "admin")


@pytest.fixture(scope="module")
def member_headers(app):
    return _headers(app, "member")


@pytest.fixture
def guild_id():
    # Unique 19-digit snowflake-like id per test.
    return str(int(uuid.uuid4().int % 10**18) + 10**18)


def _get(client, guild_id):
    res = client.get(f"/discord/config/{guild_id}")
    assert res.status_code == 200
    return res.get_json()


# --- auth ------------------------------------------------------------------

def test_post_requires_token(client, guild_id):
    assert client.post(f"/discord/config/{guild_id}", json={}).status_code == 401


def test_patch_requires_token(client, guild_id):
    assert client.patch(f"/discord/config/{guild_id}", json={}).status_code == 401


def test_post_forbidden_for_member(client, guild_id, member_headers):
    assert client.post(f"/discord/config/{guild_id}", json=NEW_FIELDS, headers=member_headers).status_code == 403


def test_patch_forbidden_for_member(client, guild_id, member_headers):
    assert client.patch(f"/discord/config/{guild_id}", json={"gcal_sync_enabled": True}, headers=member_headers).status_code == 403


# --- round trip ------------------------------------------------------------

def test_post_round_trips_all_new_fields(client, guild_id, admin_headers):
    res = client.post(f"/discord/config/{guild_id}", json=NEW_FIELDS, headers=admin_headers)
    assert res.status_code == 201
    row = _get(client, guild_id)
    for key, value in NEW_FIELDS.items():
        assert row[key] == value


def test_new_fields_default_when_never_sent(client, guild_id, admin_headers):
    assert client.post(f"/discord/config/{guild_id}", json={"log_channel": "4444444444444444444"}, headers=admin_headers).status_code == 201
    row = _get(client, guild_id)
    assert row["gcal_sync_enabled"] is False
    assert row["event_announce_enabled"] is False
    assert row["event_recap_enabled"] is False
    assert row["gcal_calendar_id"] is None
    assert row["event_announce_channel"] is None
    assert row["event_announce_role"] is None
    assert row["event_recap_channel"] is None


def test_get_config_json_shape(client, guild_id, admin_headers):
    client.post(f"/discord/config/{guild_id}", json=NEW_FIELDS, headers=admin_headers)
    row = _get(client, guild_id)
    assert set(row) == {
        "guild_id", "announcement_channel", "welcome_channel", "log_channel",
        "executive_role", "member_role", "officer_role", "auto_role",
        *NEW_FIELDS,
    }


# --- PATCH -----------------------------------------------------------------

def test_patch_sets_false_and_persists(client, guild_id, admin_headers):
    client.post(f"/discord/config/{guild_id}", json=NEW_FIELDS, headers=admin_headers)
    res = client.patch(
        f"/discord/config/{guild_id}",
        json={"gcal_sync_enabled": False, "event_recap_enabled": False},
        headers=admin_headers,
    )
    assert res.status_code == 200
    row = _get(client, guild_id)
    assert row["gcal_sync_enabled"] is False
    assert row["event_recap_enabled"] is False
    # untouched fields stay as they were
    assert row["event_announce_enabled"] is True
    assert row["gcal_calendar_id"] == NEW_FIELDS["gcal_calendar_id"]


def test_patch_can_clear_new_ids_with_null(client, guild_id, admin_headers):
    client.post(f"/discord/config/{guild_id}", json=NEW_FIELDS, headers=admin_headers)
    res = client.patch(
        f"/discord/config/{guild_id}",
        json={"event_announce_role": None, "event_recap_channel": "", "gcal_calendar_id": None},
        headers=admin_headers,
    )
    assert res.status_code == 200
    row = _get(client, guild_id)
    assert row["event_announce_role"] is None
    assert row["event_recap_channel"] is None
    assert row["gcal_calendar_id"] is None
    assert row["event_announce_channel"] == NEW_FIELDS["event_announce_channel"]


def test_patch_legacy_field_still_works(client, guild_id, admin_headers):
    client.post(f"/discord/config/{guild_id}", json=NEW_FIELDS, headers=admin_headers)
    res = client.patch(f"/discord/config/{guild_id}", json={"log_channel": "5555555555555555555"}, headers=admin_headers)
    assert res.status_code == 200
    row = _get(client, guild_id)
    assert row["log_channel"] == "5555555555555555555"
    assert row["gcal_sync_enabled"] is True


def test_patch_unknown_guild_404(client, guild_id, admin_headers):
    res = client.patch(f"/discord/config/{guild_id}", json={"gcal_sync_enabled": True}, headers=admin_headers)
    assert res.status_code == 404


def test_patch_empty_body_400(client, guild_id, admin_headers):
    client.post(f"/discord/config/{guild_id}", json=NEW_FIELDS, headers=admin_headers)
    assert client.patch(f"/discord/config/{guild_id}", json={}, headers=admin_headers).status_code == 400


# --- legacy POST must not reset the new fields -----------------------------

def test_legacy_post_does_not_reset_new_fields(client, guild_id, admin_headers):
    client.post(f"/discord/config/{guild_id}", json=NEW_FIELDS, headers=admin_headers)
    legacy = {
        "announcement_channel": "6666666666666666666",
        "welcome_channel": "7777777777777777777",
        "log_channel": "8888888888888888888",
        "executive_role": "9999999999999999999",
        "member_role": "1010101010101010101",
        "officer_role": "1212121212121212121",
        "auto_role": "1313131313131313131",
    }
    assert client.post(f"/discord/config/{guild_id}", json=legacy, headers=admin_headers).status_code == 201
    row = _get(client, guild_id)
    for key, value in legacy.items():
        assert row[key] == value
    for key, value in NEW_FIELDS.items():
        assert row[key] == value


def test_post_with_new_fields_overwrites_them(client, guild_id, admin_headers):
    client.post(f"/discord/config/{guild_id}", json=NEW_FIELDS, headers=admin_headers)
    res = client.post(
        f"/discord/config/{guild_id}",
        json={"gcal_sync_enabled": False, "event_announce_channel": None},
        headers=admin_headers,
    )
    assert res.status_code == 201
    row = _get(client, guild_id)
    assert row["gcal_sync_enabled"] is False
    assert row["event_announce_channel"] is None
    assert row["event_recap_channel"] == NEW_FIELDS["event_recap_channel"]


# --- validation ------------------------------------------------------------

@pytest.mark.parametrize("field", ["gcal_sync_enabled", "event_announce_enabled", "event_recap_enabled"])
@pytest.mark.parametrize("bad", ["true", 1, 0, None, "false"])
def test_invalid_boolean_rejected(client, guild_id, admin_headers, field, bad):
    assert client.post(f"/discord/config/{guild_id}", json={field: bad}, headers=admin_headers).status_code == 400
    client.post(f"/discord/config/{guild_id}", json={}, headers=admin_headers)
    assert client.patch(f"/discord/config/{guild_id}", json={field: bad}, headers=admin_headers).status_code == 400


@pytest.mark.parametrize("field", ["event_announce_channel", "event_announce_role", "event_recap_channel"])
@pytest.mark.parametrize("bad", ["abc", "123", "1" * 23, "12345678901234567x", 1111111111111111111, True])
def test_invalid_id_rejected(client, guild_id, admin_headers, field, bad):
    assert client.post(f"/discord/config/{guild_id}", json={field: bad}, headers=admin_headers).status_code == 400
    client.post(f"/discord/config/{guild_id}", json={}, headers=admin_headers)
    assert client.patch(f"/discord/config/{guild_id}", json={field: bad}, headers=admin_headers).status_code == 400


@pytest.mark.parametrize("bad", ["x" * 256, 123, ["a"], True])
def test_invalid_calendar_id_rejected(client, guild_id, admin_headers, bad):
    assert client.post(f"/discord/config/{guild_id}", json={"gcal_calendar_id": bad}, headers=admin_headers).status_code == 400


def test_calendar_id_255_chars_ok(client, guild_id, admin_headers):
    cal = "c" * 255
    assert client.post(f"/discord/config/{guild_id}", json={"gcal_calendar_id": cal}, headers=admin_headers).status_code == 201
    assert _get(client, guild_id)["gcal_calendar_id"] == cal


def test_invalid_post_does_not_write(client, guild_id, admin_headers):
    res = client.post(f"/discord/config/{guild_id}", json={"gcal_sync_enabled": "yes"}, headers=admin_headers)
    assert res.status_code == 400
    assert client.get(f"/discord/config/{guild_id}").status_code == 404
