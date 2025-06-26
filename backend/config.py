import os
from dotenv import load_dotenv

load_dotenv()

class BaseConfig:
    """Base configuration."""
    SECRET_KEY = os.getenv('SECRET_KEY', 'my_precious_secret_key')
    DEBUG = False
    TESTING = False
    PRODUCTION = False

class DevelopmentConfig(BaseConfig):
    """Development configuration."""
    DEBUG = True
    DB_NAME = os.getenv("DEV_DB_NAME")
    DB_USER = os.getenv("DEV_DB_USER")
    DB_PASS = os.getenv("DEV_DB_PASS")
    DB_HOST = os.getenv("DEV_DB_HOST")
    DB_PORT = os.getenv("DEV_DB_PORT")


class TestingConfig(BaseConfig):
    """Testing configuration."""
    TESTING = True
    DB_NAME = os.getenv("TEST_DB_NAME", "test_db")
    DB_USER = os.getenv("TEST_DB_USER", "test_user")
    DB_PASS = os.getenv("TEST_DB_PASS", "test_pass")
    DB_HOST = os.getenv("TEST_DB_HOST", "localhost")
    DB_PORT = os.getenv("TEST_DB_PORT", "5433")

class ProductionConfig(BaseConfig):
    """Production configuration."""
    PRODUCTION = True
    DB_NAME = os.getenv("PROD_DB_NAME")
    DB_USER = os.getenv("PROD_DB_USER")
    DB_PASS = os.getenv("PROD_DB_PASS")
    DB_HOST = os.getenv("PROD_DB_HOST")
    DB_PORT = os.getenv("PROD_DB_PORT")