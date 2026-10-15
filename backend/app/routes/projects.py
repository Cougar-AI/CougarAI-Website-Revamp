from flask import Blueprint, jsonify, request
from app.raw_db import get_db
from app.services.project_service import ProjectService, VALID_STATUSES

projects_bp = Blueprint("projects", __name__)


@projects_bp.route("/", methods=["GET", "OPTIONS"])
def list_public_projects():
    if request.method == "OPTIONS":
        return "", 200

    status = request.args.get("status")
    if status and status not in VALID_STATUSES:
        return jsonify({"error": f"status must be one of: {', '.join(VALID_STATUSES)}"}), 400

    svc = ProjectService(get_db())
    return jsonify({"projects": svc.list_projects(published_only=True, status=status)}), 200


@projects_bp.route("/<int:project_id>", methods=["GET", "OPTIONS"])
def get_public_project(project_id):
    if request.method == "OPTIONS":
        return "", 200

    project = ProjectService(get_db()).get_project(project_id, published_only=True)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    return jsonify({"project": project}), 200
