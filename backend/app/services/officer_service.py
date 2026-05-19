from datetime import date
from app.services.base_service import BaseService


class OfficerService(BaseService):
    def list_positions(self) -> list:
        with self.cursor() as cur:
            cur.execute(
                "SELECT position_id, title, department, sort_order "
                "FROM officer_positions ORDER BY sort_order ASC, title ASC"
            )
            rows = cur.fetchall()

        return [
            {
                "position_id": r["position_id"],
                "title": r["title"],
                "department": r["department"],
                "sort_order": r["sort_order"],
            }
            for r in rows
        ]

    def list_officers(self) -> list:
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT
                    o.student_id, o.role as officer_role, o.join_date, o.end_date,
                    o.position_id,
                    op.title as position_title, op.department as position_department,
                    p.first_name, p.last_name, p.avatar_url,
                    u.user_id, u.email, u.role as user_role
                FROM officers o
                LEFT JOIN officer_positions op ON op.position_id = o.position_id
                LEFT JOIN profile p ON p.student_id::text = o.student_id::text
                LEFT JOIN users u ON u.user_id = p.user_id
                ORDER BY o.join_date DESC
                """
            )
            rows = cur.fetchall()

        return [
            {
                "student_id": r["student_id"],
                "officer_role": r["officer_role"],
                "join_date": r["join_date"].isoformat() if r["join_date"] else None,
                "end_date": r["end_date"].isoformat() if r["end_date"] else None,
                "position_id": r["position_id"],
                "position_title": r["position_title"],
                "position_department": r["position_department"],
                "first_name": r["first_name"],
                "last_name": r["last_name"],
                "avatar_url": r["avatar_url"],
                "user_id": r["user_id"],
                "email": r["email"],
                "is_active": r["end_date"] is None or r["end_date"] >= date.today(),
            }
            for r in rows
        ]

    def add_officer(self, user_id: int, officer_role: str, join_date: date, position_id) -> tuple:
        with self.cursor() as cur:
            cur.execute(
                "SELECT student_id FROM profile WHERE user_id = %s",
                (user_id,),
            )
            profile = cur.fetchone()
            if not profile or not profile["student_id"]:
                return None, "User has no linked profile/student_id"

            student_id = profile["student_id"]

            cur.execute(
                """
                INSERT INTO officers (student_id, role, join_date, position_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (student_id) DO UPDATE
                    SET role = EXCLUDED.role, join_date = EXCLUDED.join_date,
                        end_date = NULL, position_id = EXCLUDED.position_id
                """,
                (student_id, officer_role, join_date, position_id),
            )

            cur.execute(
                "UPDATE users SET role = %s WHERE user_id = %s",
                (officer_role, user_id),
            )
            self.conn.commit()

        return student_id, None

    def update_officer(self, student_id: str, updates: dict, new_role=None) -> tuple:
        with self.cursor() as cur:
            cur.execute("SELECT student_id FROM officers WHERE student_id = %s", (student_id,))
            if not cur.fetchone():
                return False, "Officer not found"

            set_parts = list(updates.keys())
            params = list(updates.values())
            params.append(student_id)

            cur.execute(
                f"UPDATE officers SET {', '.join(f'{k} = %s' for k in set_parts)} WHERE student_id = %s",
                params,
            )

            if new_role:
                cur.execute(
                    "UPDATE users SET role = %s WHERE user_id = (SELECT user_id FROM profile WHERE student_id = %s)",
                    (new_role, student_id),
                )

            self.conn.commit()
        return True, None

    def remove_officer(self, student_id: str, hard: bool = False) -> bool:
        with self.cursor() as cur:
            cur.execute("SELECT student_id FROM officers WHERE student_id = %s", (student_id,))
            if not cur.fetchone():
                return False

            if hard:
                cur.execute("DELETE FROM officers WHERE student_id = %s", (student_id,))
            else:
                today = date.today()
                cur.execute(
                    "UPDATE officers SET end_date = %s WHERE student_id = %s",
                    (today, student_id),
                )

            cur.execute(
                """
                UPDATE users SET role = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM payments pay
                        JOIN profile p ON pay.student_id = p.student_id
                        WHERE p.student_id = %s AND pay.expires_at >= CURRENT_DATE
                    ) THEN 'member'
                    ELSE 'non-member'
                END
                WHERE user_id = (SELECT user_id FROM profile WHERE student_id = %s)
                """,
                (student_id, student_id),
            )
            self.conn.commit()
        return True
