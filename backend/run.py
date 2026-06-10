
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.imports import *
from app import create_app
from config import DevelopmentConfig

app = create_app(DevelopmentConfig)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5001")), use_reloader=True)
