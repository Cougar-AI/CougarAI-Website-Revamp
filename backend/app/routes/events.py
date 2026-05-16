from app.imports import *
from google.oauth2 import service_account
from googleapiclient.discovery import build
from typing import Optional
from datetime import date as date_type
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app import limiter

_MUTATE_ROLES = {"officer", "admin"}
_ADMIN_ROLES = {"admin"}


def _check_role(allowed: set) -> tuple | None:
    """Return 403 tuple if caller's role is not in allowed, else None."""
    claims = get_jwt()
    if claims.get("role") not in allowed:
        return jsonify({"error": "Insufficient role"}), 403
    return None

events_bp = Blueprint('events', __name__)

_CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

def _resolve_creds_path(env_var: str) -> Optional[str]:
    path = os.getenv(env_var)
    if not path:
        return None
    if os.path.isabs(path):
        return path
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", path))

def _get_calendar_service():
    creds_path = _resolve_creds_path("GOOGLE_CALENDAR_CREDS_PATH")
    if not creds_path:
        raise RuntimeError("GOOGLE_CALENDAR_CREDS_PATH is not configured")
    creds = service_account.Credentials.from_service_account_file(creds_path, scopes=_CALENDAR_SCOPES)
    return build("calendar", "v3", credentials=creds)

def _to_rfc3339(dt_str: str) -> str:
    """Convert a naive ISO datetime string to RFC3339 with UTC timezone."""
    from datetime import timezone
    dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

@events_bp.route("/google", methods=["GET"])
def getGoogleCalendarEvents():
    try:
        creds_path = _resolve_creds_path("GOOGLE_CALENDAR_CREDS_PATH")
        calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "cougaraicontact@gmail.com")
        if not creds_path:
            return jsonify({"error": "GOOGLE_CALENDAR_CREDS_PATH is not configured"}), 500

        creds = service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=_CALENDAR_SCOPES,
        )
        service = build("calendar", "v3", credentials=creds)
        result = service.events().list(
            calendarId=calendar_id,
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

        query, params = build_sql_querys(
            "SELECT event_id, name, event_type, description, location, location_url, starts_at, ends_at, "
            "capacity, check_in_code, check_in_enabled, check_in_expires_at, points_value, google_event_id FROM events",
            filter_dict, date_column="starts_at"
        )

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results), 200) if results else (jsonify({"error": "No events found"}), 404)

       

