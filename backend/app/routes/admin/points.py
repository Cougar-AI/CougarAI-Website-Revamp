from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from app.routes.admin import admin_bp
from app.raw_db import get_db
from app.utils.auth_decorators import require_officer
from app.services.points_service import PointsService


@admin_bp.route("/points/summary", methods=["GET", "OPTIONS"])
@require_officer
def admin_points_summary():
    svc = PointsService(get_db())
    return jsonify(svc.get_summary()), 200


@admin_bp.route("/points", methods=["GET", "OPTIONS"])
@require_officer
def admin_list_points():
    page = max(1, request.args.get("page", 1, type=int))
    limit = min(100, max(1, request.args.get("limit", 20, type=int)))
    user_id = request.args.get("user_id", type=int)

    svc = PointsService(get_db())
    records, total = svc.list_points(page, limit, user_id)

    return jsonify({
        "records": records,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),
    }), 200


@admin_bp.route("/points", methods=["POST", "OPTIONS"])
@require_officer
def admin_award_points():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    points_val = data.get("points")
    reason = (data.get("reason") or "").strip()
    event_id = data.get("event_id") or None

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    if points_val is None:
        return jsonify({"error": "points is required"}), 400
    if not reason:
        return jsonify({"error": "reason is required"}), 400

    officer_user_id = int(get_jwt_identity())
    svc = PointsService(get_db())
    points_id, error = svc.award_points(user_id, int(points_val), reason, event_id, officer_user_id)
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"points_id": points_id, "message": "Points awarded"}), 201
