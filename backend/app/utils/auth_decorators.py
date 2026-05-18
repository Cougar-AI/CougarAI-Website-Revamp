from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity

# Canonical role sets — import these instead of redefining in each route file
ADMIN_ROLES = frozenset({"admin"})
OFFICER_ROLES = frozenset({"admin", "officer"})
ALL_AUTH_ROLES = frozenset({"admin", "officer", "partner", "member", "non-member"})


def require_role(*roles):
    """
    Decorator that combines OPTIONS handling, JWT verification, and role check.
    Replaces the scattered _require_admin() / _require_officer() pattern.
    Usage: @require_role("admin") or @require_role("admin", "officer")
    """
    role_set = frozenset(roles)

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if request.method == "OPTIONS":
                return "", 200
            verify_jwt_in_request()
            if get_jwt().get("role") not in role_set:
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
    """Return the role from the current request's JWT claims."""
    return get_jwt().get("role", "")


def caller_id() -> int:
    """Return the user_id integer from the current request's JWT identity."""
    return int(get_jwt_identity())