@events_bp.route("/<int:event_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def deleteEvent(event_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _check_role(_ADMIN_ROLES)
    if err:
        return err
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
    
@events_bp.route("/", methods=["POST", "OPTIONS"])
@jwt_required()
def addEvent():
    if request.method == "OPTIONS":
        return "", 200
    err = _check_role(_MUTATE_ROLES)
    if err:
        return err
    try:
        connection = connect()
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
    
@events_bp.route("/attendance", methods=["GET", "OPTIONS"])
@jwt_required()
def getAttendance():
    if request.method == "OPTIONS":
        return "", 200
    err = _check_role(_MUTATE_ROLES)
    if err:
        return err
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
    
@events_bp.route("/<int:event_id>", methods=["PATCH", "OPTIONS"])
@jwt_required()
def updateEvent(event_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _check_role(_MUTATE_ROLES)
    if err:
        return err
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
                "location_url": request.json.get("location_url"),
                "check_in_enabled": request.json.get("check_in_enabled"),
                "check_in_expires_at": request.json.get("check_in_expires_at"),
                "points_value": request.json.get("points_value"),
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


# ---------------------------------------------------------------------------
# Streak helper
# ---------------------------------------------------------------------------

def _update_streak(cur, student_id: str, event_date: date_type):
    """Increment monthly attendance streak for a student after a check-in."""
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
        return  # already counted this month

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


# ---------------------------------------------------------------------------
# POST /events/checkin  — member self-check-in via event code
# ---------------------------------------------------------------------------

@events_bp.route("/checkin", methods=["POST", "OPTIONS"])
@jwt_required()
@limiter.limit("20/minute")
def member_checkin():
    if request.method == "OPTIONS":
        return "", 200

    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip().upper()

    if not code:
        return jsonify({"error": "code is required"}), 400

    conn = connect()
    with conn.cursor() as cur:
        # Validate event code
        cur.execute(
            """
            SELECT event_id, name, check_in_expires_at,
                   COALESCE(points_value, 10) as points_value
            FROM events
            WHERE check_in_code = %s AND check_in_enabled = TRUE
            """,
            (code,),
        )
        event = cur.fetchone()
        if not event:
            return jsonify({"error": "Invalid or inactive check-in code"}), 404

        now = datetime.utcnow()
        if event["check_in_expires_at"] and event["check_in_expires_at"] < now:
            return jsonify({"error": "This check-in code has expired"}), 410

        # Require linked profile
        cur.execute("SELECT student_id FROM profile WHERE user_id = %s", (user_id,))
        profile = cur.fetchone()
        if not profile:
            return jsonify({"error": "No profile linked — link your student ID first"}), 403

        student_id = profile["student_id"]
        event_id = event["event_id"]

        # Duplicate check
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


# ---------------------------------------------------------------------------
# POST /events/officer-checkin  — officer manual check-in by student_id
# ---------------------------------------------------------------------------

OFFICER_ROLES = {"officer", "admin"}

@events_bp.route("/officer-checkin", methods=["POST", "OPTIONS"])
@jwt_required()
@limiter.limit("60/minute")
def officer_checkin():
    if request.method == "OPTIONS":
        return "", 200

    user_id = int(get_jwt_identity())
    conn = connect()

    # Role check
    with conn.cursor() as cur:
        cur.execute("SELECT role FROM users WHERE user_id = %s", (user_id,))
        user_row = cur.fetchone()
    if not user_row or user_row.get("role") not in OFFICER_ROLES:
        return jsonify({"error": "Officer access required"}), 403

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

        # Ensure profile row exists (create stub if walk-in)
        cur.execute("SELECT student_id FROM profile WHERE student_id = %s", (student_id,))
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO profile (student_id) VALUES (%s)",
                (student_id,),
            )

        # Duplicate check (check both tables)
        cur.execute(
            "SELECT points_id FROM points WHERE student_id = %s AND event_id = %s",
            (student_id, event_id),
        )
        if cur.fetchone():
            return jsonify({"message": "Already checked in", "event_name": event["name"]}), 200

        today = date_type.today()
        cur.execute(
            "INSERT INTO points (student_id, event_id, points, date) VALUES (%s, %s, %s, %s)",
            (student_id, event_id, event["points_value"], today),
        )
        # Also record in event_checkins so attendance counts are accurate
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


# ---------------------------------------------------------------------------
# POST /events/<id>/sync-to-google  — create or update event in Google Calendar
# ---------------------------------------------------------------------------

@events_bp.route("/<int:event_id>/sync-to-google", methods=["POST", "OPTIONS"])
@jwt_required()
def sync_to_google(event_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _check_role(_MUTATE_ROLES)
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT name, description, location, starts_at, ends_at, google_event_id FROM events WHERE event_id = %s",
            (event_id,),
        )
        ev = cur.fetchone()
        if not ev:
            return jsonify({"error": "Event not found"}), 404

    try:
        service = _get_calendar_service()
        calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "cougaraicontact@gmail.com")

        starts_at = _to_rfc3339(str(ev["starts_at"]))
        ends_at = _to_rfc3339(str(ev["ends_at"])) if ev["ends_at"] else None
        if not ends_at:
            # Default to 1 hour after start
            from datetime import timedelta
            start_dt = datetime.fromisoformat(str(ev["starts_at"]))
            ends_at = (start_dt + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")

        body = {
            "summary": ev["name"],
            "description": ev["description"] or "",
            "location": ev["location"] or "",
            "start": {"dateTime": starts_at, "timeZone": "America/Chicago"},
            "end": {"dateTime": ends_at, "timeZone": "America/Chicago"},
        }

        existing_google_id = ev["google_event_id"]
        if existing_google_id:
            result = service.events().patch(
                calendarId=calendar_id, eventId=existing_google_id, body=body
            ).execute()
        else:
            result = service.events().insert(calendarId=calendar_id, body=body).execute()

        google_event_id = result["id"]
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE events SET google_event_id = %s WHERE event_id = %s",
                (google_event_id, event_id),
            )
            conn.commit()

        return jsonify({"google_event_id": google_event_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# DELETE /events/<id>/sync-to-google  — remove event from Google Calendar
# ---------------------------------------------------------------------------

@events_bp.route("/<int:event_id>/sync-to-google", methods=["DELETE"])
@jwt_required()
def remove_from_google(event_id):
    err = _check_role(_MUTATE_ROLES)
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT google_event_id FROM events WHERE event_id = %s", (event_id,))
        ev = cur.fetchone()
        if not ev:
            return jsonify({"error": "Event not found"}), 404

        google_event_id = ev["google_event_id"]
        if not google_event_id:
            return jsonify({"error": "Event is not synced to Google Calendar"}), 400

    try:
        service = _get_calendar_service()
        calendar_id = os.getenv("GOOGLE_CALENDAR_ID", "cougaraicontact@gmail.com")
        service.events().delete(calendarId=calendar_id, eventId=google_event_id).execute()
    except Exception:
        pass  # If Google delete fails, still clear locally

    with conn.cursor() as cur:
        cur.execute("UPDATE events SET google_event_id = NULL WHERE event_id = %s", (event_id,))
        conn.commit()

    return jsonify({"ok": True}), 200


# ---------------------------------------------------------------------------
# Event partner tagging  — GET/POST/DELETE /events/<id>/partners
# ---------------------------------------------------------------------------

@events_bp.route("/<int:event_id>/partners", methods=["GET", "OPTIONS"])
@jwt_required()
def get_event_partners(event_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _check_role(_MUTATE_ROLES)
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.partner_id, p.name, p.type, p.logo_url, ep.role
            FROM event_partners ep
            JOIN partners p ON ep.partner_id = p.partner_id
            WHERE ep.event_id = %s
            ORDER BY p.name
            """,
            (event_id,),
        )
        rows = cur.fetchall()

    return jsonify({"partners": [dict(r) for r in rows]}), 200


@events_bp.route("/<int:event_id>/partners", methods=["POST"])
@jwt_required()
def add_event_partner(event_id):
    err = _check_role(_MUTATE_ROLES)
    if err:
        return err

    data = request.get_json(silent=True) or {}
    partner_id = data.get("partner_id")
    role = data.get("role", "collaborator")

    if not partner_id:
        return jsonify({"error": "partner_id is required"}), 400

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO event_partners (event_id, partner_id, role)
            VALUES (%s, %s, %s)
            ON CONFLICT (event_id, partner_id) DO UPDATE SET role = EXCLUDED.role
            """,
            (event_id, partner_id, role),
        )
        conn.commit()

    return jsonify({"ok": True}), 201


@events_bp.route("/<int:event_id>/partners/<int:partner_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def remove_event_partner(event_id, partner_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _check_role(_MUTATE_ROLES)
    if err:
        return err

    conn = connect()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM event_partners WHERE event_id = %s AND partner_id = %s",
            (event_id, partner_id),
        )
        conn.commit()

    return jsonify({"ok": True}), 200

