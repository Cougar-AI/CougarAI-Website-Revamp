from urllib.parse import urlparse

from psycopg2 import errors as pg_errors

from app.services.base_service import BaseService

VALID_STATUSES = ("active", "completed")
MAX_TAGS = 10
MAX_TEAM_MEMBERS = 30

_TEXT_LIMITS = {"title": 200, "summary": 500, "semester": 50}
_URL_FIELDS = ("github_url", "demo_url", "cover_image_url")

_SELECT = """
    SELECT p.*, s.name AS sponsor_name, s.logo_url AS sponsor_logo_url, s.website AS sponsor_website
    FROM projects p
    LEFT JOIN sponsors s ON s.sponsor_id = p.sponsor_id
"""


def _project_row(r) -> dict:
    return {
        "project_id": r["project_id"],
        "title": r["title"],
        "summary": r["summary"],
        "description": r["description"],
        "status": r["status"],
        "semester": r["semester"],
        "tags": list(r["tags"] or []),
        "team_members": list(r["team_members"] or []),
        "cover_image_url": r["cover_image_url"],
        "github_url": r["github_url"],
        "demo_url": r["demo_url"],
        "sponsor": (
            {"sponsor_id": r["sponsor_id"], "name": r["sponsor_name"], "logo_url": r["sponsor_logo_url"], "website": r["sponsor_website"]}
            if r["sponsor_id"] else None
        ),
        "is_published": r["is_published"],
        "display_order": r["display_order"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
    }


def _is_safe_url(value: str, allow_upload_path: bool) -> bool:
    # Only http(s) links are rendered as hrefs/img srcs, so javascript:/data: URLs can't get in.
    if allow_upload_path and value.startswith("/admin/uploads/"):
        return True
    parsed = urlparse(value)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def _string_list(value, field: str, max_items: int, max_len: int):
    if value is None:
        return [], None
    if isinstance(value, str):
        value = value.split(",")
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        return None, f"{field} must be a list of strings"
    cleaned = []
    for item in value:
        item = item.strip()
        if item and item not in cleaned:
            if len(item) > max_len:
                return None, f"each entry in {field} must be at most {max_len} characters"
            cleaned.append(item)
    if len(cleaned) > max_items:
        return None, f"{field} can have at most {max_items} entries"
    return cleaned, None


def clean_project_payload(data: dict, partial: bool = False) -> tuple:
    """
    Validate and normalize a create (partial=False) or update (partial=True) payload.
    Returns (fields, error) — fields only contains keys present in the payload.
    """
    fields = {}

    if "title" in data or not partial:
        title = data.get("title")
        title = title.strip() if isinstance(title, str) else ""
        if not title:
            return None, "title is required"
        fields["title"] = title

    for field in ("summary", "description", "semester"):
        if field in data:
            value = data[field]
            if value is not None and not isinstance(value, str):
                return None, f"{field} must be a string"
            fields[field] = (value or "").strip() or None

    for field, limit in _TEXT_LIMITS.items():
        if fields.get(field) and len(fields[field]) > limit:
            return None, f"{field} must be at most {limit} characters"

    if "status" in data or not partial:
        status = data.get("status") or "active"
        if status not in VALID_STATUSES:
            return None, f"status must be one of: {', '.join(VALID_STATUSES)}"
        fields["status"] = status

    for field, max_items, max_len in (("tags", MAX_TAGS, 40), ("team_members", MAX_TEAM_MEMBERS, 100)):
        if field in data or not partial:
            values, error = _string_list(data.get(field), field, max_items, max_len)
            if error:
                return None, error
            fields[field] = values

    for field in _URL_FIELDS:
        if field in data:
            value = (data[field] or "").strip() if isinstance(data[field], (str, type(None))) else None
            if value is None:
                return None, f"{field} must be a string"
            if value and not _is_safe_url(value, allow_upload_path=field == "cover_image_url"):
                return None, f"{field} must be an http(s) URL"
            if len(value) > 500:
                return None, f"{field} must be at most 500 characters"
            fields[field] = value or None

    if "sponsor_id" in data:
        sponsor_id = data["sponsor_id"]
        if sponsor_id in (None, ""):
            fields["sponsor_id"] = None
        else:
            try:
                fields["sponsor_id"] = int(sponsor_id)
            except (TypeError, ValueError):
                return None, "sponsor_id must be a number"

    if "is_published" in data:
        fields["is_published"] = bool(data["is_published"])
    elif not partial:
        fields["is_published"] = True

    if "display_order" in data:
        try:
            fields["display_order"] = int(data["display_order"] or 0)
        except (TypeError, ValueError):
            return None, "display_order must be a number"

    return fields, None


class ProjectService(BaseService):
    def list_projects(self, published_only: bool, status=None) -> list:
        clauses, params = [], []
        if published_only:
            clauses.append("p.is_published = TRUE")
        if status:
            clauses.append("p.status = %s")
            params.append(status)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        with self.cursor() as cur:
            cur.execute(f"{_SELECT} {where} ORDER BY p.display_order ASC, p.created_at DESC", params)
            rows = cur.fetchall()
        return [_project_row(r) for r in rows]

    def get_project(self, project_id: int, published_only: bool):
        with self.cursor() as cur:
            cur.execute(
                f"{_SELECT} WHERE p.project_id = %s {'AND p.is_published = TRUE' if published_only else ''}",
                (project_id,),
            )
            row = cur.fetchone()
        return _project_row(row) if row else None

    def create_project(self, fields: dict) -> tuple:
        columns = list(fields.keys())
        try:
            with self.cursor() as cur:
                cur.execute(
                    f"INSERT INTO projects ({', '.join(columns)}) VALUES ({', '.join(['%s'] * len(columns))}) RETURNING project_id",
                    [fields[c] for c in columns],
                )
                project_id = cur.fetchone()["project_id"]
            self.conn.commit()
        except pg_errors.ForeignKeyViolation:
            self.conn.rollback()
            return None, "sponsor_id does not match an existing sponsor"
        return project_id, None

    def update_project(self, project_id: int, fields: dict) -> tuple:
        assignments = [f"{c} = %s" for c in fields] + ["updated_at = NOW()"]
        try:
            with self.cursor() as cur:
                cur.execute(
                    f"UPDATE projects SET {', '.join(assignments)} WHERE project_id = %s",
                    [*fields.values(), project_id],
                )
                if cur.rowcount == 0:
                    self.conn.rollback()
                    return False, "Project not found"
            self.conn.commit()
        except pg_errors.ForeignKeyViolation:
            self.conn.rollback()
            return False, "sponsor_id does not match an existing sponsor"
        return True, None

    def delete_project(self, project_id: int) -> bool:
        with self.cursor() as cur:
            cur.execute("DELETE FROM projects WHERE project_id = %s", (project_id,))
            deleted = cur.rowcount > 0
        self.conn.commit()
        return deleted
