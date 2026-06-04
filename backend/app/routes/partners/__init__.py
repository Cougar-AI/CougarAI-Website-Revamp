from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import get_jwt

partners_bp = Blueprint("partners", __name__)

_LEADER_ROLES = {"President", "Manager"}
_VALID_PARTNER_ROLES = {"President", "Marketing", "Manager", "Officer"}


def _can_access_partner(cur, user_id: int, partner_id: int) -> bool:
    """Return True if the user is an admin OR a member of this partner org."""
    if get_jwt().get("role") == "admin":
        return True
    cur.execute(
        "SELECT 1 FROM partner_members WHERE partner_id = %s AND user_id = %s",
        (partner_id, user_id),
    )
    return cur.fetchone() is not None


def _partner_detail(cur, partner_id: int) -> dict | None:
    cur.execute(
        """
        SELECT p.partner_id, p.name, p.type, p.logo_url, p.website,
               p.description, p.contact_name, p.contact_email,
               p.manager_user_id, p.is_active, p.created_at,
               COUNT(pm.user_id) AS member_count
        FROM partners p
        LEFT JOIN partner_members pm ON pm.partner_id = p.partner_id
        WHERE p.partner_id = %s
        GROUP BY p.partner_id
        """,
        (partner_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "partner_id": row["partner_id"],
        "name": row["name"],
        "type": row["type"],
        "logo_url": row["logo_url"],
        "website": row["website"],
        "description": row["description"],
        "contact_name": row["contact_name"],
        "contact_email": row["contact_email"],
        "manager_user_id": row["manager_user_id"],
        "is_active": row["is_active"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
        "member_count": int(row["member_count"]),
    }


def _get_caller_partner_role(cur, user_id: int, partner_id: int):
    """Return the caller's partner_role in this org, or None if not a member."""
    cur.execute(
        "SELECT partner_role FROM partner_members WHERE partner_id = %s AND user_id = %s",
        (partner_id, user_id),
    )
    row = cur.fetchone()
    return row["partner_role"] if row else None


from app.routes.partners import dashboard, members, resources  # noqa
