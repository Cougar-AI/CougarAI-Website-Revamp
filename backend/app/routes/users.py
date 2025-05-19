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
    connection = connect()
    with connection.cursor() as cur:
        cur.execute(f"DELETE FROM users WHERE student_id = %s", (student_id,))
        connection.commit()
        return jsonify({"message": "User deleted successfully"}), 200
            