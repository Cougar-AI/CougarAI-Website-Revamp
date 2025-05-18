from flask import Blueprint, request, jsonify
from app.db import connect

announcements_bp = Blueprint('announcements', __name__)

@announcements_bp.route("/", methods=["GET"])
def getAnnouncements():
    connection = connect()
    with connection.cursor() as cur:
        announcement_id = request.args.get("announcement_id", type=int)
        guild_id = request.args.get("guild_id")
        event_id = request.args.get("event_id", type=int)
        title = request.args.get("title")
        description = request.args.get("description")
        announcement_date = request.args.get("announcement_date")
        created_at = request.args.get("created_at")

        query = "SELECT * FROM discord_announcements"
        filters = []
        params = []

        if announcement_id:
            filters.append("announcement_id = %s")
            params.append(announcement_id)

        if guild_id:
            filters.append("guild_id = %s")
            params.append(guild_id)

        if event_id:
            filters.append("event_id = %s")
            params.append(event_id)

        if title:
            filters.append("title = %s")
            params.append(title)

        if description:
            filters.append("description = %s")
            params.append(description)

        if announcement_date:
            filters.append("announcement_date = %s")
            params.append(announcement_date)

        if created_at:
            filters.append("created_at = %s")
            params.append(created_at)

        if filters:
            query += f" WHERE {' AND '.join(filters)}"

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return jsonify(results) if results else jsonify({"error": "No announcements found"}), 404
