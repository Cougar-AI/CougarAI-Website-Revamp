from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from app.routes.partners import partners_bp, _can_access_partner, _partner_detail
from app.raw_db import get_db
from app.utils.auth_decorators import require_officer, require_authenticated


@partners_bp.route("/", methods=["GET", "OPTIONS"])
@require_officer
def list_partners():
    conn = get_db()
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


@partners_bp.route("/my", methods=["GET", "OPTIONS"])
@require_authenticated
def my_partners():
    user_id = int(get_jwt_identity())
    conn = get_db()
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


@partners_bp.route("/public", methods=["GET", "OPTIONS"])
def list_partners_public():
    if request.method == "OPTIONS":
        return "", 200

    conn = get_db()
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


@partners_bp.route("/<int:partner_id>", methods=["GET", "OPTIONS"])
@require_authenticated
def get_partner(partner_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    with conn.cursor() as cur:
        if not _can_access_partner(cur, user_id, partner_id):
            return jsonify({"error": "Access denied"}), 403
        detail = _partner_detail(cur, partner_id)

    if not detail:
        return jsonify({"error": "Partner not found"}), 404
    return jsonify(detail), 200


@partners_bp.route("/<int:partner_id>/stats", methods=["GET", "OPTIONS"])
@require_authenticated
def get_partner_stats(partner_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
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


@partners_bp.route("/<int:partner_id>/events", methods=["GET", "OPTIONS"])
@require_authenticated
def get_partner_events(partner_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
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
