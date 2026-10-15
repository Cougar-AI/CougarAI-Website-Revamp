from flask import request, jsonify
from app.routes.admin import admin_bp
from app.raw_db import get_db
from app.utils.auth_decorators import require_officer
from app.services.project_service import ProjectService, clean_project_payload


@admin_bp.route("/projects", methods=["GET", "OPTIONS"])
@require_officer
def admin_list_projects():
    # Includes unpublished drafts, unlike the public /projects listing.
    svc = ProjectService(get_db())
    return jsonify({"projects": svc.list_projects(published_only=False)}), 200


@admin_bp.route("/projects", methods=["POST", "OPTIONS"])
@require_officer
def admin_create_project():
    fields, error = clean_project_payload(request.get_json(silent=True) or {}, partial=False)
    if error:
        return jsonify({"error": error}), 400

    project_id, error = ProjectService(get_db()).create_project(fields)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"project_id": project_id, "message": "Project created"}), 201


@admin_bp.route("/projects/<int:project_id>", methods=["PATCH", "OPTIONS"])
@require_officer
def admin_update_project(project_id):
    fields, error = clean_project_payload(request.get_json(silent=True) or {}, partial=True)
    if error:
        return jsonify({"error": error}), 400
    if not fields:
        return jsonify({"error": "Nothing to update"}), 400

    success, error = ProjectService(get_db()).update_project(project_id, fields)
    if not success:
        return jsonify({"error": error}), 404 if error == "Project not found" else 400
    return jsonify({"message": "Project updated"}), 200


@admin_bp.route("/projects/<int:project_id>", methods=["DELETE", "OPTIONS"])
@require_officer
def admin_delete_project(project_id):
    if not ProjectService(get_db()).delete_project(project_id):
        return jsonify({"error": "Project not found"}), 404
    return jsonify({"message": "Project deleted"}), 200
