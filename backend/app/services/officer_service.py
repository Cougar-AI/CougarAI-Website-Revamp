import uuid
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
        valid_roles = {"officer", "admin"}
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT
                    o.student_id, o.role as officer_role, o.join_date, o.end_date,
                    o.position_id, o.photo_url, o.photo_object_position, o.linkedin_url,
                    op.title as position_title, op.department as position_department,
                    op.sort_order as position_sort_order,
                    lop.title as legacy_position_title, lop.department as legacy_position_department,
                    lop.sort_order as legacy_position_sort_order,
                    COALESCE(p.first_name, o.first_name) AS first_name,
                    COALESCE(p.last_name,  o.last_name)  AS last_name,
                    p.avatar_url,
                    u.user_id, u.email, u.role as user_role,
                    o.student_id LIKE 'officer\\_%' AS is_unlinked
                FROM officers o
                LEFT JOIN officer_positions op ON op.position_id = o.position_id
                LEFT JOIN officer_positions lop ON lop.title = o.role
                LEFT JOIN profile p ON p.student_id::text = o.student_id::text
                LEFT JOIN users u ON u.user_id = p.user_id
                ORDER BY o.join_date DESC
                """
            )
            rows = cur.fetchall()

        return [
            {
                "student_id": r["student_id"],
                "officer_role": (
                    r["officer_role"]
                    if r["officer_role"] in valid_roles
                    else (r["user_role"] if r["user_role"] in valid_roles else "officer")
                ),
                "join_date": r["join_date"].isoformat() if r["join_date"] else None,
                "end_date": r["end_date"].isoformat() if r["end_date"] else None,
                "position_id": r["position_id"],
                "position_title": (
                    r["position_title"]
                    or (r["legacy_position_title"] if r["officer_role"] not in valid_roles else None)
                    or (r["officer_role"] if r["officer_role"] not in valid_roles else None)
                ),
                "position_department": (
                    r["position_department"]
                    or (r["legacy_position_department"] if r["officer_role"] not in valid_roles else None)
                ),
                "position_sort_order": (
                    r["position_sort_order"]
                    if r["position_sort_order"] is not None
                    else (r["legacy_position_sort_order"] if r["officer_role"] not in valid_roles else None)
                ),
                "photo_url": r["photo_url"],
                "photo_object_position": r["photo_object_position"] or "50% 50%",
                "linkedin_url": r["linkedin_url"],
                "first_name": r["first_name"],
                "last_name": r["last_name"],
                "avatar_url": r["avatar_url"],
                "user_id": r["user_id"],
                "email": r["email"],
                "is_active": r["end_date"] is None or r["end_date"] >= date.today(),
                "is_unlinked": bool(r["is_unlinked"]),
            }
            for r in rows
        ]

    def get_officer_by_user_id(self, user_id: int):
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT o.student_id, o.photo_url, o.photo_object_position, o.linkedin_url,
                       o.end_date
                FROM officers o
                JOIN profile p ON p.student_id::text = o.student_id::text
                WHERE p.user_id = %s
                """,
                (user_id,),
            )
            row = cur.fetchone()
        if not row:
            return None
        return {
            "student_id": row["student_id"],
            "photo_url": row["photo_url"],
            "photo_object_position": row["photo_object_position"] or "50% 50%",
            "linkedin_url": row["linkedin_url"],
            "is_active": row["end_date"] is None or row["end_date"] >= date.today(),
        }

    def update_officer_appearance(
        self, student_id: str, photo_url, photo_object_position, linkedin_url
    ) -> tuple:
        with self.cursor() as cur:
            cur.execute("SELECT student_id FROM officers WHERE student_id = %s", (student_id,))
            if not cur.fetchone():
                return False, "Officer not found"
            cur.execute(
                """
                UPDATE officers
                SET photo_url = %s,
                    photo_object_position = %s,
                    linkedin_url = %s
                WHERE student_id = %s
                """,
                (photo_url, photo_object_position or "50% 50%", linkedin_url, student_id),
            )
            self.conn.commit()
        return True, None

    def list_active_officers_public(self) -> list:
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT
                    o.photo_url, o.photo_object_position, o.linkedin_url,
                    op.title as position_title, op.department as position_department,
                    op.sort_order as position_sort_order,
                    COALESCE(p.first_name, o.first_name) AS first_name,
                    COALESCE(p.last_name,  o.last_name)  AS last_name
                FROM officers o
                LEFT JOIN officer_positions op ON op.position_id = o.position_id
                LEFT JOIN profile p ON p.student_id::text = o.student_id::text
                WHERE o.end_date IS NULL OR o.end_date >= CURRENT_DATE
                ORDER BY op.sort_order ASC NULLS LAST, o.join_date ASC
                """
            )
            rows = cur.fetchall()
        return [
            {
                "first_name": r["first_name"],
                "last_name": r["last_name"],
                "photo_url": r["photo_url"],
                "photo_object_position": r["photo_object_position"] or "50% 50%",
                "linkedin_url": r["linkedin_url"],
                "position_title": r["position_title"],
                "position_department": r["position_department"],
                "position_sort_order": r["position_sort_order"],
            }
            for r in rows
            if r["first_name"] or r["last_name"]
        ]

    def create_position(self, title: str, department: str, sort_order: int) -> tuple:
        with self.cursor() as cur:
            try:
                cur.execute(
                    "INSERT INTO officer_positions (title, department, sort_order) VALUES (%s, %s, %s) RETURNING position_id",
                    (title, department, sort_order),
                )
                row = cur.fetchone()
                self.conn.commit()
            except Exception as e:
                self.conn.rollback()
                if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                    return None, f"A position with the title '{title}' already exists"
                return None, str(e)
        return row["position_id"], None

    def update_position(self, position_id: int, updates: dict) -> tuple:
        with self.cursor() as cur:
            cur.execute("SELECT position_id FROM officer_positions WHERE position_id = %s", (position_id,))
            if not cur.fetchone():
                return False, "Position not found"
            set_parts = list(updates.keys())
            params = list(updates.values())
            params.append(position_id)
            try:
                cur.execute(
                    f"UPDATE officer_positions SET {', '.join(f'{k} = %s' for k in set_parts)} WHERE position_id = %s",
                    params,
                )
                self.conn.commit()
            except Exception as e:
                self.conn.rollback()
                if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                    return False, f"A position with that title already exists"
                return False, str(e)
        return True, None

    def delete_position(self, position_id: int) -> tuple:
        with self.cursor() as cur:
            cur.execute("SELECT position_id FROM officer_positions WHERE position_id = %s", (position_id,))
            if not cur.fetchone():
                return False, "Position not found"
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM officers WHERE position_id = %s AND (end_date IS NULL OR end_date >= CURRENT_DATE)",
                (position_id,),
            )
            row = cur.fetchone()
            count = row["cnt"]
            if count > 0:
                return False, f"Position is in use by {count} officer(s)"
            cur.execute("DELETE FROM officer_positions WHERE position_id = %s", (position_id,))
            self.conn.commit()
        return True, None

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

    def add_officer_by_name(
        self,
        first_name: str,
        last_name: str,
        officer_role: str,
        join_date: date,
        position_id,
    ) -> tuple:
        placeholder_id = f"officer_{uuid.uuid4().hex[:12]}"
        with self.cursor() as cur:
            cur.execute(
                """
                INSERT INTO officers (student_id, first_name, last_name, role, join_date, position_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (placeholder_id, first_name, last_name, officer_role, join_date, position_id),
            )
            self.conn.commit()
        return placeholder_id, None

    def link_officer_account(self, student_id: str, user_id: int) -> tuple:
        with self.cursor() as cur:
            cur.execute("SELECT student_id, role FROM officers WHERE student_id = %s", (student_id,))
            officer = cur.fetchone()
            if not officer:
                return False, "Officer not found"

            cur.execute("SELECT student_id FROM profile WHERE user_id = %s", (user_id,))
            profile = cur.fetchone()
            if not profile or not profile["student_id"]:
                return False, "User has no linked student ID"

            real_student_id = profile["student_id"]

            cur.execute(
                "SELECT student_id FROM officers WHERE student_id = %s",
                (str(real_student_id),),
            )
            if cur.fetchone():
                return False, "This user is already an officer"

            cur.execute(
                "UPDATE officers SET student_id = %s WHERE student_id = %s",
                (str(real_student_id), student_id),
            )
            cur.execute(
                "UPDATE users SET role = %s WHERE user_id = %s",
                (officer["role"], user_id),
            )
            self.conn.commit()
        return True, None

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
