"""Integration tests for the Discord bot's service key (`Authorization: Bot <key>`).

app/utils/auth_decorators.py: a valid BOT_API_KEY acts as the admin role on
BOT_ALLOWED_ROUTES only, a wrong/missing/unconfigured key is refused, and JWT
auth for humans is unchanged.
"""
import secrets
import uuid

import pytest
from flask_jwt_extended import create_access_token

from app.utils import auth_decorators
from app.utils.auth_decorators import BOT_ALLOWED_ROUTES

KEY = secrets.token_urlsafe(32)  # fresh per run, never stored
GUILD_ID = "123456789012345678"
# Placeholder values for URL converters when exercising every allowlisted rule.
PATH_ARGS = {"guild_id": GUILD_ID, "event_id": "999999", "user_id": "999999", "student_id": "nobody"}


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """The app-wide default limit (60/hour, in-memory) is shared by the whole test
    session; these files issue many requests, so start each test with a clean bucket."""
    from app import limiter
    limiter.reset()


@pytest.fixture(autouse=True)
def bot_key(app):
    old = app.config.get("BOT_API_KEY")
    app.config["BOT_API_KEY"] = KEY
    yield KEY
    app.config["BOT_API_KEY"] = old


def bot(key=KEY):
    return {"Authorization": f"Bot {key}"}


def _sql(app, query, params=()):
    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(query, params)
            row = cur.fetchone() if cur.description else None
        conn.commit()
        return row


def _user(app, role, student_id=None):
    """Insert a user (+ profile when student_id is given). Returns (user_id, headers)."""
    user_id = _sql(
        app,
        "INSERT INTO users (email, role, email_verified_at) VALUES (%s, %s, NOW()) RETURNING user_id",
        (f"botkey_{role}_{uuid.uuid4().hex}@test.com", role),
    )["user_id"]
    if student_id:
        _sql(app, "INSERT INTO profile (user_id, student_id, first_name, last_name) VALUES (%s, %s, 'B', 'K')",
             (user_id, student_id))
    with app.test_request_context():
        token = create_access_token(identity=str(user_id), additional_claims={"role": role})
    return user_id, {"Authorization": f"Bearer {token}"}


def _event(app):
    return _sql(
        app,
        "INSERT INTO events (name, event_type, starts_at) VALUES (%s, 'meeting', NOW()) RETURNING event_id",
        (f"Bot key {uuid.uuid4().hex[:8]}",),
    )["event_id"]


def _fill(rule):
    path = rule
    for name, value in PATH_ARGS.items():
        for conv in ("", "string:", "int:"):
            path = path.replace(f"<{conv}{name}>", value)
    assert "<" not in path, f"add a PATH_ARGS value for {rule}"
    return path


def _call(client, method, path, headers):
    return client.open(path, method=method, json={}, headers=headers)


# --- the allowlist itself ----------------------------------------------------

# Deliberately a second copy: widening (or narrowing) what the bot may do has to
# be done here too, on purpose. One line per call in the bot's utils/database/*.js.
EXPECTED_BOT_ROUTES = {
    ("POST", "/discord/config/<string:guild_id>"),
    ("PATCH", "/discord/config/<string:guild_id>"),
    ("POST", "/events/rsvp/by-discord"),
    ("DELETE", "/events/rsvp/by-discord"),
    ("GET", "/events/<int:event_id>/rsvp/stats"),
    ("POST", "/events/"),
    ("PATCH", "/events/<int:event_id>"),
    ("DELETE", "/events/<int:event_id>"),
    ("GET", "/admin/stats"),
    ("GET", "/admin/events-stats"),
    ("GET", "/admin/points/summary"),
    ("GET", "/admin/pinned-announcement"),
    ("POST", "/admin/pinned-announcement"),
    ("DELETE", "/admin/pinned-announcement"),
    ("GET", "/admin/events/<int:event_id>/attendance"),
    ("POST", "/events/officer-checkin"),
    ("POST", "/admin/events/<int:event_id>/regenerate-code"),
    ("GET", "/progress-reports/status"),
    ("GET", "/admin/users"),
    ("GET", "/admin/users/<int:user_id>"),
    ("PATCH", "/admin/users/<int:user_id>"),
    ("PATCH", "/admin/users/<int:user_id>/membership"),
    ("GET", "/admin/officers"),
    ("GET", "/admin/officer-positions"),
    ("POST", "/admin/officers"),
    ("DELETE", "/admin/officers/<student_id>"),
    ("POST", "/admin/points"),
}


def test_allowlist_is_exactly_the_bots_routes():
    assert set(BOT_ALLOWED_ROUTES) == EXPECTED_BOT_ROUTES


def test_every_allowlisted_route_exists(app):
    """A renamed/removed route must not linger on the list (or silently drop off it)."""
    real = {(m, r.rule) for r in app.url_map.iter_rules() for m in r.methods}
    assert BOT_ALLOWED_ROUTES - real == set()


