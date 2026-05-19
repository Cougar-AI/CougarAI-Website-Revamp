from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity, get_jwt
from app.routes.partners import partners_bp, _LEADER_ROLES, _VALID_PARTNER_ROLES, _can_access_partner, _get_caller_partner_role
from app.raw_db import get_db
from app.utils.auth_decorators import require_authenticated


@partners_bp.route("/<int:partner_id>/members", methods=["GET", "OPTIONS"])
@require_authenticated
def get_partner_members(partner_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    with conn.cursor() as cur:
        if not _can_access_partner(cur, user_id, partner_id):
            return jsonify({"error": "Access denied"}), 403

        cur.execute(
            """
            SELECT pm.user_id, pm.partner_role, pm.joined_at,
                   u.email,
                   COALESCE(pr.first_name, '') AS first_name,
                   COALESCE(pr.last_name, '') AS last_name,
                   pr.avatar_url
            FROM partner_members pm
            JOIN users u ON pm.user_id = u.user_id
            LEFT JOIN profile pr ON u.user_id = pr.user_id
            WHERE pm.partner_id = %s
            ORDER BY pm.joined_at DESC
            """,
            (partner_id,),
        )
        rows = cur.fetchall()

    members = [
        {
            "user_id": r["user_id"],
            "email": r["email"],
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "avatar_url": r["avatar_url"],
            "partner_role": r["partner_role"],
            "joined_at": r["joined_at"].isoformat() if r["joined_at"] else None,
        }
        for r in rows
    ]
    return jsonify({"members": members}), 200


@partners_bp.route("/<int:partner_id>/members", methods=["POST", "OPTIONS"])
@require_authenticated
def add_partner_member(partner_id):
    claims = get_jwt()
    caller_id = int(get_jwt_identity())
    is_admin = claims.get("role") == "admin"

    conn = get_db()
    with conn.cursor() as cur:
        if not is_admin:
            caller_role = _get_caller_partner_role(cur, caller_id, partner_id)
            if caller_role not in _LEADER_ROLES:
                return jsonify({"error": "President or Manager access required"}), 403

        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        partner_role = (data.get("partner_role") or "").strip()

        if not email:
            return jsonify({"error": "email is required"}), 400
        if partner_role not in _VALID_PARTNER_ROLES:
            return jsonify({"error": f"partner_role must be one of: {', '.join(sorted(_VALID_PARTNER_ROLES))}"}), 400

        cur.execute("SELECT user_id, role FROM users WHERE LOWER(email) = %s", (email,))
        user_row = cur.fetchone()
        if not user_row:
            return jsonify({"error": "No user found with that email address"}), 404

        target_id = user_row["user_id"]

        cur.execute(
            "SELECT 1 FROM partner_members WHERE partner_id = %s AND user_id = %s",
            (partner_id, target_id),
        )
        if cur.fetchone():
            return jsonify({"error": "User is already a member of this partner org"}), 409

        cur.execute(
            "INSERT INTO partner_members (partner_id, user_id, partner_role) VALUES (%s, %s, %s)",
            (partner_id, target_id, partner_role),
        )
        if user_row["role"] in ("member", "non-member"):
            cur.execute("UPDATE users SET role = 'partner' WHERE user_id = %s", (target_id,))
        conn.commit()

    return jsonify({"message": "Member added", "user_id": target_id, "partner_role": partner_role}), 201


@partners_bp.route("/<int:partner_id>/members/<int:target_user_id>", methods=["DELETE", "OPTIONS"])
@require_authenticated
def remove_partner_member(partner_id, target_user_id):
    claims = get_jwt()
    caller_id = int(get_jwt_identity())
    is_admin = claims.get("role") == "admin"

    conn = get_db()
    with conn.cursor() as cur:
        if not is_admin:
            caller_role = _get_caller_partner_role(cur, caller_id, partner_id)
            if caller_role not in _LEADER_ROLES:
                return jsonify({"error": "President or Manager access required"}), 403

        cur.execute(
            "DELETE FROM partner_members WHERE partner_id = %s AND user_id = %s",
            (partner_id, target_user_id),
        )
        if cur.rowcount == 0:
            return jsonify({"error": "Member not found"}), 404

        cur.execute(
            "SELECT 1 FROM partner_members WHERE user_id = %s LIMIT 1",
            (target_user_id,),
        )
        still_partner = cur.fetchone() is not None
        if not still_partner:
            cur.execute(
                """
                SELECT 1 FROM payments
                WHERE (student_id = (SELECT student_id FROM profile WHERE user_id = %s)
                       OR email = (SELECT email FROM users WHERE user_id = %s))
                  AND expires_at >= CURRENT_DATE
                LIMIT 1
                """,
                (target_user_id, target_user_id),
            )
            has_active = cur.fetchone() is not None
            new_role = "member" if has_active else "non-member"
            cur.execute("UPDATE users SET role = %s WHERE user_id = %s", (new_role, target_user_id))

        conn.commit()

    return jsonify({"ok": True}), 200
