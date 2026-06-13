from flask import request, jsonify
from app.routes.admin import admin_bp
from app.raw_db import get_db
from app.utils.auth_decorators import require_admin, caller_role
from app.services.user_service import UserService

ALL_VALID_ROLES = {"admin", "officer", "partner", "member", "non-member"}


@admin_bp.route("/stats", methods=["GET", "OPTIONS"])
@require_admin
def get_stats():
    svc = UserService(get_db())
    stats = svc.get_stats()
    return jsonify(stats), 200


@admin_bp.route("/users", methods=["GET", "OPTIONS"])
@require_admin
def list_users():
    page = max(1, request.args.get("page", 1, type=int))
    limit = min(100, max(1, request.args.get("limit", 25, type=int)))
    search = (request.args.get("search") or "").strip()
    role_filter = request.args.get("role") or None
    membership_filter = request.args.get("membership_status") or None

    svc = UserService(get_db())
    users, total = svc.list_users(page, limit, search, role_filter, membership_filter)

    return jsonify({
        "users": users,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, -(-total // limit)),
    }), 200


@admin_bp.route("/users/<int:user_id>", methods=["GET", "OPTIONS"])
@require_admin
def get_user(user_id):
    svc = UserService(get_db())
    result = svc.get_user_detail(user_id)
    if not result:
        return jsonify({"error": "User not found"}), 404
    return jsonify(result), 200


@admin_bp.route("/users/<int:user_id>", methods=["PATCH", "OPTIONS"])
@require_admin
def update_user(user_id):
    data = request.get_json(silent=True) or {}
    new_role = data.get("role")
    is_active = data.get("is_active")
    new_email = data.get("email")

    if new_role is not None and new_role not in ALL_VALID_ROLES:
        return jsonify({"error": f"Invalid role. Must be one of: {', '.join(sorted(ALL_VALID_ROLES))}"}), 400
    if new_email is not None:
        new_email = new_email.strip()
        if not new_email:
            return jsonify({"error": "Email cannot be empty"}), 400

    caller_role_val = caller_role()

    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("SELECT role, user_id FROM users WHERE user_id = %s", (user_id,))
        existing = cur.fetchone()
        if not existing:
            return jsonify({"error": "User not found"}), 404

    updates: dict = {}
    if new_role is not None:
        updates["role"] = new_role
    if is_active is not None:
        updates["is_active"] = bool(is_active)
    if new_email is not None:
        updates["email"] = new_email

    if not updates:
        return jsonify({"error": "Nothing to update"}), 400

    svc = UserService(conn)
    svc.update_user(user_id, updates)

    return jsonify({"message": "User updated"}), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def deactivate_user(user_id):
    caller_role_val = caller_role()
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("SELECT role FROM users WHERE user_id = %s", (user_id,))
        target = cur.fetchone()
        if not target:
            return jsonify({"error": "User not found"}), 404
        if target["role"] == "admin" and caller_role_val != "admin":
            return jsonify({"error": "Only admins can deactivate other admins"}), 403

        cur.execute("UPDATE users SET is_active = FALSE WHERE user_id = %s", (user_id,))
        conn.commit()

    return jsonify({"message": "User deactivated"}), 200


@admin_bp.route("/users/<int:user_id>/membership", methods=["PATCH", "OPTIONS"])
@require_admin
def admin_set_membership(user_id):
    data = request.get_json(silent=True) or {}
    expires_at = data.get("expires_at")
    note = data.get("note") or None

    if not expires_at:
        return jsonify({"error": "expires_at is required (YYYY-MM-DD)"}), 400
    from datetime import date
    try:
        date.fromisoformat(expires_at)
    except ValueError:
        return jsonify({"error": "Invalid expires_at format (use YYYY-MM-DD)"}), 400

    svc = UserService(get_db())
    user = svc.grant_membership(user_id, expires_at, note)
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"message": "Membership manually granted"}), 200


@admin_bp.route("/users/<int:user_id>/membership", methods=["DELETE", "OPTIONS"])
@require_admin
def admin_revoke_membership(user_id):
    svc = UserService(get_db())
    result = svc.revoke_membership(user_id)
    if not result:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "message": "Membership removed",
        "deleted_payments": result["deleted_payments"],
    }), 200
