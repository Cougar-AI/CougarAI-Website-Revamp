from app.services.base_service import BaseService

TIER_ORDER = {"platinum": 0, "gold": 1, "silver": 2, "bronze": 3, "community": 4}
VALID_TIERS = set(TIER_ORDER.keys())


def _sponsor_row(r) -> dict:
    return {
        "sponsor_id": r["sponsor_id"],
        "name": r["name"],
        "logo_url": r["logo_url"],
        "website": r["website"],
        "tier": r["tier"],
        "description": r["description"],
        "contact_name": r["contact_name"],
        "contact_email": r["contact_email"],
        "is_active": r["is_active"],
        "start_date": r["start_date"].isoformat() if r["start_date"] else None,
        "end_date": r["end_date"].isoformat() if r["end_date"] else None,
        "display_order": r["display_order"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    }


class SponsorService(BaseService):
    def list_sponsors(self, active_only: bool = False) -> list:
        with self.cursor() as cur:
            cur.execute(
                "SELECT * FROM sponsors ORDER BY display_order ASC, name ASC"
            )
            rows = cur.fetchall()
        return [_sponsor_row(r) for r in rows]

    def create_sponsor(self, data: dict) -> tuple:
        name = data["name"]
        tier = data.get("tier", "community")
        with self.cursor() as cur:
            cur.execute("SELECT sponsor_id FROM sponsors WHERE name = %s", (name,))
            if cur.fetchone():
                return None, f"A sponsor named '{name}' already exists"

            cur.execute(
                """
                INSERT INTO sponsors
                  (name, logo_url, website, tier, description, contact_name, contact_email,
                   is_active, start_date, end_date, display_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING sponsor_id
                """,
                (
                    name,
                    data.get("logo_url") or None,
                    data.get("website") or None,
                    tier,
                    data.get("description") or None,
                    data.get("contact_name") or None,
                    data.get("contact_email") or None,
                    bool(data.get("is_active", True)),
                    data.get("start_date") or None,
                    data.get("end_date") or None,
                    int(data.get("display_order", 0)),
                ),
            )
            sponsor_id = cur.fetchone()["sponsor_id"]
            self.conn.commit()
        return sponsor_id, None

    def update_sponsor(self, sponsor_id: int, updates: list, params: list, new_name=None) -> tuple:
        if new_name:
            with self.cursor() as cur:
                cur.execute(
                    "SELECT sponsor_id FROM sponsors WHERE name = %s AND sponsor_id != %s",
                    (new_name, sponsor_id),
                )
                if cur.fetchone():
                    return False, f"A sponsor named '{new_name}' already exists"

        params_copy = list(params)
        params_copy.append(sponsor_id)
        with self.cursor() as cur:
            cur.execute(
                f"UPDATE sponsors SET {', '.join(updates)} WHERE sponsor_id = %s",
                params_copy,
            )
            if cur.rowcount == 0:
                return False, "Sponsor not found"
            self.conn.commit()
        return True, None

    def delete_sponsor(self, sponsor_id: int) -> bool:
        with self.cursor() as cur:
            cur.execute("DELETE FROM sponsors WHERE sponsor_id = %s", (sponsor_id,))
            if cur.rowcount == 0:
                return False
            self.conn.commit()
        return True
