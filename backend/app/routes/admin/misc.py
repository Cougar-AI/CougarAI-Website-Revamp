import os
import uuid
from flask import request, jsonify, send_from_directory
from flask_jwt_extended import get_jwt_identity
from werkzeug.utils import secure_filename
from app.routes.admin import admin_bp, UPLOADS_BASE, ALLOWED_MIME, MAX_UPLOAD_BYTES, ALLOWED_CATEGORIES
from app.raw_db import get_db
from app.utils.auth_decorators import require_admin, require_officer


@admin_bp.route("/upload-image", methods=["POST", "OPTIONS"])
@require_admin
def upload_image():
    category = request.args.get("category", "").strip()
    if category not in ALLOWED_CATEGORIES:
        return jsonify({"error": f"category must be one of: {', '.join(sorted(ALLOWED_CATEGORIES))}"}), 400

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]
    if f.mimetype not in ALLOWED_MIME:
        return jsonify({"error": "Only JPEG, PNG, and WebP images are allowed"}), 400

    f.seek(0, 2)
    size = f.tell()
    f.seek(0)
    if size > MAX_UPLOAD_BYTES:
        return jsonify({"error": "File exceeds 5 MB limit"}), 400

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[f.mimetype]
    filename = secure_filename(f"{uuid.uuid4().hex}.{ext}")
    upload_dir = os.path.join(UPLOADS_BASE, category)
    os.makedirs(upload_dir, exist_ok=True)
    f.save(os.path.join(upload_dir, filename))

    return jsonify({"url": f"/admin/uploads/{category}/{filename}"}), 200


@admin_bp.route("/upload-file", methods=["POST", "OPTIONS"])
@require_admin
def upload_file():
    """Upload non-image files (PDFs) for admin-managed categories like sponsors.
    Returns a URL under /admin/uploads/<category>/<filename>
    """
    category = request.args.get("category", "").strip()
    if category not in ALLOWED_CATEGORIES:
        return jsonify({"error": f"category must be one of: {', '.join(sorted(ALLOWED_CATEGORIES))}"}), 400

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]
    # Allow PDFs for now
    if f.mimetype != "application/pdf":
        return jsonify({"error": "Only PDF files are allowed for this endpoint"}), 400

    f.seek(0, 2)
    size = f.tell()
    f.seek(0)
    if size > (10 * 1024 * 1024):  # 10 MB limit for PDFs
        return jsonify({"error": "File exceeds 10 MB limit"}), 400

    filename = secure_filename(f"{uuid.uuid4().hex}.pdf")
    upload_dir = os.path.join(UPLOADS_BASE, category)
    os.makedirs(upload_dir, exist_ok=True)
    f.save(os.path.join(upload_dir, filename))

    return jsonify({"url": f"/admin/uploads/{category}/{filename}"}), 200


@admin_bp.route("/uploads/<category>/<filename>", methods=["GET"])
def serve_upload(category, filename):
    if category not in ALLOWED_CATEGORIES:
        return jsonify({"error": "Not found"}), 404
    upload_dir = os.path.join(UPLOADS_BASE, category)
    return send_from_directory(upload_dir, secure_filename(filename))


@admin_bp.route("/pinned-announcement", methods=["GET", "OPTIONS"])
@require_officer
def get_pinned_announcement():
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, message, created_at, expires_at, is_active
            FROM pinned_announcements
            WHERE is_active = TRUE
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY created_at DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
    if not row:
        return jsonify({"announcement": None}), 200
    return jsonify({
        "announcement": {
            "id": row["id"],
            "message": row["message"],
            "created_at": row["created_at"].isoformat(),
            "expires_at": row["expires_at"].isoformat() if row["expires_at"] else None,
        }
    }), 200


@admin_bp.route("/pinned-announcement", methods=["POST", "OPTIONS"])
@require_officer
def set_pinned_announcement():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400
    expires_at = data.get("expires_at")
    caller_id = get_jwt_identity()

    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("UPDATE pinned_announcements SET is_active = FALSE WHERE is_active = TRUE")
        cur.execute(
            """
            INSERT INTO pinned_announcements (message, created_by, expires_at)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (message, caller_id, expires_at or None),
        )
        new_id = cur.fetchone()["id"]
        conn.commit()
    return jsonify({"id": new_id, "message": "Announcement pinned"}), 201


@admin_bp.route("/pinned-announcement", methods=["DELETE", "OPTIONS"])
@require_officer
def delete_pinned_announcement():
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("UPDATE pinned_announcements SET is_active = FALSE WHERE is_active = TRUE")
        conn.commit()
    return jsonify({"message": "Announcement removed"}), 200
