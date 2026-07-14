"""Shared helpers for integration tests."""
from __future__ import annotations

import uuid
from unittest.mock import patch

from flask_jwt_extended import create_access_token

PATCH_SEND = "app.routes.auth._helpers.send_email"
STRONG_PW = "TestPass1!"


def _email() -> str:
    return f"test_{uuid.uuid4().hex[:10]}@uh.edu"


def _register(client, email: str, password: str = STRONG_PW):
    with patch(PATCH_SEND):
        return client.post("/auth/register", json={"email": email, "password": password})


def _mark_verified(app, email: str):
    from sqlalchemy import text as sqlt
    from app import db
    with app.app_context():
        with db.engine.begin() as conn:
            conn.execute(
                sqlt("UPDATE users SET email_verified_at = NOW() WHERE email = :e"),
                {"e": email},
            )


def _login(client, email: str, password: str = STRONG_PW):
    return client.post("/auth/login", json={"email": email, "password": password})


def make_user(app, role: str = "non-member") -> tuple[int, dict]:
    """Insert a verified user with the given role; return (user_id, auth_headers)."""
    with app.test_request_context():
        from app.raw_db import get_db
        email = f"u_{uuid.uuid4().hex[:8]}@uh.edu"
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (email, role, email_verified_at) "
                "VALUES (%s, %s, NOW()) RETURNING user_id",
                (email, role),
            )
            user_id = cur.fetchone()["user_id"]
            conn.commit()
        token = create_access_token(
            identity=str(user_id),
            additional_claims={"role": role},
        )
        return user_id, {"Authorization": f"Bearer {token}"}


def make_profile(app, user_id: int, student_id: str | None = None) -> str:
    """Insert a profile row linked to user_id; returns student_id."""
    sid = student_id or str(uuid.uuid4().int % 9_000_000 + 1_000_000)
    with app.test_request_context():
        from app.raw_db import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO profile (student_id, user_id, first_name, last_name) "
                "VALUES (%s, %s, %s, %s) ON CONFLICT (student_id) DO NOTHING",
                (sid, user_id, "Test", "User"),
            )
            conn.commit()
    return sid


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
