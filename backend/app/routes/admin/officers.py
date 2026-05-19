import os
import uuid
from datetime import date
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from werkzeug.utils import secure_filename
from app.routes.admin import admin_bp, UPLOADS_BASE, ALLOWED_MIME, MAX_UPLOAD_BYTES
from app.raw_db import get_db
from app.utils.auth_decorators import require_admin, require_officer
from app.services.officer_service import OfficerService

_OFFICER_ROLES = {"officer", "admin"}


@admin_bp.route("/officer-positions", methods=["GET", "OPTIONS"])
@require_officer
def list_officer_positions():
    svc = OfficerService(get_db())
    positions = svc.list_positions()
    return jsonify({"positions": positions}), 200


@admin_bp.route("/officer-positions", methods=["POST", "OPTIONS"])
@require_admin
def create_officer_position():
    if request.method == "OPTIONS":
        return "", 200
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    department = (data.get("department") or "").strip()
    sort_order = data.get("sort_order", 0)

    if not title:
        return jsonify({"error": "title is required"}), 400

    try:
        sort_order = int(sort_order)
    except (TypeError, ValueError):
        return jsonify({"error": "sort_order must be an integer"}), 400

    svc = OfficerService(get_db())
    position_id, error = svc.create_position(title, department, sort_order)
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"message": "Position created", "position_id": position_id}), 201


@admin_bp.route("/officer-positions/<int:position_id>", methods=["PATCH", "OPTIONS"])
@require_admin
def update_officer_position(position_id):
    if request.method == "OPTIONS":
        return "", 200
    data = request.get_json(silent=True) or {}
    updates = {}

    if "title" in data:
        title = (data["title"] or "").strip()
        if not title:
            return jsonify({"error": "title cannot be empty"}), 400
        updates["title"] = title

    if "department" in data:
        updates["department"] = (data["department"] or "").strip()

    if "sort_order" in data:
        try:
            updates["sort_order"] = int(data["sort_order"])
        except (TypeError, ValueError):
            return jsonify({"error": "sort_order must be an integer"}), 400

    if not updates:
        return jsonify({"error": "Nothing to update"}), 400

    svc = OfficerService(get_db())
    success, error = svc.update_position(position_id, updates)
    if not success:
        return jsonify({"error": error}), 404 if error == "Position not found" else 400

    return jsonify({"message": "Position updated"}), 200


