# app/raw_db.py
from app.imports import *
from flask import current_app, g
from urllib.parse import urlparse, unquote
from contextlib import contextmanager
import os

REQUIRED = ("dbname", "user", "password")

def _from_uri(uri: str):
    if uri.startswith("postgres://"):
        uri = "postgresql://" + uri[len("postgres://"):]
    u = urlparse(uri)
    return {
        "dbname": (u.path or "/").lstrip("/"),
        "user": unquote(u.username) if u.username else None,
        "password": unquote(u.password) if u.password else None,
        "host": u.hostname or "127.0.0.1",
        "port": u.port or 5432,
    }

def _from_config():
    return {
        "dbname": current_app.config.get("DB_NAME") or os.getenv("DB_NAME"),
        "user": current_app.config.get("DB_USER") or os.getenv("DB_USER"),
        "password": (
            current_app.config.get("DB_PASS")
            or os.getenv("DB_PASS")
            or os.getenv("DB_PASSWORD")
        ),
        "host": current_app.config.get("DB_HOST") or os.getenv("DB_HOST") or "127.0.0.1",
        "port": int(current_app.config.get("DB_PORT") or os.getenv("DB_PORT") or 5432),
    }

def _validate(dsn: dict):
    missing = [k for k in REQUIRED if not dsn.get(k)]
    if missing:
        raise RuntimeError(
            "Database configuration incomplete. Missing: "
            + ", ".join(missing)
            + ". Ensure DB_NAME, DB_USER, DB_PASS/DB_PASSWORD (and optionally DB_HOST, DB_PORT) are set, "
              "or provide a full SQLALCHEMY_DATABASE_URI/DATABASE_URL."
        )

def connect():
    uri = current_app.config.get("SQLALCHEMY_DATABASE_URI") or os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI")
    if uri:
        dsn = _from_uri(uri)
    else:
        dsn = _from_config()

    _validate(dsn)
    return psycopg2.connect(
        dbname=dsn["dbname"],
        user=dsn["user"],
        password=dsn["password"],
        host=dsn["host"],
        port=dsn["port"],
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def get_db():
    """Return a request-scoped DB connection. Creates one per request, reuses it on repeat calls."""
    if 'db_conn' not in g:
        g.db_conn = connect()
    return g.db_conn
