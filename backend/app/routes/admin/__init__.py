import os
from flask import Blueprint, send_from_directory, make_response

admin_bp = Blueprint("admin", __name__)

UPLOADS_BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_CATEGORIES = {"sponsors", "partners", "slideshow", "officers"}

@admin_bp.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename):
    safe_path = os.path.normpath(filename)
    if safe_path.startswith(".."):
        from flask import abort
        abort(403)

    response = make_response(
        send_from_directory(UPLOADS_BASE, safe_path)
    )

    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET"
    return response

from app.routes.admin import users, events, officers, sponsors, partners, points, misc, bulk_email, slideshow  # noqa: E402, F401

