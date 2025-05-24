from flask import Blueprint, request, jsonify
from app.utils.query_handler import build_sql_querys
from app.db import connect

points_bp = Blueprint('points', __name__)
@points_bp.route("/", methods=["GET"])
def getPoints():
    connection = connect()
    with connection.cursor() as cur:

        filter_dict = {
            "points.point_id": request.args.get("point_id", type=int),
            "points.student_id": request.args.get("student_id", type=int),
            "start_date": request.args.get("start_date"),
            "end_date": request.args.get("end_date"),
        }
        query, params = build_sql_querys("SELECT * FROM points JOIN users ON points.student_id = users.student_id", filter_dict, date_column="points.date")
        query += " ORDER BY points.date DESC"

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return jsonify(results) if results else jsonify({"error": "No points found"}), 404
        
@points_bp.route("/<int:point_id>", methods=["DELETE"])
def deletePoints(point_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            cur.execute("DELETE FROM points WHERE point_id = %s", (point_id,))
            connection.commit()
            return jsonify({"message": "Point deleted successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": "Failed to delete point", "error": str(e)}), 500
    

@points_bp.route("/leaderboard", methods=["GET"])
def getLeaderboard():
    connection = connect()
    with connection.cursor() as cur:

        startDate = request.args.get("start_date")
        endDate = request.args.get("end_date")
        limit = request.args.get("limit", type=int)
        offset = request.args.get("offset", type=int)

        query = "SELECT users.student_id, SUM(points.points) as total_points, users.first_name, users.last_name FROM points JOIN users on users.student_id = points.student_id"
        params = []
        filters = []

        if (startDate and endDate):
            filters.append("points.date BETWEEN %s AND %s")
            params.extend([startDate, endDate])
        elif startDate:
            filters.append("points.date >= %s")
            params.append(startDate)
        elif endDate:
            filters.append("points.date <= %s")
            params.append(endDate)

        if filters:
            query += f" WHERE " + ' AND '.join(filters)
        query += " GROUP BY users.student_id, users.first_name, users.last_name ORDER BY total_points DESC"

        if limit is not None:
            query += " LIMIT %s"
            params.append(limit)

        if offset is not None:
            query += " OFFSET %s"
            params.append(offset)

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return jsonify(results) if results else jsonify({"error": "No points found"}), 404


@points_bp.route("/add", methods=["POST"])
def addPoints():
    try:
        connection = connect()
        with connection.cursor() as cur:
            student_id = request.json.get("student_id")
            points = request.json.get("points")

            if student_id is None or points is None:
                return jsonify({"error": "Student ID and points are required"}), 400
            
            cur.execute("SELECT 1 FROM users WHERE student_id = %s", (student_id,))
            if cur.fetchone() is None:
                return jsonify({"error": "Invalid student_id"}), 400


            cur.execute("INSERT INTO points(student_id, points) VALUES (%s, %s)", (student_id, points))
            connection.commit()
            return jsonify({"message": "Points added successfully"}), 201
    except Exception as e:
        connection.rollback()
        return jsonify({"error": "Failed to add points", "error": str(e)}), 500
        
    
@points_bp.route("/<int:point_id>", methods=["PUT"]) # updates 
def updatePoints(point_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            points = request.json.get("points")
            if points is None:
                return jsonify({"error": "Point ID and points are required"}), 400
            
            cur.execute("SELECT 1 FROM points WHERE point_id = %s", (point_id,))
            if cur.fetchone() is None:
                return jsonify({"error": "Invalid point_id"}), 400

            cur.execute("UPDATE points SET points = %s WHERE point_id = %s", (points, point_id))
            connection.commit()
            return jsonify({"message": "Points updated successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": "Failed to update points", "error": str(e)}), 500
    
@points_bp.route("/student", methods=["GET"])
def getStudentPoints():
    connection = connect()
    with connection.cursor() as cur:

        filter_dict = {
            "points.student_id": request.args.get("student_id", type=int),
            "start_date": request.args.get("start_date"),
            "end_date": request.args.get("end_date"),
            "limit": request.args.get("limit", type=int),
            "offset": request.args.get("offset", type=int)
        }


        if filter_dict["points.student_id"] is None:
            return jsonify({"error": "No student id provided"}), 400
        
        query, params = build_sql_querys("SELECT * FROM points JOIN users ON points.student_id = users.student_id", filter_dict, date_column="points.date")
        
        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return jsonify(results) if results else jsonify({"error": "No points found"}), 404
    
@points_bp.route("/total", methods=["GET"])
def getTotalPoints():
    connection = connect()
    with connection.cursor() as cur:
        student_id = request.args.get("student_id", type=int)
        startDate = request.args.get("start_date")
        endDate = request.args.get("end_date")

        filter_dict = {
            "points.student_id": request.args.get("student_id", type=int),
            "start_date": request.args.get("start_date"),
            "end_date": request.args.get("end_date"),
        }

        query_base = "SELECT SUM(points.points) as total_points FROM points"

        if student_id is not None:
            query_base += " JOIN users ON points.student_id = users.student_id"

        query, params = build_sql_querys(query_base, filter_dict, date_column="points.date")

        cur.execute(query, tuple(params))
        result = cur.fetchone()

        return jsonify(result) if result else jsonify({"error": "No points found"}), 404
    

@points_bp.route("/<int:point_id>", methods=["GET"])
def getPointById(point_id):
    connection = connect()
    with connection.cursor() as cur:
        cur.execute("SELECT * FROM points WHERE point_id = %s", (point_id,))
        result = cur.fetchone()
        return jsonify(result) if result else jsonify({"error": "Point not found"}), 404
    
@points_bp.route("/total/by-month", methods=["GET"])
def getMonthlyTotals():
    connection = connect()
    with connection.cursor() as cur:
        student_id = request.args.get("student_id", type=int)
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

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
        return jsonify(results) if results else jsonify({"error": "No point totals found"}), 404

    

