# wsgi.py (or whatever this file is)
from pathlib import Path
from dotenv import load_dotenv

# Point to the actual .env location (adjust if yours is elsewhere)
BASE_DIR = Path(__file__).resolve().parent  # e.g., backend/
load_dotenv(BASE_DIR / ".env", override=False)

from app import create_app
from config import ProductionConfig

app = create_app(ProductionConfig)

# TEMP: sanity—remove after it boots
import os
print("Has URI?", bool(app.config.get("SQLALCHEMY_DATABASE_URI")))
print("DBG DB_NAME:", os.getenv("DB_NAME"))
print("DBG DB_USER:", os.getenv("DB_USER"))
print("DBG has PASS:", bool(os.getenv("DB_PASS") or os.getenv("DB_PASSWORD")))
