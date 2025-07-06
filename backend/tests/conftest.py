import pytest
import psycopg2
from app import create_app
from config import TestingConfig
from app.db import get_db, close_db, init_db

@pytest.fixture(scope='session')
def app():
    """Instantiate the app for testing"""
    app = create_app(TestingConfig)
    with app.app_context():
        init_db()
    yield app

@pytest.fixture(scope='session')
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture(scope='function')
def test_user(app):
    with app.app_context():
        db = get_db()
        cur = db.cursor()
        cur.execute(
            "INSERT INTO users (student_id, email, password_hash, first_name, last_name) VALUES (%s, %s, crypt(%s, gen_salt('bf')), %s, %s)",
            ('12345', 'test@example.com', 'password', 'Test', 'User')
        )
        db.commit()
        yield
        cur.execute("DELETE FROM users WHERE student_id = '12345'")
        db.commit()
        close_db()
