from app.imports import *
from flask import current_app
from urllib.parse import urlparse

def connect():
    dsn = current_app.config.get("SQLALCHEMY_DATABASE_URI")
    if dsn:
        u = urlparse(dsn)
        return psycopg2.connect(
            dbname=(u.path or "/").lstrip("/"),
            user=u.username,
            password=u.password,
            host=u.hostname or "localhost",
            port=u.port or 5432,
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
    # Fallback to discrete DB_* keys for dev/prod
    return psycopg2.connect(
        dbname=current_app.config.get("DB_NAME"),
        user=current_app.config.get("DB_USER"),
        password=current_app.config.get("DB_PASS"),
        host=current_app.config.get("DB_HOST", "localhost"),
        port=current_app.config.get("DB_PORT", 5432),
        cursor_factory=psycopg2.extras.RealDictCursor,
    )