from app.imports import *
import traceback  # at the top


points_bp = Blueprint('points', __name__)
@points_bp.route("/", methods=["GET"])
def getPoints():
    connection = connect()
    with connection.cursor() as cur:

        filter_dict = {
            "points.points_id": request.args.get("points_id", type=int),
            "points.student_id": request.args.get("student_id", type=int),
            "points.event_id": request.args.get("event_id", type=int),
            "points.date": request.args.get("date"),
            "points.points": request.args.get("points", type=int),
            "start_date": request.args.get("start_date"),
            "end_date": request.args.get("end_date"),
            "limit": request.args.get("limit", type=int),
            "offset": request.args.get("offset", type=int)
        }
        query, params = build_sql_querys("SELECT * FROM points JOIN users ON points.student_id = users.student_id", filter_dict, date_column="points.date")
        query += " ORDER BY points.date DESC"

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results), 200) if results else (jsonify({"error": "No points found"}), 404)
        
@points_bp.route("/<int:points_id>", methods=["DELETE"])
def deletePoints(points_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            cur.execute("DELETE FROM points WHERE points_id = %s", (points_id,))
            connection.commit()
            return jsonify({"message": "Point deleted successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": "Failed to delete point", "error": str(e)}), 500
    

@points_bp.route("/leaderboard", methods=["GET"])
def getLeaderboard():
    connection = connect()
    with connection.cursor() as cur:

        filter_dict = {
            "date": request.args.get("date"),
            "event_id": request.args.get("event_id", type=int),
            "start_date": request.args.get("start_date"),
            "end_date": request.args.get("end_date"),
            "limit": request.args.get("limit", type=int),
            "offset": request.args.get("offset", type=int)
        }

        query, params = build_sql_querys("SELECT users.student_id, SUM(points.points) as total_points, users.first_name, users.last_name FROM points JOIN users on users.student_id = points.student_id", filter_dict, date_column="points.date")
        query += " GROUP BY users.student_id, users.first_name, users.last_name ORDER BY total_points DESC"

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results), 200) if results else (jsonify({"error": "No points found"}), 404)


@points_bp.route("/add/<int:student_id>", methods=["POST"])
def addPoints(student_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            
            filter_dict = {
                "student_id": student_id,
                "points": request.json.get("points"),
                "date": request.json.get("date"),
                "event_id": request.json.get("event_id")
            }

            if filter_dict["points"] is None:
                return jsonify({"error": "points are required"}), 400
            else:
                try:
                    filter_dict["points"] = int(filter_dict["points"])
                except ValueError:
                    return jsonify({"error": "Points must be an integer"}), 400
            
            if filter_dict["date"] and not is_valid_date(filter_dict["date"]):
                return jsonify({"error": "Invalid date format. "}), 400

            cur.execute("SELECT 1 FROM users WHERE student_id = %s", (student_id,))
            if cur.fetchone() is None:
                return jsonify({"error": "Invalid student_id"}), 400

            query, params = build_sql_querys("INSERT INTO points", filter_dict, date_column="date", mode="INSERT")
            cur.execute(query, tuple(params))

            connection.commit()
            return jsonify({"message": "Points added successfully"}), 201
    except Exception as e:
        connection.rollback()
        return jsonify({"error": "Failed to add points", "details": str(e)}), 500
        
    
@points_bp.route("/<int:points_id>", methods=["PATCH"])
def updatePoints(points_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            filter_dict = { 
                "student_id": request.json.get("student_id"),
                "points": request.json.get("points"),
                "date": request.json.get("date"),
                "event_id": request.json.get("event_id")
            }

            query, params = build_sql_querys("UPDATE points", filter_dict, mode="SET")
            query += " WHERE points_id = %s"
            params.append(points_id)
            cur.execute(query, tuple(params))
            if cur.rowcount == 0:
                return jsonify({"error": "No points found for the given points_id"}), 404
            connection.commit()
            return jsonify({"message": "Points updated successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": "Failed to update points", "details": str(e)}), 500
    

    
@points_bp.route("/student/<int:student_id>", methods=["GET"])
def getStudentPoints(student_id):
    try:
        connection = connect()
        with connection.cursor() as cur:

            filter_dict = {
                "points.student_id": student_id,
                "start_date": request.args.get("start_date"),
                "end_date": request.args.get("end_date"),
                "limit": request.args.get("limit", type=int),
                "offset": request.args.get("offset", type=int)
            }

            query, params = build_sql_querys("SELECT * FROM points JOIN users ON points.student_id = users.student_id", filter_dict, date_column="points.date")
            
            cur.execute(query, tuple(params))
            results = cur.fetchall()
            return (jsonify(results), 200) if results else (jsonify({"error": "No points found"}), 404)
    except Exception as e:
        return jsonify({"error": "Failed to retrieve points", "details": str(e)}), 500
    
@points_bp.route("/total", methods=["GET"])
def getTotalPoints():
    try:
        connection = connect()
        with connection.cursor() as cur:
            filter_dict = {
                "points.student_id": request.args.get("student_id", type=int),
                "start_date": request.args.get("start_date"),
                "end_date": request.args.get("end_date"),
            }

            if filter_dict["points.student_id"] is not None:
                query_base = (
                    "SELECT users.first_name, users.last_name, points.student_id, "
                    "SUM(points.points) as total_points FROM points "
                    "JOIN users on points.student_id = users.student_id "
                )
            else:
                query_base = "SELECT SUM(points.points) as total_points FROM points "

            query, params = build_sql_querys(query_base, filter_dict, date_column="points.date")

            if filter_dict["points.student_id"] is not None:
                query += " GROUP BY users.first_name, users.last_name, points.student_id"

            cur.execute(query, tuple(params))
            result = cur.fetchone()
            print("Result:", result)

            if result is None or ("total_points" in result and result["total_points"] is None):
                return jsonify({"error": "No points found"}), 404

            if filter_dict["points.student_id"] is not None:
                result_dict = {
                    "first_name": result["first_name"],
                    "last_name": result["last_name"],
                    "student_id": result["student_id"],
                    "total_points": result["total_points"],
                }
            else:
                result_dict = {"total_points": result["total_points"]}

            return jsonify(result_dict)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to retrieve total points"}), 500
    finally:
        connection.close()

    

@points_bp.route("/<int:points_id>", methods=["GET"])
def getPointById(points_id):
    connection = connect()
    with connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur: # converts from a tuple to dict used in the jsonify
        cur.execute("SELECT * FROM points WHERE points_id = %s", (points_id,))
        result = cur.fetchone()
        return jsonify(result) if result else jsonify({"error": "Point not found"}), 404
    
@points_bp.route("/total/by-month", methods=["GET"])
def getMonthlyTotals():
    connection = connect()
    with connection.cursor() as cur:

        filter_dict = {
            "student_id": request.args.get("student_id", type=int),
            "start_date": request.args.get("start_date"),
            "end_date": request.args.get("end_date"),
        }

        base_query = """
            SELECT
                DATE_TRUNC('month', date) AS month,
                SUM(points) AS total_points
            FROM points
        """


        query, params = build_sql_querys(base_query, filter_dict, date_column="date")
        query += " GROUP BY month ORDER BY month DESC"

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results)) if results else (jsonify({"error": "No point totals found"}), 404)

    

