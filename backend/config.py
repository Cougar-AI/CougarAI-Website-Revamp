# config.py
from datetime import timedelta
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
    SECRET_KEY = os.getenv("SECRET_KEY_BASE", "changemedev")
    JSON_AS_ASCII = False
    JWT_ACCESS_SECRET  = os.environ.get("JWT_ACCESS_SECRET",  "dev-access-secret")
    JWT_REFRESH_SECRET = os.environ.get("JWT_REFRESH_SECRET", "dev-refresh-secret")
    JWT_EMAIL_SECRET   = os.environ.get("JWT_EMAIL_SECRET",   "dev-email-secret")
    JWT_RESET_SECRET   = os.environ.get("JWT_RESET_SECRET",   "dev-reset-secret")
    
    ACCESS_EXPIRES  = timedelta(minutes=15)
    REFRESH_EXPIRES = timedelta(days=7)
    VERIFY_EXPIRES  = timedelta(hours=24)
    RESET_EXPIRES   = timedelta(minutes=30)
    
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    _stripe_mode = os.getenv("STRIPE_MODE", "test").strip().lower()
    STRIPE_SECRET_KEY = (
        os.getenv("STRIPE_TEST_SECRET_KEY")
        if _stripe_mode == "test"
        else os.getenv("STRIPE_SECRET_KEY")
    )
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    MAILER_BACKEND = os.getenv("MAILER_BACKEND", "smtp")
    SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() in {"1","true","yes","on"}
    
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
