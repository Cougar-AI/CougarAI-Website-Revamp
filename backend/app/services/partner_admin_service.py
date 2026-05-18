from app.services.base_service import BaseService


def _partner_row(r) -> dict:
    return {
        "partner_id": r["partner_id"],
        "name": r["name"],
        "type": r["type"],
        "logo_url": r["logo_url"],
        "website": r["website"],
        "description": r["description"],
        "contact_name": r["contact_name"],
        "contact_email": r["contact_email"],
        "manager_user_id": r["manager_user_id"],
        "is_active": r["is_active"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        "member_count": r.get("member_count", 0),
    }


class PartnerAdminService(BaseService):
    def list_partners(self) -> list:
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT p.*, COUNT(pm.user_id) as member_count
                FROM partners p
                LEFT JOIN partner_members pm ON pm.partner_id = p.partner_id
                GROUP BY p.partner_id
                ORDER BY p.name ASC
                """
            )
            rows = cur.fetchall()
        return [_partner_row(r) for r in rows]

    def create_partner(self, data: dict) -> tuple:
        name = data["name"]
        ptype = data.get("type", "other")
        with self.cursor() as cur:
            cur.execute(
                """
                INSERT INTO partners
                  (name, type, logo_url, website, description, contact_name, contact_email,
                   manager_user_id, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING partner_id
                """,
                (
                    name,
                    ptype,
                    data.get("logo_url") or None,
                    data.get("website") or None,
                    data.get("description") or None,
                    data.get("contact_name") or None,
                    data.get("contact_email") or None,
                    data.get("manager_user_id") or None,
                    bool(data.get("is_active", True)),
                ),
            )
            partner_id = cur.fetchone()["partner_id"]
            self.conn.commit()
        return partner_id, None

    def update_partner(self, partner_id: int, updates: list, params: list) -> tuple:
        params_copy = list(params)
        params_copy.append(partner_id)
        with self.cursor() as cur:
            cur.execute(
                f"UPDATE partners SET {', '.join(updates)} WHERE partner_id = %s",
                params_copy,
            )
            if cur.rowcount == 0:
                return False, "Partner not found"
            self.conn.commit()
        return True, None

    def delete_partner(self, partner_id: int) -> bool:
        with self.cursor() as cur:
            cur.execute("DELETE FROM partners WHERE partner_id = %s", (partner_id,))
            if cur.rowcount == 0:
                return False
            self.conn.commit()
        return True

    def list_members(self, partner_id: int) -> tuple:
        with self.cursor() as cur:
            cur.execute("SELECT partner_id FROM partners WHERE partner_id = %s", (partner_id,))
            if not cur.fetchone():
                return None, "Partner not found"

            cur.execute(
                """
                SELECT pm.user_id, pm.partner_role, pm.joined_at,
                       u.email, p.first_name, p.last_name, p.avatar_url
                FROM partner_members pm
                JOIN users u ON u.user_id = pm.user_id
                LEFT JOIN profile p ON p.user_id = pm.user_id
                WHERE pm.partner_id = %s
                ORDER BY pm.joined_at ASC
                """,
                (partner_id,),
            )
            rows = cur.fetchall()

        members = [
            {
                "user_id": r["user_id"],
                "partner_role": r["partner_role"],
                "joined_at": r["joined_at"].isoformat() if r["joined_at"] else None,
                "email": r["email"],
                "first_name": r["first_name"],
                "last_name": r["last_name"],
                "avatar_url": r["avatar_url"],
            }
            for r in rows
        ]
        return members, None

    def add_member(self, partner_id: int, user_id: int, partner_role: str) -> tuple:
        with self.cursor() as cur:
            cur.execute("SELECT partner_id FROM partners WHERE partner_id = %s", (partner_id,))
            if not cur.fetchone():
                return False, "Partner not found"

            cur.execute("SELECT role FROM users WHERE user_id = %s", (user_id,))
            user_row = cur.fetchone()
            if not user_row:
                return False, "User not found"

            cur.execute(
                """
                INSERT INTO partner_members (partner_id, user_id, partner_role)
                VALUES (%s, %s, %s)
                ON CONFLICT (partner_id, user_id) DO UPDATE SET partner_role = EXCLUDED.partner_role
                """,
                (partner_id, user_id, partner_role),
            )

            if user_row["role"] in ("member", "non-member"):
                cur.execute("UPDATE users SET role = 'partner' WHERE user_id = %s", (user_id,))

            self.conn.commit()
        return True, None

    def remove_member(self, partner_id: int, user_id: int) -> tuple:
        with self.cursor() as cur:
            cur.execute(
                "DELETE FROM partner_members WHERE partner_id = %s AND user_id = %s",
                (partner_id, user_id),
            )
            if cur.rowcount == 0:
                return False, "Member not found in this partner"

            cur.execute(
                "SELECT COUNT(*) as cnt FROM partner_members WHERE user_id = %s",
                (user_id,),
            )
            remaining = cur.fetchone()["cnt"]
            if remaining == 0:
                cur.execute(
                    """
                    UPDATE users SET role = CASE
                        WHEN EXISTS (
                            SELECT 1 FROM payments pay
                            JOIN profile pr ON pay.student_id = pr.student_id
                            WHERE pr.user_id = %s AND pay.expires_at >= CURRENT_DATE
                        ) THEN 'member'
                        ELSE 'non-member'
                    END
                    WHERE user_id = %s AND role = 'partner'
                    """,
                    (user_id, user_id),
                )

            self.conn.commit()
        return True, None
