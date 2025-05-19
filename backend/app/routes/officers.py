from flask import Blueprint, request, jsonify
from backend.app.db import connect

officers_bp = Blueprint('officers', __name__)

@officers_bp.route("/", methods=["GET"])
def getOfficers():
    connection = connect()
    with connection.cursor() as cur:
        student_id = request.args.get("student_id", type=int)
        joinDate = request.args.get("join_date")
        endDate = request.args.get("end_date")

        query = "SELECT * FROM officers"
        filters = []
        params = []

        if student_id:
            filters.append("student_id = %s")
            params.append(student_id)

        if joinDate and endDate:
            filters.append("join_date BETWEEN %s AND %s")
            params.extend([joinDate, endDate])

        if filters:
            query += f" WHERE {' AND '.join(filters)}"

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return jsonify(results) if results else jsonify({"error": "No officers found"}), 404
        

            