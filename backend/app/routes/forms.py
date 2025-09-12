from app.imports import *
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build

forms_bp = Blueprint("forms", __name__)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_CREDS_PATH")

def parse_forms_ts(s: str) -> datetime:
    s = s.strip()
    for fmt in ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y %I:%M:%S %p"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    # last resort (e.g., ISO-ish)
    return datetime.fromisoformat(s)

@forms_bp.route("/<string:spreadsheet_id>", methods=["POST"])
def process_sheet(spreadsheet_id):
    connection = None
    try:
        connection = connect()
        with connection.cursor() as cur:
            payload = request.get_json(silent=True) or {}
            event_id = payload.get("event_id")
            points   = payload.get("points", 10)
            if not event_id:
                return jsonify({"error": "Event ID is required"}), 400

            creds = service_account.Credentials.from_service_account_file(
                SERVICE_ACCOUNT_FILE, scopes=SCOPES
            )
            service = build("sheets", "v4", credentials=creds)
            result = service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id, range="Form Responses 1"
            ).execute()

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
                if len(row) <= max(student_idx, email_idx, timestampx):
                    continue

                raw_student_id = row[student_idx].strip()
                email          = row[email_idx].strip()
                timestamp_str  = row[timestampx].strip()

                # must be digits AND exactly 7 chars
                if (not raw_student_id.isdigit()) or (len(raw_student_id) != 7):
                    continue
                if not email:
                    continue  # or synthesize a placeholder if you prefer

                student_id = int(raw_student_id)

                # 1) create/find user by email
                cur.execute(
                    """
                    INSERT INTO users (email)
                    VALUES (%s)
                    ON CONFLICT (email) DO NOTHING
                    RETURNING user_id
                    """,
                    (email,),
                )
                row_user = cur.fetchone()
                if row_user is None:
                    cur.execute("SELECT user_id FROM users WHERE email = %s", (email,))
                    row_user = cur.fetchone()
                user_id = row_user[0]

                # 2) create profile if missing (tied to that user)
                cur.execute(
                    """
                    INSERT INTO profile (user_id, student_id)
                    VALUES (%s, %s)
                    ON CONFLICT (student_id) DO NOTHING
                    """,
                    (user_id, student_id),
                )
                # (If you want latest email to take ownership, use:
                #  ON CONFLICT (student_id) DO UPDATE SET user_id = EXCLUDED.user_id)

                # 3) add points entry
                ts = parse_forms_ts(timestamp_str)
                cur.execute(
                    """
                    INSERT INTO points (student_id, event_id, points, date)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (student_id, event_id, points, ts),
                )
                added += 1

            connection.commit()
            return jsonify({"status": "success", "inserted": added})
    except Exception as e:
        if connection:
            connection.rollback()
        import traceback
        return jsonify({
            "error": "Failed to process the spreadsheet",
            "details": str(e),
            "trace": traceback.format_exc(),
        }), 500