import psycopg2
import os 

def connect():
        return psycopg2.connect(
            name = os.getenv("DB_NAME"),
            user = os.getenv("DB_USER"),
            password = os.getenv("DB_PASS"),
            host = os.getenv("DB_HOST"),
            port = os.getenv("DB_PORT"),
            cursor_factory=psycopg2.extras.RealDictCursor # will make results be dictionary, and not tuple
        )