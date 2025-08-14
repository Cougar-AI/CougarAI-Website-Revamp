# config.py
import os
from dotenv import load_dotenv, find_dotenv

# Load .env if present, but don't overwrite process env
load_dotenv(find_dotenv(), override=False)

def _build_uri():
    name = os.getenv("DB_NAME")
    user = os.getenv("DB_USER")
    pw   = os.getenv("DB_PASS") or os.getenv("DB_PASSWORD")
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "5432")
    if all([name, user, pw, host, port]):
        return f"postgresql://{user}:{pw}@{host}:{port}/{name}"

class BaseConfig:
    DEBUG = False
    TESTING = False
    PRODUCTION = False
    JWT_SECRET = os.getenv("JWT_SECRET", "change-me-too")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv("SQLALCHEMY_DATABASE_URI") or _build_uri()

class TestConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql://test_user:test_pass@127.0.0.1:5432/test_db",
    )

class ProductionConfig(BaseConfig):
    PRODUCTION = True
    SQLALCHEMY_DATABASE_URI = os.getenv("SQLALCHEMY_DATABASE_URI") or _build_uri()
