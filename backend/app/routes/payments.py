from flask import Blueprint, request, jsonify 
from app.db import connect 

payments_bp = Blueprint('payments', __name__)

@payments_bp.route("/", methods=["GET"])
def getPayments():
    connections = connect()
    with connections.cursor() as cur:

        payment_id = request.args.get("payment_id", type=int)
        student_id = request.args.get("student_id", type=int)
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        
        query = "SELECT * FROM payments"
        filters = []
        params = []

        if payment_id:
            filters.append("payment_id = %s")
            params.append(payment_id)

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
        return jsonify(results) if results else jsonify({"error": "No payments found"}), 404


@payments_bp.route("/<int:payment_id>", methods=["DELETE"])
def deletePayment(payment_id):
    try:
        connection = connect()
        with connection.cursor() as cur:
            cur.execute(f"DELETE FROM payments WHERE payment_id = %s", (payment_id,))
            connection.commit()
            return jsonify({"message": "Payment deleted successfully"}), 200
    except Exception as e:
        connection.rollback()
        return jsonify({"error": str(e)}), 500

