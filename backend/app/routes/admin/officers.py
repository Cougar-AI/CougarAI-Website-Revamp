from datetime import date
from flask import request, jsonify
from app.routes.admin import admin_bp
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

    if not user_id or not officer_role:
        return jsonify({"error": "user_id and officer_role are required"}), 400

    if officer_role not in _OFFICER_ROLES:
        return jsonify({"error": f"officer_role must be one of: {', '.join(sorted(_OFFICER_ROLES))}"}), 400

    try:
        join_date = date.fromisoformat(join_date_str)
    except ValueError:
        return jsonify({"error": "Invalid join_date format (use YYYY-MM-DD)"}), 400

    svc = OfficerService(get_db())
    student_id, error = svc.add_officer(user_id, officer_role, join_date, position_id)
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"message": "Officer added", "student_id": student_id}), 201


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
