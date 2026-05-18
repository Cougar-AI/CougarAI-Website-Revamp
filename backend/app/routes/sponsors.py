from flask import Blueprint, jsonify, request
from app.raw_db import get_db

sponsors_bp = Blueprint("sponsors", __name__)

TIER_ORDER = {"platinum": 0, "gold": 1, "silver": 2, "bronze": 3, "community": 4}


@sponsors_bp.route("/", methods=["GET", "OPTIONS"])
def list_sponsors():
    if request.method == "OPTIONS":
        return "", 200

    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT sponsor_id, name, logo_url, website, tier, description, is_active,
                   start_date, end_date, display_order
            FROM sponsors
            WHERE is_active = TRUE
            ORDER BY display_order ASC, name ASC
            """
        )
        rows = cur.fetchall()

    sponsors = [
        {
            "sponsor_id": r["sponsor_id"],
            "name": r["name"],
            "logo_url": r["logo_url"],
            "website": r["website"],
            "tier": r["tier"],
            "description": r["description"],
            "start_date": r["start_date"].isoformat() if r["start_date"] else None,
            "end_date": r["end_date"].isoformat() if r["end_date"] else None,
            "display_order": r["display_order"],
        }
        for r in rows
    ]

    # Sort by tier precedence then display_order
    sponsors.sort(key=lambda s: (TIER_ORDER.get(s["tier"], 99), s["display_order"]))

    return jsonify({"sponsors": sponsors}), 200
