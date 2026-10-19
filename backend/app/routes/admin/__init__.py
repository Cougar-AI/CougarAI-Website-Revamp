import os
from flask import Blueprint
admin_bp = Blueprint("admin", __name__)

UPLOADS_BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_CATEGORIES = {"sponsors", "partners", "slideshow", "officers", "projects"}
# Admin-only uploads that must never be served by the public /admin/uploads route
# (financial receipts) — read them back through GET /admin/receipts/image/<filename>.
PRIVATE_UPLOAD_CATEGORIES = {"receipts"}
# Categories officers (not just admins) may upload images to.
OFFICER_UPLOAD_CATEGORIES = {"projects"}


from app.routes.admin import users, events, officers, sponsors, partners, points, misc, bulk_email, slideshow, workshop_proxy, projects  # noqa: E402, F401

