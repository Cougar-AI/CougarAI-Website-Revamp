from app.imports import *

officers_bp = Blueprint('officers', __name__)

@officers_bp.route("/", methods=["GET"])
def getOfficers():
    connection = connect()
    with connection.cursor() as cur:
        filter_dict = {
            "student_id": request.args.get("student_id"),
            "join_date": request.args.get("join_date"),
            "end_date": request.args.get("end_date"),
            "limit": request.args.get("limit", type=int),
            "offset": request.args.get("offset", type=int)
        }

        if "join_date" in filter_dict and filter_dict["join_date"] and not is_valid_date(filter_dict["join_date"]):
            return jsonify({"error": "Invalid join_date format"}), 400

        query, params = build_sql_querys("SELECT * FROM officers", filter_dict, date_column="join_date", order_by="join_date")

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results), 200) if results else (jsonify({"error": "No officers found"}), 404)
    
@officers_bp.route("/<string:student_id>", methods=["POST"])
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

            if filter_dict["join_date"] is None or filter_dict["role"] is None:
                return jsonify({"error": "student_id, join_date and role are required"}), 400
            
            if not is_valid_date(filter_dict["join_date"], fmt="%Y-%m-%d"):
                return jsonify({"error": "Invalid join_date format. Use YYYY-MM-DD"}), 400
            
            if filter_dict["end_date"] and not is_valid_date(filter_dict["end_date"], fmt="%Y-%m-%d"):
                return jsonify({"error": "Invalid end_date format. Use YYYY-MM-DD"}), 400

            # Remove None values from filter_dict before INSERT
            filter_dict = {k: v for k, v in filter_dict.items() if v is not None}
            
            query, params = build_sql_querys("INSERT INTO officers", filter_dict, date_column="join_date", mode="INSERT")
            query += " RETURNING student_id"

            cur.execute(query, tuple(params))
            result = cur.fetchone()

            if not result:
                return jsonify({"error": "Failed to add officer"}), 400
            connection.commit()
            return jsonify({"results": result}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@officers_bp.route("/<string:student_id>", methods=["DELETE"])
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
        
@officers_bp.route("/<string:student_id>", methods=["GET"])
def getOfficer(student_id):
    connection = connect()
    with connection.cursor() as cur:
        cur.execute("SELECT * FROM officers WHERE student_id = %s", (student_id,))
        result = cur.fetchone()
        return jsonify(result) if result else jsonify({"error": "Officer not found"}), 404
            
@officers_bp.route("/<string:student_id>", methods=["PATCH"])
def updateOfficer(student_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            filter_dict = {
                "student_id": student_id,
                "join_date": request.json.get("join_date"),
                "end_date": request.json.get("end_date"),
                "role": request.json.get("role")
            }

            if filter_dict["join_date"] and not is_valid_date(filter_dict["join_date"]):
                return jsonify({"error": "Invalid join_date format"}), 400
            
            if filter_dict["end_date"] and not is_valid_date(filter_dict["end_date"]):
                return jsonify({"error": "Invalid end_date format"}), 400

            query, params = build_sql_querys("UPDATE officers", filter_dict, mode="SET", )
            query += " WHERE student_id = %s"
            params.append(student_id)

            cur.execute(query, tuple(params))
            if cur.rowcount == 0:
                return jsonify({"error": "Officer not found"}), 404

            connection.commit()
            return jsonify({"message": "Officer updated successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500