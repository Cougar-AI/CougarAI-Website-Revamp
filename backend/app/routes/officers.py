from flask import Blueprint, request, jsonify
from app.utils.query_handler import build_sql_querys
from app.db import connect

officers_bp = Blueprint('officers', __name__)

@officers_bp.route("/", methods=["GET"])
def getOfficers():
    connection = connect()
    with connection.cursor() as cur:
        filter_dict = {
            "officer_id": request.args.get("officer_id", type=int),
            "student_id": request.args.get("student_id", type=int),
            "join_date": request.args.get("join_date"),
            "end_date": request.args.get("end_date"),
            "limit": request.args.get("limit", type=int),
            "offset": request.args.get("offset", type=int)
        }

        query, params = build_sql_querys("SELECT * FROM officers", filter_dict, date_column="join_date")
        query += " ORDER BY join_date DESC"

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results), 200) if results else (jsonify({"error": "No officers found"}), 404)
    
@officers_bp.route("/add", methods=["POST"])
def addOfficer():
    try:
        connection = connect()
        with connection.cursor() as cur:
            student_id = request.json.get("student_id")
            join_date = request.json.get("join_date")
            role = request.json.get("role")
            end_date = request.json.get("end_date") 

            if student_id is None or join_date is None or role is None:
                return jsonify({"error": "student_id, join_date and role are required"}), 400
            
            if end_date:
                if join_date > end_date:
                    return jsonify({"error": "join_date cannot be after end_date"}), 400
                cur.execute("INSERT INTO officers (student_id, role, join_date, end_date) VALUES (%s, %s, %s, %s) RETURNING officer_id", (student_id, role, join_date, end_date)) 
            else:
                cur.execute("INSERT INTO officers (student_id, role, join_date) VALUES (%s, %s, %s) RETURNING officer_id", (student_id, role, join_date))
            connection.commit()
            officer_id = cur.fetchone()[0]
            return jsonify({"officer_id": officer_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@officers_bp.route("/<int:officer_id>", methods=["DELETE"])
def deleteOfficer(officer_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            cur.execute("DELETE FROM officers WHERE officer_id = %s", (officer_id,))
            if cur.rowcount == 0:
                return jsonify({"error": "Officer not found"}), 404
            connection.commit()
            return jsonify({"message": "Officer deleted successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500

@officers_bp.route("/<int:officer_id>", methods=["PUT"])
def updateOfficer(officer_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            student_id = request.json.get("student_id")
            join_date = request.json.get("join_date")
            role = request.json.get("role")
            end_date = request.json.get("end_date")

            if student_id is None and join_date is None and role is None and end_date is None:
                return jsonify({"error": "At least one field must be provided to update"}), 400

            cur.execute("SELECT * FROM officers WHERE officer_id = %s", (officer_id,))
            if cur.rowcount == 0:
                return jsonify({"error": "Officer not found"}), 404

            query = "UPDATE officers SET "
            updates = []
            params = []

            if student_id:
                updates.append("student_id = %s")
                params.append(student_id)

            if join_date:
                updates.append("join_date = %s")
                params.append(join_date)

            if role:
                updates.append("role = %s")
                params.append(role)

            if end_date:
                updates.append("end_date = %s")
                params.append(end_date)

            query += ", ".join(updates) + " WHERE officer_id = %s"
            params.append(officer_id)

            cur.execute(query, tuple(params))
            connection.commit()
            
            return jsonify({"message": "Officer updated successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500
        
@officers_bp.route("/<int:officer_id>", methods=["GET"])
def getOfficer(officer_id):
    connection = connect()
    with connection.cursor() as cur:
        cur.execute("SELECT * FROM officers WHERE officer_id = %s", (officer_id,))
        result = cur.fetchone()
        return jsonify(result) if result else jsonify({"error": "Officer not found"}), 404
            