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
    import os
    from sqlalchemy import text as sqlt
    from app import create_app, db

    application = create_app("config.TestConfig")

    bootstrap_schema = """
    CREATE TABLE IF NOT EXISTS profile (
        user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
        student_id VARCHAR(32) NOT NULL UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        avatar_url TEXT,
        preferred_email TEXT,
        is_public BOOLEAN NOT NULL DEFAULT TRUE,
        notification_settings JSONB,
        current_streak INTEGER NOT NULL DEFAULT 0,
        max_streak INTEGER NOT NULL DEFAULT 0,
        last_event_month DATE,
        grade_level VARCHAR(50),
        major VARCHAR(120),
        shirt_size VARCHAR(20),
        discord_id VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS officers (
        student_id VARCHAR(32) PRIMARY KEY,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(20) NOT NULL DEFAULT 'officer',
        join_date DATE NOT NULL DEFAULT CURRENT_DATE,
        end_date DATE
    );

    CREATE TABLE IF NOT EXISTS notification_schedules (
        schedule_id SERIAL PRIMARY KEY,
        title TEXT,
        body TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
    );
    """

    # Apply schema once — db-init tables then core migrations (same order as run_migrations.sh)
    root = os.path.join(os.path.dirname(__file__), "..")
    schema_files = [
        os.path.join(root, "db-init", "001_auth.sql"),
        os.path.join(root, "migrations", "add_users_dashboard_fields.sql"),
        os.path.join(root, "migrations", "add_non_member_default_role.sql"),
        os.path.join(root, "migrations", "add_slideshow_photos.sql"),
        os.path.join(root, "migrations", "add_officer_positions_table.sql"),
        os.path.join(root, "migrations", "add_officer_photos.sql"),
        os.path.join(root, "migrations", "add_officers_display_name.sql"),
    ]
    with application.app_context():
        with db.engine.begin() as conn:
            for idx, path in enumerate(schema_files):
                with open(path) as f:
                    conn.execute(sqlt(f.read()))
                if idx == 0:
                    conn.execute(sqlt(bootstrap_schema))

    return application


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()
