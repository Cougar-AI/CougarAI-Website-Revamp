from app.imports import *
discord_bp = Blueprint('discord', __name__)

@discord_bp.route("/config/<string:guild_id>", methods=["GET"])
def getDiscordConfig(guild_id):
    guild_id = (guild_id or "").strip()
    connection = connect()
    with connection.cursor() as cur:
        cur.execute(f"SELECT * FROM discord_config WHERE guild_id = %s", (guild_id, )) # we use %s to prevent SQL injection
        result = cur.fetchone()
        return (jsonify(result), 200) if result else (jsonify({"error": "No config found"}), 404)
    
@discord_bp.route("/config/<string:guild_id>", methods=["POST"])
def createDiscordConfig(guild_id):
    try:
        guild_id = (guild_id or "").strip()
        connection = connect()
        with connection.cursor() as cur:
            if not (guild_id.isdigit() and 16 <= len(guild_id) <= 22):
                return jsonify({"error": "Invalid guild ID"}), 400
            announcement_channel = request.json.get("announcement_channel", "") 
            welcome_channel = request.json.get("welcome_channel", "")
            log_channel = request.json.get("log_channel", "")
            executive_role = request.json.get("executive_role", "")
            member_role = request.json.get("member_role", "")

            cur.execute("INSERT INTO discord_config (guild_id, announcement_channel, welcome_channel, log_channel, executive_role, member_role) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (guild_id) DO UPDATE SET announcement_channel = EXCLUDED.announcement_channel, welcome_channel = EXCLUDED.welcome_channel, log_channel = EXCLUDED.log_channel, executive_role = EXCLUDED.executive_role, member_role = EXCLUDED.member_role",
                        (guild_id, announcement_channel, welcome_channel, log_channel, executive_role, member_role)) 
            
            connection.commit()
            return jsonify({"message": "Discord config created/updated successfully"}), 201
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500
    
@discord_bp.route("/config/<string:guild_id>", methods=["PATCH"])
def updatediscordConfig(guild_id):
    try:
        guild_id = (guild_id or "").strip()
        connection = connect()
        with connection.cursor() as cur:
            if not (guild_id.isdigit() and 16 <= len(guild_id) <= 22):
                return jsonify({"error": "Invalid guild ID"}), 400
            
            filter_dict = {
                "announcement_channel": request.json.get("announcement_channel"),
                "welcome_channel": request.json.get("welcome_channel"),
                "log_channel": request.json.get("log_channel"),
                "executive_role": request.json.get("executive_role"),
                "member_role": request.json.get("member_role")
            }

            query, params = build_sql_querys("UPDATE discord_config", filter_dict, mode="SET")
            query += " WHERE guild_id = %s"
            params.append(guild_id)
            cur.execute(query, tuple(params))
            if cur.rowcount == 0:
                return jsonify({"error": "No config found for the given guild ID"}), 404
            connection.commit()
            return jsonify({"message": "Discord config updated successfully"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    
@discord_bp.route("/config/<string:guild_id>", methods=["DELETE"])
def deleteDiscordConfig(guild_id):
    try:
        guild_id = (guild_id or "").strip()
        connection = connect()
        with connection.cursor() as cur:
            if not (guild_id.isdigit() and 16 <= len(guild_id) <= 22):
                return jsonify({"error": "Invalid guild ID"}), 400
            
            cur.execute("DELETE FROM discord_config WHERE guild_id = %s", (guild_id,))
            if cur.rowcount == 0:
                return jsonify({"error": "No config found for the given guild ID"}), 404
            connection.commit()
            return jsonify({"message": "Discord config deleted successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500
    
   