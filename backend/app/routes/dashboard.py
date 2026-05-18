import os
from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from app.raw_db import get_db
from app import limiter
from app.utils.auth_decorators import require_authenticated, caller_id
from app.services.dashboard_service import DashboardService

dashboard_bp = Blueprint("dashboard", __name__)

AVATAR_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "avatars")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_BYTES = 2 * 1024 * 1024  # 2 MB

_ALLOWED_PROFILE_FIELDS = [
    "first_name", "last_name", "preferred_email", "is_public",
    "notification_settings", "shirt_size", "major", "discord_id", "grade_level",
]


# ---------------------------------------------------------------------------
# GET /dashboard/me
# ---------------------------------------------------------------------------

@dashboard_bp.route("/me", methods=["GET", "OPTIONS"])
@require_authenticated
def get_me():
    uid = caller_id()
    conn = get_db()
    svc = DashboardService(conn)
    result = svc.get_me(uid)
    if result is None:
        return jsonify({"error": "User not found"}), 404
    return jsonify(result), 200


# ---------------------------------------------------------------------------
# PATCH /dashboard/profile
# ---------------------------------------------------------------------------

@dashboard_bp.route("/profile", methods=["PATCH", "OPTIONS"])
@require_authenticated
def update_profile():
    uid = caller_id()
    data = request.get_json(silent=True) or {}
    updates = {k: data[k] for k in _ALLOWED_PROFILE_FIELDS if k in data}

    conn = get_db()
    svc = DashboardService(conn)
    ok, error = svc.update_profile(uid, updates)

    if not ok:
        status = 400 if error == "No valid fields provided" else 404
        return jsonify({"error": error}), status

    return jsonify({"message": "Profile updated"}), 200


# ---------------------------------------------------------------------------
# POST /dashboard/profile/link
# ---------------------------------------------------------------------------

@dashboard_bp.route("/profile/link", methods=["POST", "OPTIONS"])
@require_authenticated
def link_profile():
    uid = caller_id()
    data = request.get_json(silent=True) or {}
    student_id = str(data.get("student_id") or "").strip()

    if not student_id:
        return jsonify({"error": "student_id is required"}), 400

    conn = get_db()
    svc = DashboardService(conn)
    ok, error, status_code = svc.link_profile(uid, student_id)

    if not ok:
        return jsonify({"error": error}), status_code

    return jsonify({"message": "Profile linked successfully"}), 200


# ---------------------------------------------------------------------------
# POST /dashboard/avatar  (file I/O + single DB update — kept inline)
# ---------------------------------------------------------------------------

@dashboard_bp.route("/avatar", methods=["POST", "OPTIONS"])
@require_authenticated
@limiter.limit("5/minute")
def upload_avatar():
    uid = caller_id()

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]
    if f.mimetype not in ALLOWED_MIME:
        return jsonify({"error": "Only JPEG, PNG, and WebP images are allowed"}), 400

    f.seek(0, 2)
    size = f.tell()
    f.seek(0)
    if size > MAX_AVATAR_BYTES:
        return jsonify({"error": "File exceeds 2 MB limit"}), 400

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[f.mimetype]
    filename = secure_filename(f"{uid}.{ext}")
    os.makedirs(AVATAR_DIR, exist_ok=True)
    f.save(os.path.join(AVATAR_DIR, filename))

    avatar_url = f"/dashboard/avatar/{uid}"
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("UPDATE profile SET avatar_url = %s WHERE user_id = %s", (avatar_url, uid))
        conn.commit()

    return jsonify({"avatar_url": avatar_url}), 200


# ---------------------------------------------------------------------------
# GET /dashboard/avatar/<user_id>  (public — no auth)
# ---------------------------------------------------------------------------

@dashboard_bp.route("/avatar/<int:user_id>", methods=["GET"])
def get_avatar(user_id):
    for ext in ("jpg", "png", "webp"):
        path = os.path.join(AVATAR_DIR, f"{user_id}.{ext}")
        if os.path.exists(path):
            return send_from_directory(AVATAR_DIR, f"{user_id}.{ext}")
    return jsonify({"error": "Avatar not found"}), 404


# ---------------------------------------------------------------------------
# GET /dashboard/memberships
# ---------------------------------------------------------------------------

@dashboard_bp.route("/memberships", methods=["GET", "OPTIONS"])
@require_authenticated
def get_memberships():
    uid = caller_id()
    conn = get_db()
    svc = DashboardService(conn)
    return jsonify(svc.get_memberships(uid)), 200


# ---------------------------------------------------------------------------
# GET /dashboard/points
# ---------------------------------------------------------------------------

@dashboard_bp.route("/points", methods=["GET", "OPTIONS"])
@require_authenticated
def get_points():
    uid = caller_id()
    limit = request.args.get("limit", 20, type=int)
    offset = request.args.get("offset", 0, type=int)

    conn = get_db()
    svc = DashboardService(conn)
    return jsonify(svc.get_points(uid, limit, offset)), 200


# ---------------------------------------------------------------------------
# POST /dashboard/onboarding/complete  (SQLAlchemy db layer — kept inline)
# ---------------------------------------------------------------------------

@dashboard_bp.route("/onboarding/complete", methods=["POST", "OPTIONS"])
@require_authenticated
def complete_onboarding():
    uid = caller_id()
    from app import db
    from sqlalchemy import text

    with db.engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET onboarding_completed_at = NOW() WHERE user_id = :uid"),
            {"uid": uid},
        )

    return jsonify({"message": "Onboarding complete"}), 200
