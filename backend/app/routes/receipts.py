from app.imports import *
from app.raw_db import connect
from flask import current_app
from flask_jwt_extended import jwt_required, get_jwt
from datetime import timezone
import os

receipts_bp = Blueprint("receipts", __name__)

_ADMIN_ROLES = {"admin"}

VALID_CATEGORIES = {"Food", "Supplies", "Software", "Equipment", "Travel", "Other"}


def _is_admin(claims):
    return claims.get("role") in _ADMIN_ROLES


def _require_admin():
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({"error": "Admin access required"}), 403
    return None


# ── Funds ──────────────────────────────────────────────────────────────────────

@receipts_bp.route("/funds", methods=["GET", "OPTIONS"])
@jwt_required()
def list_funds():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT f.fund_id, f.name, f.description, f.budget_limit, f.fiscal_year,
                       f.created_at,
                       COALESCE(SUM(r.amount), 0) AS spent
                FROM budget_funds f
                LEFT JOIN receipts r ON r.fund_id = f.fund_id
                GROUP BY f.fund_id
                ORDER BY f.fiscal_year DESC, f.name
            """)
            funds = []
            for row in cur.fetchall():
                funds.append({
                    "fund_id": row["fund_id"],
                    "name": row["name"],
                    "description": row["description"],
                    "budget_limit": float(row["budget_limit"]) if row["budget_limit"] is not None else None,
                    "fiscal_year": row["fiscal_year"],
                    "spent": float(row["spent"]),
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                })
        return jsonify({"funds": funds})
    finally:
        conn.close()


@receipts_bp.route("/funds", methods=["POST"])
@jwt_required()
def create_fund():
    err = _require_admin()
    if err:
        return err
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    budget_limit = data.get("budget_limit")
    fiscal_year = data.get("fiscal_year")
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO budget_funds (name, description, budget_limit, fiscal_year)
                   VALUES (%s, %s, %s, %s) RETURNING fund_id""",
                (name, data.get("description"), budget_limit, fiscal_year),
            )
            fund_id = cur.fetchone()["fund_id"]
        conn.commit()
        return jsonify({"fund_id": fund_id}), 201
    finally:
        conn.close()


@receipts_bp.route("/funds/<int:fund_id>", methods=["PATCH", "OPTIONS"])
@jwt_required()
def update_fund(fund_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err
    data = request.get_json() or {}
    allowed = ("name", "description", "budget_limit", "fiscal_year")
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE budget_funds SET {set_clause} WHERE fund_id = %s",
                (*updates.values(), fund_id),
            )
            if cur.rowcount == 0:
                return jsonify({"error": "Fund not found"}), 404
        conn.commit()
        return jsonify({"success": True})
    finally:
        conn.close()


@receipts_bp.route("/funds/<int:fund_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def delete_fund(fund_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS cnt FROM receipts WHERE fund_id = %s", (fund_id,))
            if cur.fetchone()["cnt"] > 0:
                return jsonify({"error": "Cannot delete fund with linked receipts"}), 409
            cur.execute("DELETE FROM budget_funds WHERE fund_id = %s", (fund_id,))
            if cur.rowcount == 0:
                return jsonify({"error": "Fund not found"}), 404
        conn.commit()
        return jsonify({"success": True})
    finally:
        conn.close()


# ── Receipts ───────────────────────────────────────────────────────────────────

