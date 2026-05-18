import os
import uuid
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError


@pytest.fixture(scope="session")
def docker_compose_file(pytestconfig):
    # Ensures pytest-docker finds tests/docker-compose.yml reliably
    return os.path.join(str(pytestconfig.rootpath), "tests", "docker-compose.yml")


# --- session-wide PostgreSQL service ---------------------------
@pytest.fixture(scope="session")
def _postgres_url(docker_services):
    port = docker_services.port_for("postgres_test", 5432)
    base_url = f"postgresql://test_user:test_pass@localhost:{port}/postgres"

    def _ready() -> bool:
        try:
            eng = create_engine(base_url, isolation_level="AUTOCOMMIT")
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except OperationalError:
            return False

    docker_services.wait_until_responsive(timeout=30.0, pause=0.5, check=_ready)

    db_name = f"test_{uuid.uuid4().hex}"
    eng = create_engine(base_url, isolation_level="AUTOCOMMIT")
    with eng.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    eng.dispose()

    test_url = f"postgresql://test_user:test_pass@localhost:{port}/{db_name}"
    os.environ["DATABASE_URL"] = test_url
    yield test_url

    eng = create_engine(base_url, isolation_level="AUTOCOMMIT")
    with eng.connect() as conn:
        conn.execute(
            text("SELECT pg_terminate_backend(pid) "
                 "FROM pg_stat_activity WHERE datname = :dname"),
            {"dname": db_name},
        )
        conn.execute(text(f'DROP DATABASE "{db_name}"'))
    eng.dispose()


@pytest.fixture(scope="session")
def app(_postgres_url):
    from app import create_app
    return create_app("config.TestConfig")


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()