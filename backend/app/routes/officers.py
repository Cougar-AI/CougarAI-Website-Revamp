from flask import Blueprint, request, jsonify
from app.db import connect

officers_bp = Blueprint('officers', __name__)

@officers_bp.route("/", methods=["GET"])
def getOfficers():
    connection = connect()
    with connection.cursor() as cur:
        student_id = request.args.get("student_id", type=int)
        joinDate = request.args.get("join_date")
        endDate = request.args.get("end_date")

        if student_id:
            query = "SELECT * FROM officers WHERE student_id = %s"
            params = [student_id]

            if joinDate and endDate:
                query += " AND join_date BETWEEN %s AND %s"
                params.extend([joinDate, endDate]) 

            cur.execute(query, tuple(params))
            results = cur.fetchall() if len(params) > 1 else cur.fetchone() 
            return jsonify(results) if results else jsonify({"error": "No officer found"}), 404
        elif joinDate and endDate:
            cur.execute(f"SELECT * FROM officers WHERE join_date BETWEEN %s AND %s", (joinDate, endDate))
            results = cur.fetchall()
            return jsonify(results) if results else jsonify({"error": "No officer found"}), 404
        else:
            cur.execute(f'SELECT * FROM officers')
            results = cur.fetchall()
            return jsonify(results) if results else jsonify({"error": "No officers found"}), 404