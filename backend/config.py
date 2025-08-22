# config.py
import os
from dotenv import load_dotenv, find_dotenv

# Load .env if present, but don't overwrite process env
load_dotenv(find_dotenv(), override=False)

def _build_uri():
    """
    Build PostgreSQL database URI from environment variables.
    
    Required environment variables:
    - DB_NAME: Database name
    - DB_USER: Database username  
    - DB_PASS or DB_PASSWORD: Database password
    
    Optional environment variables:
    - DB_HOST: Database host (defaults to 127.0.0.1)
    - DB_PORT: Database port (defaults to 5432)
    
    Returns:
        str: PostgreSQL URI if all required variables are present, None otherwise
    """
    name = os.getenv("DB_NAME")
    user = os.getenv("DB_USER")
    pw = os.getenv("DB_PASS") or os.getenv("DB_PASSWORD")
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "5432")
    
    if all([name, user, pw, host, port]):
        return f"postgresql://{user}:{pw}@{host}:{port}/{name}"
    return None

class BaseConfig:
    """Base configuration with common settings."""
    DEBUG = False
    TESTING = False
    PRODUCTION = False
    JWT_SECRET = os.getenv("JWT_SECRET", "change-me-too")
    JWT_EMAIL_SECRET = os.getenv("JWT_EMAIL_SECRET", "change-me-email-secret")
    SECRET_KEY_BASE = os.getenv("SECRET_KEY_BASE", "change-me-secret-key")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
    MAILER_BACKEND = os.getenv("MAILER_BACKEND", "smtp")
    SQLALCHEMY_TRACK_MODIFICATIONS = False


class DevelopmentConfig(BaseConfig):
    """Development environment configuration."""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv("SQLALCHEMY_DATABASE_URI") or _build_uri()


class TestConfig(BaseConfig):
    """Test environment configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql://test_user:test_pass@127.0.0.1:5432/test_db",
    )


class ProductionConfig(BaseConfig):
    """Production environment configuration."""
    PRODUCTION = True
    SQLALCHEMY_DATABASE_URI = os.getenv("SQLALCHEMY_DATABASE_URI") or _build_uri()
