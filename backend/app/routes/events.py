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
            query += f" WHERE {' AND '.join(filters)}"

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return jsonify(results) if results else jsonify({"error": "No events found"}), 404

       

@events_bp.route("/<int:event_id>", methods=["DELETE"])
def deleteEvent(event_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            cur.execute(f"DELETE FROM events WHERE event_id = %s", (event_id,))
            connection.commit()
            return jsonify({"message": "Event deleted successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500
    
# @events_bp.route("/attendence", methods=["GET"])
