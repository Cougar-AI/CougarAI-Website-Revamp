from app.services.base_service import BaseService


class KnowledgeBaseService(BaseService):
    def create_entry(self, payload: dict):
        # expected keys: content_type, title, summary, body, source_label, source_url, tags (list), is_featured (bool)
        content_type = (payload.get("content_type") or "").strip()
        title = (payload.get("title") or "").strip()
        summary = (payload.get("summary") or "").strip()
        body = (payload.get("body") or "").strip()
        source_label = payload.get("source_label")
        source_url = payload.get("source_url")
        tags = payload.get("tags") or []
        is_featured = bool(payload.get("is_featured"))

        if not content_type or not title or not summary or not body:
            return None, "missing_fields"

        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]

        with self.cursor() as cur:
            cur.execute(
                """
                INSERT INTO knowledge_entries (content_type, title, summary, body, source_label, source_url, tags, is_featured)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING entry_id
                """,
                (content_type, title, summary, body, source_label, source_url, tags, is_featured),
            )
            row = cur.fetchone()
            self.conn.commit()

        return self.get_entry(row["entry_id"]), None

    def update_entry(self, entry_id: int, payload: dict):
        # allow updating selected fields
        fields = []
        params: list[object] = []
        for key in ("content_type", "title", "summary", "body", "source_label", "source_url", "is_featured"):
            if key in payload:
                fields.append(f"{key} = %s")
                params.append(payload.get(key))

        if "tags" in payload:
            tags = payload.get("tags") or []
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(",") if t.strip()]
            fields.append("tags = %s")
            params.append(tags)

        if not fields:
            return None, "no_changes"

        params.append(entry_id)
        sql = f"UPDATE knowledge_entries SET {', '.join(fields)}, updated_at = NOW() WHERE entry_id = %s AND is_active = TRUE RETURNING entry_id"

        with self.cursor() as cur:
            cur.execute(sql, tuple(params))
            row = cur.fetchone()
            if not row:
                return None, "entry_not_found"
            self.conn.commit()

        return self.get_entry(row["entry_id"]), None

    def delete_entry(self, entry_id: int):
        with self.cursor() as cur:
            cur.execute(
                "UPDATE knowledge_entries SET is_active = FALSE WHERE entry_id = %s AND is_active = TRUE RETURNING entry_id",
                (entry_id,),
            )
            row = cur.fetchone()
            if not row:
                return False, "entry_not_found"
            self.conn.commit()

        return True, None

    def list_entries(self, content_type: str | None = None, query: str | None = None):
        sql = [
            """
            SELECT
                e.entry_id,
                e.content_type,
                e.title,
                e.summary,
                e.body,
                e.source_label,
                e.source_url,
                e.tags,
                e.published_at,
                e.updated_at,
                e.is_featured,
                COUNT(c.comment_id)::int AS comment_count
            FROM knowledge_entries e
            LEFT JOIN knowledge_comments c ON c.entry_id = e.entry_id
            WHERE e.is_active = TRUE
            """
        ]
        params: list[object] = []

        if content_type and content_type != "all":
            sql.append("AND e.content_type = %s")
            params.append(content_type)

        if query:
            sql.append(
                """
                AND (
                    e.title ILIKE %s OR
                    e.summary ILIKE %s OR
                    e.body ILIKE %s OR
                    COALESCE(e.source_label, '') ILIKE %s OR
                    EXISTS (
                        SELECT 1
                        FROM unnest(e.tags) AS tag
                        WHERE tag ILIKE %s
                    )
                )
                """
            )
            like = f"%{query}%"
            params.extend([like, like, like, like, like])

        sql.append(
            """
            GROUP BY e.entry_id
            ORDER BY e.is_featured DESC, e.published_at DESC, e.entry_id DESC
            """
        )

        with self.cursor() as cur:
            cur.execute("\n".join(line.strip() for line in sql if line.strip()), tuple(params))
            rows = cur.fetchall()

        return [self._entry_row(row) for row in rows]

    def get_entry(self, entry_id: int):
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT
                    e.entry_id,
                    e.content_type,
                    e.title,
                    e.summary,
                    e.body,
                    e.source_label,
                    e.source_url,
                    e.tags,
                    e.published_at,
                    e.updated_at,
                    e.is_featured,
                    COUNT(c.comment_id)::int AS comment_count
                FROM knowledge_entries e
                LEFT JOIN knowledge_comments c ON c.entry_id = e.entry_id
                WHERE e.entry_id = %s AND e.is_active = TRUE
                GROUP BY e.entry_id
                LIMIT 1
                """,
                (entry_id,),
            )
            row = cur.fetchone()

        return self._entry_row(row) if row else None

    def list_comments(self, entry_id: int):
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT comment_id, entry_id, user_id, display_name, body, created_at, updated_at
                FROM knowledge_comments
                WHERE entry_id = %s
                ORDER BY created_at DESC, comment_id DESC
                """,
                (entry_id,),
            )
            rows = cur.fetchall()

        return [
            {
                "comment_id": row["comment_id"],
                "entry_id": row["entry_id"],
                "user_id": row["user_id"],
                "display_name": row["display_name"],
                "body": row["body"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }
            for row in rows
        ]

    def add_comment(self, entry_id: int, user_id: int, body: str):
        body = body.strip()
        if not body:
            return None, "comment_required"

        with self.cursor() as cur:
            cur.execute("SELECT entry_id FROM knowledge_entries WHERE entry_id = %s AND is_active = TRUE", (entry_id,))
            if not cur.fetchone():
                return None, "entry_not_found"

            cur.execute(
                """
                SELECT
                    COALESCE(
                        NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
                        u.email
                    ) AS display_name
                FROM users u
                LEFT JOIN profile p ON p.user_id = u.user_id
                WHERE u.user_id = %s
                """,
                (user_id,),
            )
            user_row = cur.fetchone()
            display_name = (user_row["display_name"] if user_row else None) or f"User {user_id}"

            cur.execute(
                """
                INSERT INTO knowledge_comments (entry_id, user_id, display_name, body)
                VALUES (%s, %s, %s, %s)
                RETURNING comment_id, entry_id, user_id, display_name, body, created_at, updated_at
                """,
                (entry_id, user_id, display_name, body),
            )
            row = cur.fetchone()
            self.conn.commit()

        return {
            "comment_id": row["comment_id"],
            "entry_id": row["entry_id"],
            "user_id": row["user_id"],
            "display_name": row["display_name"],
            "body": row["body"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }, None

    @staticmethod
    def _entry_row(row):
        return {
            "entry_id": row["entry_id"],
            "content_type": row["content_type"],
            "title": row["title"],
            "summary": row["summary"],
            "body": row["body"],
            "source_label": row["source_label"],
            "source_url": row["source_url"],
            "tags": row["tags"] or [],
            "published_at": row["published_at"].isoformat() if row["published_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            "is_featured": row["is_featured"],
            "comment_count": row["comment_count"] if "comment_count" in row else 0,
        }