from app.imports import *
from google.oauth2 import service_account
from googleapiclient.discovery import build

events_bp = Blueprint('events', __name__)

_CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]
_CALENDAR_ID = "cougaraicontact@gmail.com"

@events_bp.route("/google", methods=["GET"])
def getGoogleCalendarEvents():
    try:
        creds = service_account.Credentials.from_service_account_file(
            os.getenv("GOOGLE_CALENDAR_CREDS_PATH"),
            scopes=_CALENDAR_SCOPES,
        )
        service = build("calendar", "v3", credentials=creds)
        result = service.events().list(
            calendarId=_CALENDAR_ID,
            timeMin="2022-08-08T00:00:00Z",
            maxResults=500,
            singleEvents=True,
            orderBy="startTime",
        ).execute()
        return jsonify(result.get("items", [])), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@events_bp.route("/", methods=["GET"])
def getEvents():
    connection = connect()
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

        query, params = build_sql_querys("SELECT * FROM events", filter_dict, date_column="starts_at")

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
                "event_type": request.json.get("event_type"),
                "description": request.json.get("description"),
                "location": request.json.get("location"),
                "starts_at": request.json.get("starts_at"),
                "ends_at": request.json.get("ends_at"),
                "capacity": request.json.get("capacity")
            }
            if filter_dict["starts_at"] is None or filter_dict["event_type"] is None or filter_dict["name"] is None:
                return jsonify({"error": "name, starts_at and event_type are required"}), 400

            query, params = build_sql_querys("INSERT INTO events", filter_dict, date_column="starts_at", mode="INSERT")
            query += " RETURNING event_id"
        
            cur.execute(query, tuple(params))
            event_id = cur.fetchone()[0]
            connection.commit()
            return jsonify({"message": "Success", "event_id": event_id}), 201
        
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
    
@events_bp.route("/<int:event_id>", methods=["PATCH"])
def updateEvent(event_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            filter_dict = {
                "name": request.json.get("name"),
                "event_type": request.json.get("event_type"),
                "capacity": request.json.get("capacity"),
                "starts_at": request.json.get("starts_at"),
                "ends_at": request.json.get("ends_at"),
                "description": request.json.get("description"),
                "location": request.json.get("location"),
            }

            if filter_dict["starts_at"] and not is_valid_date(filter_dict["starts_at"]):
                return jsonify({"error": "Invalid starts_at format"}), 400
            if filter_dict["ends_at"] and not is_valid_date(filter_dict["ends_at"]):
                return jsonify({"error": "Invalid ends_at format"}), 400
            
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

        


