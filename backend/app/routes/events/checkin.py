import math
from datetime import date as date_type, datetime, timezone
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from app import limiter
from app.routes.events import events_bp
from app.raw_db import get_db
from app.utils.auth_decorators import require_officer, require_authenticated


def _haversine_m(lat1, lon1, lat2, lon2):
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _update_streak(cur, student_id: str, event_date: date_type):
    event_month = event_date.strftime("%Y-%m")

    cur.execute(
        "SELECT current_streak, max_streak, last_event_month FROM profile WHERE student_id = %s",
        (student_id,),
    )
    row = cur.fetchone()
    if not row:
        return

    last_month = row["last_event_month"]
    if last_month == event_month:
        return

    if last_month:
        ly, lm = int(last_month[:4]), int(last_month[5:])
        ey, em = int(event_month[:4]), int(event_month[5:])
        consecutive = (ey * 12 + em) == (ly * 12 + lm + 1)
        new_streak = row["current_streak"] + 1 if consecutive else 1
    else:
        new_streak = 1

    new_max = max(new_streak, row["max_streak"])
    cur.execute(
        "UPDATE profile SET current_streak = %s, max_streak = %s, last_event_month = %s WHERE student_id = %s",
        (new_streak, new_max, event_month, student_id),
    )


@events_bp.route("/checkin", methods=["POST", "OPTIONS"])
@require_authenticated
@limiter.limit("20/minute")
def member_checkin():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip().upper()

    if not code:
        return jsonify({"error": "code is required"}), 400

    member_lat = data.get("lat")
    member_lon = data.get("lon")

    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT event_id, name, check_in_expires_at,
                   COALESCE(points_value, 10) as points_value,
                   require_location, latitude, longitude,
                   COALESCE(checkin_radius_m, 400) as checkin_radius_m
            FROM events
            WHERE check_in_code = %s AND check_in_enabled = TRUE
            """,
            (code,),
        )
        event = cur.fetchone()
        if not event:
            return jsonify({"error": "Invalid or inactive check-in code"}), 404

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if event["check_in_expires_at"] and event["check_in_expires_at"] < now:
            return jsonify({"error": "This check-in code has expired"}), 410

        if event["require_location"] and event["latitude"] is not None and event["longitude"] is not None:
            if member_lat is None or member_lon is None:
                return jsonify({"error": "This event requires location verification — please enable location access"}), 400
            try:
                distance = _haversine_m(float(member_lat), float(member_lon),
                                        float(event["latitude"]), float(event["longitude"]))
            except (TypeError, ValueError):
                return jsonify({"error": "Invalid location coordinates"}), 400
            if distance > event["checkin_radius_m"]:
                return jsonify({"error": f"You are not within range of the event location ({int(distance)}m away, {event['checkin_radius_m']}m required)"}), 403

        cur.execute("SELECT student_id FROM profile WHERE user_id = %s", (user_id,))
        profile = cur.fetchone()
        if not profile:
            return jsonify({"error": "No profile linked — link your student ID first"}), 403

        student_id = profile["student_id"]
        event_id = event["event_id"]

        cur.execute(
            "SELECT checkin_id FROM event_checkins WHERE event_id = %s AND user_id = %s",
            (event_id, user_id),
        )
        if cur.fetchone():
            return jsonify({"error": "You have already checked in to this event"}), 409

        today = date_type.today()
        cur.execute(
            "INSERT INTO points (student_id, event_id, points, date) VALUES (%s, %s, %s, %s)",
            (student_id, event_id, event["points_value"], today),
        )
        cur.execute(
            "INSERT INTO event_checkins (event_id, student_id, user_id) VALUES (%s, %s, %s)",
            (event_id, student_id, user_id),
        )
        _update_streak(cur, student_id, today)
        conn.commit()

        cur.execute("SELECT SUM(points) FROM points WHERE student_id = %s", (student_id,))
        total = int(cur.fetchone()["sum"] or 0)

    return jsonify({
        "event_name": event["name"],
        "points_awarded": event["points_value"],
        "total_points": total,
    }), 200


@events_bp.route("/officer-checkin", methods=["POST", "OPTIONS"])
@require_officer
@limiter.limit("60/minute")
def officer_checkin():
    user_id = int(get_jwt_identity())
    conn = get_db()

    data = request.get_json(silent=True) or {}
    student_id = str(data.get("student_id") or "").strip()
    event_id = data.get("event_id")

    if not student_id or not event_id:
        return jsonify({"error": "student_id and event_id are required"}), 400

    with conn.cursor() as cur:
        cur.execute(
            "SELECT event_id, name, COALESCE(points_value, 10) as points_value FROM events WHERE event_id = %s",
            (event_id,),
        )
        event = cur.fetchone()
        if not event:
            return jsonify({"error": "Event not found"}), 404

        cur.execute("SELECT student_id FROM profile WHERE student_id = %s", (student_id,))
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO profile (student_id) VALUES (%s)",
                (student_id,),
            )

        today = date_type.today()
        cur.execute(
            """
            INSERT INTO points (student_id, event_id, points, date, officer_user_id)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (student_id, event_id) DO NOTHING
            """,
            (student_id, event_id, event["points_value"], today, user_id),
        )
        if cur.rowcount == 0:
            return jsonify({"message": "Already checked in", "event_name": event["name"]}), 200

        cur.execute(
            """
            INSERT INTO event_checkins (event_id, student_id)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
            """,
            (event_id, student_id),
        )
        _update_streak(cur, student_id, today)
        conn.commit()

    return jsonify({
        "student_id": student_id,
        "event_name": event["name"],
        "points_awarded": event["points_value"],
    }), 200
