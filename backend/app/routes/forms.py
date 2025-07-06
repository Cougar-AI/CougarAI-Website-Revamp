from app.imports import *
from datetime import datetime
from google.oauth2 import service_account 
from googleapiclient.discovery import build 

forms_bp = Blueprint("forms", __name__)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
SERVICE_ACCOUNT_FILE = os.getenv('GOOGLE_CREDS_PATH')

@forms_bp.route("/<string:spreadsheet_id>", methods=["POST"])
def process_sheet(spreadsheet_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            event_id = request.json.get("event_id")
            points = request.json.get("points", 10)

            if not event_id:
                return jsonify({"error": "Event ID is required"}), 400
            
            creds = service_account.Credentials.from_service_account_file(
                SERVICE_ACCOUNT_FILE, scopes=SCOPES)
            service = build('sheets', 'v4', credentials=creds)

            sheet = service.spreadsheets()
            result = sheet.values().get(spreadsheetId=spreadsheet_id, 
                                        range='Form Responses 1').execute()
            
            values = result.get("values", [])
            if not values or len(values) < 2:
                return jsonify({"error": "No data found in the spreadsheet"}), 400

            headers = values[0]
            student_idx = headers.index("Student ID")
            timestampx = headers.index("Timestamp")

            added = 0 

            for row in values[1:]:
                if len(row) <= max(student_idx, timestampx):
                    continue

                student_id = row[student_idx].strip()
                timestamp_str = row[timestampx].strip()
                cur.execute("INSERT INTO points (student_id, event_id, points, date) VALUES (%s, %s, %s, %s)", (student_id, event_id, points, datetime.strptime(timestamp_str, "%m/%d/%Y %H:%M:%S")))
                added+=1

            connection.commit()
            return jsonify({"status": "success", "inserted": added})
    except Exception as e:
        connection.rollback()
        return jsonify({"error": "Failed to process the spreadsheet", "details": str(e)}), 500




            


