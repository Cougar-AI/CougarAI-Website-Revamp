# app/utils/db_utils.py - Database utility functions for auth
from flask import current_app
from app import db
from app.raw_db import connect
import psycopg2.extras


def get_db_connection():
    """
    Get database connection that works both in testing and production.
    In testing mode, use SQLAlchemy's connection; in production use raw connection.
    """
    if current_app.config.get("TESTING"):
        # In testing mode, use SQLAlchemy's connection
        # This should use the connection established by the test fixture
        connection = db.engine.raw_connection()
        return connection
    else:
        # In production/development, use the raw connection
        return connect()

def execute_query(query, params=None):
    """
    Execute a query and return results using the appropriate database connection.
    
    Args:
        query: SQL query string
        params: Query parameters
        
    Returns:
        Query results
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            if query.strip().upper().startswith('SELECT'):
                return cur.fetchall()
            elif query.strip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')):
                conn.commit()
                return cur.fetchall() if cur.description else None
        conn.commit()
        return None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def execute_single_query(query, params=None):
    """Execute a query and return single result."""
    results = execute_query(query, params)
    return results[0] if results else None