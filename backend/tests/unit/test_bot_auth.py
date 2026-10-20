"""Unit tests for the bot identity in app/utils/auth_decorators.py — no Docker.

The integration suite (tests/integration/test_bot_api_key.py) covers the real
routes; this pins what cannot be shown there because no real allowlisted
route excludes admins: the bot is the admin role, not a superuser.
"""
import secrets

import pytest
from flask import Flask, jsonify
from flask_jwt_extended import JWTManager

from app.utils import auth_decorators
from app.utils.auth_decorators import require_role, caller_id, caller_role

KEY = secrets.token_urlsafe(32)


@pytest.fixture
def bot_app(monkeypatch):
    app = Flask(__name__)
    app.config.update(JWT_SECRET_KEY=secrets.token_hex(32), TESTING=True, BOT_API_KEY=KEY)
    JWTManager(app)

    @app.route("/t/partner-only", methods=["GET"])
    @require_role("partner")
    def partner_only():
        return jsonify({"ok": True})

    @app.route("/t/whoami", methods=["GET"])
    @require_role("admin")
    def whoami():
        return jsonify({"id": caller_id(), "role": caller_role()})

    monkeypatch.setattr(auth_decorators, "BOT_ALLOWED_ROUTES",
                        frozenset({("GET", "/t/partner-only"), ("GET", "/t/whoami")}))
    return app


def test_bot_is_admin_not_superuser(bot_app):
    res = bot_app.test_client().get("/t/partner-only", headers={"Authorization": f"Bot {KEY}"})
    assert res.status_code == 403
    assert res.get_json() == {"error": "Insufficient permissions"}


def test_bot_identity_has_admin_role_and_no_user_id(bot_app):
    res = bot_app.test_client().get("/t/whoami", headers={"Authorization": f"Bot {KEY}"})
    assert res.status_code == 200
    assert res.get_json() == {"id": None, "role": "admin"}


def test_not_a_bot_request_outside_a_request():
    assert auth_decorators.is_bot_request() is False
