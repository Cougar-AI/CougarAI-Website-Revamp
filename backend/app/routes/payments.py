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
            query += " WHERE "+ ' AND '.join(filters)

        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return jsonify(results) if results else jsonify({"error": "No payments found"}), 404


@payments_bp.route("/<int:payment_id>", methods=["DELETE"])
def deletePayment(payment_id):
    try:
        connections = connect()
        with connections.cursor() as cur:
            if cur.rowcount == 0:
                return jsonify({"error": "Payment not found"}), 404
            cur.execute("DELETE FROM payments WHERE payment_id = %s", (payment_id,))
            connections.commit()
            return jsonify({"message": "Payment deleted successfully"}), 200
    except Exception as e:
        connections.rollback()
        return jsonify({"error": str(e)}), 500
    
@payments_bp.route("/<int:student_id>", methods=["POST"])
def createPayment(student_id):
    try:
        connections = connect()
        with connections.cursor() as cur:
            date = request.json.get("date")
            amount = request.json.get("amount")

            if amount is None:
                return jsonify({"error": "Amount is required to be specified"}), 400

            cur.execute("SELECT 1 FROM payments WHERE student_id = %s AND date >= CURRENT_DATE - INTERVAL '3 months'", (student_id,))
            if cur.fetchone():
                return jsonify({"error": "Payment already exists for this student in the last semester (3 months)"}), 400
            cur.execute("INSERT INTO payments (student_id, date, amount) VALUES (%s, %s, %s) RETURNING *", (student_id, date, amount))
            connections.commit()
            return jsonify({"message": "Payment created successfully", "payment": cur.fetchone()}), 201
    except Exception as e:
        connections.rollback()
        return jsonify({"error": str(e)}), 500
    

