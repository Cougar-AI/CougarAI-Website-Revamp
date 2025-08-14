import os
from pathlib import Path
from dotenv import load_dotenv


load_dotenv()

class BaseConfig:
    DEBUG = False
    TESTING = False
    PRODUCTION = False
    JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-too")

class DevelopmentConfig(BaseConfig):
    DB_NAME = os.getenv("DEV_DB_NAME")
    DB_USER = os.getenv("DEV_DB_USER")
    DB_PASS = os.getenv("DEV_DB_PASS")
    DB_HOST = os.getenv("DEV_DB_HOST", "localhost")
    DB_PORT = os.getenv("DEV_DB_PORT", "5432")
    if all([DB_NAME, DB_USER, DB_PASS, DB_HOST, DB_PORT]):
        SQLALCHEMY_DATABASE_URI = (
            f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
        )
        SQLALCHEMY_TRACK_MODIFICATIONS = False


class TestConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv(
    "DATABASE_URL",
    "postgresql://test_user:test_pass@localhost:5432/test_db",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

class ProductionConfig(BaseConfig):
    """Production configuration."""
    PRODUCTION = True
    DB_NAME = os.getenv("PROD_DB_NAME")
    DB_USER = os.getenv("PROD_DB_USER")
    DB_PASS = os.getenv("PROD_DB_PASS")
    DB_HOST = os.getenv("PROD_DB_HOST")
    DB_PORT = os.getenv("PROD_DB_PORT")