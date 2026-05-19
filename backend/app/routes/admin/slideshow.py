import os
from flask import request, jsonify
from flask_jwt_extended import get_jwt_identity
from app.routes.admin import admin_bp, UPLOADS_BASE
from app.raw_db import get_db
from app.utils.auth_decorators import require_admin


@admin_bp.route("/slideshow-photos", methods=["GET", "OPTIONS"])
def get_slideshow_photos():
    if request.method == "OPTIONS":
        return "", 200
    page = request.args.get("page", "").strip()
    if page not in ("home", "about"):
        return jsonify({"error": "page must be 'home' or 'about'"}), 400

    include_inactive = request.args.get("include_inactive", "false").lower() == "true"
    conn = get_db()
    with conn.cursor() as cur:
        if include_inactive:
            cur.execute(
                """
                SELECT photo_id, page, url, object_position, caption, is_active, display_order, uploaded_at
                FROM slideshow_photos
                WHERE page = %s
                ORDER BY display_order ASC
                """,
                (page,),
            )
        else:
            cur.execute(
                """
                SELECT photo_id, page, url, object_position, caption, is_active, display_order, uploaded_at
                FROM slideshow_photos
                WHERE page = %s AND is_active = TRUE
                ORDER BY display_order ASC
                """,
                (page,),
            )
        rows = cur.fetchall()

    photos = []
    for r in rows:
        row = dict(r)
        row["uploaded_at"] = row["uploaded_at"].isoformat() if row.get("uploaded_at") else None
        photos.append(row)
    return jsonify({"photos": photos}), 200


@admin_bp.route("/slideshow-photos", methods=["POST", "OPTIONS"])
@require_admin
def add_slideshow_photo():
    data = request.get_json(silent=True) or {}
    page = (data.get("page") or "").strip()
    url = (data.get("url") or "").strip()
    object_position = (data.get("object_position") or "center").strip()
    caption = (data.get("caption") or "").strip() or None

    if page not in ("home", "about"):
        return jsonify({"error": "page must be 'home' or 'about'"}), 400
    if not url:
        return jsonify({"error": "url is required"}), 400

    caller_id = get_jwt_identity()
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM slideshow_photos WHERE page = %s",
            (page,),
        )
        next_order = cur.fetchone()["next_order"]

        display_order = data.get("display_order")
        if display_order is None:
            display_order = next_order

        cur.execute(
            """
            INSERT INTO slideshow_photos (page, url, object_position, caption, display_order, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING photo_id
            """,
            (page, url, object_position, caption, display_order, caller_id),
        )
        photo_id = cur.fetchone()["photo_id"]
        conn.commit()

    return jsonify({"photo_id": photo_id, "message": "Photo added"}), 201


@admin_bp.route("/slideshow-photos/reorder", methods=["PATCH", "OPTIONS"])
@require_admin
def reorder_slideshow_photos():
    data = request.get_json(silent=True) or {}
    order = data.get("order", [])
    if not isinstance(order, list):
        return jsonify({"error": "order must be a list of photo_ids"}), 400

    conn = get_db()
    with conn.cursor() as cur:
        for idx, photo_id in enumerate(order):
            cur.execute(
                "UPDATE slideshow_photos SET display_order = %s WHERE photo_id = %s",
                (idx, photo_id),
            )
        conn.commit()
    return jsonify({"message": "Reordered"}), 200


@admin_bp.route("/slideshow-photos/<int:photo_id>", methods=["PATCH", "OPTIONS"])
@require_admin
def update_slideshow_photo(photo_id: int):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("SELECT photo_id FROM slideshow_photos WHERE photo_id = %s", (photo_id,))
        if not cur.fetchone():
            return jsonify({"error": "Not found"}), 404

        fields, values = [], []
        if "object_position" in data:
            fields.append("object_position = %s")
            values.append((data["object_position"] or "center").strip())
        if "caption" in data:
            fields.append("caption = %s")
            values.append((data["caption"] or "").strip() or None)
        if "is_active" in data:
            fields.append("is_active = %s")
            values.append(bool(data["is_active"]))
        if "display_order" in data:
            fields.append("display_order = %s")
            values.append(int(data["display_order"]))

        if not fields:
            return jsonify({"error": "No fields to update"}), 400

        values.append(photo_id)
        cur.execute(
            f"UPDATE slideshow_photos SET {', '.join(fields)} WHERE photo_id = %s",
            values,
        )
        conn.commit()
    return jsonify({"message": "Updated"}), 200


@admin_bp.route("/slideshow-photos/<int:photo_id>", methods=["DELETE", "OPTIONS"])
@require_admin
def delete_slideshow_photo(photo_id: int):
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("SELECT url FROM slideshow_photos WHERE photo_id = %s", (photo_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Not found"}), 404
        url = row["url"]
        cur.execute("DELETE FROM slideshow_photos WHERE photo_id = %s", (photo_id,))
        conn.commit()

    if url.startswith("/admin/uploads/slideshow/"):
        filename = url.split("/admin/uploads/slideshow/")[-1]
        filepath = os.path.join(UPLOADS_BASE, "slideshow", filename)
        if os.path.exists(filepath):
            os.remove(filepath)

    return jsonify({"message": "Deleted"}), 200