@pytest.mark.parametrize("method,rule", sorted(EXPECTED_BOT_ROUTES))
def test_bot_key_acts_as_admin_on_allowlisted_route(app, client, method, rule):
    """Same status as a human admin's JWT, and never an auth failure."""
    _, admin = _user(app, "admin")
    path = _fill(rule)
    try:
        as_admin = _call(client, method, path, admin)
    except Exception:
        # Placeholder data trips a route bug / test-schema gap for the admin too
        # (GET /admin/users: the test payments.student_id is INTEGER). An auth
        # refusal is a 401/403 response, never an exception, so the bot raising
        # too still proves it got past auth.
        with pytest.raises(Exception):
            _call(client, method, path, bot())
        return
    as_bot = _call(client, method, path, bot())
    assert as_bot.status_code not in (401, 403), as_bot.get_json()
    assert as_bot.status_code == as_admin.status_code, (as_bot.get_json(), as_admin.get_json())


@pytest.mark.parametrize("method,rule", sorted(EXPECTED_BOT_ROUTES))
def test_allowlisted_route_still_requires_auth(client, method, rule):
    assert _call(client, method, _fill(rule), {}).status_code == 401


# --- real writes through the bot identity -------------------------------------

def test_bot_writes_discord_config(app, client):
    guild = str(10**17 + secrets.randbelow(10**17))
    res = client.post(f"/discord/config/{guild}", json={"log_channel": "1"}, headers=bot())
    assert res.status_code == 201
    res = client.patch(f"/discord/config/{guild}", json={"gcal_sync_enabled": True}, headers=bot())
    assert res.status_code == 200
    assert client.get(f"/discord/config/{guild}").get_json()["gcal_sync_enabled"] is True


def test_bot_pins_announcement_with_no_actor(app, client):
    res = client.post("/admin/pinned-announcement", json={"message": "from the bot"}, headers=bot())
    assert res.status_code == 201
    row = _sql(app, "SELECT created_by FROM pinned_announcements WHERE id = %s", (res.get_json()["id"],))
    assert row["created_by"] is None


def test_bot_awards_points_with_no_actor(app, client):
    user_id, _ = _user(app, "member", student_id=uuid.uuid4().hex[:12])
    res = client.post("/admin/points", json={"user_id": user_id, "points": 5, "reason": "bot"}, headers=bot())
    assert res.status_code == 201
    row = _sql(app, "SELECT officer_user_id FROM points WHERE points_id = %s", (res.get_json()["points_id"],))
    assert row["officer_user_id"] is None


def test_bot_officer_checkin_with_no_actor(app, client):
    student_id = uuid.uuid4().hex[:12]
    _user(app, "member", student_id=student_id)
    event_id = _event(app)
    res = client.post("/events/officer-checkin", json={"student_id": student_id, "event_id": event_id}, headers=bot())
    assert res.status_code == 200 and res.get_json()["student_id"] == student_id
    row = _sql(app, "SELECT officer_user_id FROM points WHERE student_id = %s AND event_id = %s",
               (student_id, event_id))
    assert row["officer_user_id"] is None


def test_human_actor_still_recorded(app, client):
    """The bot change must not drop attribution for officers."""
    officer_id, officer = _user(app, "officer")
    res = client.post("/admin/pinned-announcement", json={"message": "from a human"}, headers=officer)
    assert res.status_code == 201
    row = _sql(app, "SELECT created_by FROM pinned_announcements WHERE id = %s", (res.get_json()["id"],))
    assert row["created_by"] == officer_id


# --- refused everywhere else ---------------------------------------------------

REFUSED = [
    # require_role routes the bot has no business on
    ("DELETE", f"/discord/config/{GUILD_ID}"),
    ("DELETE", "/admin/users/999999"),
    ("POST", "/admin/officer-positions"),
    ("GET", "/events/999999/rsvp"),
    ("POST", "/admin/bulk-email/send"),
    # same URL as an allowlisted entry, different method
    ("GET", "/admin/points"),
    ("DELETE", "/admin/users/999999/membership"),
    ("PATCH", "/admin/pinned-announcement"),
]


@pytest.mark.parametrize("method,path", REFUSED)
def test_valid_key_refused_off_the_allowlist(client, method, path):
    res = client.open(path, method=method, json={}, headers=bot())
    assert res.status_code in (403, 405)
    if res.status_code == 403:
        assert res.get_json() == {"error": "Bot key not permitted on this route"}


def test_refused_route_has_no_side_effect(app, client):
    guild = str(10**17 + secrets.randbelow(10**17))
    _, admin = _user(app, "admin")
    assert client.post(f"/discord/config/{guild}", json={}, headers=admin).status_code == 201
    assert client.delete(f"/discord/config/{guild}", headers=bot()).status_code == 403
    assert client.get(f"/discord/config/{guild}").status_code == 200


