from flask import Blueprint, request, jsonify 
from app.db import connect 

payment_bp = Blueprint('payment', __name__)

@payment_bp.route("/", methods=["GET"])
def getPayments():
    connections = connect()
    with connections.cursor() as cur:

        payment_id = request.args.get("payment_id", type=int)
        student_id = request.args.get("student_id", type=int)
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        
        if payment_id:
            cur.execute(f"SELECT * FROM payments WHERE payment_id = %s", (payment_id,))
            results = cur.fetchone()
            return jsonify(results) if results else jsonify({"error": "No payment found"}), 404
        elif student_id:

            query = f"SELECT * FROm payments WHERE student_id = %s"
            params = [student_id]

            if start_date and end_date:
                query += " AND date BETWEEN %s AND %s"
                params.extend([start_date, end_date])

            cur.execute(query, tuple(params))
            results = cur.fetchall()
            return jsonify(results) if results else jsonify({"error": "No payment found"}), 404
        elif start_date and end_date:
            cur.execute(f"SELECT * FROM payments WHERE date BETWEEN %s AND %s", (start_date, end_date))
            results = cur.fetchall()
            return jsonify(results) if results else jsonify({"error": "No payment found"}), 404
        else:
            cur.execute(f"SELECT * FROM payments")
            results = cur.fetchall()
            return jsonify(results) if results else jsonify({"error": "No payments found"}), 404

@payment_bp.route("/", methods=["DELETE"])
def deletePayment():
    connection = connect()
    with connection.cursor() as cur:
        payment_id = request.args.get("payment_id", type=int)
        if not payment_id:
            return jsonify({"error": "No payment id provided"}), 400

        cur.execute(f"DELETE FROM payments WHERE payment_id = %s", (payment_id,))
        connection.commit()
        return jsonify({"message": "Payment deleted successfully"}), 200

