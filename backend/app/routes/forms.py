import os
from datetime import datetime
from typing import Optional
from flask import Blueprint, request, jsonify
from google.oauth2 import service_account
from googleapiclient.discovery import build
from app.raw_db import get_db
from app.utils.auth_decorators import require_officer

forms_bp = Blueprint("forms", __name__)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

def _resolve_creds_path(env_var: str) -> Optional[str]:
    path = os.getenv(env_var)
    if not path:
        return None
    if os.path.isabs(path):
        return path
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", path))

def parse_forms_ts(s: str) -> datetime:
    s = s.strip()
    for fmt in ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y %I:%M:%S %p"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return datetime.fromisoformat(s)

@forms_bp.route("/<string:spreadsheet_id>", methods=["POST", "OPTIONS"])
@require_officer
def process_sheet(spreadsheet_id):
    try:
        connection = get_db()
        with connection.cursor() as cur:
            event_id = request.json.get("event_id")
            points = request.json.get("points", 10)

            if not event_id:
                return jsonify({"error": "Event ID is required"}), 400

            service_account_file = _resolve_creds_path("GOOGLE_CREDS_PATH")
            if not service_account_file:
                return jsonify({"error": "GOOGLE_CREDS_PATH is not configured"}), 500

            creds = service_account.Credentials.from_service_account_file(
                service_account_file, scopes=SCOPES)
            service = build('sheets', 'v4', credentials=creds)

            sheet = service.spreadsheets()
            result = sheet.values().get(spreadsheetId=spreadsheet_id,
                                        range='Form Responses 1').execute()

            values = result.get("values", [])
            if not values or len(values) < 2:
                return jsonify({"error": "No data found in the spreadsheet"}), 400

            headers = values[0]
            try:
                student_idx = headers.index("Student ID")
                email_idx   = headers.index("Email Address")
                timestampx  = headers.index("Timestamp")
            except ValueError as he:
                return jsonify({"error": "Missing expected header", "details": str(he)}), 400

            added = 0

            for row in values[1:]:
                if len(row) <= max(student_idx, timestampx, email_idx):
                    continue

                student_id = row[student_idx].strip()
                email = row[email_idx].strip()
                timestamp_str = row[timestampx].strip()

                if not student_id.isdigit() or not(len(student_id) == 7):
                    continue

                if not email:
                    continue

                student_id = int(student_id)

                cur.execute("""
                    INSERT INTO users (email)
                    VALUES (%s)
                    ON CONFLICT (email) DO NOTHING
                    RETURNING user_id
                """, (email,))
                row_user = cur.fetchone()

                if row_user is None:
                    cur.execute("SELECT user_id FROM users WHERE email = %s", (email,))
                    row_user = cur.fetchone()

                if row_user is None:
                    return jsonify({"error": f"Could not resolve user_id for {email!r}"}), 400

                # handle tuple rows vs dict rows
                user_id = row_user["user_id"] if isinstance(row_user, dict) else row_user[0]

                cur.execute("""
                    INSERT INTO profile (user_id, student_id)
                    VALUES (%s, %s)
                    ON CONFLICT (student_id) DO NOTHING
                """, (user_id, student_id, ))

                ts = parse_forms_ts(timestamp_str)
                cur.execute("""
                    INSERT INTO points (student_id, event_id, points, date)
                    VALUES (%s, %s, %s, %s)
                """, (student_id, event_id, points, ts))
                added += 1

            connection.commit()
            return jsonify({"status": "success", "inserted": added})
    except Exception as e:
        try:
            connection.rollback()
        except Exception:
            pass
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to process the spreadsheet"}), 500
