"""from flask import Blueprint, request, jsonify
from app.utils.query_handler import build_sql_querys
from app.db import connect"""

from app.imports import *

discord_bp = Blueprint('discord', __name__)

@discord_bp.route("/announcements/", methods=["GET"])
def getAnnouncements():
    connections = connect()
    with connections.cursor() as cur:

        filter_dict = {
            "announcement_id": request.args.get("announcement_id", type=int),
            "guild_id": request.args.get("guild_id"),
            "event_id": request.args.get("event_id"),
            "title": request.args.get("title"),
            "description": request.args.get("description"),
            "announcement_date": request.args.get("announcement_date"),
            "created_at": request.args.get("created_at"),
            "start_date": request.args.get("start_date"),
            "end_date": request.args.get("end_date"),
            "limit": request.args.get("limit", type=int),
            "offset": request.args.get("offset", type=int)
        }

        query, params = build_sql_querys("SELECT * FROM discord_announcements", filter_dict)
        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results),200) if results else (jsonify({"error": "No announcements found"}), 404)
    
@discord_bp.route("/announcements/<int:announcement_id>", methods=["DELETE"])
def deleteAnnouncement(announcement_id):
    try:
        connections = connect()
        with connections.cursor() as cur:
            cur.execute("DELETE FROM discord_announcements WHERE announcement_id = %s", (announcement_id,))
            if cur.rowcount == 0:
                return jsonify({"error": "Announcement not found"}), 404
            connections.commit()
            return jsonify({"message": "Announcement deleted successfully"}), 200
    except Exception as e:
        connections.rollback()
        return jsonify({"error": str(e)}), 500
    
@discord_bp.route("/announcements/<string:guild_id>", methods=["POST"])
def createAnnouncement(guild_id):
    try:
        connections = connect()
        with connections.cursor() as cur:

            filter_dict = {
                "guild_id": guild_id,
                "title": request.json.get("title"),
                "description": request.json.get("description"),
                "event_id": request.json.get("event_id"),
                "announcement_date": request.json.get("announcement_date"),
                "created_at": request.json.get("created_at", "NOW()"),
                "event_image": request.json.get("event_image"),
                "message": request.json.get("message")
            }

            if not (guild_id.isdigit() and len(guild_id) == 18):
                return jsonify({"error": "Invalid guild ID"}), 400

            if not filter_dict["title"] or not filter_dict["description"]:
                return jsonify({"error": "Title and description are required"}), 400

            query, params = build_sql_querys("INSERT INTO discord_announcements", filter_dict, mode="INSERT")
            query += " RETURNING announcement_id"

            cur.execute(query, tuple(params))
            announcement_id = cur.fetchone()[0]
            connections.commit()

            return jsonify({"message": "Announcement created successfully", "announcement_id": announcement_id}), 201
    except Exception as e:
        connections.rollback()
        return jsonify({"error": str(e)}), 500
    
@discord_bp.route("/announcements/<int:announcement_id>", methods=["PATCH"])
def updateAnnouncement(announcement_id):
    try:
        connections = connect()
        with connections.cursor() as cur:
            filter_dict = {
                "title": request.json.get("title"),
                "description": request.json.get("description"),
                "event_id": request.json.get("event_id"),
                "announcement_date": request.json.get("announcement_date"),
                "created_at": request.json.get("created_at"),
                "event_image": request.json.get("event_image"),
                "message": request.json.get("message"),
                "guild_id": request.json.get("guild_id")
            }

            query, params = build_sql_querys("UPDATE discord_announcements", filter_dict, mode="SET")
            query += " WHERE announcement_id = %s"
            params.append(announcement_id)

            cur.execute(query, tuple(params))
            if cur.rowcount == 0:
                return jsonify({"error": "Announcement not found"}), 404

            connections.commit()
            return jsonify({"message": "Announcement updated successfully"}), 200
    except Exception as e:
        connections.rollback()
        return jsonify({"error": str(e)}), 500
