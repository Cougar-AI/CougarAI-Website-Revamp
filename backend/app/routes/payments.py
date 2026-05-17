from flask import Blueprint, request, jsonify
from app.utils.query_handler import build_sql_querys
from app.utils.date_validation import is_valid_date
from app.raw_db import connect
from flask_jwt_extended import jwt_required, get_jwt

payments_bp = Blueprint('payments', __name__)

_ADMIN_ROLES = {"admin"}

def _require_admin():
    claims = get_jwt()
    if claims.get("role") not in _ADMIN_ROLES:
        return jsonify({"error": "Admin access required"}), 403
    return None

@payments_bp.route("/", methods=["GET"])
@jwt_required()
def getPayments():
    err = _require_admin()
    if err: return err
    connections = connect()
    with connections.cursor() as cur:

        filter_dict = { 
            "payment_id": request.args.get("payment_id", type=int),
            "student_id": request.args.get("student_id", type=int),
            "start_date": request.args.get("start_date"),
            "end_date": request.args.get("end_date"),
        }

        query, params = build_sql_querys("SELECT * FROM payments", filter_dict, date_column="date")
        
        cur.execute(query, tuple(params))
        results = cur.fetchall()
        return (jsonify(results), 200) if results else (jsonify({"error": "No payments found"}), 404)


@payments_bp.route("/<int:payment_id>", methods=["DELETE"])
@jwt_required()
def deletePayment(payment_id):
    err = _require_admin()
    if err: return err
    try:
        connections = connect()
        with connections.cursor() as cur:
            cur.execute("DELETE FROM payments WHERE payment_id = %s", (payment_id,))

            if cur.rowcount == 0:
                return jsonify({"error": "Payment not found"}), 404
            connections.commit()
            return jsonify({"message": "Payment deleted successfully"}), 200
    except Exception as e:
        connections.rollback()
        return jsonify({"error": str(e)}), 500
    
@payments_bp.route("/<int:student_id>", methods=["POST"])
@jwt_required()
def createPayment(student_id):
    err = _require_admin()
    if err: return err
    try:
        connections = connect()
        with connections.cursor() as cur:
            date = request.json.get("date")
            amount = request.json.get("amount")

            if amount is None:
                return jsonify({"error": "Amount is required to be specified"}), 400
            else:
                try:
                    amount = float(amount)
                except (ValueError, TypeError):
                    return jsonify({"error": "Amount must be a valid number"}), 400

            if date and not is_valid_date(date):
                return jsonify({"error": "Invalid date format"}), 400

            cur.execute("SELECT 1 FROM payments WHERE student_id = %s AND date >= CURRENT_DATE - INTERVAL '3 months'", (student_id,))
            if cur.fetchone():
                return jsonify({"error": "Payment already exists for this student in the last semester (3 months)"}), 400
            cur.execute("INSERT INTO payments (student_id, date, amount) VALUES (%s, %s, %s) RETURNING *", (student_id, date, amount))
            result = cur.fetchone()
            connections.commit()
            return jsonify({"message": "Payment created successfully", "payment": result}), 201
    except Exception as e:
        connections.rollback()
        return jsonify({"error": str(e)}), 500
    

