# backend/app/raw_db.py
import os
from urllib.parse import urlparse, parse_qs
from flask import current_app, has_app_context
import psycopg2
from psycopg2.extras import RealDictCursor

def _cfg(key, *env_keys, default=None):
    # prefer Flask config (when available), otherwise env
    if has_app_context():
        v = current_app.config.get(key)
        if v not in (None, ""):
            return v
    for k in env_keys:
        v = os.getenv(k)
        if v not in (None, ""):
            return v
    return default

def _kwargs_from_uri(uri: str) -> dict:
    u = urlparse(uri)
    opts = {
        "dbname": (u.path or "/").lstrip("/"),
        "user": u.username,
        "password": u.password,
        "host": u.hostname or "127.0.0.1",  # force TCP if missing
        "port": int(u.port) if u.port else 5432,
        "cursor_factory": RealDictCursor,
    }
    # carry through common query params (ssl, timeouts, etc.)
    q = {k: v[0] for k, v in parse_qs(u.query).items() if v}
    for k in ("sslmode", "sslrootcert", "sslcert", "sslkey", "application_name"):
        if k in q:
            opts[k] = q[k]
    if "connect_timeout" in q:
        try:
            opts["connect_timeout"] = int(q["connect_timeout"])
        except ValueError:
            pass
    return opts

def connect():
    # 1) Full URL if provided (supports SQLALCHEMY_DATABASE_URI, DATABASE_URL, DB_URL)
    uri = _cfg("SQLALCHEMY_DATABASE_URI", "DATABASE_URL", "DB_URL")
    if uri:
        kw = _kwargs_from_uri(uri)
    else:
        # 2) Discrete pieces (support both DB_* and PG* names)
        dbname = _cfg("DB_NAME", "PGDATABASE", default="CougarAI_Database")
        user   = _cfg("DB_USER", "PGUSER")
        pwd    = _cfg("DB_PASS", "PGPASSWORD", default="")
        host   = _cfg("DB_HOST", "PGHOST", default="127.0.0.1")  # force TCP
        port   = int(_cfg("DB_PORT", "PGPORT", default="5432"))

        if not all([dbname, user, host, port]):
            # Fail fast with a clear message so you know why it fell back to a socket.
            raise RuntimeError(
                "Database config incomplete: set SQLALCHEMY_DATABASE_URI or "
                "DB_NAME/DB_USER/DB_PASS/DB_HOST/DB_PORT (or PG* equivalents)."
            )

        kw = {
            "dbname": dbname,
            "user": user,
            "password": pwd,
            "host": host,
            "port": port,
            "cursor_factory": RealDictCursor,
        }

        sslmode = _cfg("DB_SSLMODE", "PGSSLMODE")
        if sslmode:
            kw["sslmode"] = sslmode

    # Optional: log non-secret target so you can see what’s actually used
    if has_app_context() and getattr(current_app, "logger", None):
        current_app.logger.info(
            "DB connect -> host=%s port=%s db=%s user=%s",
            kw.get("host"), kw.get("port"), kw.get("dbname"), kw.get("user"),
        )

    return psycopg2.connect(**kw)
