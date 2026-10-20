# config.py
from datetime import timedelta
import os
import sys
from dotenv import load_dotenv

# Load .env if present, but don't overwrite process env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=False)

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

def _split_origins(value: str):
    return [origin.strip() for origin in value.split(",") if origin.strip()]

# Placeholder secrets that are public (this repo is public). Production refuses
# to sign logins with any of them: anyone could mint an admin token.
PUBLIC_PLACEHOLDER_SECRETS = frozenset({
    "changemedev", "dev-access-secret", "dev-refresh-secret", "dev-email-secret", "dev-reset-secret",
})
MIN_SECRET_LENGTH = 32


def _secret_problems(name: str, value: str, *, fatal_if_public: bool) -> list:
    """Startup checks for one secret: raises on a public placeholder (when
    fatal_if_public), returns warning strings for anything merely weak."""
    if value in PUBLIC_PLACEHOLDER_SECRETS:
        if fatal_if_public:
            raise RuntimeError(
                f"{name} is a public placeholder value. Anyone can forge logins with it. "
                f"Set a random value in backend/.env: python3 -c \"import secrets;print(secrets.token_urlsafe(48))\""
            )
        return [f"{name} is a public placeholder value; set a random one in backend/.env."]
    if len(value) < MIN_SECRET_LENGTH:
        return [f"{name} is only {len(value)} characters; use at least {MIN_SECRET_LENGTH} random characters (short HMAC keys can be cracked offline from any token)."]
    return []


def _require_env(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        raise RuntimeError(f"Required environment variable {key!r} is not set. Set it in backend/.env before starting the server.")
    return val

class BaseConfig:
    """Base configuration with common settings."""
    DEBUG = False
    TESTING = False
    PRODUCTION = False
    SECRET_KEY = os.getenv("SECRET_KEY_BASE", "changemedev")
    JSON_AS_ASCII = False
    # Dev/test fallbacks — overridden in ProductionConfig to require real values
    JWT_ACCESS_SECRET  = os.environ.get("JWT_ACCESS_SECRET",  "dev-access-secret")
    JWT_REFRESH_SECRET = os.environ.get("JWT_REFRESH_SECRET", "dev-refresh-secret")
    JWT_EMAIL_SECRET   = os.environ.get("JWT_EMAIL_SECRET",   "dev-email-secret")
    JWT_RESET_SECRET   = os.environ.get("JWT_RESET_SECRET",   "dev-reset-secret")
    
    ACCESS_EXPIRES  = timedelta(minutes=30)
    REFRESH_EXPIRES = timedelta(days=7)
    VERIFY_EXPIRES  = timedelta(hours=24)
    RESET_EXPIRES   = timedelta(minutes=30)
    
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    FRONTEND_URLS = _split_origins(os.getenv("FRONTEND_URLS", "")) or None
    _stripe_mode = os.getenv("STRIPE_MODE", "test").strip().lower()
    STRIPE_SECRET_KEY = (
        os.getenv("STRIPE_TEST_SECRET_KEY")
        if _stripe_mode == "test"
        else os.getenv("STRIPE_SECRET_KEY")
    )
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "")
    # Shared secret the CougarAI Discord bot sends as `Authorization: Bot <key>`.
    # Unset (or under 32 chars) = bot key auth off. See app/utils/auth_decorators.py.
    BOT_API_KEY = os.getenv("BOT_API_KEY", "")

    MAILER_BACKEND = os.getenv("MAILER_BACKEND", "smtp")
    SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() in {"1","true","yes","on"}

    # Largest request body Flask will read (bulk-email attachments cap at 18 MB); larger → 413
    MAX_CONTENT_LENGTH = 20 * 1024 * 1024
    
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

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)

    @classmethod
    def _validate_secrets(cls):
        # In production all secrets must be explicitly set — no insecure defaults allowed
        cls.JWT_ACCESS_SECRET  = _require_env("JWT_ACCESS_SECRET")
        cls.JWT_REFRESH_SECRET = _require_env("JWT_REFRESH_SECRET")
        cls.JWT_EMAIL_SECRET   = _require_env("JWT_EMAIL_SECRET")
        cls.JWT_RESET_SECRET   = _require_env("JWT_RESET_SECRET")
        cls.STRIPE_WEBHOOK_SECRET = _require_env("STRIPE_WEBHOOK_SECRET")

        # JWT signing secrets: a public placeholder is fatal, a short one is a loud warning.
        warnings = []
        for name in ("JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "JWT_EMAIL_SECRET", "JWT_RESET_SECRET"):
            warnings += _secret_problems(name, getattr(cls, name), fatal_if_public=True)
        # SECRET_KEY (SECRET_KEY_BASE) signs the Google/Microsoft OAuth state.
        secret_key_base = os.environ.get("SECRET_KEY_BASE", "")
        if not secret_key_base:
            warnings.append("SECRET_KEY_BASE is not set, so SECRET_KEY is the public placeholder 'changemedev'; set a random one in backend/.env.")
        else:
            cls.SECRET_KEY = secret_key_base
            warnings += _secret_problems("SECRET_KEY_BASE", secret_key_base, fatal_if_public=False)
        for w in warnings:
            print(f"[config] SECURITY WARNING: {w}", file=sys.stderr)
        return warnings

# Validate production secrets at import time only when this config will actually be used
if os.getenv("FLASK_ENV") == "production" or os.getenv("COUGARAI_ENV") == "production":
    ProductionConfig._validate_secrets()
