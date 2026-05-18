import secrets
import pytest
from flask import Flask, jsonify
from flask_jwt_extended import JWTManager, create_access_token


@pytest.fixture(scope="module")
def jwt_app():
    """
    Bare Flask app with JWT configured. No DB, no Docker.
    Registers one test route per auth decorator for isolation testing.
    Module scope: stateless across tests, no need to recreate per function.
    """
    app = Flask(__name__)
    app.config["JWT_SECRET_KEY"] = secrets.token_hex(32)  # generated fresh per run, never stored
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False
    app.config["TESTING"] = True
    JWTManager(app)

    from app.utils.auth_decorators import (
        require_admin,
        require_officer,
        require_authenticated,
        require_role,
    )

    @app.route("/test/admin-only", methods=["GET", "OPTIONS"])
    @require_admin
    def admin_only():
        return jsonify({"ok": True})

    @app.route("/test/officer-only", methods=["GET", "OPTIONS"])
    @require_officer
    def officer_only():
        return jsonify({"ok": True})

    @app.route("/test/auth-only", methods=["GET", "OPTIONS"])
    @require_authenticated
    def auth_only():
        return jsonify({"ok": True})

    @app.route("/test/member-only", methods=["GET", "OPTIONS"])
    @require_role("member")
    def member_only():
        return jsonify({"ok": True})

    return app


@pytest.fixture(scope="module")
def jwt_client(jwt_app):
    return jwt_app.test_client()


def make_token(jwt_app, role, user_id=1):
    """Return a signed JWT string with the given role claim."""
    with jwt_app.app_context():
        return create_access_token(
            identity=str(user_id),
            additional_claims={"role": role},
        )
