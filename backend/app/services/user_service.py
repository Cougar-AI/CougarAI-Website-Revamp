from __future__ import annotations

from app.services.base_service import BaseService


class UserService(BaseService):
    def get_stats(self) -> dict:
        with self.cursor() as cur:
            cur.execute("SELECT COUNT(*) as total FROM users")
            total_users = cur.fetchone()["total"]

            cur.execute(
                """
                SELECT COUNT(DISTINCT p.payment_id) as active
                FROM payments p
                WHERE p.expires_at >= CURRENT_DATE
                """
            )
            active_members = cur.fetchone()["active"]

            cur.execute(
                """
                SELECT COUNT(*) as count FROM users
                WHERE created_at >= NOW() - INTERVAL '7 days'
                """
            )
            new_signups_7d = cur.fetchone()["count"]

            cur.execute(
                """
                SELECT COUNT(*) as count FROM events
                WHERE DATE_TRUNC('month', starts_at) = DATE_TRUNC('month', CURRENT_DATE)
                """
            )
            events_this_month = cur.fetchone()["count"]

            cur.execute(
                "SELECT COUNT(*) as count FROM events WHERE starts_at > NOW()"
            )
            upcoming_events_count = cur.fetchone()["count"]

            cur.execute(
                """
                SELECT COALESCE(SUM(amount), 0) as revenue FROM payments
                WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
                """
            )
            revenue_this_month = float(cur.fetchone()["revenue"])

            cur.execute("SELECT COALESCE(SUM(points), 0) as total FROM points")
            total_points = int(cur.fetchone()["total"])

        return {
            "total_users": total_users,
            "active_members": active_members,
            "new_signups_7d": new_signups_7d,
            "events_this_month": events_this_month,
            "upcoming_events_count": upcoming_events_count,
            "revenue_this_month": revenue_this_month,
            "total_points_awarded": total_points,
        }

    def list_users(self, page: int, limit: int, search: str, role_filter, membership_filter) -> tuple:
        offset = (page - 1) * limit
        with self.cursor() as cur:
            conditions = []
            params: list = []

            if search:
                conditions.append(
                    "(u.email ILIKE %s OR p.first_name ILIKE %s OR p.last_name ILIKE %s)"
                )
            like = f"%{search}%" if search else None
            if search:
                params += [like, like, like]

            if role_filter:
                conditions.append("u.role = %s")
                params.append(role_filter)

            where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

            membership_join = """
                LEFT JOIN LATERAL (
                    SELECT MAX(expires_at) as expires_at
                    FROM payments pay
                    WHERE pay.student_id = p.student_id
                       OR pay.email = u.email
                ) mem ON TRUE
            """
            points_join = """
                LEFT JOIN LATERAL (
                    SELECT
                        COALESCE(SUM(pt.points), 0) as total_points,
                        COUNT(*) as events_attended
                    FROM points pt
                    WHERE pt.student_id = p.student_id
                ) pts ON TRUE
            """
            checkins_join = """
                LEFT JOIN LATERAL (
                    SELECT COUNT(*) as checkin_count
                    FROM event_checkins ec
                    WHERE ec.user_id = u.user_id
                ) chk ON TRUE
            """

            having_clause = ""
            if membership_filter == "active":
                having_clause = "AND mem.expires_at >= CURRENT_DATE"
            elif membership_filter == "expired":
                having_clause = "AND mem.expires_at < CURRENT_DATE AND mem.expires_at IS NOT NULL"
            elif membership_filter == "none":
                having_clause = "AND mem.expires_at IS NULL"

            count_params = list(params)
            cur.execute(
                f"""
                SELECT COUNT(*) as total
                FROM users u
                LEFT JOIN profile p ON p.user_id = u.user_id
                {membership_join}
                {where_clause}
                {"AND" if where_clause else "WHERE"} TRUE {having_clause}
                """,
                count_params,
            )
            total = cur.fetchone()["total"]

            cur.execute(
                f"""
                SELECT
                    u.user_id, u.email, u.role, u.is_active, u.created_at, u.last_login,
                    p.first_name, p.last_name, p.student_id, p.avatar_url,
                    mem.expires_at as membership_expires_at,
                    pts.total_points as points_total,
                    pts.events_attended,
                    chk.checkin_count,
                    CASE
                        WHEN mem.expires_at >= CURRENT_DATE THEN 'active'
                        WHEN mem.expires_at < CURRENT_DATE THEN 'expired'
                        ELSE 'none'
                    END as membership_status
                FROM users u
                LEFT JOIN profile p ON p.user_id = u.user_id
                {membership_join}
                {points_join}
                {checkins_join}
                {where_clause}
                {"AND" if where_clause else "WHERE"} TRUE {having_clause}
                ORDER BY u.created_at DESC
                LIMIT %s OFFSET %s
                """,
                count_params + [limit, offset],
            )
            rows = cur.fetchall()

        users = []
        for r in rows:
            users.append({
                "user_id": r["user_id"],
                "email": r["email"],
                "role": r["role"],
                "is_active": r["is_active"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "last_login": r["last_login"].isoformat() if r["last_login"] else None,
                "first_name": r["first_name"],
                "last_name": r["last_name"],
                "student_id": r["student_id"],
                "avatar_url": r["avatar_url"],
                "membership_expires_at": r["membership_expires_at"].isoformat() if r["membership_expires_at"] else None,
                "membership_status": r["membership_status"],
                "points_total": int(r["points_total"] or 0),
                "events_attended": int(r["events_attended"] or 0),
                "checkin_count": int(r["checkin_count"] or 0),
                "has_profile": r["student_id"] is not None,
            })

        return users, total

    def get_user_detail(self, user_id: int) -> dict | None:
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT u.user_id, u.email, u.role, u.is_active, u.created_at, u.last_login,
                       u.stripe_customer_id,
                       p.student_id, p.first_name, p.last_name, p.grade_level, p.major,
                       p.shirt_size, p.discord_id, p.avatar_url, p.is_public,
                       p.current_streak, p.max_streak
                FROM users u
                LEFT JOIN profile p ON p.user_id = u.user_id
                WHERE u.user_id = %s
                """,
                (user_id,),
            )
            user = cur.fetchone()
            if not user:
                return None

            cur.execute(
                """
                SELECT payment_id, date, amount, plan_id, expires_at, stripe_session_id,
                       COALESCE(is_manual, FALSE) as is_manual, note
                FROM payments
                WHERE student_id = %s OR email = (SELECT email FROM users WHERE user_id = %s)
                ORDER BY date DESC
                LIMIT 10
                """,
                (user["student_id"], user_id),
            )
            payments = cur.fetchall()

            cur.execute(
                "SELECT COALESCE(SUM(points), 0) as total, COUNT(*) as events FROM points WHERE student_id = %s",
                (user["student_id"],),
            )
            pts = cur.fetchone()

            cur.execute(
                "SELECT COUNT(*) as count FROM event_checkins WHERE user_id = %s",
                (user_id,),
            )
            checkin_count = cur.fetchone()["count"]

        def _iso(v):
            return v.isoformat() if v else None

        return {
            "user_id": user["user_id"],
            "email": user["email"],
            "role": user["role"],
            "is_active": user["is_active"],
            "created_at": _iso(user["created_at"]),
            "last_login": _iso(user["last_login"]),
            "stripe_customer_id": user["stripe_customer_id"],
            "profile": {
                "student_id": user["student_id"],
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "grade_level": user["grade_level"],
                "major": user["major"],
                "shirt_size": user["shirt_size"],
                "discord_id": user["discord_id"],
                "avatar_url": user["avatar_url"],
                "is_public": user["is_public"],
                "current_streak": user["current_streak"],
                "max_streak": user["max_streak"],
            } if user["student_id"] else None,
            "payments": [
                {
                    "payment_id": p["payment_id"],
                    "date": _iso(p["date"]),
                    "amount": float(p["amount"]) if p["amount"] else 0,
                    "plan_id": p["plan_id"],
                    "expires_at": _iso(p["expires_at"]),
                    "stripe_session_id": p["stripe_session_id"],
                    "is_manual": bool(p["is_manual"]),
                    "note": p["note"],
                }
                for p in payments
            ],
            "points_total": int(pts["total"]),
            "events_attended": int(pts["events"]),
            "checkin_count": checkin_count,
        }

    def update_user(self, user_id: int, updates: dict) -> bool:
        set_parts = list(updates.keys())
        params = list(updates.values())
        params.append(user_id)
        with self.cursor() as cur:
            cur.execute(
                f"UPDATE users SET {', '.join(f'{k} = %s' for k in set_parts)} WHERE user_id = %s",
                params,
            )
            if cur.rowcount == 0:
                return False
            self.conn.commit()
        return True

    def deactivate_user(self, user_id: int) -> dict | None:
        with self.cursor() as cur:
            cur.execute("SELECT role FROM users WHERE user_id = %s", (user_id,))
            target = cur.fetchone()
            if not target:
                return None
            cur.execute("UPDATE users SET is_active = FALSE WHERE user_id = %s", (user_id,))
            self.conn.commit()
        return target

    def grant_membership(self, user_id: int, expires_at: str, note) -> dict | None:
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT u.user_id, u.email, p.student_id
                FROM users u
                LEFT JOIN profile p ON p.user_id = u.user_id
                WHERE u.user_id = %s
                """,
                (user_id,),
            )
            user = cur.fetchone()
            if not user:
                return None

            cur.execute(
                """
                INSERT INTO payments (student_id, email, date, amount, plan_id, expires_at, is_manual, note)
                VALUES (%s, %s, CURRENT_DATE, 0, 'manual', %s, TRUE, %s)
                """,
                (user["student_id"], user["email"], expires_at, note),
            )

            cur.execute(
                """
                UPDATE users SET role = 'member'
                WHERE user_id = %s AND role IN ('non-member', 'member')
                """,
                (user_id,),
            )
            self.conn.commit()
        return user