@receipts_bp.route("/", methods=["GET", "OPTIONS"])
@jwt_required()
def list_receipts():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err

    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, int(request.args.get("per_page", 50)))
    category = request.args.get("category")
    fund_id = request.args.get("fund_id")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    q = request.args.get("q", "").strip()

    where_clauses = ["1=1"]
    params = []
    if category:
        where_clauses.append("r.category = %s")
        params.append(category)
    if fund_id:
        where_clauses.append("r.fund_id = %s")
        params.append(int(fund_id))
    if start_date:
        where_clauses.append("r.created_at >= %s")
        params.append(start_date)
    if end_date:
        where_clauses.append("r.created_at <= %s")
        params.append(end_date + " 23:59:59")
    if q:
        where_clauses.append("(r.title ILIKE %s OR r.vendor ILIKE %s)")
        params.extend([f"%{q}%", f"%{q}%"])

    where_sql = " AND ".join(where_clauses)
    offset = (page - 1) * per_page

    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS total FROM receipts r WHERE {where_sql}", params)
            total = cur.fetchone()["total"]

            cur.execute(
                f"""
                SELECT r.receipt_id, r.title, r.vendor, r.amount, r.category,
                       r.fund_id, f.name AS fund_name,
                       r.description, r.notes, r.receipt_image_path,
                       r.submitted_by, u.email AS submitted_by_email,
                       r.created_at, r.updated_at
                FROM receipts r
                LEFT JOIN budget_funds f ON f.fund_id = r.fund_id
                LEFT JOIN users u ON u.user_id = r.submitted_by
                WHERE {where_sql}
                ORDER BY r.created_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [per_page, offset],
            )
            receipts = []
            for row in cur.fetchall():
                receipts.append({
                    "receipt_id": row["receipt_id"],
                    "title": row["title"],
                    "vendor": row["vendor"],
                    "amount": float(row["amount"]),
                    "category": row["category"],
                    "fund_id": row["fund_id"],
                    "fund_name": row["fund_name"],
                    "description": row["description"],
                    "notes": row["notes"],
                    "receipt_image_path": row["receipt_image_path"],
                    "submitted_by": row["submitted_by"],
                    "submitted_by_email": row["submitted_by_email"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                })
        return jsonify({"receipts": receipts, "total": total, "page": page, "per_page": per_page})
    finally:
        conn.close()


@receipts_bp.route("/stats", methods=["GET", "OPTIONS"])
@jwt_required()
def receipt_stats():
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*), COALESCE(SUM(amount), 0) AS total FROM receipts")
            row = cur.fetchone()
            count = int(row["count"])
            total_spent = float(row["total"])

            # This month
            cur.execute(
                "SELECT COALESCE(SUM(amount), 0) AS month_total FROM receipts "
                "WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())"
            )
            month_total = float(cur.fetchone()["month_total"])

            # By category
            cur.execute(
                "SELECT category, COALESCE(SUM(amount), 0) AS cat_total "
                "FROM receipts GROUP BY category ORDER BY cat_total DESC"
            )
            by_category = [
                {"category": r["category"] or "Uncategorized", "total": float(r["cat_total"])}
                for r in cur.fetchall()
            ]

            # By month (last 12 months)
            cur.execute(
                """SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
                          COALESCE(SUM(amount), 0) AS month_total
                   FROM receipts
                   WHERE created_at >= NOW() - INTERVAL '12 months'
                   GROUP BY month ORDER BY month"""
            )
            by_month = [
                {"month": r["month"], "total": float(r["month_total"])}
                for r in cur.fetchall()
            ]

            # Per fund utilization
            cur.execute(
                """SELECT f.fund_id, f.name, f.budget_limit, f.fiscal_year,
                          COALESCE(SUM(r.amount), 0) AS spent
                   FROM budget_funds f
                   LEFT JOIN receipts r ON r.fund_id = f.fund_id
                   GROUP BY f.fund_id ORDER BY f.fiscal_year DESC, f.name"""
            )
            by_fund = []
            for r in cur.fetchall():
                by_fund.append({
                    "fund_id": r["fund_id"],
                    "name": r["name"],
                    "budget_limit": float(r["budget_limit"]) if r["budget_limit"] is not None else None,
                    "fiscal_year": r["fiscal_year"],
                    "spent": float(r["spent"]),
                })

        return jsonify({
            "count": count,
            "total_spent": total_spent,
            "month_total": month_total,
            "by_category": by_category,
            "by_month": by_month,
            "by_fund": by_fund,
        })
    finally:
        conn.close()


@receipts_bp.route("/", methods=["POST"])
@jwt_required()
def create_receipt():
    err = _require_admin()
    if err:
        return err
    from flask_jwt_extended import get_jwt_identity
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400
    amount = data.get("amount")
    if amount is None:
        return jsonify({"error": "amount is required"}), 400
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a number"}), 400

    category = data.get("category")
    if category and category not in VALID_CATEGORIES:
        return jsonify({"error": f"Invalid category. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}"}), 400

    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO receipts (title, vendor, amount, category, fund_id,
                          description, notes, receipt_image_path, submitted_by)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING receipt_id""",
                (
                    title,
                    data.get("vendor"),
                    amount,
                    category,
                    data.get("fund_id"),
                    data.get("description"),
                    data.get("notes"),
                    data.get("receipt_image_path"),
                    user_id,
                ),
            )
            receipt_id = cur.fetchone()["receipt_id"]
        conn.commit()
        return jsonify({"receipt_id": receipt_id}), 201
    finally:
        conn.close()


@receipts_bp.route("/<int:receipt_id>", methods=["PATCH", "OPTIONS"])
@jwt_required()
def update_receipt(receipt_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err
    data = request.get_json() or {}
    allowed = ("title", "vendor", "amount", "category", "fund_id", "description", "notes", "receipt_image_path")
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400
    if "category" in updates and updates["category"] and updates["category"] not in VALID_CATEGORIES:
        return jsonify({"error": "Invalid category"}), 400
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE receipts SET {set_clause} WHERE receipt_id = %s",
                (*updates.values(), receipt_id),
            )
            if cur.rowcount == 0:
                return jsonify({"error": "Receipt not found"}), 404
        conn.commit()
        return jsonify({"success": True})
    finally:
        conn.close()


@receipts_bp.route("/<int:receipt_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def delete_receipt(receipt_id):
    if request.method == "OPTIONS":
        return "", 200
    err = _require_admin()
    if err:
        return err
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT receipt_image_path FROM receipts WHERE receipt_id = %s", (receipt_id,))
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "Receipt not found"}), 404
            image_path = row["receipt_image_path"]
            cur.execute("DELETE FROM receipts WHERE receipt_id = %s", (receipt_id,))
        conn.commit()

        # Remove image file if present
        if image_path:
            uploads_dir = current_app.config.get("UPLOAD_FOLDER", "uploads")
            abs_path = os.path.join(uploads_dir, "receipts", os.path.basename(image_path))
            if os.path.isfile(abs_path):
                try:
                    os.remove(abs_path)
                except OSError:
                    pass

        return jsonify({"success": True})
    finally:
        conn.close()
