from app.services.base_service import BaseService
from app.utils.query_handler import build_sql_querys


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
                SELECT p.student_id, pr.first_name, pr.last_name, SUM(p.points) as total
                FROM points p
                LEFT JOIN profile pr ON pr.student_id = p.student_id
                GROUP BY p.student_id, pr.first_name, pr.last_name
                ORDER BY total DESC
                LIMIT 5
                """
            )
            top_earners = [
                {
                    "student_id": r["student_id"],
                    "first_name": r["first_name"],
                    "last_name": r["last_name"],
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
                       pr.first_name, pr.last_name,
                       ou.email as officer_email
                FROM points p
                LEFT JOIN profile pr ON pr.student_id = p.student_id
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
                "student_id": r["student_id"],
                "event_id": r["event_id"],
                "date": r["date"].isoformat() if r["date"] else None,
                "points": r["points"],
                "reason": r["reason"],
                "officer_email": r["officer_email"],
                "first_name": r["first_name"],
                "last_name": r["last_name"],
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

    def get_leaderboard(self, caller_user_id, start_date, end_date, limit, offset):
        date_filter = ""
        date_params = []
        if start_date:
            date_filter += " AND points.date >= %s"
            date_params.append(start_date)
        if end_date:
            date_filter += " AND points.date <= %s"
            date_params.append(end_date)

        with self.cursor() as cur:
            # Public leaderboard — only is_public profiles
            cur.execute(
                f"""
                SELECT profile.student_id,
                       profile.first_name,
                       profile.last_name,
                       profile.avatar_url,
                       profile.current_streak,
                       profile.max_streak,
                       SUM(points.points) AS total_points
                FROM points
                JOIN profile ON profile.student_id = points.student_id
                WHERE profile.is_public = TRUE {date_filter}
                GROUP BY profile.student_id, profile.first_name, profile.last_name,
                         profile.avatar_url, profile.current_streak, profile.max_streak
                ORDER BY total_points DESC
                LIMIT %s OFFSET %s
                """,
                tuple(date_params + [limit, offset]),
            )
            results = cur.fetchall()

            # Caller's own rank (always returned, even if private)
            my_rank = None
            my_total = None
            if caller_user_id:
                cur.execute(
                    "SELECT student_id FROM profile WHERE user_id = %s", (caller_user_id,)
                )
                profile_row = cur.fetchone()
                if profile_row:
                    sid = profile_row["student_id"]
                    cur.execute(
                        f"""
                        SELECT SUM(points) AS total FROM points
                        WHERE student_id = %s {date_filter}
                        """,
                        tuple([sid] + date_params),
                    )
                    total_row = cur.fetchone()
                    my_total = int(total_row["total"] or 0) if total_row else 0

                    inner_where = ("WHERE" + date_filter.lstrip(" AND")) if date_filter else ""
                    cur.execute(
                        f"""
                        SELECT COUNT(*) + 1 AS rank FROM (
                            SELECT student_id, SUM(points) AS pts
                            FROM points {inner_where}
                            GROUP BY student_id
                        ) sub WHERE sub.pts > %s
                        """,
                        tuple(date_params + [my_total]),
                    )
                    rank_row = cur.fetchone()
                    my_rank = rank_row["rank"] if rank_row else None

        return {"entries": results, "caller_rank": my_rank, "caller_total": my_total}

    def get_monthly_totals(self, student_id, start_date, end_date):
        filter_dict = {
            "student_id": student_id,
            "start_date": start_date,
            "end_date": end_date,
        }

        base_query = """
            SELECT
                DATE_TRUNC('month', date) AS month,
                SUM(points) AS total_points
            FROM points
        """

        query, params = build_sql_querys(base_query, filter_dict, date_column="date")
        query += " GROUP BY month ORDER BY month DESC"

        with self.cursor() as cur:
            cur.execute(query, tuple(params))
            results = cur.fetchall()
        return results or []

    def get_streak_leaderboard(self, limit=100):
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT first_name, last_name, current_streak, max_streak,
                       student_id
                FROM profile
                WHERE is_public = TRUE
                ORDER BY current_streak DESC, max_streak DESC
                LIMIT %s
                """,
                (limit,),
            )
            results = cur.fetchall()
        return results or []
