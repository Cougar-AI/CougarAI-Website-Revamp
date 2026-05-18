import json
from datetime import date

from app.services.base_service import BaseService


class DashboardService(BaseService):
    # -----------------------------------------------------------------------
    # GET /dashboard/me
    # -----------------------------------------------------------------------

    def get_me(self, user_id: int) -> dict | None:
        """Return the full payload for /dashboard/me, or None if user not found."""
        with self.cursor() as cur:
            # Core user row
            cur.execute(
                """
                SELECT user_id, email, role, created_at, onboarding_completed_at
                FROM users WHERE user_id = %s
                """,
                (user_id,),
            )
            user = cur.fetchone()
            if not user:
                return None

            # Linked profile row
            cur.execute(
                """
                SELECT student_id, first_name, last_name, grade_level, major,
                       shirt_size, discord_id, avatar_url, is_public, preferred_email,
                       notification_settings, current_streak, max_streak, last_event_month
                FROM profile WHERE user_id = %s
                """,
                (user_id,),
            )
            profile = cur.fetchone()

            # Membership status (latest active payment)
            cur.execute(
                """
                SELECT plan_id, expires_at
                FROM payments
                WHERE (student_id = (SELECT student_id FROM profile WHERE user_id = %s)
                       OR email = (SELECT email FROM users WHERE user_id = %s))
                  AND expires_at IS NOT NULL
                ORDER BY expires_at DESC LIMIT 1
                """,
                (user_id, user_id),
            )
            membership_row = cur.fetchone()

            # Points summary
            student_id = profile["student_id"] if profile else None
            total_points = 0
            rank = None
            total_members = 0

            if student_id:
                cur.execute("SELECT SUM(points) FROM points WHERE student_id = %s", (student_id,))
                row = cur.fetchone()
                total_points = int(row["sum"] or 0)

                cur.execute(
                    """
                    SELECT COUNT(*) + 1 as rank
                    FROM (
                        SELECT student_id, SUM(points) as pts
                        FROM points GROUP BY student_id
                    ) sub
                    WHERE sub.pts > %s
                    """,
                    (total_points,),
                )
                rank = cur.fetchone()["rank"]

                cur.execute("SELECT COUNT(*) FROM profile")
                total_members = cur.fetchone()["count"]

        today = date.today()
        membership_status = "none"
        membership_data = None
        if membership_row:
            expires = membership_row["expires_at"]
            membership_status = "active" if expires and expires >= today else "expired"
            membership_data = {
                "status": membership_status,
                "expires_at": expires.isoformat() if expires else None,
                "plan_id": membership_row["plan_id"],
            }

        notif = None
        if profile and profile.get("notification_settings"):
            raw = profile["notification_settings"]
            notif = raw if isinstance(raw, dict) else json.loads(raw)

        return {
            "user_id": user["user_id"],
            "email": user["email"],
            "role": user.get("role", "member"),
            "created_at": user["created_at"].isoformat() if user.get("created_at") else None,
            "onboarding_completed": user.get("onboarding_completed_at") is not None,
            "has_profile": profile is not None,
            "profile": {
                "student_id": profile["student_id"] if profile else None,
                "first_name": profile["first_name"] if profile else None,
                "last_name": profile["last_name"] if profile else None,
                "preferred_email": profile["preferred_email"] if profile else None,
                "avatar_url": profile["avatar_url"] if profile else None,
                "is_public": profile["is_public"] if profile else True,
                "grade_level": profile["grade_level"] if profile else None,
                "major": profile["major"] if profile else None,
                "shirt_size": profile["shirt_size"] if profile else None,
                "discord_id": profile["discord_id"] if profile else None,
                "notification_settings": notif or {
                    "email_events": True,
                    "email_newsletter": True,
                    "email_announcements": True,
                },
                "current_streak": profile["current_streak"] if profile else 0,
                "max_streak": profile["max_streak"] if profile else 0,
            } if profile else None,
            "membership": membership_data,
            "points_summary": {
                "total": total_points,
                "rank": rank,
                "total_members": total_members,
            },
        }

    # -----------------------------------------------------------------------
    # PATCH /dashboard/profile
    # -----------------------------------------------------------------------

    def update_profile(self, user_id: int, updates: dict) -> tuple[bool, str | None]:
        """
        Apply allowed field updates to the profile row for user_id.
        Returns (True, None) on success, (False, error_message) on failure.
        """
        if not updates:
            return False, "No valid fields provided"

        with self.cursor() as cur:
            cur.execute("SELECT student_id FROM profile WHERE user_id = %s", (user_id,))
            profile = cur.fetchone()
            if not profile:
                return False, "No profile linked to this account"

            if "notification_settings" in updates and isinstance(updates["notification_settings"], dict):
                updates["notification_settings"] = json.dumps(updates["notification_settings"])

            set_clause = ", ".join(f"{k} = %s" for k in updates)
            values = list(updates.values()) + [user_id]
            cur.execute(f"UPDATE profile SET {set_clause} WHERE user_id = %s", values)
            self.conn.commit()

        return True, None

    # -----------------------------------------------------------------------
    # POST /dashboard/profile/link
    # -----------------------------------------------------------------------

    def link_profile(self, user_id: int, student_id: str) -> tuple[bool, str | None, int]:
        """
        Link or create a profile row for user_id with the given student_id.
        Returns (success, error_message, http_status_code).
        """
        with self.cursor() as cur:
            cur.execute("SELECT user_id FROM profile WHERE student_id = %s", (student_id,))
            existing = cur.fetchone()

            if existing and existing["user_id"] and existing["user_id"] != user_id:
                return False, "This student ID is already linked to another account", 409

            if existing:
                cur.execute("UPDATE profile SET user_id = %s WHERE student_id = %s", (user_id, student_id))
            else:
                cur.execute(
                    "INSERT INTO profile (student_id, user_id) VALUES (%s, %s)",
                    (student_id, user_id),
                )
            self.conn.commit()

        return True, None, 200

    # -----------------------------------------------------------------------
    # GET /dashboard/memberships
    # -----------------------------------------------------------------------

    def get_memberships(self, user_id: int) -> dict:
        """Return {"current": ..., "history": [...]} for user_id."""
        with self.cursor() as cur:
            cur.execute("SELECT email FROM users WHERE user_id = %s", (user_id,))
            user = cur.fetchone()
            cur.execute("SELECT student_id FROM profile WHERE user_id = %s", (user_id,))
            profile = cur.fetchone()

            cur.execute(
                """
                SELECT payment_id, date, amount, plan_id, stripe_session_id, expires_at
                FROM payments
                WHERE student_id = %s OR email = %s
                ORDER BY date DESC
                """,
                (profile["student_id"] if profile else None, user["email"] if user else None),
            )
            payments = cur.fetchall()

        today = date.today()
        history = []
        current_membership = None

        for p in payments:
            expires = p.get("expires_at")
            row = {
                "payment_id": p["payment_id"],
                "date": p["date"].isoformat() if p.get("date") else None,
                "amount": float(p["amount"]) if p.get("amount") else None,
                "plan_id": p.get("plan_id"),
                "stripe_session_id": (p.get("stripe_session_id") or "")[:20] + "..."
                if p.get("stripe_session_id")
                else None,
                "expires_at": expires.isoformat() if expires else None,
                "status": "active" if expires and expires >= today else "expired",
            }
            history.append(row)
            if not current_membership and expires and expires >= today:
                current_membership = row

        return {"current": current_membership, "history": history}

    # -----------------------------------------------------------------------
    # GET /dashboard/points
    # -----------------------------------------------------------------------

    def get_points(self, user_id: int, limit: int = 20, offset: int = 0) -> dict:
        """Return {"total": ..., "rank": ..., "items": [...]} for user_id."""
        with self.cursor() as cur:
            cur.execute("SELECT student_id FROM profile WHERE user_id = %s", (user_id,))
            profile = cur.fetchone()
            if not profile:
                return {"total": 0, "rank": None, "items": []}

            student_id = profile["student_id"]

            cur.execute(
                """
                SELECT p.points_id, p.points, p.date,
                       e.name as event_name, e.event_type
                FROM points p
                LEFT JOIN events e ON p.event_id = e.event_id
                WHERE p.student_id = %s
                ORDER BY p.date DESC
                LIMIT %s OFFSET %s
                """,
                (student_id, limit, offset),
            )
            items = cur.fetchall()

            cur.execute("SELECT SUM(points) FROM points WHERE student_id = %s", (student_id,))
            total = int(cur.fetchone()["sum"] or 0)

            cur.execute(
                """
                SELECT COUNT(*) + 1 as rank
                FROM (SELECT student_id, SUM(points) as pts FROM points GROUP BY student_id) sub
                WHERE sub.pts > %s
                """,
                (total,),
            )
            rank = cur.fetchone()["rank"]

        return {
            "total": total,
            "rank": rank,
            "items": [
                {
                    "points_id": r["points_id"],
                    "points": r["points"],
                    "date": r["date"].isoformat() if r.get("date") else None,
                    "event_name": r.get("event_name"),
                    "event_type": r.get("event_type"),
                }
                for r in items
            ],
        }
