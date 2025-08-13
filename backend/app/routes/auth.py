# backend/app/routes/auth.py
from flask import Blueprint, request, jsonify, current_app
from functools import wraps
from datetime import datetime, timedelta
import os
import jwt

# If you centralize common imports (e.g., connect()), keep this:
from app.imports import *  # expects: connect(), etc.

auth_bp = Blueprint("auth", __name__)

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION = timedelta(days=1)

def _get_jwt_secret() -> str:
    """
    Prefer the Flask app config; fall back to environment, then finally a hardcoded default
    for tests/dev. In production, we enforce a non-default secret at app startup (see
    the @auth_bp.record hook below).
    """
    # Prefer app config if available
    if current_app:
        secret = current_app.config.get("JWT_SECRET")
        if secret:
            return secret

    # Fallbacks for non-app-context usage (e.g., scripts)
    env_secret = os.getenv("JWT_SECRET")
    if env_secret:
        return env_secret

    # Final fallback for tests/dev; DO NOT rely on this in production
    return "change-me-too"

@auth_bp.record
def _enforce_secret_in_prod(setup_state):
    """
    Runs when the blueprint is registered on the app.
    Fail fast in production if the secret is missing or left as a default.
    """
    app = setup_state.app
    secret = app.config.get("JWT_SECRET") or os.getenv("JWT_SECRET") or "change-me-too"

    if app.config.get("TESTING"):
        # Don't enforce during tests; TestConfig provides a default.
        return

    if app.config.get("PRODUCTION") or app.config.get("ENV") == "production":
        if not secret or secret == "change-me-too":
            raise RuntimeError(
                "JWT_SECRET must be set in production. "
                "Set app.config['JWT_SECRET'] or the JWT_SECRET environment variable."
            )

def generate_token(student_id: str) -> str:
    payload = {
        "student_id": student_id,
        "exp": datetime.utcnow() + JWT_EXPIRATION,
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm=JWT_ALGORITHM)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    password = data.get("password")
    if not student_id or not password:
        return jsonify({"error": "Student ID and password are required"}), 400

    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM users
                WHERE student_id = %s
                  AND password_hash = crypt(%s, password_hash)
                """,
                (student_id, password),
            )
            user = cur.fetchone()
    finally:
        conn.close()

    if not user:
        return jsonify({"error": "Invalid student ID or password"}), 401

    token = generate_token(student_id)
    return jsonify({"token": token, "student_id": student_id}), 200

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

        if not token:
            return jsonify({"error": "Token is missing!"}), 401

        try:
            jwt.decode(token, _get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        except Exception:
            return jsonify({"error": "Token is invalid!"}), 401

        return f(*args, **kwargs)
    return decorated

@auth_bp.route("/protected", methods=["GET"])
@token_required
def protected():
    return jsonify({"message": "You have access to this protected route!"})
