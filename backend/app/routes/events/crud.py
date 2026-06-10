from datetime import datetime
from flask import request, jsonify
from app.routes.events import events_bp
from app.raw_db import get_db
from app.utils.date_validation import is_valid_date
from app.utils.query_handler import build_sql_querys
from app.utils.auth_decorators import require_admin, require_officer
from app.services.event_admin_service import EventAdminService


@events_bp.route("/event-types", methods=["GET", "OPTIONS"])
def get_public_event_types():
    if request.method == "OPTIONS":
        return "", 200
    svc = EventAdminService(get_db())
    return jsonify({"event_types": svc.list_event_types(active_only=True)}), 200


@events_bp.route("/", methods=["GET"])
def getEvents():
    connection = get_db()
    with connection.cursor() as cur:
        starts_at = request.args.get("starts_at")
        ends_at = request.args.get("ends_at")

        if starts_at and not is_valid_date(starts_at):
            return jsonify({"error": "Invalid date format"}), 400
        if ends_at and not is_valid_date(ends_at):
            return jsonify({"error": "Invalid date format"}), 400

        filter_dict = {
            "event_id": request.args.get("event_id", type=int),
            "name": request.args.get("name"),
            "event_type": request.args.get("event_type"),
            "limit": request.args.get("limit", type=int),
            "offset": request.args.get("offset", type=int),
            "description": request.args.get("description"),
            "start_date": request.args.get("start_date"),
            "end_date": request.args.get("end_date"),
            "starts_at": starts_at,
            "ends_at": ends_at,
            "capacity": request.args.get("capacity"),
            "location": request.args.get("location"),
        }

        query, params = build_sql_querys(
            "SELECT event_id, name, event_type, description, location, location_url, starts_at, ends_at, "
            "capacity, check_in_code, check_in_enabled, check_in_expires_at, points_value, google_event_id, "
            "rsvp_enabled, require_location, latitude, longitude, checkin_radius_m, "
            "(SELECT COUNT(*) FROM event_rsvps WHERE event_rsvps.event_id = events.event_id) AS rsvp_count, "
            "(SELECT color FROM event_types WHERE LOWER(TRIM(name)) = LOWER(TRIM(events.event_type)) LIMIT 1) AS type_color "
            "FROM events",
            filter_dict, date_column="starts_at"
        )

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results), 200) if results else (jsonify({"error": "No events found"}), 404)


@events_bp.route("/<int:event_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def deleteEvent(event_id):
    try:
        connection = get_db()
        with connection.cursor() as cur:
            cur.execute("DELETE FROM events WHERE event_id = %s", (event_id,))
            if cur.rowcount == 0:
                return jsonify({"error": f"Event ID {event_id} not found"}), 404
            connection.commit()
            return jsonify({"message": "Event deleted successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500


@events_bp.route("/", methods=["POST", "OPTIONS"])
@require_officer
def addEvent():
    try:
        connection = get_db()
        with connection.cursor() as cur:
            filter_dict = {
                "name": request.json.get("name"),
                "event_type": request.json.get("event_type"),
                "description": request.json.get("description"),
                "location": request.json.get("location"),
                "location_url": request.json.get("location_url"),
                "starts_at": request.json.get("starts_at"),
                "ends_at": request.json.get("ends_at"),
                "capacity": request.json.get("capacity"),
                "check_in_enabled": request.json.get("check_in_enabled"),
                "check_in_expires_at": request.json.get("check_in_expires_at"),
                "points_value": request.json.get("points_value"),
                "require_location": request.json.get("require_location"),
                "latitude": request.json.get("latitude"),
                "longitude": request.json.get("longitude"),
                "checkin_radius_m": request.json.get("checkin_radius_m"),
                "rsvp_enabled": request.json.get("rsvp_enabled"),
            }
            if filter_dict["starts_at"] is None or filter_dict["event_type"] is None or filter_dict["name"] is None:
                return jsonify({"error": "name, starts_at and event_type are required"}), 400

            query, params = build_sql_querys("INSERT INTO events", filter_dict, date_column="starts_at", mode="INSERT")
            query += " RETURNING event_id"

            cur.execute(query, tuple(params))
            event_id = cur.fetchone()["event_id"]
            connection.commit()
            return jsonify({"message": "Success", "event_id": event_id}), 201

    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500


@events_bp.route("/attendance", methods=["GET", "OPTIONS"])
@require_officer
def getAttendance():
    try:
        connection = get_db()
        with connection.cursor() as cur:
            filter_dict = {
                "points.event_id": request.args.get("event_id", type=int),
                "points.student_id": request.args.get("student_id", type=int),
                "events.description": request.args.get("description"),
                "events.location": request.args.get("location"),
                "limit": request.args.get("limit", type=int),
                "offset": request.args.get("offset", type=int),
                "start_date": request.args.get("start_date"),
                "end_date": request.args.get("end_date"),
            }

            if filter_dict["points.event_id"] and filter_dict["points.student_id"]:
                return jsonify({"error": "Please provide either event_id or student_id, not both"}), 400
            elif not filter_dict["points.event_id"] and not filter_dict["points.student_id"]:
                return jsonify({"error": "Please provide either event_id or student_id"}), 400

            base_query = """
            SELECT points.*,
            events.description, events.location, events.name, events.event_type, events.starts_at, events.ends_at,
            profile.first_name, profile.last_name
            FROM points
            JOIN events ON points.event_id = events.event_id
            JOIN profile ON points.student_id = profile.student_id
            """

            query, params = build_sql_querys(base_query, filter_dict, date_column="events.starts_at")
            query += """
                GROUP BY
                    points.points_id,
                    events.description, events.location, events.name, events.event_type, events.starts_at, events.ends_at,
                    profile.first_name, profile.last_name
            """

            cur.execute(query, tuple(params))
            results = cur.fetchall()
            return (jsonify(results), 200) if results else (jsonify({"error": "No attendance found"}), 404)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@events_bp.route("/<int:event_id>", methods=["PATCH", "OPTIONS"])
@require_officer
def updateEvent(event_id):
    try:
        connection = get_db()
        with connection.cursor() as cur:
            filter_dict = {
                "name": request.json.get("name"),
                "event_type": request.json.get("event_type"),
                "capacity": request.json.get("capacity"),
                "starts_at": request.json.get("starts_at"),
                "ends_at": request.json.get("ends_at"),
                "description": request.json.get("description"),
                "location": request.json.get("location"),
                "location_url": request.json.get("location_url"),
                "check_in_enabled": request.json.get("check_in_enabled"),
                "check_in_expires_at": request.json.get("check_in_expires_at"),
                "points_value": request.json.get("points_value"),
                "require_location": request.json.get("require_location"),
                "latitude": request.json.get("latitude"),
                "longitude": request.json.get("longitude"),
                "checkin_radius_m": request.json.get("checkin_radius_m"),
                "rsvp_enabled": request.json.get("rsvp_enabled"),
            }

            try:
                if filter_dict["starts_at"]:
                    datetime.fromisoformat(filter_dict["starts_at"])
                if filter_dict["ends_at"]:
                    datetime.fromisoformat(filter_dict["ends_at"])
            except ValueError:
                return jsonify({"error": "Invalid datetime format"}), 400

            query, params = build_sql_querys("UPDATE events", filter_dict, date_column="starts_at", mode="SET")
            query += " WHERE event_id = %s"
            params.append(event_id)

            cur.execute(query, tuple(params))
            if cur.rowcount == 0:
                return jsonify({"error": f"Event ID {event_id} not found"}), 404

            connection.commit()
            return jsonify({"message": "Event updated successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500
