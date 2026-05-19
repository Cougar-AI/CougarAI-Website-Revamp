from datetime import datetime, timezone
from app.services.base_service import BaseService


class NotificationService(BaseService):

    def list_schedules(self):
        with self.cursor() as cur:
            cur.execute("""
                SELECT ns.*,
                  (SELECT sent_at FROM notification_logs nl
                   WHERE nl.schedule_id = ns.schedule_id
                   ORDER BY nl.sent_at DESC LIMIT 1) AS last_sent,
                  (SELECT status FROM notification_logs nl
                   WHERE nl.schedule_id = ns.schedule_id
                   ORDER BY nl.sent_at DESC LIMIT 1) AS last_status
                FROM notification_schedules ns
                ORDER BY ns.created_at DESC
            """)
            schedules = []
            for row in cur.fetchall():
                d = self._row_to_dict(row)
                d["last_sent"] = row["last_sent"].isoformat() if row.get("last_sent") else None
                d["last_status"] = row.get("last_status")
                schedules.append(d)
        return schedules

    def create_schedule(self, data):
        target_roles = data.get("target_roles") or ["officer", "admin"]
        try:
            with self.cursor() as cur:
                cur.execute(
                    """INSERT INTO notification_schedules
                       (name, type, is_active, send_email, send_in_app,
                        cron_day_of_week, cron_hour, cron_minute,
                        hours_before, target_roles, subject, body_template)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       RETURNING schedule_id""",
                    (
                        data["name"],
                        data["type"],
                        data.get("is_active", True),
                        data.get("send_email", False),
                        data.get("send_in_app", True),
                        data.get("cron_day_of_week"),
                        data.get("cron_hour", 9),
                        data.get("cron_minute", 0),
                        data.get("hours_before"),
                        target_roles,
                        data.get("subject"),
                        data.get("body_template"),
                    ),
                )
                schedule_id = cur.fetchone()["schedule_id"]
            self.conn.commit()
            return schedule_id, None
        except Exception as exc:
            return None, str(exc)

    def update_schedule(self, schedule_id, updates):
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        set_clause = ", ".join(f"{k} = %s" for k in updates)
        try:
            with self.cursor() as cur:
                cur.execute(
                    f"UPDATE notification_schedules SET {set_clause} WHERE schedule_id = %s",
                    (*updates.values(), schedule_id),
                )
                if cur.rowcount == 0:
                    return False, "Schedule not found"
            self.conn.commit()
            return True, None
        except Exception as exc:
            return False, str(exc)

    def delete_schedule(self, schedule_id):
        try:
            with self.cursor() as cur:
                cur.execute(
                    "DELETE FROM notification_schedules WHERE schedule_id = %s",
                    (schedule_id,),
                )
                if cur.rowcount == 0:
                    return False, "Schedule not found"
            self.conn.commit()
            return True, None
        except Exception as exc:
            return False, str(exc)

    def get_schedule(self, schedule_id):
        with self.cursor() as cur:
            cur.execute(
                "SELECT type, hours_before, target_roles FROM notification_schedules WHERE schedule_id = %s",
                (schedule_id,),
            )
            row = cur.fetchone()
        if not row:
            return None
        return dict(row)

    def list_logs(self):
        with self.cursor() as cur:
            cur.execute("""
                SELECT nl.log_id, nl.schedule_id, nl.sent_at, nl.recipients_count,
                       nl.status, nl.error_message, ns.name AS schedule_name
                FROM notification_logs nl
                LEFT JOIN notification_schedules ns ON ns.schedule_id = nl.schedule_id
                ORDER BY nl.sent_at DESC
                LIMIT 50
            """)
            logs = []
            for row in cur.fetchall():
                logs.append({
                    "log_id": row["log_id"],
                    "schedule_id": row["schedule_id"],
                    "schedule_name": row["schedule_name"],
                    "sent_at": row["sent_at"].isoformat() if row["sent_at"] else None,
                    "recipients_count": row["recipients_count"],
                    "status": row["status"],
                    "error_message": row["error_message"],
                })
        return logs

    def get_user_notifications(self, user_id):
        with self.cursor() as cur:
            cur.execute(
                """SELECT notification_id, title, body, is_read, created_at, schedule_id
                   FROM user_notifications
                   WHERE user_id = %s
                   ORDER BY created_at DESC
                   LIMIT 30""",
                (user_id,),
            )
            return [
                {
                    "notification_id": r["notification_id"],
                    "title": r["title"],
                    "body": r["body"],
                    "is_read": r["is_read"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    "schedule_id": r["schedule_id"],
                }
                for r in cur.fetchall()
            ]

    def mark_notification_read(self, notification_id, user_id):
        with self.cursor() as cur:
            cur.execute(
                "UPDATE user_notifications SET is_read = TRUE WHERE notification_id = %s AND user_id = %s",
                (notification_id, user_id),
            )
        self.conn.commit()
        return True

    def mark_all_read(self, user_id):
        with self.cursor() as cur:
            cur.execute(
                "UPDATE user_notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE",
                (user_id,),
            )
        self.conn.commit()
        return True

    def clear_read_notifications(self, user_id):
        with self.cursor() as cur:
            cur.execute(
                "DELETE FROM user_notifications WHERE user_id = %s AND is_read = TRUE",
                (user_id,),
            )
        self.conn.commit()
        return True

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _row_to_dict(row):
        return {
            "schedule_id": row["schedule_id"],
            "name": row["name"],
            "type": row["type"],
            "is_active": row["is_active"],
            "send_email": row["send_email"],
            "send_in_app": row["send_in_app"],
            "cron_day_of_week": row["cron_day_of_week"],
            "cron_hour": row["cron_hour"],
            "cron_minute": row["cron_minute"],
            "hours_before": row["hours_before"],
            "target_roles": row["target_roles"] or [],
            "subject": row["subject"],
            "body_template": row["body_template"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }
