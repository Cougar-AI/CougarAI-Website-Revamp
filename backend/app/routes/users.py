from flask import Blueprint, request, jsonify
from app.db import connect

users_bp = Blueprint('users', __name__)

@users_bp.route("/", methods=["GET"])
def getUsers():
    connection = connect()
    with connection.cursor() as cur:

        student_id = request.args.get("student_id", type=int)
        first_name = request.args.get("first_name")
        last_name = request.args.get("last_name")
        email = request.args.get("email")
        discord_id = request.args.get("discord_id")
        shirt_size = request.args.get("shirt_size")
        student_classification = request.args.get("student_classification")
        gender = request.args.get("gender")
        major = request.args.get("major")


        query = "SELECT * FROM users"
        filters = []
        params = []

        if student_id:
            filters.append("student_id = %s")
            params.append(student_id)

        if first_name:
            filters.append("first_name = %s")
            params.append(first_name)

        if last_name:
            filters.append("last_name = %s")
            params.append(last_name)

        if email:
            filters.append("email = %s")
            params.append(email)
        
        if discord_id:
            filters.append("discord_id = %s")
            params.append(discord_id)

        if shirt_size:
            filters.append("shirt_size = %s")
            params.append(shirt_size)

        if student_classification:
            filters.append("student_classification = %s")
            params.append(student_classification)

        if gender:
            filters.append("gender = %s")
            params.append(gender)

        if major:
            filters.append("major = %s")
            params.append(major)

        if filters:
            query += f" WHERE {' AND '.join(filters)}"
        
        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return jsonify(results) if results else jsonify({"error": "No users found"}), 404

        
@users_bp.route("/<int:student_id>", methods=["DELETE"])
def deleteUser(student_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            cur.execute(f"DELETE FROM users WHERE student_id = %s", (student_id,))
            connection.commit()
            return jsonify({"message": "User deleted successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500

@users_bp.route("/", methods=["POST"])
def addUser():
    try:
        connection = connect()
        with connection.cursor() as cur:
            student_id = request.json.get("student_id")
            first_name = request.json.get("first_name")
            last_name = request.json.get("last_name")
            email = request.json.get("email")
            discord_id = request.json.get("discord_id")
            shirt_size = request.json.get("shirt_size")
            major = request.json.get("major")
            gender = request.json.get("gender")
            join_source = request.json.get("join_source")
            phone_number = request.json.get("phone_number")
            student_classification = request.json.get("student_classification")

            if not all([first_name, last_name, email, student_id]):
                return jsonify({"error": "first_name, last_name, email and student_id are required"}), 400
            
            if not (shirt_size in ["XS", "S", "M", "L", "XL", "XXL"]):
                return jsonify({"error": "shirt_size must be one of the following: XS, S, M, L, XL, XXL"}), 400
            
            cur.execute("SELECT 1 FROM users WHERE student_id = %s", (student_id,))
            if cur.fetchone():
                return jsonify({"error": "Student ID already exists"}), 400

            cur.execute("INSERT INTO users (student_id, first_name, last_name, email, discord_id, shirt_size, gender, major, join_source, phone_number, student_classification) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING student_id", (student_id, first_name, last_name, email, discord_id, shirt_size, gender, major, join_source, phone_number, student_classification))
            connection.commit()
            user_id = cur.fetchone()[0]
            return jsonify({"student_id": user_id}), 201
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500

            