from flask import Blueprint, request, jsonify
from app.utils.date_validation import is_valid_date
from app.utils.query_handler import build_sql_querys
from app.db import connect


events_bp = Blueprint('events', __name__)
@events_bp.route("/", methods=["GET"])
def getEvents():
    connection = connect()
    with connection.cursor() as cur:

        event_date = request.args.get("event_date")
        if event_date and not is_valid_date(event_date):
            return jsonify({"error": "Invalid event_date format"}), 400

        filter_dict = {
            "event_id": request.args.get("event_id", type=int),
            "event_type": request.args.get("event_type"),
            "limit": request.args.get("limit", type=int),
            "offset": request.args.get("offset", type=int),
            "description": request.args.get("description"),
            "event_date": event_date,
            "location": request.args.get("location"),
        }

        query, params = build_sql_querys("SELECT * FROM events", filter_dict, date_column="event_date")

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
            
            filter_dict = {
                "event_name": request.json.get("event_name"),
                "event_date": request.json.get("event_date"),
                "event_type": request.json.get("event_type"),
                "description": request.json.get("description"),
                "location": request.json.get("location"),
                "start_time": request.json.get("start_time"),
                "end_time": request.json.get("end_time")
            }
            if filter_dict["event_date"] is None or filter_dict["event_type"] is None or filter_dict["event_name"] is None:
                return jsonify({"error": "event_name, event_date and event_type are required"}), 400
            
            query, params = build_sql_querys("INSERT INTO events", filter_dict, date_column="event_date", mode="INSERT")
            query += " RETURNING event_id"
        
            cur.execute(query, tuple(params))
            
            connection.commit()
            return jsonify({"message": "Success"}), 201
        
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500
    
@events_bp.route("/attendance", methods=["GET"]) # cougar.ai/events/attendence&event_id=1 
def getAttendance():
    try:
        connection = connect()
        with connection.cursor() as cur:

            filter_dict = {
                "event_id": request.args.get("event_id", type=int),
                "student_id": request.args.get("student_id", type=int),
                "limit": request.args.get("limit", type=int),
                "offset": request.args.get("offset", type=int),
                "description": request.args.get("description"),
                "location": request.args.get("location"),
            }
            
            if filter_dict["event_id"] and filter_dict["student_id"]:
                return jsonify({"error": "Please provide either event_id or student_id, not both"}), 400
            elif filter_dict["event_id"]:
                base_query = "SELECT * FROM events JOIN points ON events.event_id = points.event_id"
            elif filter_dict["student_id"]:
                base_query = "SELECT * FROM points JOIN events ON points.event_id = events.event_id"
            else:
                return jsonify({"error": "Please provide either event_id or student_id"}), 400
            
            query, params = build_sql_querys(base_query, filter_dict, date_column="points.date")

            cur.execute(query, tuple(params))
            results = cur.fetchall()
            return (jsonify(results), 200) if results else (jsonify({"error": "No attendence found"}), 404)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

        


