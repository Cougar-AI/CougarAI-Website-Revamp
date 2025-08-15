from app.imports import *

profile_bp = Blueprint('profile', __name__)

@profile_bp.route("/", methods=["GET"])
def getProfile():
    connection = connect()
    with connection.cursor() as cur:

        filter_dict = {
            "user_id": request.args.get("user_id", type=int),
            "student_id": request.args.get("student_id"),
            "first_name": request.args.get("first_name"),
            "last_name": request.args.get("last_name"),
            "discord_id": request.args.get("discord_id"),
            "shirt_size": request.args.get("shirt_size"),
            "grade_level": request.args.get("grade_level"),
            "gender": request.args.get("gender", type=int),
            "join_source": request.args.get("join_source"),
            "phone": request.args.get("phone"),
        }

        query, params = build_sql_querys("SELECT * FROM profile", filter_dict, mode="SET")
        
        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results), 200) if results else (jsonify({"error": "No profile found"}), 404)


@profile_bp.route("/<int:student_id>", methods=["DELETE"])
def deleteProfile(student_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            cur.execute(f"DELETE FROM profile WHERE student_id = %s", (student_id,))
            connection.commit()
            return jsonify({"message": "Profile deleted successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500

@profile_bp.route("/", methods=["POST"])
def addProfile():
    try:
        connection = connect()
        with connection.cursor() as cur:
            student_id = request.json.get("student_id")
            first_name = request.json.get("first_name")
            last_name = request.json.get("last_name")
            discord_id = request.json.get("discord_id")
            shirt_size = request.json.get("shirt_size")
            major = request.json.get("major")
            gender = request.json.get("gender")
            join_source = request.json.get("join_source")
            phone = request.json.get("phone")
            grade_level = request.json.get("grade_level")

            if not all([first_name, last_name, student_id]):
                return jsonify({"error": "first_name, last_name, and student_id are required"}), 400
            
            allowed_sizes = {"XS", "S", "M", "L", "XL", "XXL"}
            if shirt_size and shirt_size not in allowed_sizes:
                return jsonify({"error": f"shirt_size must be one of: {', '.join(sorted(allowed_sizes))}"}), 400

            allowed_grades = {"freshman", "sophomore", "junior", "senior", "graduate", "alumni", "other"}
            if grade_level and grade_level not in allowed_grades:
                return jsonify({"error": f"grade_level must be one of: {', '.join(sorted(allowed_grades))}"}), 400

            cur.execute("SELECT 1 FROM profile WHERE student_id = %s", (student_id,))
            if cur.fetchone():
                return jsonify({"error": "Student ID already exists"}), 400

            cur.execute("INSERT INTO profile (student_id, first_name, last_name, discord_id, shirt_size, gender, join_source, phone, grade_level, major) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING student_id", (student_id, first_name, last_name, discord_id, shirt_size, gender, join_source, phone, grade_level, major))
            profile_id = cur.fetchone()[0]
            connection.commit()
            return jsonify({"student_id": profile_id}), 201
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500
    
@profile_bp.route("/<string:student_id>", methods=["PATCH"])
def updateProfile(student_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            filter_dict = {
                "first_name": request.json.get("first_name"),
                "last_name": request.json.get("last_name"),
                "discord_id": request.json.get("discord_id"),
                "shirt_size": request.json.get("shirt_size"),
                "gender": request.json.get("gender"),
                "join_source": request.json.get("join_source"),
                "phone": request.json.get("phone"),
                "grade_level": request.json.get("grade_level"),
                "major": request.json.get("major"),
            }

            query, params = build_sql_querys("UPDATE profile", filter_dict, mode="SET")
            query += " WHERE student_id = %s"
            params.append(student_id)

            cur.execute(query, tuple(params))
            if cur.rowcount == 0:
                return jsonify({"error": f"Student ID {student_id} not found"}), 404

            connection.commit()
            return jsonify({"message": "Profile updated successfully"}), 200

    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500

