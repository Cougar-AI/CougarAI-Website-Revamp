from app.imports import *

events_bp = Blueprint('events', __name__)
@events_bp.route("/", methods=["GET"])
def getEvents():
    connection = connect()
    with connection.cursor() as cur:

        date = request.args.get("date")
        if date and not is_valid_date(date):
            return jsonify({"error": "Invalid date format"}), 400

        filter_dict = {
            "event_id": request.args.get("event_id", type=int),
            "type": request.args.get("type"),
            "limit": request.args.get("limit", type=int),
            "offset": request.args.get("offset", type=int),
            "description": request.args.get("description"),
            "start_date": request.args.get("start_date"),
            "end_date": request.args.get("end_date"),
            "date": date,
            "location": request.args.get("location"),
        }

        query, params = build_sql_querys("SELECT * FROM events", filter_dict, date_column="date")

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
                "name": request.json.get("name"),
                "date": request.json.get("date"),
                "type": request.json.get("type"),
                "description": request.json.get("description"),
                "location": request.json.get("location"),
                "start_time": request.json.get("start_time"),
                "end_time": request.json.get("end_time")
            }
            if filter_dict["date"] is None or filter_dict["type"] is None or filter_dict["name"] is None:
                return jsonify({"error": "name, date and type are required"}), 400
            
            query, params = build_sql_querys("INSERT INTO events", filter_dict, date_column="date", mode="INSERT")
            query += " RETURNING event_id"
        
            cur.execute(query, tuple(params))
            
            connection.commit()
            return jsonify({"message": "Success"}), 201
        
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500
    
@events_bp.route("/attendance", methods=["GET"]) 
def getAttendance():
    try:
        connection = connect()
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
            events.description, events.location, events.name, events.type, events.date,
            users.first_name, users.last_name
            FROM points 
            JOIN events ON points.event_id = events.event_id 
            JOIN users ON points.student_id = users.student_id
            """

            query, params = build_sql_querys(base_query, filter_dict, date_column="points.date")
            query += """
                GROUP BY 
                    points.points_id, 
                    events.description, events.location, events.name, events.type, events.date,
                    users.first_name, users.last_name
            """

            cur.execute(query, tuple(params))
            results = cur.fetchall()
            return (jsonify(results), 200) if results else (jsonify({"error": "No attendence found"}), 404)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@events_bp.route("/<int:event_id>", methods=["PATCH"])
def updateEvent(event_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            filter_dict = {
                "name": request.json.get("name"),
                "date": request.json.get("date"),
                "type": request.json.get("type"),
                "description": request.json.get("description"),
                "location": request.json.get("location"),
            }

            if filter_dict["date"] and not is_valid_date(filter_dict["date"]):
                return jsonify({"error": "Invalid date format"}), 400
            
            query, params = build_sql_querys("UPDATE events", filter_dict, date_column="date", mode="SET")
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

        


