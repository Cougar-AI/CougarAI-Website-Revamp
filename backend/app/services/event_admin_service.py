from __future__ import annotations

import string
import secrets
from app.services.base_service import BaseService


_EVENT_TYPE_CANONICAL_NAMES = {
    "hackathon": "Hackathons",
    "hackathons": "Hackathons",
    "other": "Other",
    "social": "Socials",
    "socials": "Socials",
    "workshop": "Workshops",
    "workshops": "Workshops",
}


def _gen_checkin_code(length: int = 12) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def normalize_event_type_name(name: str) -> str:
    cleaned = " ".join((name or "").strip().split())
    if not cleaned:
        return ""
    return _EVENT_TYPE_CANONICAL_NAMES.get(cleaned.lower(), cleaned)


def event_type_dedupe_key(name: str) -> str:
    return normalize_event_type_name(name).lower()


def _event_type_choice_score(type_id: int, raw_name: str, is_active: bool) -> tuple[int, int, int]:
    normalized_name = normalize_event_type_name(raw_name)
    # Prefer rows already using the canonical display label, then active rows,
    # then the older record for stable IDs.
    return (
        int(raw_name == normalized_name),
        int(bool(is_active)),
        -int(type_id),
    )


class EventAdminService(BaseService):
    def get_attendance(self, event_id: int) -> dict | None:
        with self.cursor() as cur:
            cur.execute("SELECT name, capacity, starts_at FROM events WHERE event_id = %s", (event_id,))
            event = cur.fetchone()
            if not event:
                return None

            cur.execute(
                """
                SELECT
                    ec.checkin_id, ec.checked_in_at,
                    ec.student_id, ec.user_id,
                    p.first_name, p.last_name, p.avatar_url,
                    pt.points
                FROM event_checkins ec
                LEFT JOIN profile p ON p.student_id = ec.student_id
                LEFT JOIN points pt ON pt.student_id = ec.student_id AND pt.event_id = ec.event_id
                WHERE ec.event_id = %s
                ORDER BY ec.checked_in_at ASC
                """,
                (event_id,),
            )
            rows = cur.fetchall()

        attendees = [
            {
                "checkin_id": r["checkin_id"],
                "checked_in_at": r["checked_in_at"].isoformat() if r["checked_in_at"] else None,
                "student_id": r["student_id"],
                "user_id": r["user_id"],
                "first_name": r["first_name"],
                "last_name": r["last_name"],
                "avatar_url": r["avatar_url"],
                "points": r["points"],
            }
            for r in rows
        ]

        return {
            "event_id": event_id,
            "event_name": event["name"],
            "capacity": event["capacity"],
            "starts_at": event["starts_at"].isoformat() if event["starts_at"] else None,
            "attendance_count": len(attendees),
            "attendees": attendees,
        }

    def regenerate_checkin_code(self, event_id: int) -> str | None:
        new_code = _gen_checkin_code()
        with self.cursor() as cur:
            cur.execute("SELECT event_id FROM events WHERE event_id = %s", (event_id,))
            if not cur.fetchone():
                return None
            cur.execute(
                "UPDATE events SET check_in_code = %s WHERE event_id = %s",
                (new_code, event_id),
            )
            self.conn.commit()
        return new_code

    def list_events_stats(self, start_date, end_date, limit: int) -> list:
        with self.cursor() as cur:
            conditions: list[str] = []
            params: list = []

            if start_date:
                conditions.append("e.starts_at >= %s::date")
                params.append(start_date)
            if end_date:
                conditions.append("e.starts_at < (%s::date + INTERVAL '1 day')")
                params.append(end_date)

            where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

            cur.execute(
                f"""
                SELECT
                    e.event_id, e.name, e.event_type, e.description,
                    e.location, e.location_url, e.starts_at, e.ends_at,
                    e.capacity, e.check_in_code, e.check_in_enabled, e.points_value,
                    COUNT(ec.checkin_id) AS attendance_count
                FROM events e
                LEFT JOIN event_checkins ec ON ec.event_id = e.event_id
                {where}
                GROUP BY e.event_id
                ORDER BY e.starts_at DESC
                LIMIT %s
                """,
                params + [limit],
            )
            rows = cur.fetchall()

        return [
            {
                "event_id":         r["event_id"],
                "name":             r["name"],
                "event_type":       r["event_type"],
                "description":      r["description"],
                "location":         r["location"],
                "location_url":     r["location_url"],
                "starts_at":        r["starts_at"].isoformat() if r["starts_at"] else None,
                "ends_at":          r["ends_at"].isoformat() if r["ends_at"] else None,
                "capacity":         r["capacity"],
                "check_in_code":    r["check_in_code"],
                "check_in_enabled": r["check_in_enabled"],
                "points_value":     r["points_value"],
                "attendance_count": int(r["attendance_count"]),
            }
            for r in rows
        ]

    def list_event_types(self, active_only: bool = False) -> list:
        with self.cursor() as cur:
            where = "WHERE is_active = TRUE " if active_only else ""
            cur.execute(
                "SELECT type_id, name, default_points, color, description, is_active, created_at "
                f"FROM event_types {where}ORDER BY name ASC"
            )
            rows = cur.fetchall()

        grouped: dict[str, dict] = {}
        for r in rows:
            normalized_name = normalize_event_type_name(r["name"])
            item = {
                "type_id": r["type_id"],
                "name": normalized_name,
                "default_points": r["default_points"],
                "color": r["color"],
                "description": r["description"],
                "is_active": r["is_active"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            }
            key = event_type_dedupe_key(r["name"])
            existing = grouped.get(key)
            if not existing:
                grouped[key] = item
                continue

            existing_score = _event_type_choice_score(existing["type_id"], existing["name"], existing["is_active"])
            current_score = _event_type_choice_score(r["type_id"], r["name"], r["is_active"])
            if current_score > existing_score:
                grouped[key] = item

        return sorted(grouped.values(), key=lambda item: item["name"].lower())

    def event_type_name_exists(self, name: str, exclude_type_id: int | None = None) -> bool:
        normalized = event_type_dedupe_key(name)
        with self.cursor() as cur:
            cur.execute(
                "SELECT type_id, name FROM event_types"
            )
            rows = cur.fetchall()

        for row in rows:
            if exclude_type_id is not None and row["type_id"] == exclude_type_id:
                continue
            if event_type_dedupe_key(row["name"]) == normalized:
                return True
        return False

    def create_event_type(self, name: str, default_points: int, color: str, description) -> int:
        name = normalize_event_type_name(name)
        with self.cursor() as cur:
            cur.execute(
                "INSERT INTO event_types (name, default_points, color, description) VALUES (%s, %s, %s, %s) RETURNING type_id",
                (name, default_points, color, description),
            )
            type_id = cur.fetchone()["type_id"]
            self.conn.commit()
        return type_id

    def update_event_type(self, type_id: int, updates: dict) -> bool:
        if "name" in updates:
            updates["name"] = normalize_event_type_name(updates["name"])
        set_parts = list(updates.keys())
        params = list(updates.values())
        params.append(type_id)
        with self.cursor() as cur:
            cur.execute(
                f"UPDATE event_types SET {', '.join(f'{k} = %s' for k in set_parts)} WHERE type_id = %s",
                params,
            )
            if cur.rowcount == 0:
                return False
            self.conn.commit()
        return True

    def delete_event_type(self, type_id: int) -> tuple:
        with self.cursor() as cur:
            cur.execute("SELECT COUNT(*) as cnt FROM events WHERE type_id = %s", (type_id,))
            count = cur.fetchone()["cnt"]
            if count > 0:
                return False, f"Cannot delete: {count} event(s) reference this type"

            cur.execute("UPDATE event_types SET is_active = FALSE WHERE type_id = %s", (type_id,))
            if cur.rowcount == 0:
                return False, "Event type not found"
            self.conn.commit()
        return True, None
