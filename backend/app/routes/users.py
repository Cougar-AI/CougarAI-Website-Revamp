from flask import Blueprint, request, jsonify
from app.db import connect

users_bp = Blueprint('users', __name__)

@users_bp.route("/", methods=["GET"])
def getUsers():
    connection = connect()
    with connection.cursor() as cur:

        student_id = request.args.get("student_id", type=int)

        if student_id:
            cur.execute(f"SELECT * FROM users WHERE student_id = %s", (student_id,))
            results = cur.fetchone()
            return jsonify(results) if results else jsonify({"error": "No user found"}), 404
        else:
            cur.execute(f'SELECT * FROM users')
            results = cur.fetchall()
            return jsonify(results) if results else jsonify({"error": "No users found"}), 404

        
@user_dp.route("/<int:student_id>", methods=["DELETE"])
def deleteUser(student_id):
    connection = connect()
    with connection.cursor() as cur:
        cur.execute(f"DELETE FROM users WHERE student_id = %s", (student_id,))
        connection.commit()
        return jsonify({"message": "User deleted successfully"}), 200
            