from app.imports import *
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

partners_bp = Blueprint("partners", __name__)

_ADMIN_ROLES = {"admin"}
_OFFICER_PLUS = {"officer", "admin"}


def _get_claims():
    return get_jwt()


def _is_admin(claims):
    return claims.get("role") in _ADMIN_ROLES


def _can_access_partner(cur, user_id: int, partner_id: int) -> bool:
    """Return True if the user is an admin OR a member of this partner org."""
    claims = _get_claims()
    if _is_admin(claims):
        return True
    cur.execute(
        "SELECT 1 FROM partner_members WHERE partner_id = %s AND user_id = %s",
        (partner_id, user_id),
    )
    return cur.fetchone() is not None


def _partner_detail(cur, partner_id: int) -> dict | None:
    cur.execute(
        """
        SELECT p.partner_id, p.name, p.type, p.logo_url, p.website,
               p.description, p.contact_name, p.contact_email,
               p.manager_user_id, p.is_active, p.created_at,
               COUNT(pm.user_id) AS member_count
        FROM partners p
        LEFT JOIN partner_members pm ON pm.partner_id = p.partner_id
        WHERE p.partner_id = %s
        GROUP BY p.partner_id
        """,
        (partner_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "partner_id": row["partner_id"],
        "name": row["name"],
        "type": row["type"],
        "logo_url": row["logo_url"],
        "website": row["website"],
        "description": row["description"],
        "contact_name": row["contact_name"],
        "contact_email": row["contact_email"],
        "manager_user_id": row["manager_user_id"],
        "is_active": row["is_active"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "member_count": int(row["member_count"]),
    }


# ---------------------------------------------------------------------------
# GET /partners/  — admin: list all partners
# ---------------------------------------------------------------------------

@partners_bp.route("/", methods=["GET", "OPTIONS"])
@jwt_required()
def list_partners():
    if request.method == "OPTIONS":
        return "", 200
    claims = _get_claims()
    if claims.get("role") not in (_ADMIN_ROLES | _OFFICER_PLUS):
        return jsonify({"error": "Officer access required"}), 403

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.partner_id, p.name, p.type, p.logo_url, p.website,
                   p.description, p.contact_name, p.contact_email,
                   p.manager_user_id, p.is_active, p.created_at,
                   COUNT(pm.user_id) AS member_count
            FROM partners p
            LEFT JOIN partner_members pm ON pm.partner_id = p.partner_id
            GROUP BY p.partner_id
            ORDER BY p.name
            """
        )
        rows = cur.fetchall()

    partners = [
        {
            "partner_id": r["partner_id"],
            "name": r["name"],
            "type": r["type"],
            "logo_url": r["logo_url"],
            "website": r["website"],
            "description": r["description"],
            "contact_name": r["contact_name"],
            "contact_email": r["contact_email"],
            "manager_user_id": r["manager_user_id"],
            "is_active": r["is_active"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "member_count": int(r["member_count"]),
        }
        for r in rows
    ]
    return jsonify({"partners": partners}), 200


# ---------------------------------------------------------------------------
# GET /partners/my  — partner: return their own org(s)
# ---------------------------------------------------------------------------

@partners_bp.route("/my", methods=["GET", "OPTIONS"])
@jwt_required()
def my_partners():
    if request.method == "OPTIONS":
        return "", 200

    user_id = int(get_jwt_identity())
    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.partner_id, p.name, p.type, p.logo_url, p.website,
                   p.description, p.contact_name, p.contact_email,
                   p.is_active, pm.partner_role
            FROM partner_members pm
            JOIN partners p ON pm.partner_id = p.partner_id
            WHERE pm.user_id = %s AND p.is_active = TRUE
            ORDER BY p.name
            """,
            (user_id,),
        )
        rows = cur.fetchall()

    partners = [
        {
            "partner_id": r["partner_id"],
            "name": r["name"],
            "type": r["type"],
            "logo_url": r["logo_url"],
            "website": r["website"],
            "description": r["description"],
            "contact_name": r["contact_name"],
            "contact_email": r["contact_email"],
            "is_active": r["is_active"],
            "partner_role": r["partner_role"],
        }
        for r in rows
    ]
    return jsonify({"partners": partners}), 200


# ---------------------------------------------------------------------------
# GET /partners/<id>  — admin or own partner member
# ---------------------------------------------------------------------------

@partners_bp.route("/<int:partner_id>", methods=["GET", "OPTIONS"])
@jwt_required()
def get_partner(partner_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = int(get_jwt_identity())
    conn = connect()
    with conn.cursor() as cur:
        if not _can_access_partner(cur, user_id, partner_id):
            return jsonify({"error": "Access denied"}), 403
        detail = _partner_detail(cur, partner_id)

    if not detail:
        return jsonify({"error": "Partner not found"}), 404
    return jsonify(detail), 200


# ---------------------------------------------------------------------------
# GET /partners/<id>/members
# ---------------------------------------------------------------------------

@partners_bp.route("/<int:partner_id>/members", methods=["GET", "OPTIONS"])
@jwt_required()
def get_partner_members(partner_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = int(get_jwt_identity())
    conn = connect()
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


# ---------------------------------------------------------------------------
# GET /partners/<id>/events
# ---------------------------------------------------------------------------

@partners_bp.route("/<int:partner_id>/events", methods=["GET", "OPTIONS"])
@jwt_required()
def get_partner_events(partner_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = int(get_jwt_identity())
    conn = connect()
    with conn.cursor() as cur:
        if not _can_access_partner(cur, user_id, partner_id):
            return jsonify({"error": "Access denied"}), 403

        cur.execute(
            """
            SELECT e.event_id, e.name, e.event_type, e.location,
                   e.starts_at, e.ends_at, e.capacity,
                   e.points_value, ep.role,
                   COUNT(DISTINCT ec.checkin_id) AS attendance_count
            FROM event_partners ep
            JOIN events e ON ep.event_id = e.event_id
            LEFT JOIN event_checkins ec ON ec.event_id = e.event_id
            WHERE ep.partner_id = %s
            GROUP BY e.event_id, e.name, e.event_type, e.location,
                     e.starts_at, e.ends_at, e.capacity, e.points_value, ep.role
            ORDER BY e.starts_at DESC
            """,
            (partner_id,),
        )
        rows = cur.fetchall()

    events = [
        {
            "event_id": r["event_id"],
            "name": r["name"],
            "event_type": r["event_type"],
            "location": r["location"],
            "starts_at": r["starts_at"].isoformat() if r["starts_at"] else None,
            "ends_at": r["ends_at"].isoformat() if r["ends_at"] else None,
            "capacity": r["capacity"],
            "points_value": r["points_value"],
            "partner_role": r["role"],
            "attendance_count": int(r["attendance_count"]),
        }
        for r in rows
    ]
    return jsonify({"events": events}), 200


# ---------------------------------------------------------------------------
# GET /partners/<id>/stats
# ---------------------------------------------------------------------------

@partners_bp.route("/<int:partner_id>/stats", methods=["GET", "OPTIONS"])
@jwt_required()
def get_partner_stats(partner_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = int(get_jwt_identity())
    conn = connect()
    with conn.cursor() as cur:
        if not _can_access_partner(cur, user_id, partner_id):
            return jsonify({"error": "Access denied"}), 403

        cur.execute(
            "SELECT COUNT(*) AS cnt FROM partner_members WHERE partner_id = %s",
            (partner_id,),
        )
        member_count = int(cur.fetchone()["cnt"])

        cur.execute(
            "SELECT COUNT(*) AS cnt FROM event_partners WHERE partner_id = %s",
            (partner_id,),
        )
        event_count = int(cur.fetchone()["cnt"])

        cur.execute(
            """
            SELECT COUNT(ec.checkin_id) AS cnt
            FROM event_partners ep
            JOIN event_checkins ec ON ec.event_id = ep.event_id
            WHERE ep.partner_id = %s
            """,
            (partner_id,),
        )
        total_checkins = int(cur.fetchone()["cnt"])

    return jsonify({
        "member_count": member_count,
        "event_count": event_count,
        "total_checkins": total_checkins,
    }), 200


# ---------------------------------------------------------------------------
# GET /partners/<id>/resource-links
# POST /partners/<id>/resource-links
# DELETE /partners/<id>/resource-links/<link_id>
# ---------------------------------------------------------------------------

@partners_bp.route("/<int:partner_id>/resource-links", methods=["GET", "OPTIONS"])
@jwt_required()
def get_resource_links(partner_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = int(get_jwt_identity())
    conn = connect()
    with conn.cursor() as cur:
        if not _can_access_partner(cur, user_id, partner_id):
            return jsonify({"error": "Access denied"}), 403

        cur.execute(
            "SELECT link_id, title, url, description, created_at FROM partner_resource_links WHERE partner_id = %s ORDER BY created_at DESC",
            (partner_id,),
        )
        rows = cur.fetchall()

    links = [
        {
            "link_id": r["link_id"],
            "title": r["title"],
            "url": r["url"],
            "description": r["description"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]
    return jsonify({"links": links}), 200


@partners_bp.route("/<int:partner_id>/resource-links", methods=["POST"])
@jwt_required()
def add_resource_link(partner_id):
    claims = _get_claims()
    if not _is_admin(claims):
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    url = (data.get("url") or "").strip()
    description = (data.get("description") or "").strip() or None

    if not title or not url:
        return jsonify({"error": "title and url are required"}), 400

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT partner_id FROM partners WHERE partner_id = %s",
            (partner_id,),
        )
        if not cur.fetchone():
            return jsonify({"error": "Partner not found"}), 404

        cur.execute(
            "INSERT INTO partner_resource_links (partner_id, title, url, description) VALUES (%s, %s, %s, %s) RETURNING link_id",
            (partner_id, title, url, description),
        )
        link_id = cur.fetchone()["link_id"]
        conn.commit()

    return jsonify({"link_id": link_id, "message": "Link added"}), 201


# ---------------------------------------------------------------------------
# GET /partners/public  — no auth, safe fields only for About Us page
# ---------------------------------------------------------------------------

@partners_bp.route("/public", methods=["GET", "OPTIONS"])
def list_partners_public():
    if request.method == "OPTIONS":
        return "", 200

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT partner_id, name, type, logo_url, website, description
            FROM partners
            WHERE is_active = TRUE
            ORDER BY name
            """
        )
        rows = cur.fetchall()

    partners = [
        {
            "partner_id": r["partner_id"],
            "name": r["name"],
            "type": r["type"],
            "logo_url": r["logo_url"],
            "website": r["website"],
            "description": r["description"],
        }
        for r in rows
    ]
    return jsonify({"partners": partners}), 200


# ---------------------------------------------------------------------------
# POST /partners/<id>/members  — President/Manager of that org can add members
# ---------------------------------------------------------------------------

_LEADER_ROLES = {"President", "Manager"}
_VALID_PARTNER_ROLES = {"President", "Marketing", "Manager", "Officer"}


def _get_caller_partner_role(cur, user_id: int, partner_id: int):
    """Return the caller's partner_role in this org, or None if not a member."""
    cur.execute(
        "SELECT partner_role FROM partner_members WHERE partner_id = %s AND user_id = %s",
        (partner_id, user_id),
    )
    row = cur.fetchone()
    return row["partner_role"] if row else None


@partners_bp.route("/<int:partner_id>/members", methods=["POST", "OPTIONS"])
@jwt_required()
def add_partner_member(partner_id):
    if request.method == "OPTIONS":
        return "", 200

    claims = _get_claims()
    caller_id = int(get_jwt_identity())
    is_admin = _is_admin(claims)

    conn = connect()
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


# ---------------------------------------------------------------------------
# DELETE /partners/<id>/members/<user_id>  — President/Manager can remove members
# ---------------------------------------------------------------------------

@partners_bp.route("/<int:partner_id>/members/<int:target_user_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def remove_partner_member(partner_id, target_user_id):
    if request.method == "OPTIONS":
        return "", 200

    claims = _get_claims()
    caller_id = int(get_jwt_identity())
    is_admin = _is_admin(claims)

    conn = connect()
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

        # Revert global role if no longer in any partner org
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


@partners_bp.route("/<int:partner_id>/resource-links/<int:link_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def delete_resource_link(partner_id, link_id):
    if request.method == "OPTIONS":
        return "", 200

    claims = _get_claims()
    if not _is_admin(claims):
        return jsonify({"error": "Admin access required"}), 403

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM partner_resource_links WHERE link_id = %s AND partner_id = %s",
            (link_id, partner_id),
        )
        if cur.rowcount == 0:
            return jsonify({"error": "Link not found"}), 404
        conn.commit()

    return jsonify({"ok": True}), 200
