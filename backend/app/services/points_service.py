from app.services.base_service import BaseService


class PointsService(BaseService):
    def get_summary(self) -> dict:
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(SUM(points), 0) as total
                FROM points
                WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
                """
            )
            total_this_month = int(cur.fetchone()["total"])

            cur.execute(
                """
                SELECT
                    u.user_id,
                    p.student_id,
                    pr.first_name,
                    pr.last_name,
                    u.email,
                    SUM(p.points) as total
                FROM points p
                LEFT JOIN profile pr ON pr.student_id = p.student_id
                LEFT JOIN users u ON u.user_id = pr.user_id
                GROUP BY u.user_id, p.student_id, pr.first_name, pr.last_name, u.email
                ORDER BY total DESC
                LIMIT 5
                """
            )
            top_earners = [
                {
                    "user_id": r["user_id"],
                    "student_id": r["student_id"],
                    "name": (
                        f'{(r["first_name"] or "").strip()} {(r["last_name"] or "").strip()}'.strip()
                        or r["email"]
                        or r["student_id"]
                    ),
                    "first_name": r["first_name"],
                    "last_name": r["last_name"],
                    "user_email": r["email"],
                    "total": int(r["total"]),
                }
                for r in cur.fetchall()
            ]

        return {
            "total_this_month": total_this_month,
            "top_earners": top_earners,
        }

    def list_points(self, page: int, limit: int, user_id=None) -> tuple:
        offset = (page - 1) * limit
        with self.cursor() as cur:
            cond = ""
            params: list = []
            if user_id:
                cond = "WHERE p.student_id = (SELECT student_id FROM profile WHERE user_id = %s)"
                params.append(user_id)

            cur.execute(
                f"""
                SELECT COUNT(*) as total FROM points p {cond}
                """,
                params,
            )
            total = cur.fetchone()["total"]

            cur.execute(
                f"""
                SELECT p.points_id, p.student_id, p.event_id, p.date, p.points,
                       COALESCE(p.reason, '') as reason,
                       p.officer_user_id,
                       pr.user_id,
                       pr.first_name, pr.last_name,
                       u.email as user_email,
                       ou.email as officer_email
                FROM points p
                LEFT JOIN profile pr ON pr.student_id = p.student_id
                LEFT JOIN users u ON u.user_id = pr.user_id
                LEFT JOIN users ou ON ou.user_id = p.officer_user_id
                {cond}
                ORDER BY p.date DESC, p.points_id DESC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            rows = cur.fetchall()

        records = [
            {
                "points_id": r["points_id"],
                "user_id": r["user_id"],
                "student_id": r["student_id"],
                "event_id": r["event_id"],
                "date": r["date"].isoformat() if r["date"] else None,
                "points": r["points"],
                "reason": r["reason"],
                "officer_email": r["officer_email"],
                "user_email": r["user_email"],
                "first_name": r["first_name"],
                "last_name": r["last_name"],
                "user_name": (
                    f'{(r["first_name"] or "").strip()} {(r["last_name"] or "").strip()}'.strip()
                    or r["user_email"]
                    or r["student_id"]
                ),
            }
            for r in rows
        ]
        return records, total

    def award_points(self, user_id: int, points: int, reason: str, event_id, officer_user_id: int) -> tuple:
        with self.cursor() as cur:
            cur.execute("SELECT student_id FROM profile WHERE user_id = %s", (user_id,))
            profile = cur.fetchone()
            if not profile or not profile["student_id"]:
                return None, "User has no linked profile/student_id"

            student_id = profile["student_id"]

            cur.execute(
                """
                INSERT INTO points (student_id, event_id, date, points, reason, officer_user_id)
                VALUES (%s, %s, CURRENT_DATE, %s, %s, %s)
                RETURNING points_id
                """,
                (student_id, event_id, points, reason, officer_user_id),
            )
            points_id = cur.fetchone()["points_id"]
            self.conn.commit()
        return points_id, None
