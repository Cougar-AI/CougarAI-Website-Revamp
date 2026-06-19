from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from app.raw_db import get_db
from app.services.knowledge_base_service import KnowledgeBaseService
from app.utils.auth_decorators import require_authenticated


knowledge_base_bp = Blueprint("knowledge_base", __name__)


@knowledge_base_bp.route("/entries", methods=["GET", "OPTIONS"])
def list_entries():
    if request.method == "OPTIONS":
        return "", 200

    content_type = (request.args.get("type") or "all").strip().lower()
    query = (request.args.get("q") or "").strip()

    svc = KnowledgeBaseService(get_db())
    entries = svc.list_entries(content_type=content_type, query=query or None)

    return jsonify({"entries": entries}), 200


@knowledge_base_bp.route("/entries/<int:entry_id>", methods=["GET", "OPTIONS"])
def get_entry(entry_id: int):
    if request.method == "OPTIONS":
        return "", 200

    svc = KnowledgeBaseService(get_db())
    entry = svc.get_entry(entry_id)
    if not entry:
        return jsonify({"error": "Entry not found"}), 404

    entry["comments"] = svc.list_comments(entry_id)
    return jsonify({"entry": entry}), 200


@knowledge_base_bp.route("/entries/<int:entry_id>/comments", methods=["GET", "OPTIONS"])
def get_comments(entry_id: int):
    if request.method == "OPTIONS":
        return "", 200

    svc = KnowledgeBaseService(get_db())
    return jsonify({"comments": svc.list_comments(entry_id)}), 200


@knowledge_base_bp.route("/entries/<int:entry_id>/comments", methods=["POST", "OPTIONS"])
@require_authenticated
def add_comment(entry_id: int):
    data = request.get_json(silent=True) or {}
    body = (data.get("body") or "").strip()
    if not body:
        return jsonify({"error": "comment_required"}), 400

    user_id = int(get_jwt_identity())
    svc = KnowledgeBaseService(get_db())
    comment, error = svc.add_comment(entry_id, user_id, body)
    if error == "entry_not_found":
        return jsonify({"error": "Entry not found"}), 404
    if error:
        return jsonify({"error": error}), 400

    return jsonify({"comment": comment}), 201