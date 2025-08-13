from app.imports import *
from flask import current_app

def connect():
        return psycopg2.connect(
            dbname = current_app.config["DB_NAME"],
            user = current_app.config["DB_USER"],
            password = current_app.config["DB_PASS"],
            host = current_app.config["DB_HOST"],
            port = current_app.config["DB_PORT"],
            cursor_factory=psycopg2.extras.RealDictCursor # will make results be dictionary, and not tuple
        )