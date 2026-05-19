from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from app.routes.partners import partners_bp, _can_access_partner
from app.raw_db import get_db
from app.utils.auth_decorators import require_admin, require_authenticated


@partners_bp.route("/<int:partner_id>/resource-links", methods=["GET", "OPTIONS"])
@require_authenticated
def get_resource_links(partner_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
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


@partners_bp.route("/<int:partner_id>/resource-links", methods=["POST", "OPTIONS"])
@require_admin
def add_resource_link(partner_id):
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    url = (data.get("url") or "").strip()
    description = (data.get("description") or "").strip() or None

    if not title or not url:
        return jsonify({"error": "title and url are required"}), 400

    conn = get_db()
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


@partners_bp.route("/<int:partner_id>/resource-links/<int:link_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def delete_resource_link(partner_id, link_id):
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM partner_resource_links WHERE link_id = %s AND partner_id = %s",
            (link_id, partner_id),
        )
        if cur.rowcount == 0:
            return jsonify({"error": "Link not found"}), 404
        conn.commit()

    return jsonify({"ok": True}), 200