@pytest.mark.parametrize("path", ["/events/my-rsvps", "/dashboard/me", "/notifications/user", "/partners/my"])
def test_jwt_only_routes_reject_the_bot_scheme(client, path):
    """require_authenticated never accepts a Bot header (so caller_id() can't be None there)."""
    assert client.get(path, headers=bot()).status_code == 401


def test_optional_jwt_route_treats_bot_as_anonymous(app, client):
    """GET /events/ shows officer-only fields to officers; a Bot header is not one."""
    event_id = _event(app)
    _, admin = _user(app, "admin")
    anon = client.get(f"/events/?event_id={event_id}").get_json()
    as_bot = client.get(f"/events/?event_id={event_id}", headers=bot()).get_json()
    as_admin = client.get(f"/events/?event_id={event_id}", headers=admin).get_json()
    assert as_bot == anon
    assert as_admin != anon  # proves the route really does differ for officers


# --- wrong / missing / unconfigured key --------------------------------------

ALLOWED = ("GET", "/admin/stats")


@pytest.mark.parametrize("header", [
    f"Bot {KEY[:-1]}",
    f"Bot {KEY}x",
    f"Bot x{KEY}",
    f"Bot {KEY.upper() if KEY != KEY.upper() else KEY.lower()}",
    f"Bot {secrets.token_urlsafe(32)}",
    "Bot ",
    "Bot",
    f"Bot{KEY}",
    f"Bot é{KEY}",
])
def test_wrong_or_missing_key_401(client, header):
    res = client.get(ALLOWED[1], headers={"Authorization": header})
    assert res.status_code == 401


def test_key_as_bearer_is_not_a_jwt(client):
    res = client.get(ALLOWED[1], headers={"Authorization": f"Bearer {KEY}"})
    assert res.status_code in (401, 422)


def test_wrong_key_401_even_off_the_allowlist(client):
    """Don't reveal which routes are allowlisted to someone without the key."""
    res = client.delete(f"/discord/config/{GUILD_ID}", headers=bot("nope"))
    assert res.status_code == 401


def test_scheme_is_case_insensitive(client):
    assert client.get(ALLOWED[1], headers={"Authorization": f"bot {KEY}"}).status_code == 200
    assert client.get(ALLOWED[1], headers={"Authorization": f"BOT {KEY}"}).status_code == 200


@pytest.mark.parametrize("server_key", ["", None, "short-key"])
def test_unconfigured_or_short_server_key_refuses_everything(app, client, server_key):
    app.config["BOT_API_KEY"] = server_key
    assert client.get(ALLOWED[1], headers={"Authorization": "Bot "}).status_code == 401
    assert client.get(ALLOWED[1], headers=bot(server_key or "")).status_code == 401
    assert client.get(ALLOWED[1], headers=bot()).status_code == 401


def test_key_is_compared_in_constant_time(client, monkeypatch):
    calls = []
    real = auth_decorators.hmac.compare_digest

    def spy(a, b):
        calls.append((type(a), type(b)))
        return real(a, b)

    monkeypatch.setattr(auth_decorators.hmac, "compare_digest", spy)
    assert client.get(ALLOWED[1], headers=bot()).status_code == 200
    assert client.get(ALLOWED[1], headers=bot("wrong")).status_code == 401
    assert calls == [(bytes, bytes), (bytes, bytes)]


# --- humans unaffected ---------------------------------------------------------

def test_admin_jwt_unchanged(app, client):
    _, admin = _user(app, "admin")
    assert client.get("/admin/stats", headers=admin).status_code == 200
    guild = str(10**17 + secrets.randbelow(10**17))
    assert client.post(f"/discord/config/{guild}", json={}, headers=admin).status_code == 201
    # a route the bot is refused on still works for a human admin
    assert client.delete(f"/discord/config/{guild}", headers=admin).status_code == 200


@pytest.mark.parametrize("role", ["member", "officer"])
def test_lower_roles_still_refused_with_bot_key_configured(app, client, role):
    _, headers = _user(app, role)
    assert client.get("/admin/stats", headers=headers).status_code == 403
    assert client.patch(f"/discord/config/{GUILD_ID}", json={}, headers=headers).status_code == 403


def test_bot_identity_does_not_leak_into_next_request(app, client):
    _, member = _user(app, "member")
    assert client.get("/admin/stats", headers=bot()).status_code == 200
    assert client.get("/admin/stats", headers=member).status_code == 403
    assert client.get("/admin/stats").status_code == 401


def test_humans_unaffected_when_bot_key_unset(app, client):
    app.config["BOT_API_KEY"] = ""
    _, admin = _user(app, "admin")
    assert client.get("/admin/stats", headers=admin).status_code == 200


def test_cors_preflight_unchanged(client):
    assert client.options("/admin/stats").status_code == 200
