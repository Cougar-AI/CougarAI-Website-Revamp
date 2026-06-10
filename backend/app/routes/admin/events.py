from flask import request, jsonify
from app.routes.admin import admin_bp
from app.raw_db import get_db
from app.utils.auth_decorators import require_admin, require_officer
from app.services.user_service import UserService
from app.services.event_admin_service import EventAdminService, normalize_event_type_name


@admin_bp.route("/events/<int:event_id>/attendance", methods=["GET", "OPTIONS"])
@require_admin
def get_event_attendance(event_id):
    svc = EventAdminService(get_db())
    result = svc.get_attendance(event_id)
    if not result:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(result), 200


@admin_bp.route("/events/<int:event_id>/regenerate-code", methods=["POST", "OPTIONS"])
@require_admin
def regenerate_checkin_code(event_id):
    svc = EventAdminService(get_db())
    new_code = svc.regenerate_checkin_code(event_id)
    if new_code is None:
        return jsonify({"error": "Event not found"}), 404
    return jsonify({"check_in_code": new_code}), 200


@admin_bp.route("/events-stats", methods=["GET", "OPTIONS"])
@require_officer
def list_events_stats():
    start_date = request.args.get("start_date")
    end_date   = request.args.get("end_date")
    limit      = min(500, max(1, request.args.get("limit", 200, type=int)))

    svc = EventAdminService(get_db())
    events = svc.list_events_stats(start_date, end_date, limit)
    return jsonify({"events": events}), 200


@admin_bp.route("/event-types", methods=["GET", "OPTIONS"])
@require_officer
def list_event_types():
    svc = EventAdminService(get_db())
    event_types = svc.list_event_types()
    return jsonify({"event_types": event_types}), 200


@admin_bp.route("/event-types", methods=["POST", "OPTIONS"])
@require_admin
def create_event_type():
    data = request.get_json(silent=True) or {}
    name = normalize_event_type_name((data.get("name") or "").strip())
    if not name:
        return jsonify({"error": "name is required"}), 400

    default_points = int(data.get("default_points", 10))
    color = (data.get("color") or "#b91c1c").strip()
    description = data.get("description") or None

    svc = EventAdminService(get_db())
    if svc.event_type_name_exists(name):
        return jsonify({"error": f"An event type named '{name}' already exists"}), 409
    type_id = svc.create_event_type(name, default_points, color, description)
    return jsonify({"type_id": type_id, "message": "Event type created"}), 201


@admin_bp.route("/event-types/<int:type_id>", methods=["PATCH", "OPTIONS"])
@require_admin
def update_event_type(type_id):
    data = request.get_json(silent=True) or {}
    updates = []
    params = []

    for field in ("name", "color", "description"):
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data[field])
    if "default_points" in data:
        updates.append("default_points = %s")
        params.append(int(data["default_points"]))
    if "is_active" in data:
        updates.append("is_active = %s")
        params.append(bool(data["is_active"]))

    if not updates:
        return jsonify({"error": "Nothing to update"}), 400

    # Build update dict for service
    update_dict = {}
    for field in ("name", "color", "description"):
        if field in data:
            update_dict[field] = normalize_event_type_name(data[field]) if field == "name" else data[field]
    if "default_points" in data:
        update_dict["default_points"] = int(data["default_points"])
    if "is_active" in data:
        update_dict["is_active"] = bool(data["is_active"])

    svc = EventAdminService(get_db())
    if "name" in update_dict and svc.event_type_name_exists(update_dict["name"], exclude_type_id=type_id):
        return jsonify({"error": f"An event type named '{update_dict['name']}' already exists"}), 409
    success = svc.update_event_type(type_id, update_dict)
    if not success:
        return jsonify({"error": "Event type not found"}), 404
    return jsonify({"message": "Event type updated"}), 200


@admin_bp.route("/event-types/<int:type_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def delete_event_type(type_id):
    svc = EventAdminService(get_db())
    success, error_msg = svc.delete_event_type(type_id)
    if not success:
        if error_msg and "reference" in error_msg:
            return jsonify({"error": error_msg}), 409
        return jsonify({"error": error_msg or "Event type not found"}), 404
    return jsonify({"message": "Event type deactivated"}), 200
