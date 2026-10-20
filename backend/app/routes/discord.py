from flask import Blueprint, request, jsonify
from app.raw_db import get_db
from app.utils.query_handler import build_sql_querys
from app.utils.auth_decorators import require_admin
from app.utils.request_body import json_object_body

discord_bp = Blueprint('discord', __name__)

# Calendar-sync settings added after the original seven columns. These are
# validated strictly and are only touched when their key is present in the
# request body, so older clients that never send them can't reset them.
_NEW_BOOL_FIELDS = ("gcal_sync_enabled", "event_announce_enabled", "event_recap_enabled")
_NEW_ID_FIELDS = ("event_announce_channel", "event_announce_role", "event_recap_channel")
_NEW_TEXT_FIELDS = ("gcal_calendar_id",)
_GCAL_CALENDAR_ID_MAX = 255


def _parse_new_fields(body):
    """Validate the calendar-sync fields present in `body`.

    Returns (fields, error). `fields` maps column -> value for keys that were
    present only (absent keys are omitted, never defaulted). Channel/role IDs
    and gcal_calendar_id accept null/"" to clear (stored as NULL).
    """
    fields = {}
    for key in _NEW_BOOL_FIELDS:
        if key in body:
            if not isinstance(body[key], bool):
                return None, f"{key} must be a boolean"
            fields[key] = body[key]
    for key in _NEW_ID_FIELDS:
        if key in body:
            value = body[key]
            if value is None or value == "":
                fields[key] = None
            elif isinstance(value, str) and value.isdigit() and 16 <= len(value) <= 22:
                fields[key] = value
            else:
                return None, f"{key} must be a Discord ID (16-22 digits) or null"
    for key in _NEW_TEXT_FIELDS:
        if key in body:
            value = body[key]
            if value is None or value == "":
                fields[key] = None
            elif isinstance(value, str) and len(value) <= _GCAL_CALENDAR_ID_MAX:
                fields[key] = value
            else:
                return None, f"{key} must be a string of at most {_GCAL_CALENDAR_ID_MAX} characters or null"
    return fields, None

@discord_bp.route("/config/<string:guild_id>", methods=["GET"])
def getDiscordConfig(guild_id):
    guild_id = (guild_id or "").strip()
    connection = get_db()
    with connection.cursor() as cur:
        cur.execute(f"SELECT * FROM discord_config WHERE guild_id = %s", (guild_id, )) # we use %s to prevent SQL injection
        result = cur.fetchone()
        return (jsonify(result), 200) if result else (jsonify({"error": "No config found"}), 404)

@discord_bp.route("/config/<string:guild_id>", methods=["POST", "OPTIONS"])
@require_admin
def createDiscordConfig(guild_id):
    try:
        guild_id = (guild_id or "").strip()
        connection = get_db()
        with connection.cursor() as cur:
            if not (guild_id.isdigit() and 16 <= len(guild_id) <= 22):
                return jsonify({"error": "Invalid guild ID"}), 400
            body = json_object_body()
            if body is None:
                return jsonify({"error": "JSON object body required"}), 400
            announcement_channel = body.get("announcement_channel", "")
            welcome_channel = body.get("welcome_channel", "")
            log_channel = body.get("log_channel", "")
            executive_role = body.get("executive_role", "")
            member_role = body.get("member_role", "")
            officer_role = body.get("officer_role", "")
            auto_role = body.get("auto_role", "")

            new_fields, err = _parse_new_fields(body)
            if err:
                return jsonify({"error": err}), 400

            # Legacy columns: always overwritten (absent key -> ""), unchanged.
            # New columns: only inserted/overwritten when the key was sent, so a
            # POST that omits them leaves the stored values alone (and a first
            # insert falls back to the column defaults: FALSE / NULL).
            # Column names come from the fixed whitelist above, never user input.
            new_cols = list(new_fields.keys())
            insert_cols = ", ".join(
                ["guild_id", "announcement_channel", "welcome_channel", "log_channel",
                 "executive_role", "member_role", "officer_role", "auto_role"] + new_cols
            )
            placeholders = ", ".join(["%s"] * (8 + len(new_cols)))
            update_set = ", ".join(
                ["announcement_channel = EXCLUDED.announcement_channel",
                 "welcome_channel = EXCLUDED.welcome_channel",
                 "log_channel = EXCLUDED.log_channel",
                 "executive_role = EXCLUDED.executive_role",
                 "member_role = EXCLUDED.member_role",
                 "officer_role = EXCLUDED.officer_role",
                 "auto_role = EXCLUDED.auto_role"]
                + [f"{c} = EXCLUDED.{c}" for c in new_cols]
            )
            cur.execute(
                f"INSERT INTO discord_config ({insert_cols}) VALUES ({placeholders}) "
                f"ON CONFLICT (guild_id) DO UPDATE SET {update_set}",
                (guild_id, announcement_channel, welcome_channel, log_channel,
                 executive_role, member_role, officer_role, auto_role,
                 *new_fields.values()),
            )

            connection.commit()
            return jsonify({"message": "Discord config created/updated successfully"}), 201
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500

@discord_bp.route("/config/<string:guild_id>", methods=["PATCH", "OPTIONS"])
@require_admin
def updatediscordConfig(guild_id):
    try:
        guild_id = (guild_id or "").strip()
        connection = get_db()
        with connection.cursor() as cur:
            if not (guild_id.isdigit() and 16 <= len(guild_id) <= 22):
                return jsonify({"error": "Invalid guild ID"}), 400

            body = json_object_body()
            if body is None:
                return jsonify({"error": "JSON object body required"}), 400

            filter_dict = {
                "announcement_channel": body.get("announcement_channel"),
                "welcome_channel": body.get("welcome_channel"),
                "log_channel": body.get("log_channel"),
                "executive_role": body.get("executive_role"),
                "member_role": body.get("member_role"),
                "officer_role": body.get("officer_role"),
                "auto_role": body.get("auto_role"),
            }

            new_fields, err = _parse_new_fields(body)
            if err:
                return jsonify({"error": err}), 400

            query, params = build_sql_querys("UPDATE discord_config", filter_dict, mode="SET", allow_empty_set=True)
            # build_sql_querys skips None, which would make the new fields
            # impossible to clear (and it emits no SET at all when nothing
            # legacy was sent), so the new columns are appended here. `False`
            # is not None and is written normally.
            if new_fields:
                new_set = ", ".join(f"{c} = %s" for c in new_fields)
                query += (", " if " SET " in query else " SET ") + new_set
                params.extend(new_fields.values())
            elif " SET " not in query:
                return jsonify({"error": "No fields to update"}), 400
            query += " WHERE guild_id = %s"
            params.append(guild_id)
            cur.execute(query, tuple(params))
            if cur.rowcount == 0:
                return jsonify({"error": "No config found for the given guild ID"}), 404
            connection.commit()
            return jsonify({"message": "Discord config updated successfully"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

@discord_bp.route("/config/<string:guild_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def deleteDiscordConfig(guild_id):
    try:
        guild_id = (guild_id or "").strip()
        connection = get_db()
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
