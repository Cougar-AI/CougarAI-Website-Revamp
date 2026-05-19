from flask import request, jsonify
from app.routes.admin import admin_bp
from app.raw_db import get_db
from app.utils.auth_decorators import require_admin
from app.services.partner_admin_service import PartnerAdminService

VALID_PARTNER_TYPES = {"company", "university_org", "nonprofit", "other"}
VALID_PARTNER_ROLES = {"President", "Marketing", "Manager", "Officer"}


@admin_bp.route("/partners", methods=["GET", "OPTIONS"])
@require_admin
def admin_list_partners():
    svc = PartnerAdminService(get_db())
    return jsonify({"partners": svc.list_partners()}), 200


@admin_bp.route("/partners", methods=["POST", "OPTIONS"])
@require_admin
def admin_create_partner():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    ptype = data.get("type", "other")
    if ptype not in VALID_PARTNER_TYPES:
        return jsonify({"error": f"type must be one of: {', '.join(sorted(VALID_PARTNER_TYPES))}"}), 400

    data["name"] = name
    svc = PartnerAdminService(get_db())
    partner_id, error = svc.create_partner(data)
    if error:
        return jsonify({"error": error}), 409
    return jsonify({"partner_id": partner_id, "message": "Partner created"}), 201


@admin_bp.route("/partners/<int:partner_id>", methods=["PATCH", "OPTIONS"])
@require_admin
def admin_update_partner(partner_id):
    data = request.get_json(silent=True) or {}
    updates = []
    params = []

    for field in ("name", "logo_url", "website", "description", "contact_name", "contact_email"):
        if field in data:
            updates.append(f"{field} = %s")
            params.append(data[field] or None)

    if "type" in data:
        if data["type"] not in VALID_PARTNER_TYPES:
            return jsonify({"error": f"type must be one of: {', '.join(sorted(VALID_PARTNER_TYPES))}"}), 400
        updates.append("type = %s")
        params.append(data["type"])

    if "is_active" in data:
        updates.append("is_active = %s")
        params.append(bool(data["is_active"]))

    if "manager_user_id" in data:
        updates.append("manager_user_id = %s")
        params.append(data["manager_user_id"] or None)

    if not updates:
        return jsonify({"error": "Nothing to update"}), 400

    svc = PartnerAdminService(get_db())
    success, error = svc.update_partner(partner_id, updates, params)
    if not success:
        return jsonify({"error": error or "Partner not found"}), 404
    return jsonify({"message": "Partner updated"}), 200


@admin_bp.route("/partners/<int:partner_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def admin_delete_partner(partner_id):
    svc = PartnerAdminService(get_db())
    if not svc.delete_partner(partner_id):
        return jsonify({"error": "Partner not found"}), 404
    return jsonify({"message": "Partner deleted"}), 200


@admin_bp.route("/partners/<int:partner_id>/members", methods=["GET", "OPTIONS"])
@require_admin
def admin_list_partner_members(partner_id):
    svc = PartnerAdminService(get_db())
    members, error = svc.list_members(partner_id)
    if members is None:
        return jsonify({"error": error}), 404
    return jsonify({"members": members}), 200


@admin_bp.route("/partners/<int:partner_id>/members", methods=["POST", "OPTIONS"])
@require_admin
def admin_add_partner_member(partner_id):
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    partner_role = data.get("partner_role", "Officer")

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    if partner_role not in VALID_PARTNER_ROLES:
        return jsonify({"error": f"partner_role must be one of: {', '.join(sorted(VALID_PARTNER_ROLES))}"}), 400

    svc = PartnerAdminService(get_db())
    success, error = svc.add_member(partner_id, user_id, partner_role)
    if not success:
        return jsonify({"error": error}), 404
    return jsonify({"message": "Member added to partner"}), 201


@admin_bp.route("/partners/<int:partner_id>/members/<int:user_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def admin_remove_partner_member(partner_id, user_id):
    svc = PartnerAdminService(get_db())
    success, error = svc.remove_member(partner_id, user_id)
    if not success:
        return jsonify({"error": error}), 404
    return jsonify({"message": "Member removed from partner"}), 200
