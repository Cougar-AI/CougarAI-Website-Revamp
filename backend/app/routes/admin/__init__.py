import os
from flask import Blueprint

admin_bp = Blueprint("admin", __name__)

UPLOADS_BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_CATEGORIES = {"sponsors", "partners", "slideshow", "officers"}

from app.routes.admin import users, events, officers, sponsors, partners, points, misc, bulk_email, slideshow  # noqa: E402, F401
