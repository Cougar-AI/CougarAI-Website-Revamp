# wsgi.py - Production WSGI entry point
from pathlib import Path
from dotenv import load_dotenv

# Point to the actual .env location (adjust if yours is elsewhere)
BASE_DIR = Path(__file__).resolve().parent  # e.g., backend/
load_dotenv(BASE_DIR / ".env", override=False)

from app import create_app
from config import ProductionConfig

app = create_app(ProductionConfig)
