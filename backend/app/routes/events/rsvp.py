from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from app.routes.events import events_bp
from app.raw_db import get_db
from app.utils.auth_decorators import require_admin, require_officer, require_role, require_authenticated


@events_bp.route("/my-rsvps", methods=["GET", "OPTIONS"])
@require_authenticated
def list_my_rsvps():
    user_id = int(get_jwt_identity())
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT event_id FROM event_rsvps WHERE user_id = %s",
            (user_id,),
        )
        event_ids = [row["event_id"] for row in cur.fetchall()]
    return jsonify({"rsvped_event_ids": event_ids}), 200


@events_bp.route("/<int:event_id>/rsvp", methods=["GET", "OPTIONS"])
@require_officer
def list_event_rsvps(event_id):
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            """SELECT r.rsvp_id, r.user_id, r.created_at, u.email
               FROM event_rsvps r
               JOIN users u ON u.user_id = r.user_id
               WHERE r.event_id = %s
               ORDER BY r.created_at""",
            (event_id,),
        )
        rsvps = [
            {
                "rsvp_id": row["rsvp_id"],
                "user_id": row["user_id"],
                "email": row["email"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
            for row in cur.fetchall()
        ]
    return jsonify({"rsvps": rsvps, "count": len(rsvps)})


@events_bp.route("/<int:event_id>/rsvp/stats", methods=["GET", "OPTIONS"])
@require_officer
def event_rsvp_stats(event_id):
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS rsvp_count FROM event_rsvps WHERE event_id = %s",
            (event_id,),
        )
        rsvp_count = int(cur.fetchone()["rsvp_count"])

        cur.execute(
            "SELECT COUNT(*) AS attended FROM event_checkins WHERE event_id = %s",
            (event_id,),
        )
        attended = int(cur.fetchone()["attended"])

        conversion = round(attended / rsvp_count * 100, 1) if rsvp_count > 0 else 0.0

    return jsonify({
        "event_id": event_id,
        "rsvp_count": rsvp_count,
        "attended": attended,
        "conversion_pct": conversion,
    })


@events_bp.route("/<int:event_id>/rsvp", methods=["POST", "OPTIONS"])
@require_role("non-member", "member", "officer", "admin", "partner")
def create_rsvp(event_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("SELECT rsvp_enabled FROM events WHERE event_id = %s", (event_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Event not found"}), 404
        if not row["rsvp_enabled"]:
            return jsonify({"error": "RSVP is not enabled for this event"}), 400
        cur.execute(
            """INSERT INTO event_rsvps (event_id, user_id)
               VALUES (%s, %s)
               ON CONFLICT (event_id, user_id) DO NOTHING""",
            (event_id, user_id),
        )
        conn.commit()
    return jsonify({"success": True}), 201


@events_bp.route("/<int:event_id>/my-rsvp", methods=["GET", "OPTIONS"])
@require_authenticated
def get_my_rsvp(event_id):
    try:
        user_id = int(get_jwt_identity())
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM event_rsvps WHERE event_id = %s AND user_id = %s",
                (event_id, user_id),
            )
            return jsonify({"rsvped": cur.fetchone() is not None}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@events_bp.route("/<int:event_id>/rsvp", methods=["DELETE", "OPTIONS"])
@require_authenticated
def cancel_rsvp(event_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM event_rsvps WHERE event_id = %s AND user_id = %s",
            (event_id, user_id),
        )
        conn.commit()
    return jsonify({"success": True})


# --- Discord bot RSVPs -----------------------------------------------------
# The bot identifies people by Discord ID and events by Google Calendar ID.
# profile.discord_id is self-editable and unverified, so anything other than
# exactly one matching profile is refused rather than guessed at.

def _resolve_discord_rsvp_target(cur):
    """Resolve the JSON body to (event_row, user_id), or (None, (response, status))."""
    body = request.get_json(silent=True)
    body = body if isinstance(body, dict) else {}
    google_event_id = body.get("google_event_id")
    discord_id = body.get("discord_id")
    if (
        not isinstance(google_event_id, str) or not google_event_id.strip()
        or not isinstance(discord_id, str) or not discord_id.strip()
    ):
        return None, (jsonify({"error": "google_event_id_and_discord_id_required"}), 422)

    cur.execute(
        "SELECT event_id, rsvp_enabled FROM events WHERE google_event_id = %s",
        (google_event_id.strip(),),
    )
    event = cur.fetchone()
    if not event:
        return None, (jsonify({"error": "event_not_found"}), 404)

    cur.execute(
        "SELECT user_id FROM profile WHERE discord_id::text = %s",
        (discord_id.strip(),),
    )
    profiles = cur.fetchall()
    if not profiles:
        return None, (jsonify({"error": "profile_not_found"}), 404)
    if len(profiles) > 1:
        return None, (jsonify({"error": "ambiguous_profile"}), 404)
    return (event, profiles[0]["user_id"]), None


@events_bp.route("/rsvp/by-discord", methods=["POST", "OPTIONS"])
@require_admin
def create_rsvp_by_discord():
    conn = get_db()
    with conn.cursor() as cur:
        target, err = _resolve_discord_rsvp_target(cur)
        if err:
            return err
        event, user_id = target
        if not event["rsvp_enabled"]:
            return jsonify({"error": "rsvp_disabled"}), 400
        # An existing website RSVP conflicts and is left untouched (stays 'website').
        cur.execute(
            """INSERT INTO event_rsvps (event_id, user_id, source)
               VALUES (%s, %s, 'discord')
               ON CONFLICT (event_id, user_id) DO NOTHING""",
            (event["event_id"], user_id),
        )
        created = cur.rowcount == 1
        conn.commit()
    return jsonify({"success": True, "created": created}), 201


@events_bp.route("/rsvp/by-discord", methods=["DELETE", "OPTIONS"])
@require_admin
def cancel_rsvp_by_discord():
    conn = get_db()
    with conn.cursor() as cur:
        target, err = _resolve_discord_rsvp_target(cur)
        if err:
            return err
        event, user_id = target
        # Only rows the bot created; a website RSVP is never removed from Discord.
        cur.execute(
            """DELETE FROM event_rsvps
               WHERE event_id = %s AND user_id = %s AND source = 'discord'""",
            (event["event_id"], user_id),
        )
        deleted = cur.rowcount > 0
        conn.commit()
    return jsonify({"success": True, "deleted": deleted}), 200
