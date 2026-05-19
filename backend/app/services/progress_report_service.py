from datetime import date, timedelta
from app.services.base_service import BaseService


class ProgressReportService(BaseService):

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _monday_of_week(d: date) -> date:
        return d - timedelta(days=d.weekday())

    @staticmethod
    def _serialize(r) -> dict:
        return {
            "report_id": r["report_id"],
            "user_id": r["user_id"],
            "week_of": r["week_of"].isoformat() if r["week_of"] else None,
            "summary": r["summary"],
            "tasks_completed": r["tasks_completed"],
            "tasks_in_progress": r["tasks_in_progress"],
            "tasks_on_hold": r["tasks_on_hold"],
            "upcoming_tasks": r["upcoming_tasks"],
            "comments": r["comments"],
            "feedback": r["feedback"],
            "questions": r["questions"],
            "submitted_at": r["submitted_at"].isoformat() if r["submitted_at"] else None,
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
            "first_name": r.get("first_name"),
            "last_name": r.get("last_name"),
            "email": r.get("email"),
        }

    # ------------------------------------------------------------------
    # list_reports
    # ------------------------------------------------------------------

    def list_reports(self, week_of: date | None, filter_user_id: int | None,
                     page: int, limit: int) -> tuple[list, int]:
        offset = (page - 1) * limit
        conds: list[str] = []
        params: list = []

        if week_of is not None:
            conds.append("pr.week_of = %s")
            params.append(week_of)

        if filter_user_id is not None:
            conds.append("pr.user_id = %s")
            params.append(filter_user_id)

        where = ("WHERE " + " AND ".join(conds)) if conds else ""

        with self.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) as total FROM progress_reports pr {where}",
                params,
            )
            total = cur.fetchone()["total"]

            cur.execute(
                f"""
                SELECT pr.*, u.email, p.first_name, p.last_name
                FROM progress_reports pr
                JOIN users u ON u.user_id = pr.user_id
                LEFT JOIN profile p ON p.user_id = pr.user_id
                {where}
                ORDER BY pr.week_of DESC, pr.submitted_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [limit, offset],
            )
            rows = cur.fetchall()

        return [self._serialize(r) for r in rows], total

    # ------------------------------------------------------------------
    # my_reports
    # ------------------------------------------------------------------

    def my_reports(self, user_id: int) -> list:
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT pr.*, u.email, p.first_name, p.last_name
                FROM progress_reports pr
                JOIN users u ON u.user_id = pr.user_id
                LEFT JOIN profile p ON p.user_id = pr.user_id
                WHERE pr.user_id = %s
                ORDER BY pr.week_of DESC
                LIMIT 20
                """,
                (user_id,),
            )
            rows = cur.fetchall()
        return [self._serialize(r) for r in rows]

    # ------------------------------------------------------------------
    # submit_report
    # ------------------------------------------------------------------

    def submit_report(self, user_id: int, week_date: date, values: dict) -> tuple[int, str]:
        with self.cursor() as cur:
            cur.execute(
                """
                INSERT INTO progress_reports
                  (user_id, week_of, summary, tasks_completed, tasks_in_progress, tasks_on_hold,
                   upcoming_tasks, comments, feedback, questions, submitted_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                ON CONFLICT (user_id, week_of) DO UPDATE SET
                  summary = EXCLUDED.summary,
                  tasks_completed = EXCLUDED.tasks_completed,
                  tasks_in_progress = EXCLUDED.tasks_in_progress,
                  tasks_on_hold = EXCLUDED.tasks_on_hold,
                  upcoming_tasks = EXCLUDED.upcoming_tasks,
                  comments = EXCLUDED.comments,
                  feedback = EXCLUDED.feedback,
                  questions = EXCLUDED.questions,
                  updated_at = NOW()
                RETURNING report_id
                """,
                (
                    user_id, week_date,
                    values["summary"], values["tasks_completed"], values["tasks_in_progress"],
                    values["tasks_on_hold"], values["upcoming_tasks"], values["comments"],
                    values["feedback"], values["questions"],
                ),
            )
            report_id = cur.fetchone()["report_id"]
            self.conn.commit()
        return report_id, week_date.isoformat()

    # ------------------------------------------------------------------
    # update_report
    # ------------------------------------------------------------------

    def update_report(self, report_id: int, user_id: int,
                      data: dict) -> tuple[bool, str | None, int]:
        """Returns (success, error_message, status_code)."""
        fields = [
            "summary", "tasks_completed", "tasks_in_progress", "tasks_on_hold",
            "upcoming_tasks", "comments", "feedback", "questions",
        ]

        with self.cursor() as cur:
            cur.execute(
                "SELECT user_id FROM progress_reports WHERE report_id = %s",
                (report_id,),
            )
            row = cur.fetchone()
            if not row:
                return False, "Report not found", 404
            if row["user_id"] != user_id:
                return False, "Cannot edit another officer's report", 403

            updates = []
            params = []
            for f in fields:
                if f in data:
                    updates.append(f"{f} = %s")
                    params.append(data[f] or None)

            if not updates:
                return False, "Nothing to update", 400

            updates.append("updated_at = NOW()")
            params.append(report_id)
            cur.execute(
                f"UPDATE progress_reports SET {', '.join(updates)} WHERE report_id = %s",
                params,
            )
            self.conn.commit()

        return True, None, 200

    # ------------------------------------------------------------------
    # report_status
    # ------------------------------------------------------------------

    def report_status(self, week_date: date) -> dict:
        with self.cursor() as cur:
            cur.execute(
                """
                SELECT
                    u.user_id, u.email, p.first_name, p.last_name,
                    pr.report_id, pr.submitted_at
                FROM users u
                LEFT JOIN profile p ON p.user_id = u.user_id
                LEFT JOIN progress_reports pr
                    ON pr.user_id = u.user_id AND pr.week_of = %s
                WHERE u.role IN ('officer', 'admin')
                  AND u.is_active = TRUE
                ORDER BY p.last_name ASC, p.first_name ASC
                """,
                (week_date,),
            )
            rows = cur.fetchall()

        deadline = week_date + timedelta(days=7)
        is_overdue = date.today() >= deadline

        officers = [
            {
                "user_id": r["user_id"],
                "email": r["email"],
                "first_name": r["first_name"],
                "last_name": r["last_name"],
                "submitted": r["report_id"] is not None,
                "submitted_at": r["submitted_at"].isoformat() if r["submitted_at"] else None,
                "overdue": is_overdue and r["report_id"] is None,
            }
            for r in rows
        ]

        return {
            "week_of": week_date.isoformat(),
            "deadline": deadline.isoformat(),
            "is_overdue": is_overdue,
            "officers": officers,
        }
