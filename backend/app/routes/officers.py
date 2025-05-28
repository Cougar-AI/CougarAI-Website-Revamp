from flask import Blueprint, request, jsonify
from app.utils.query_handler import build_sql_querys
from app.utils.date_validation import is_valid_date
from app.db import connect

officers_bp = Blueprint('officers', __name__)

@officers_bp.route("/", methods=["GET"])
def getOfficers():
    connection = connect()
    with connection.cursor() as cur:
        filter_dict = {
            "student_id": request.args.get("student_id", type=int),
            "student_id": request.args.get("student_id", type=int),
            "join_date": request.args.get("join_date"),
            "end_date": request.args.get("end_date"),
            "limit": request.args.get("limit", type=int),
            "offset": request.args.get("offset", type=int)
        }

        if "join_date" in filter_dict and filter_dict["join_date"] and not is_valid_date(filter_dict["join_date"]):
            return jsonify({"error": "Invalid join_date format"}), 400

        query, params = build_sql_querys("SELECT * FROM officers", filter_dict, date_column="join_date")
        query += " ORDER BY join_date DESC"

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results), 200) if results else (jsonify({"error": "No officers found"}), 404)
    
@officers_bp.route("/<int:student_id>", methods=["POST"])
def addOfficer(student_id):
    try:
        connection = connect()
        with connection.cursor() as cur:

            filter_dict = {
                "student_id": student_id,
                "join_date": request.json.get("join_date"),
                "end_date": request.json.get("end_date"),
                "role": request.json.get("role")
            }
            
            if not (1000000 <= student_id <= 9999999):
                return jsonify({"error": "student_id must be a 7-digit number"}), 400

            if filter_dict["join_date"] is None or filter_dict["role"] is None:
                return jsonify({"error": "student_id, join_date and role are required"}), 400
            
            if not is_valid_date(filter_dict["join_date"]):
                return jsonify({"error": "Invalid join_date format"}), 400

            query, params = build_sql_querys("INSERT INTO officers", filter_dict, date_column="join_date", mode="INSERT")
            query += " RETURNING student_id"

            # if filter_dict["end_date"]:
            #     cur.execute("INSERT INTO officers (student_id, role, join_date, end_date) VALUES (%s, %s, %s, %s) RETURNING student_id", (student_id, role, join_date, end_date)) 
            # else:
            #     cur.execute("INSERT INTO officers (student_id, role, join_date) VALUES (%s, %s, %s) RETURNING student_id", (student_id, role, join_date))

            cur.execute(query, tuple(params))
            result = cur.fetchone()

            if not result:
                return jsonify({"error": "Failed to add officer"}), 400
            connection.commit()
            return jsonify({"results": result}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@officers_bp.route("/<int:student_id>", methods=["DELETE"])
def deleteOfficer(student_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            cur.execute("DELETE FROM officers WHERE student_id = %s", (student_id,))
            if cur.rowcount == 0:
                return jsonify({"error": "Officer not found"}), 404

            connection.commit()
            return jsonify({"message": "Officer deleted successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500
        
@officers_bp.route("/<int:student_id>", methods=["GET"])
def getOfficer(student_id):
    connection = connect()
    with connection.cursor() as cur:
        cur.execute("SELECT * FROM officers WHERE student_id = %s", (student_id,))
        result = cur.fetchone()
        return jsonify(result) if result else jsonify({"error": "Officer not found"}), 404
            