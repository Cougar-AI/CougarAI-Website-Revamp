from app.imports import *

users_bp = Blueprint('users', __name__)

@users_bp.route("/", methods=["GET"])
def getUsers():
    connection = connect()
    with connection.cursor() as cur:

        filter_dict = {
            "student_id": request.args.get("student_id", type=int),
            "first_name": request.args.get("first_name"),
            "last_name": request.args.get("last_name"),
            "email": request.args.get("email"),
            "discord_id": request.args.get("discord_id"),
            "shirt_size": request.args.get("shirt_size", type=int),
            "student_classification": request.args.get("student_classification", type=int),
            "gender": request.args.get("gender", type=int),
            "major": request.args.get("major"),
        }


        query, params = build_sql_querys("SELECT * FROM users", filter_dict)
        
        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results), 200) if results else (jsonify({"error": "No users found"}), 404)

        
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

            if not all([first_name, last_name, student_id]):
                return jsonify({"error": "first_name, last_name, and student_id are required"}), 400
            
            if shirt_size and (shirt_size >= 6 or shirt_size < 0):
                return jsonify({"error": "shirt_size must be one of the following: XS, S, M, L, XL, XXL"}), 400
            
            cur.execute("SELECT 1 FROM users WHERE student_id = %s", (student_id,))
            if cur.fetchone():
                return jsonify({"error": "Student ID already exists"}), 400

            cur.execute("INSERT INTO users (student_id, first_name, last_name, email, discord_id, shirt_size, gender, major, join_source, phone_number, student_classification) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING student_id", (student_id, first_name, last_name, email, discord_id, shirt_size, gender, major, join_source, phone_number, student_classification))
            user_id = cur.fetchone()[0]
            connection.commit()
            return jsonify({"student_id": user_id}), 201
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500

            