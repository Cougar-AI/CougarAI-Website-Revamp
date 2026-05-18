from datetime import timezone, datetime

from app.services.base_service import BaseService


def _fund_row(r) -> dict:
    return {
        "fund_id": r["fund_id"],
        "name": r["name"],
        "description": r["description"],
        "budget_limit": float(r["budget_limit"]) if r["budget_limit"] is not None else None,
        "fiscal_year": r["fiscal_year"],
        "spent": float(r["spent"]),
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    }


def _receipt_row(r) -> dict:
    return {
        "receipt_id": r["receipt_id"],
        "title": r["title"],
        "vendor": r["vendor"],
        "amount": float(r["amount"]),
        "category": r["category"],
        "fund_id": r["fund_id"],
        "fund_name": r["fund_name"],
        "description": r["description"],
        "notes": r["notes"],
        "receipt_image_path": r["receipt_image_path"],
        "submitted_by": r["submitted_by"],
        "submitted_by_email": r["submitted_by_email"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
    }


class ReceiptService(BaseService):

    # ── Funds ──────────────────────────────────────────────────────────────

    def list_funds(self) -> list:
        with self.cursor() as cur:
            cur.execute("""
                SELECT f.fund_id, f.name, f.description, f.budget_limit, f.fiscal_year,
                       f.created_at,
                       COALESCE(SUM(r.amount), 0) AS spent
                FROM budget_funds f
                LEFT JOIN receipts r ON r.fund_id = f.fund_id
                GROUP BY f.fund_id
                ORDER BY f.fiscal_year DESC, f.name
            """)
            return [_fund_row(row) for row in cur.fetchall()]

    def create_fund(self, data: dict) -> tuple:
        with self.cursor() as cur:
            cur.execute(
                """INSERT INTO budget_funds (name, description, budget_limit, fiscal_year)
                   VALUES (%s, %s, %s, %s) RETURNING fund_id""",
                (
                    data["name"],
                    data.get("description"),
                    data.get("budget_limit"),
                    data.get("fiscal_year"),
                ),
            )
            fund_id = cur.fetchone()["fund_id"]
        self.conn.commit()
        return fund_id, None

    def update_fund(self, fund_id: int, updates: dict) -> tuple:
        set_clause = ", ".join(f"{k} = %s" for k in updates)
        with self.cursor() as cur:
            cur.execute(
                f"UPDATE budget_funds SET {set_clause} WHERE fund_id = %s",
                (*updates.values(), fund_id),
            )
            if cur.rowcount == 0:
                return False, "Fund not found"
        self.conn.commit()
        return True, None

    def delete_fund(self, fund_id: int) -> tuple:
        with self.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM receipts WHERE fund_id = %s", (fund_id,)
            )
            if cur.fetchone()["cnt"] > 0:
                return False, "Cannot delete fund with linked receipts"
            cur.execute("DELETE FROM budget_funds WHERE fund_id = %s", (fund_id,))
            if cur.rowcount == 0:
                return False, "Fund not found"
        self.conn.commit()
        return True, None

    # ── Receipts ───────────────────────────────────────────────────────────

    def list_receipts(
        self,
        page: int,
        per_page: int,
        category=None,
        fund_id=None,
        start_date=None,
        end_date=None,
        q: str = "",
    ) -> tuple:
        where_clauses = ["1=1"]
        params = []
        if category:
            where_clauses.append("r.category = %s")
            params.append(category)
        if fund_id is not None:
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

        with self.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) AS total FROM receipts r WHERE {where_sql}", params
            )
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
            receipts = [_receipt_row(row) for row in cur.fetchall()]

        return receipts, total

    def get_stats(self) -> dict:
        with self.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*), COALESCE(SUM(amount), 0) AS total FROM receipts"
            )
            row = cur.fetchone()
            count = int(row["count"])
            total_spent = float(row["total"])

            cur.execute(
                "SELECT COALESCE(SUM(amount), 0) AS month_total FROM receipts "
                "WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())"
            )
            month_total = float(cur.fetchone()["month_total"])

            cur.execute(
                "SELECT category, COALESCE(SUM(amount), 0) AS cat_total "
                "FROM receipts GROUP BY category ORDER BY cat_total DESC"
            )
            by_category = [
                {"category": r["category"] or "Uncategorized", "total": float(r["cat_total"])}
                for r in cur.fetchall()
            ]

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

            cur.execute(
                """SELECT f.fund_id, f.name, f.budget_limit, f.fiscal_year,
                          COALESCE(SUM(r.amount), 0) AS spent
                   FROM budget_funds f
                   LEFT JOIN receipts r ON r.fund_id = f.fund_id
                   GROUP BY f.fund_id ORDER BY f.fiscal_year DESC, f.name"""
            )
            by_fund = [
                {
                    "fund_id": r["fund_id"],
                    "name": r["name"],
                    "budget_limit": float(r["budget_limit"]) if r["budget_limit"] is not None else None,
                    "fiscal_year": r["fiscal_year"],
                    "spent": float(r["spent"]),
                }
                for r in cur.fetchall()
            ]

        return {
            "count": count,
            "total_spent": total_spent,
            "month_total": month_total,
            "by_category": by_category,
            "by_month": by_month,
            "by_fund": by_fund,
        }

    def create_receipt(self, user_id: int, data: dict) -> tuple:
        with self.cursor() as cur:
            cur.execute(
                """INSERT INTO receipts (title, vendor, amount, category, fund_id,
                          description, notes, receipt_image_path, submitted_by)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING receipt_id""",
                (
                    data["title"],
                    data.get("vendor"),
                    data["amount"],
                    data.get("category"),
                    data.get("fund_id"),
                    data.get("description"),
                    data.get("notes"),
                    data.get("receipt_image_path"),
                    user_id,
                ),
            )
            receipt_id = cur.fetchone()["receipt_id"]
        self.conn.commit()
        return receipt_id, None

    def update_receipt(self, receipt_id: int, updates: dict) -> tuple:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        set_clause = ", ".join(f"{k} = %s" for k in updates)
        with self.cursor() as cur:
            cur.execute(
                f"UPDATE receipts SET {set_clause} WHERE receipt_id = %s",
                (*updates.values(), receipt_id),
            )
            if cur.rowcount == 0:
                return False, "Receipt not found"
        self.conn.commit()
        return True, None

    def delete_receipt(self, receipt_id: int) -> tuple:
        with self.cursor() as cur:
            cur.execute(
                "SELECT receipt_image_path FROM receipts WHERE receipt_id = %s",
                (receipt_id,),
            )
            row = cur.fetchone()
            if not row:
                return False, "Receipt not found", None
            image_path = row["receipt_image_path"]
            cur.execute("DELETE FROM receipts WHERE receipt_id = %s", (receipt_id,))
        self.conn.commit()
        return True, None, image_path
