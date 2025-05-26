from flask import Blueprint, request, jsonify
from app.db import connect


events_bp = Blueprint('events', __name__)
@events_bp.route("/", methods=["GET"])
def getEvents():
    connection = connect()
    with connection.cursor() as cur:
        event_id = request.args.get("event_id", type=int)
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        event_type = request.args.get("event_type")

        query = "SELECT * FROM events"
        filters = []
        params = []

        if event_id:
            filters.append("event_id = %s")
            params.append(event_id)

        if start_date and end_date:
            filters.append("event_date BETWEEN %s AND %s")
            params.extend([start_date, end_date])

        if event_type:
            filters.append("event_type = %s")
            params.append(event_type)

        if filters:
            query += " WHERE {' AND '.join(filters)}"

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results), 200) if results else (jsonify({"error": "No events found"}), 404)

       

@events_bp.route("/<int:event_id>", methods=["DELETE"])
def deleteEvent(event_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            cur.execute("DELETE FROM events WHERE event_id = %s", (event_id,))
            if cur.rowcount == 0:
                return jsonify({"error": f"Event ID {event_id} not found"}), 404
            connection.commit()
            return jsonify({"message": "Event deleted successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500
    
@events_bp.route("/", methods=["POST"])
def addEvent():
    try:
        connection = connect()
        with connection.cursor() as cur:
            event_name = request.json.get("event_name")
            event_date = request.json.get("event_date")
            event_type = request.json.get("event_type")
            description = request.json.get("description")
            location = request.json.get("location")
            start_time = request.json.get("start_time")
            end_time = request.json.get("end_time")

            if not all([event_name, event_date, event_type]):
                return jsonify({"error": "event_name, event_date and event_type are required"}), 400
            
            check_query = "SELECT * FROM events WHERE event_name = %s AND event_date = %s"
            cur.execute(check_query, (event_name, event_date))
            if cur.fetchone():
                return jsonify({"error": "Event already exists"}), 400
            
            cur.execute("INSERT INTO events (event_name, event_date, event_type, description, location, start_time, end_time) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING event_id", (event_name, event_date, event_type, description, location, start_time, end_time))
            event_id = cur.fetchone()[0]
            connection.commit()
            return jsonify({"event_id": event_id}), 201
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500
    
@events_bp.route("/<int:event_id>", methods=["PUT"])
def updateEvent(event_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            # Get fields to update
            event_name = request.json.get("event_name")
            event_date = request.json.get("event_date")
            event_type = request.json.get("event_type")
            description = request.json.get("description")
            location = request.json.get("location")
            start_time = request.json.get("start_time")
            end_time = request.json.get("end_time")

            if not any([event_name, event_date, event_type, description, location, start_time, end_time]):
                return jsonify({"error": "At least one field must be provided to update"}), 400

            # Check if event exists
            cur.execute("SELECT * FROM events WHERE event_id = %s", (event_id,))
            if cur.fetchone() is None:
                return jsonify({"error": f"Event ID {event_id} not found"}), 404

            # Build dynamic update query
            updates = []
            params = []

            if event_name:
                updates.append("event_name = %s")
                params.append(event_name)
            if event_date:
                updates.append("event_date = %s")
                params.append(event_date)
            if event_type:
                updates.append("event_type = %s")
                params.append(event_type)
            if description:
                updates.append("description = %s")
                params.append(description)
            if location:
                updates.append("location = %s")
                params.append(location)
            if start_time:
                updates.append("start_time = %s")
                params.append(start_time)
            if end_time:
                updates.append("end_time = %s")
                params.append(end_time)

            update_query = f"UPDATE events SET {', '.join(updates)} WHERE event_id = %s"
            params.append(event_id)

            cur.execute(update_query, tuple(params))
            connection.commit()
            return jsonify({"message": "Event updated successfully"}), 200

    except Exception as e:
        connection.rollback()
        return jsonify({"error": "Unexpected server error", "details": str(e)}), 500


@events_bp.route("/attendence", methods=["GET"]) # cougar.ai/events/attendence&event_id=1 
def getAttendence():
    try:
        connection = connect()
        with connection.cursor() as cur:
            event_id = request.args.get("event_id", type=int)
            student_id = request.args.get("student_id", type=int)
            
            if event_id and student_id:
                return jsonify({"error": "Please provide either event_id or student_id, not both"}), 400
            elif event_id:
                query = "SELECT * FROM events JOIN points ON events.event_id = points.event_id"
            elif student_id:
                query = "SELECT * FROM points JOIN events ON points.event_id = events.event_id"
            else:
                return jsonify({"error": "Please provide either event_id or student_id"}), 400
            filters = []
            params = []

            if event_id:
                filters.append("events.event_id = %s")
                params.append(event_id)

            if student_id:
                filters.append("points.student_id = %s")
                params.append(student_id)

            if filters:
                query += " WHERE " + ' AND '.join(filters)

            cur.execute(query, tuple(params))
            results = cur.fetchall()
            return (jsonify(results), 200) if results else (jsonify({"error": "No attendence found"}), 404)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

        


