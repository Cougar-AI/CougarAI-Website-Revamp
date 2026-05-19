from flask import request, jsonify
from app.routes.admin import admin_bp
from app.raw_db import get_db
from app.utils.auth_decorators import require_admin
from app.services.sponsor_service import SponsorService, VALID_TIERS


@admin_bp.route("/sponsors", methods=["GET", "OPTIONS"])
@require_admin
def admin_list_sponsors():
    svc = SponsorService(get_db())
    return jsonify({"sponsors": svc.list_sponsors()}), 200


@admin_bp.route("/sponsors", methods=["POST", "OPTIONS"])
@require_admin
def admin_create_sponsor():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    tier = data.get("tier", "community")
    if tier not in VALID_TIERS:
        return jsonify({"error": f"tier must be one of: {', '.join(sorted(VALID_TIERS))}"}), 400

    data["name"] = name
    svc = SponsorService(get_db())
    sponsor_id, error = svc.create_sponsor(data)
    if error:
        return jsonify({"error": error}), 409
    return jsonify({"sponsor_id": sponsor_id, "message": "Sponsor created"}), 201


@admin_bp.route("/sponsors/<int:sponsor_id>", methods=["PATCH", "OPTIONS"])
@require_admin
def admin_update_sponsor(sponsor_id):
    data = request.get_json(silent=True) or {}
    updates = []
    params = []

    for field in ("name", "logo_url", "website", "description", "contact_name", "contact_email"):
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data[field] or None)

    if "tier" in data:
        if data["tier"] not in VALID_TIERS:
            return jsonify({"error": f"tier must be one of: {', '.join(sorted(VALID_TIERS))}"}), 400
        updates.append("tier = %s")
        params.append(data["tier"])

    if "is_active" in data:
        updates.append("is_active = %s")
        params.append(bool(data["is_active"]))

    for field in ("start_date", "end_date"):
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data[field] or None)

    if "display_order" in data:
        updates.append("display_order = %s")
        params.append(int(data["display_order"]))

    if not updates:
        return jsonify({"error": "Nothing to update"}), 400

    new_name = data["name"].strip() if ("name" in data and data["name"]) else None
    svc = SponsorService(get_db())
    success, error = svc.update_sponsor(sponsor_id, updates, params, new_name=new_name)
    if not success:
        status = 409 if error and "already exists" in error else 404
        return jsonify({"error": error}), status
    return jsonify({"message": "Sponsor updated"}), 200


@admin_bp.route("/sponsors/<int:sponsor_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def admin_delete_sponsor(sponsor_id):
    svc = SponsorService(get_db())
    if not svc.delete_sponsor(sponsor_id):
        return jsonify({"error": "Sponsor not found"}), 404
    return jsonify({"message": "Sponsor deleted"}), 200
