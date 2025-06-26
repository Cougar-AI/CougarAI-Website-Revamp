import pytest
from app import create_app
from config import TestingConfig

@pytest.fixture(scope='module')
def app():
    """Instantiate the app for testing"""
    app = create_app(TestingConfig)
    return app

@pytest.fixture(scope='module')
def client(app):
    """A test client for the app."""
    return app.test_client()