from Flask import Blueprint, request, jsonify
from app.db import connect

points_bp = Blueprint('points', __name__)
@points_bp.route("/", methods=["GET"])
def getPoints():
    connection = connect()
    with connection.cursor() as cur:
        point_id = request.args.get("point_id", type=int)
        student_id = request.args.get("student_id", type=int)
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

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

        if filters:
            query += f" WHERE {' AND '.join(filters)}"

        cur.execute(query, tuple(params))
        results = cur.fetchall()

        return jsonify(results) if results else jsonify({"error": "No points found"}), 404
        
@points_bp.route("/", methods=["DELETE"])
def deletePoints():
    connection = connect()
    with connection.cursor() as cur:
        point_id = request.args.get("point_id", type=int)
        if not point_id:
            return jsonify({"error": "No point id provided"}), 400
        cur.execute("DELETE FROM points WHERE point_id = %s", (point_id,))
        connection.commit()
        return jsonify({"message": "Point deleted successfully"}), 200
    

@points_bp.route("/leaderboard", methods=["GET"])
def getLeaderboard():
    connection = connect()
    with connection.cursor() as cur:
        cur.execute("SELECT student_id, sum(points) as total_points FROM points GROUP BY student_id ORDER by total_points DESC")
        results = cur.fetchall()
        return jsonify(results) if results else jsonify({"error": "No points found"}), 404
