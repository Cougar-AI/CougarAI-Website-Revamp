import os
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import get_jwt_identity
from app.raw_db import get_db
from app.utils.auth_decorators import require_admin
from app.services.receipt_service import ReceiptService

receipts_bp = Blueprint("receipts", __name__)

VALID_CATEGORIES = {"Food", "Supplies", "Software", "Equipment", "Travel", "Other"}


# ── Funds ──────────────────────────────────────────────────────────────────────

@receipts_bp.route("/funds", methods=["GET", "OPTIONS"])
@require_admin
def list_funds():
    svc = ReceiptService(get_db())
    return jsonify({"funds": svc.list_funds()})


@receipts_bp.route("/funds", methods=["POST"])
@require_admin
def create_fund():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    svc = ReceiptService(get_db())
    fund_id, error = svc.create_fund({**data, "name": name})
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"fund_id": fund_id}), 201


@receipts_bp.route("/funds/<int:fund_id>", methods=["PATCH", "OPTIONS"])
@require_admin
def update_fund(fund_id):
    data = request.get_json() or {}
    allowed = ("name", "description", "budget_limit", "fiscal_year")
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400
    svc = ReceiptService(get_db())
    success, error = svc.update_fund(fund_id, updates)
    if not success:
        status = 404 if error == "Fund not found" else 400
        return jsonify({"error": error}), status
    return jsonify({"success": True})


@receipts_bp.route("/funds/<int:fund_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def delete_fund(fund_id):
    svc = ReceiptService(get_db())
    success, error = svc.delete_fund(fund_id)
    if not success:
        status = 404 if error == "Fund not found" else 409
        return jsonify({"error": error}), status
    return jsonify({"success": True})


# ── Receipts ───────────────────────────────────────────────────────────────────

@receipts_bp.route("/", methods=["GET", "OPTIONS"])
@require_admin
def list_receipts():
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, int(request.args.get("per_page", 50)))
    category = request.args.get("category")
    fund_id = request.args.get("fund_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    q = request.args.get("q", "").strip()

    svc = ReceiptService(get_db())
    receipts, total = svc.list_receipts(
        page=page,
        per_page=per_page,
        category=category,
        fund_id=int(fund_id) if fund_id else None,
        start_date=start_date,
        end_date=end_date,
        q=q,
    )
    return jsonify({"receipts": receipts, "total": total, "page": page, "per_page": per_page})


@receipts_bp.route("/stats", methods=["GET", "OPTIONS"])
@require_admin
def receipt_stats():
    svc = ReceiptService(get_db())
    return jsonify(svc.get_stats())


@receipts_bp.route("/", methods=["POST"])
@require_admin
def create_receipt():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    amount = data.get("amount")
    if amount is None:
        return jsonify({"error": "amount is required"}), 400
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a number"}), 400

    category = data.get("category")
    if category and category not in VALID_CATEGORIES:
        return jsonify({"error": f"Invalid category. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}"}), 400

    svc = ReceiptService(get_db())
    receipt_id, error = svc.create_receipt(user_id, {**data, "title": title, "amount": amount})
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"receipt_id": receipt_id}), 201


@receipts_bp.route("/<int:receipt_id>", methods=["PATCH", "OPTIONS"])
@require_admin
def update_receipt(receipt_id):
    data = request.get_json() or {}
    allowed = ("title", "vendor", "amount", "category", "fund_id", "description", "notes", "receipt_image_path")
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400
    if "category" in updates and updates["category"] and updates["category"] not in VALID_CATEGORIES:
        return jsonify({"error": "Invalid category"}), 400

    svc = ReceiptService(get_db())
    success, error = svc.update_receipt(receipt_id, updates)
    if not success:
        return jsonify({"error": error}), 404
    return jsonify({"success": True})


@receipts_bp.route("/<int:receipt_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def delete_receipt(receipt_id):
    svc = ReceiptService(get_db())
    success, error, image_path = svc.delete_receipt(receipt_id)
    if not success:
        return jsonify({"error": error}), 404

    if image_path:
        uploads_dir = current_app.config.get("UPLOAD_FOLDER", "uploads")
        abs_path = os.path.join(uploads_dir, "receipts", os.path.basename(image_path))
        if os.path.isfile(abs_path):
            try:
                os.remove(abs_path)
            except OSError:
                pass

    return jsonify({"success": True})