@admin_bp.route("/officer-positions/<int:position_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def delete_officer_position(position_id):
    if request.method == "OPTIONS":
        return "", 200

    svc = OfficerService(get_db())
    success, error = svc.delete_position(position_id)
    if not success:
        return jsonify({"error": error}), 404 if error == "Position not found" else 400

    return jsonify({"message": "Position deleted"}), 200


@admin_bp.route("/officers/directory", methods=["GET", "OPTIONS"])
def officers_directory():
    if request.method == "OPTIONS":
        return "", 200
    svc = OfficerService(get_db())
    officers = svc.list_active_officers_public()
    return jsonify({"officers": officers}), 200


@admin_bp.route("/officers/self", methods=["GET", "OPTIONS"])
@require_officer
def get_officer_self():
    if request.method == "OPTIONS":
        return "", 200
    caller_id = get_jwt_identity()
    svc = OfficerService(get_db())
    officer = svc.get_officer_by_user_id(caller_id)
    if not officer:
        return jsonify({"error": "Not found"}), 404
    return jsonify(officer), 200


@admin_bp.route("/officers/self", methods=["PATCH", "OPTIONS"])
@require_officer
def update_officer_self():
    caller_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    svc = OfficerService(get_db())
    officer = svc.get_officer_by_user_id(caller_id)
    if not officer:
        return jsonify({"error": "You are not listed as an active officer"}), 404

    photo_url = data.get("photo_url")
    photo_object_position = data.get("photo_object_position", "50% 50%")
    linkedin_url = data.get("linkedin_url")

    # Allow explicit null to clear fields
    if "photo_url" not in data and "photo_object_position" not in data and "linkedin_url" not in data:
        return jsonify({"error": "Nothing to update"}), 400

    success, error = svc.update_officer_appearance(
        officer["student_id"], photo_url, photo_object_position, linkedin_url
    )
    if not success:
        return jsonify({"error": error}), 404

    return jsonify({"message": "Officer appearance updated"}), 200


@admin_bp.route("/officers/self/photo", methods=["POST", "OPTIONS"])
@require_officer
def upload_officer_self_photo():
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
    upload_dir = os.path.join(UPLOADS_BASE, "officers")
    os.makedirs(upload_dir, exist_ok=True)
    f.save(os.path.join(upload_dir, filename))

    return jsonify({"url": f"/admin/uploads/officers/{filename}"}), 200


@admin_bp.route("/officers", methods=["GET", "OPTIONS"])
@require_admin
def list_officers():
    svc = OfficerService(get_db())
    officers = svc.list_officers()
    return jsonify({"officers": officers}), 200


@admin_bp.route("/officers", methods=["POST", "OPTIONS"])
@require_admin
def add_officer():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    officer_role = data.get("officer_role")
    join_date_str = data.get("join_date") or date.today().isoformat()
    position_id = data.get("position_id") or None
    first_name = (data.get("first_name") or "").strip()
    last_name = (data.get("last_name") or "").strip()

    if not officer_role:
        return jsonify({"error": "officer_role is required"}), 400

    if officer_role not in _OFFICER_ROLES:
        return jsonify({"error": f"officer_role must be one of: {', '.join(sorted(_OFFICER_ROLES))}"}), 400

    try:
        join_date = date.fromisoformat(join_date_str)
    except ValueError:
        return jsonify({"error": "Invalid join_date format (use YYYY-MM-DD)"}), 400

    svc = OfficerService(get_db())

    if user_id:
        student_id, error = svc.add_officer(user_id, officer_role, join_date, position_id)
    elif first_name and last_name:
        student_id, error = svc.add_officer_by_name(first_name, last_name, officer_role, join_date, position_id)
    else:
        return jsonify({"error": "Provide either user_id or both first_name and last_name"}), 400

    if error:
        return jsonify({"error": error}), 400

    return jsonify({"message": "Officer added", "student_id": student_id}), 201


@admin_bp.route("/officers/<student_id>/link-account", methods=["POST", "OPTIONS"])
@require_admin
def link_officer_account(student_id):
    if request.method == "OPTIONS":
        return "", 200
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    svc = OfficerService(get_db())
    success, error = svc.link_officer_account(student_id, user_id)
    if not success:
        return jsonify({"error": error}), 400

    return jsonify({"message": "Account linked"}), 200


@admin_bp.route("/officers/<student_id>", methods=["PATCH", "OPTIONS"])
@require_admin
def update_officer(student_id):
    data = request.get_json(silent=True) or {}
    officer_role = data.get("officer_role")
    join_date_str = data.get("join_date")
    end_date_str = data.get("end_date")

    updates: dict = {}

    if officer_role:
        if officer_role not in _OFFICER_ROLES:
            return jsonify({"error": f"officer_role must be one of: {', '.join(sorted(_OFFICER_ROLES))}"}), 400
        updates["role"] = officer_role

    if join_date_str:
        try:
            date.fromisoformat(join_date_str)
        except ValueError:
            return jsonify({"error": "Invalid join_date"}), 400
        updates["join_date"] = join_date_str

    if end_date_str is not None:
        if end_date_str:
            try:
                date.fromisoformat(end_date_str)
            except ValueError:
                return jsonify({"error": "Invalid end_date"}), 400
        updates["end_date"] = end_date_str or None

    if "position_id" in data:
        updates["position_id"] = data["position_id"] or None

    # Appearance fields (admin can set for any officer)
    if "photo_url" in data:
        updates["photo_url"] = data["photo_url"] or None
    if "photo_object_position" in data:
        updates["photo_object_position"] = data["photo_object_position"] or "50% 50%"
    if "linkedin_url" in data:
        updates["linkedin_url"] = data["linkedin_url"] or None

    if not updates:
        return jsonify({"error": "Nothing to update"}), 400

    svc = OfficerService(get_db())
    success, error = svc.update_officer(student_id, updates, new_role=officer_role)
    if not success:
        return jsonify({"error": error}), 404

    return jsonify({"message": "Officer updated"}), 200


@admin_bp.route("/officers/<student_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def remove_officer(student_id):
    hard = request.args.get("hard") in ("1", "true")

    svc = OfficerService(get_db())
    found = svc.remove_officer(student_id, hard=hard)
    if not found:
        return jsonify({"error": "Officer not found"}), 404

    return jsonify({"message": "Officer deleted" if hard else "Officer removed (end_date set to today)"}), 200
