import os
import json
from datetime import date
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from app.raw_db import connect
from app import limiter

dashboard_bp = Blueprint("dashboard", __name__)

AVATAR_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "avatars")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_AVATAR_BYTES = 2 * 1024 * 1024  # 2 MB


def _cors_preflight():
    return "", 200


def _user_id() -> int:
    return int(get_jwt_identity())


# ---------------------------------------------------------------------------
# GET /dashboard/me
# ---------------------------------------------------------------------------

@dashboard_bp.route("/me", methods=["GET", "OPTIONS"])
@jwt_required()
def get_me():
    if request.method == "OPTIONS":
        return _cors_preflight()

    uid = _user_id()
    conn = connect()
    with conn.cursor() as cur:
        # Core user row
        cur.execute(
            """
            SELECT user_id, email, role, created_at, onboarding_completed_at
            FROM users WHERE user_id = %s
            """,
            (uid,),
        )
        user = cur.fetchone()
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Linked profile row
        cur.execute(
            """
            SELECT student_id, first_name, last_name, grade_level, major,
                   shirt_size, discord_id, avatar_url, is_public, preferred_email,
                   notification_settings, current_streak, max_streak, last_event_month
            FROM profile WHERE user_id = %s
            """,
            (uid,),
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
            (uid, uid),
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

    return jsonify({
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
            "notification_settings": notif or {"email_events": True, "email_newsletter": True, "email_announcements": True},
            "current_streak": profile["current_streak"] if profile else 0,
            "max_streak": profile["max_streak"] if profile else 0,
        } if profile else None,
        "membership": membership_data,
        "points_summary": {
            "total": total_points,
            "rank": rank,
            "total_members": total_members,
        },
    }), 200


# ---------------------------------------------------------------------------
# PATCH /dashboard/profile
# ---------------------------------------------------------------------------

@dashboard_bp.route("/profile", methods=["PATCH", "OPTIONS"])
@jwt_required()
def update_profile():
    if request.method == "OPTIONS":
        return _cors_preflight()

    uid = _user_id()
    data = request.get_json(silent=True) or {}

    allowed = ["first_name", "last_name", "preferred_email", "is_public",
               "notification_settings", "shirt_size", "major", "discord_id", "grade_level"]

    updates = {k: data[k] for k in allowed if k in data}
    if not updates:
        return jsonify({"error": "No valid fields provided"}), 400

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT student_id FROM profile WHERE user_id = %s", (uid,))
        profile = cur.fetchone()

        if not profile:
            return jsonify({"error": "No profile linked to this account"}), 404

        if "notification_settings" in updates and isinstance(updates["notification_settings"], dict):
            updates["notification_settings"] = json.dumps(updates["notification_settings"])

        set_clause = ", ".join(f"{k} = %s" for k in updates)
        values = list(updates.values()) + [uid]
        cur.execute(f"UPDATE profile SET {set_clause} WHERE user_id = %s", values)
        conn.commit()

    return jsonify({"message": "Profile updated"}), 200


# ---------------------------------------------------------------------------
# POST /dashboard/profile/link
# ---------------------------------------------------------------------------

@dashboard_bp.route("/profile/link", methods=["POST", "OPTIONS"])
@jwt_required()
def link_profile():
    if request.method == "OPTIONS":
        return _cors_preflight()

    uid = _user_id()
    data = request.get_json(silent=True) or {}
    student_id = str(data.get("student_id") or "").strip()

    if not student_id:
        return jsonify({"error": "student_id is required"}), 400

    conn = connect()
    with conn.cursor() as cur:
        # Check not already linked to another account
        cur.execute("SELECT user_id FROM profile WHERE student_id = %s", (student_id,))
        existing = cur.fetchone()

        if existing and existing["user_id"] and existing["user_id"] != uid:
            return jsonify({"error": "This student ID is already linked to another account"}), 409

        if existing:
            cur.execute("UPDATE profile SET user_id = %s WHERE student_id = %s", (uid, student_id))
        else:
            cur.execute(
                "INSERT INTO profile (student_id, user_id) VALUES (%s, %s)",
                (student_id, uid),
            )
        conn.commit()

    return jsonify({"message": "Profile linked successfully"}), 200


