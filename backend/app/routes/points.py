from flask import Blueprint, request, jsonify
from backend.app.db import connect

points_bp = Blueprint('points', __name__)
@points_bp.route("/", methods=["GET"])
def getPoints():
    connection = connect()
    with connection.cursor() as cur:
        point_id = request.args.get("point_id", type=int)
        student_id = request.args.get("student_id", type=int)
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        limit = request.args.get("limit", type=int)
        offset = request.args.get("offset", type=int)

        query = "SELECT * FROM points"
        filters = []
        params = []

        if point_id: 
            filters.append("point_id = %s")
            params.append(point_id)
        
        if student_id:
            filters.append("student_id = %s")
            params.append(student_id)

        if start_date and end_date:
            filters.append("date BETWEEN %s AND %s")
            params.extend([start_date, end_date])
        elif start_date:
            filters.append("date >= %s")
            params.append(start_date)
        elif end_date:
            filters.append("date <= %s")
            params.append(end_date)

        if filters:
            query += f" WHERE {' AND '.join(filters)}"

        query += " ORDER BY date DESC"

        if limit is not None:
            query += " LIMIT %s"
            params.append(limit)

        if offset is not None:
            query += " OFFSET %s"
            params.append(offset)

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return jsonify(results) if results else jsonify({"error": "No points found"}), 404
        
@points_bp.route("/", methods=["DELETE"])
def deletePoints():
    connection = connect()
    with connection.cursor() as cur:
        point_id = request.args.get("point_id", type=int)
        if point_id is None:
            return jsonify({"error": "No point id provided"}), 400
        cur.execute("DELETE FROM points WHERE point_id = %s", (point_id,))
        connection.commit()
        return jsonify({"message": "Point deleted successfully"}), 200
    

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
    connection = connect()
    with connection.cursor() as cur:
        student_id = request.json.get("student_id")
        points = request.json.get("points")

        if student_id is None or points is None:
            return jsonify({"error": "Student ID and points are required"}), 400
        cur.execute("INSERT INTO points(student_id, points) VALUES (%s, %s)", (student_id, points))
        connection.commit()
        return jsonify({"message": "Points added successfully"}), 201
    
@points_bp.route("/updates", methods=["PUT"])
def updatePoints():
    connection = connect()
    with connection.cursor() as cur:
        point_id = request.json.get("point_id")
        points = request.json.get("points")
        if point_id is None or points is None:
            return jsonify({"error": "Point ID and points are required"}), 400
        cur.execute("UPDATE points SET points = %s WHERE point_id = %s", (points, point_id))
        connection.commit()
        return jsonify({"message": "Points updated successfully"}), 200
    
@points_bp.route("/student", methods=["GET"])
def getStudentPoints():
    connection = connect()
    with connection.cursor() as cur:
        student_id = request.args.get("student_id", type=int)
        startDate = request.args.get("start_date")
        endDate = request.args.get("end_date")
        limit = request.args.get("limit", type=int)
        offset = request.args.get("offset", type=int)

        if student_id is None:
            return jsonify({"error": "No student id provided"}), 400
        
        query = "SELECT * FROM points JOIN users ON points.student_id = users.student_id"
        filters = ["points.student_id = %s"]
        params = [student_id]

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
            query += f" WHERE {' AND '.join(filters)}"
        
        if limit is not None:
            query += " LIMIT %s"
            params.append(limit)

        if offset is not None:
            query += " OFFSET %s"
            params.append(offset)

        query += " ORDER BY points.date DESC LIMIT %s OFFSET %s"

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return jsonify(results) if results else jsonify({"error": "No points found"}), 404
