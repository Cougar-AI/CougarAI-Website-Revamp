from flask import Blueprint, request, jsonify
from app.utils.query_handler import build_sql_querys
from app.db import connect

discord_bp = Blueprint('discord', __name__)

@discord_bp.route("/config/<string:guild_id>", methods=["GET"])
def getDiscordConfig(guild_id):
    connection = connect()
    with connection.cursor() as cur:
        cur.execute(f"SELECT * FROM discord_config WHERE guild_id = %s", (guild_id, )) # we use %s to prevent SQL injection
        result = cur.fetchone()
        return (jsonify(result), 200) if result else (jsonify({"error": "No config found"}), 404)
    

    



    


