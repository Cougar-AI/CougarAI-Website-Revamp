import pytest
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy import event


@pytest.fixture(autouse=True)
def db_session(app):
    """
    Transaction-wrapping isolation fixture for integration tests.
    autouse=True scoped to tests/integration/ only — does NOT affect unit tests.

    Phase 2 note: this uses SQLAlchemy session nesting. The app uses raw
    psycopg2 via get_db(), so service/route commits are NOT rolled back here.
    Replace with psycopg2 savepoint isolation in Phase 2.
    """
    from app import db as _db

    with app.app_context():
        _db.create_all()

        connection = _db.engine.connect()
        outer_tx = connection.begin()

        SessionFactory = sessionmaker(bind=connection)
        TestingSession = scoped_session(SessionFactory)
        _db.session = TestingSession

        TestingSession.begin_nested()

        @event.listens_for(TestingSession(), "after_transaction_end")
        def _restart_savepoint(sess, trans):
            if trans.nested and not trans._parent.nested:
                try:
                    sess.begin_nested()
                except Exception:
                    pass

        try:
            yield TestingSession
        finally:
            try:
                TestingSession.remove()
            finally:
                try:
                    if outer_tx.is_active:
                        outer_tx.rollback()
                finally:
                    try:
                        connection.close()
                    except Exception:
                        pass
