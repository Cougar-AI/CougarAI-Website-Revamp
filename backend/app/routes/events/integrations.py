import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from flask import request, jsonify
from google.oauth2 import service_account
from googleapiclient.discovery import build
from app.routes.events import events_bp
from app.raw_db import get_db
from app.utils.auth_decorators import require_officer

_CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


def _resolve_creds_path(env_var: str) -> Optional[str]:
    path = os.getenv(env_var)
    if not path:
        return None
    if os.path.isabs(path):
        return path
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", path))


def _get_calendar_service():
    creds_path = _resolve_creds_path("GOOGLE_CALENDAR_CREDS_PATH")
    if not creds_path:
        raise RuntimeError("GOOGLE_CALENDAR_CREDS_PATH is not configured")
    creds = service_account.Credentials.from_service_account_file(creds_path, scopes=_CALENDAR_SCOPES)
    return build("calendar", "v3", credentials=creds)


def _to_rfc3339(dt_str: str) -> str:
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


@events_bp.route("/<int:event_id>/sync-to-google", methods=["POST", "OPTIONS"])
@require_officer
def sync_to_google(event_id):
    conn = get_db()
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


@events_bp.route("/<int:event_id>/sync-to-google", methods=["DELETE", "OPTIONS"])
@require_officer
def remove_from_google(event_id):
    conn = get_db()
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
        pass

    with conn.cursor() as cur:
        cur.execute("UPDATE events SET google_event_id = NULL WHERE event_id = %s", (event_id,))
        conn.commit()

    return jsonify({"ok": True}), 200


@events_bp.route("/<int:event_id>/partners", methods=["GET", "OPTIONS"])
@require_officer
def get_event_partners(event_id):
    conn = get_db()
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


@events_bp.route("/<int:event_id>/partners", methods=["POST", "OPTIONS"])
@require_officer
def add_event_partner(event_id):
    data = request.get_json(silent=True) or {}
    partner_id = data.get("partner_id")
    role = data.get("role", "collaborator")

    if not partner_id:
        return jsonify({"error": "partner_id is required"}), 400

    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM events WHERE event_id = %s", (event_id,))
        if not cur.fetchone():
            return jsonify({"error": "Event not found"}), 404

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
@require_officer
def remove_event_partner(event_id, partner_id):
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM event_partners WHERE event_id = %s AND partner_id = %s",
            (event_id, partner_id),
        )
        conn.commit()
    return jsonify({"ok": True}), 200


@events_bp.route("/<int:event_id>/sponsors", methods=["GET", "OPTIONS"])
@require_officer
def get_event_sponsors(event_id):
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT s.sponsor_id, s.name, s.logo_url, s.tier
            FROM event_sponsors es
            JOIN sponsors s ON es.sponsor_id = s.sponsor_id
            WHERE es.event_id = %s
            ORDER BY s.name
            """,
            (event_id,),
        )
        rows = cur.fetchall()
    return jsonify({"sponsors": [dict(r) for r in rows]}), 200


@events_bp.route("/<int:event_id>/sponsors", methods=["POST", "OPTIONS"])
@require_officer
def add_event_sponsor(event_id):
    data = request.get_json(silent=True) or {}
    sponsor_id = data.get("sponsor_id")

    if not sponsor_id:
        return jsonify({"error": "sponsor_id is required"}), 400

    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM events WHERE event_id = %s", (event_id,))
        if not cur.fetchone():
            return jsonify({"error": "Event not found"}), 404

        cur.execute(
            """
            INSERT INTO event_sponsors (event_id, sponsor_id)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
            """,
            (event_id, sponsor_id),
        )
        conn.commit()
    return jsonify({"ok": True}), 201


@events_bp.route("/<int:event_id>/sponsors/<int:sponsor_id>", methods=["DELETE", "OPTIONS"])
@require_officer
def remove_event_sponsor(event_id, sponsor_id):
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM event_sponsors WHERE event_id = %s AND sponsor_id = %s",
            (event_id, sponsor_id),
        )
        conn.commit()
    return jsonify({"ok": True}), 200
