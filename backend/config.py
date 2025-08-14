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
    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASS = os.getenv("DB_PASS")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
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
    PRODUCTION = True
    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASS = os.getenv("DB_PASS")
    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = os.getenv("DB_PORT")