# ---------------------------------------------------------------------------
# POST /dashboard/avatar
# ---------------------------------------------------------------------------

@dashboard_bp.route("/avatar", methods=["POST", "OPTIONS"])
@jwt_required()
@limiter.limit("5/minute")
def upload_avatar():
    if request.method == "OPTIONS":
        return _cors_preflight()

    uid = _user_id()

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]
    if f.mimetype not in ALLOWED_MIME:
        return jsonify({"error": "Only JPEG, PNG, and WebP images are allowed"}), 400

    f.seek(0, 2)
    size = f.tell()
    f.seek(0)
    if size > MAX_AVATAR_BYTES:
        return jsonify({"error": "File exceeds 2 MB limit"}), 400

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[f.mimetype]
    filename = secure_filename(f"{uid}.{ext}")
    os.makedirs(AVATAR_DIR, exist_ok=True)
    f.save(os.path.join(AVATAR_DIR, filename))

    avatar_url = f"/dashboard/avatar/{uid}"
    conn = connect()
    with conn.cursor() as cur:
        cur.execute("UPDATE profile SET avatar_url = %s WHERE user_id = %s", (avatar_url, uid))
        conn.commit()

    return jsonify({"avatar_url": avatar_url}), 200


# ---------------------------------------------------------------------------
# GET /dashboard/avatar/<user_id>  (public — no auth)
# ---------------------------------------------------------------------------

@dashboard_bp.route("/avatar/<int:user_id>", methods=["GET"])
def get_avatar(user_id):
    for ext in ("jpg", "png", "webp"):
        path = os.path.join(AVATAR_DIR, f"{user_id}.{ext}")
        if os.path.exists(path):
            return send_from_directory(AVATAR_DIR, f"{user_id}.{ext}")
    return jsonify({"error": "Avatar not found"}), 404


# ---------------------------------------------------------------------------
# GET /dashboard/memberships
# ---------------------------------------------------------------------------

@dashboard_bp.route("/memberships", methods=["GET", "OPTIONS"])
@jwt_required()
def get_memberships():
    if request.method == "OPTIONS":
        return _cors_preflight()

    uid = _user_id()
    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT email FROM users WHERE user_id = %s", (uid,))
        user = cur.fetchone()
        cur.execute("SELECT student_id FROM profile WHERE user_id = %s", (uid,))
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
            "stripe_session_id": (p.get("stripe_session_id") or "")[:20] + "..." if p.get("stripe_session_id") else None,
            "expires_at": expires.isoformat() if expires else None,
            "status": "active" if expires and expires >= today else "expired",
        }
        history.append(row)
        if not current_membership and expires and expires >= today:
            current_membership = row

    return jsonify({
        "current": current_membership,
        "history": history,
    }), 200


# ---------------------------------------------------------------------------
# GET /dashboard/points
# ---------------------------------------------------------------------------

@dashboard_bp.route("/points", methods=["GET", "OPTIONS"])
@jwt_required()
def get_points():
    if request.method == "OPTIONS":
        return _cors_preflight()

    uid = _user_id()
    limit = request.args.get("limit", 20, type=int)
    offset = request.args.get("offset", 0, type=int)

    conn = connect()
    with conn.cursor() as cur:
        cur.execute("SELECT student_id FROM profile WHERE user_id = %s", (uid,))
        profile = cur.fetchone()
        if not profile:
            return jsonify({"total": 0, "rank": None, "items": []}), 200

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

    return jsonify({
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
    }), 200


# ---------------------------------------------------------------------------
# POST /dashboard/onboarding/complete
# ---------------------------------------------------------------------------

@dashboard_bp.route("/onboarding/complete", methods=["POST", "OPTIONS"])
@jwt_required()
def complete_onboarding():
    if request.method == "OPTIONS":
        return _cors_preflight()

    uid = _user_id()
    from app import db
    from sqlalchemy import text

    with db.engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET onboarding_completed_at = NOW() WHERE user_id = :uid"),
            {"uid": uid},
        )

    return jsonify({"message": "Onboarding complete"}), 200
