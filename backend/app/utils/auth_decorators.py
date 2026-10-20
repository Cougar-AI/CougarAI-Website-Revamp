import hmac
from functools import wraps
from flask import request, jsonify, current_app, has_request_context
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity

# Canonical role sets — import these instead of redefining in each route file
ADMIN_ROLES = frozenset({"admin"})
OFFICER_ROLES = frozenset({"admin", "officer"})
ALL_AUTH_ROLES = frozenset({"admin", "officer", "partner", "member", "non-member"})

# ---------------------------------------------------------------------------
# Discord bot service auth
#
# The CougarAI Discord bot sends `Authorization: Bot <BOT_API_KEY>` instead of
# logging in as a human admin. A valid key is treated as the admin role, but
# ONLY on the (method, URL rule) pairs below; on every other route it is
# refused. Routes that only check a JWT (require_authenticated, or calling
# verify_jwt_in_request directly) never see the key at all: flask-jwt-extended
# rejects a non-Bearer header.
#
# The bot has no users row, so caller_id() returns None for it — routes on
# this list must handle that (the actor columns they write are nullable).
# Keep this list in step with the bot's utils/database/*.js.
# ---------------------------------------------------------------------------
BOT_AUTH_SCHEME = "bot"
BOT_ROLE = "admin"
BOT_API_KEY_MIN_LENGTH = 32
# Kept on the request itself, not flask.g: g lives on the app context, which
# can outlive a request (tests, or any request run inside an app_context).
_BOT_ENVIRON_KEY = "cougarai.bot_identity"

BOT_ALLOWED_ROUTES = frozenset({
    # utils/database/config.js — /config setup, /settings
    ("POST", "/discord/config/<string:guild_id>"),
    ("PATCH", "/discord/config/<string:guild_id>"),
    # utils/database/rsvpSync.js — Discord "Interested" → RSVP, event recaps
    ("POST", "/events/rsvp/by-discord"),
    ("DELETE", "/events/rsvp/by-discord"),
    ("GET", "/events/<int:event_id>/rsvp/stats"),
    # utils/database/event.js — /events create/update/delete, calendar sync
    ("POST", "/events/"),
    ("PATCH", "/events/<int:event_id>"),
    ("DELETE", "/events/<int:event_id>"),
    # utils/database/admin.js
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
})


def _presented_bot_key():
    """The key from an `Authorization: Bot <key>` header, "" for an empty one,
    or None when the request does not use the Bot scheme at all."""
    scheme, _, key = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != BOT_AUTH_SCHEME:
        return None
    return key.strip()


def _bot_key_valid(presented: str) -> bool:
    expected = current_app.config.get("BOT_API_KEY") or ""
    # An unset or short server key must never match — not even an empty one.
    if len(expected) < BOT_API_KEY_MIN_LENGTH:
        return False
    return hmac.compare_digest(presented.encode(), expected.encode())


def _bot_route_allowed() -> bool:
    rule = request.url_rule.rule if request.url_rule else None
    return (request.method, rule) in BOT_ALLOWED_ROUTES


def _authenticate_bot(presented: str):
    """Mark the request as the bot identity, or return the error response."""
    if not _bot_key_valid(presented):
        current_app.logger.warning("Rejected bot key on %s %s", request.method, request.path)
        return jsonify({"error": "Invalid bot key"}), 401
    if not _bot_route_allowed():
        current_app.logger.warning("Bot key refused on %s %s (not allowlisted)", request.method, request.path)
        return jsonify({"error": "Bot key not permitted on this route"}), 403
    request.environ[_BOT_ENVIRON_KEY] = True
    return None


def is_bot_request() -> bool:
    return has_request_context() and request.environ.get(_BOT_ENVIRON_KEY, False)


def require_role(*roles):
    """
    Decorator that combines OPTIONS handling, JWT verification, and role check.
    Replaces the scattered _require_admin() / _require_officer() pattern.
    Usage: @require_role("admin") or @require_role("admin", "officer")
    Also accepts the Discord bot's key on BOT_ALLOWED_ROUTES (see above).
    """
    role_set = frozenset(roles)

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if request.method == "OPTIONS":
                return "", 200
            presented = _presented_bot_key()
            if presented is None:
                verify_jwt_in_request()
            else:
                error = _authenticate_bot(presented)
                if error:
                    return error
            if caller_role() not in role_set:
                return jsonify({"error": "Insufficient permissions"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_admin(fn):
    """Shorthand for @require_role('admin')."""
    return require_role("admin")(fn)


def require_officer(fn):
    """Shorthand for @require_role('admin', 'officer')."""
    return require_role("admin", "officer")(fn)


def require_authenticated(fn):
    """Requires any valid JWT (any role). Handles OPTIONS."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if request.method == "OPTIONS":
            return "", 200
        verify_jwt_in_request()
        return fn(*args, **kwargs)
    return wrapper


def caller_role() -> str:
    """Return the role from the current request's JWT claims (BOT_ROLE for the bot)."""
    if is_bot_request():
        return BOT_ROLE
    return get_jwt().get("role", "")


def caller_id():
    """Return the user_id integer from the current request's JWT identity,
    or None for the Discord bot, which has no users row."""
    if is_bot_request():
        return None
    return int(get_jwt_identity())
