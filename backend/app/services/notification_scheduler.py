"""
Notification scheduler using Flask-APScheduler.

Active schedules are loaded from the DB on startup and reloaded whenever
a schedule is created/updated/deleted via the /notifications API.
"""

from flask_apscheduler import APScheduler
from datetime import datetime, timezone
import logging

scheduler = APScheduler()
log = logging.getLogger(__name__)

# Day-of-week mapping: 0=Mon … 6=Sun (matches cron_day_of_week column)
_DOW_MAP = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}


def _log_send(app, schedule_id, recipients_count, status, error_message=None):
    from app.raw_db import connect
    with app.app_context():
        conn = connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO notification_logs
                       (schedule_id, recipients_count, status, error_message)
                       VALUES (%s, %s, %s, %s)""",
                    (schedule_id, recipients_count, status, error_message),
                )
            conn.commit()
        finally:
            conn.close()


def _insert_user_notifications(conn, user_ids, title, body, schedule_id):
    """Bulk-insert in-app notifications for a list of user_ids."""
    if not user_ids:
        return
    with conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO user_notifications (user_id, title, body, schedule_id)
               VALUES (%s, %s, %s, %s)""",
            [(uid, title, body, schedule_id) for uid in user_ids],
        )


def _send_progress_report_reminder(app, schedule_id):
    from app.raw_db import connect
    from app.services.mailer import send_email
    with app.app_context():
        conn = connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT name, subject, body_template, send_email, send_in_app
                       FROM notification_schedules WHERE schedule_id = %s""",
                    (schedule_id,),
                )
                sched = cur.fetchone()
                if not sched:
                    return

                send_email_flag = sched["send_email"]
                send_in_app_flag = sched["send_in_app"]
                subject = sched["subject"] or "Reminder: Progress Report Due"
                body_tpl = sched["body_template"] or (
                    "Hi {officer_name},\n\n"
                    "This is a reminder that your weekly progress report is due.\n"
                    "Please log in to https://cougarai.org/admin and submit it.\n\n"
                    "— CougarAI"
                )

                cur.execute(
                    """SELECT u.user_id, u.email,
                              COALESCE(p.first_name || ' ' || p.last_name, u.email) AS full_name
                       FROM users u
                       LEFT JOIN profile p ON p.user_id = u.user_id
                       WHERE u.role IN ('officer', 'admin') AND u.is_deleted IS NOT TRUE"""
                )
                officers = cur.fetchall()

            sent = 0
            errors = []

            if send_in_app_flag and officers:
                in_app_body = body_tpl.replace("{officer_name}", "there")
                user_ids = [o["user_id"] for o in officers]
                _insert_user_notifications(conn, user_ids, subject, in_app_body, schedule_id)
                conn.commit()

            if send_email_flag:
                for officer in officers:
                    body = body_tpl.replace("{officer_name}", officer["full_name"] or officer["email"])
                    try:
                        send_email(officer["email"], subject, body)
                        sent += 1
                    except Exception as exc:
                        errors.append(str(exc))

            status = "sent" if not errors else ("failed" if sent == 0 else "sent")
            total = len(officers) if send_in_app_flag else sent
            _log_send(app, schedule_id, total, status, "; ".join(errors) or None)
        except Exception as exc:
            log.exception("Progress report reminder failed")
            _log_send(app, schedule_id, 0, "failed", str(exc))
        finally:
            conn.close()


def _send_event_reminders(app, schedule_id, hours_before, target_roles):
    from app.raw_db import connect
    from app.services.mailer import send_email
    with app.app_context():
        conn = connect()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT subject, body_template, send_email, send_in_app
                       FROM notification_schedules WHERE schedule_id = %s""",
                    (schedule_id,),
                )
                sched = cur.fetchone()
                if not sched:
                    return

                send_email_flag = sched["send_email"]
                send_in_app_flag = sched["send_in_app"]
                subject_tpl = sched["subject"] or "Reminder: {event_name} is coming up!"
                body_tpl = sched["body_template"] or (
                    "Hi {recipient_name},\n\n"
                    "This is a reminder that {event_name} is starting soon.\n"
                    "Date/Time: {event_date}\n"
                    "Location: {event_location}\n\n"
                    "— CougarAI"
                )

                cur.execute(
                    """SELECT event_id, name, starts_at, location
                       FROM events
                       WHERE check_in_enabled = TRUE
                         AND starts_at BETWEEN NOW()
                           AND NOW() + (%s || ' hours')::INTERVAL""",
                    (str(hours_before),),
                )
                upcoming = cur.fetchall()
                if not upcoming:
                    _log_send(app, schedule_id, 0, "skipped", "No upcoming events in window")
                    return

                roles_list = target_roles if target_roles else ["officer", "admin"]
                placeholders = ",".join(["%s"] * len(roles_list))
                cur.execute(
                    f"SELECT user_id, email FROM users WHERE role IN ({placeholders}) AND is_deleted IS NOT TRUE",
                    roles_list,
                )
                recipients = cur.fetchall()

            sent = 0
            errors = []

            for event in upcoming:
                event_name = event["name"]
                event_date = event["starts_at"].strftime("%A, %B %-d at %-I:%M %p") if event["starts_at"] else "TBD"
                event_location = event["location"] or "TBD"
                title = subject_tpl.replace("{event_name}", event_name)
                in_app_body = (
                    body_tpl
                    .replace("{recipient_name}", "there")
                    .replace("{event_name}", event_name)
                    .replace("{event_date}", event_date)
                    .replace("{event_location}", event_location)
                )

                if send_in_app_flag and recipients:
                    user_ids = [u["user_id"] for u in recipients]
                    _insert_user_notifications(conn, user_ids, title, in_app_body, schedule_id)

                if send_email_flag:
                    for user in recipients:
                        subj = title
                        body = (
                            body_tpl
                            .replace("{recipient_name}", user["email"])
                            .replace("{event_name}", event_name)
                            .replace("{event_date}", event_date)
                            .replace("{event_location}", event_location)
                        )
                        try:
                            send_email(user["email"], subj, body)
                            sent += 1
                        except Exception as exc:
                            errors.append(str(exc))

            if send_in_app_flag:
                conn.commit()

            status = "sent" if not errors else ("failed" if sent == 0 else "sent")
            total = len(upcoming) * len(recipients) if send_in_app_flag else sent
            _log_send(app, schedule_id, total, status, "; ".join(errors[:3]) or None)
        except Exception as exc:
            log.exception("Event reminder failed")
            _log_send(app, schedule_id, 0, "failed", str(exc))
        finally:
            conn.close()


def reload_schedules(app):
    """Re-read active schedules from DB and sync APScheduler jobs."""
    from app.raw_db import connect
    with app.app_context():
        try:
            conn = connect()
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM notification_schedules WHERE is_active = TRUE"
                )
                schedules = cur.fetchall()
            conn.close()
        except Exception:
            log.exception("Could not load notification schedules from DB")
            return

        # Remove all existing dynamic jobs
        for job in scheduler.get_jobs():
            if job.id.startswith("notif_"):
                job.remove()

        for sched in schedules:
            sid = sched["schedule_id"]
            stype = sched["type"]
            job_id = f"notif_{sid}"

            try:
                if stype == "progress_report_reminder":
                    dow = sched["cron_day_of_week"]
                    hour = sched["cron_hour"] or 9
                    minute = sched["cron_minute"] or 0
                    day_str = _DOW_MAP.get(dow, "mon")
                    scheduler.add_job(
                        id=job_id,
                        func=_send_progress_report_reminder,
                        args=[app, sid],
                        trigger="cron",
                        day_of_week=day_str,
                        hour=hour,
                        minute=minute,
                        replace_existing=True,
                    )
                    log.info("Scheduled progress report reminder %s: %s %s:%02d", sid, day_str, hour, minute)

                elif stype == "event_reminder":
                    hours_before = sched["hours_before"] or 2
                    target_roles = sched["target_roles"] or ["officer", "admin"]
                    scheduler.add_job(
                        id=job_id,
                        func=_send_event_reminders,
                        args=[app, sid, hours_before, target_roles],
                        trigger="interval",
                        minutes=30,
                        replace_existing=True,
                    )
                    log.info("Scheduled event reminder %s: every 30 min, %dh window", sid, hours_before)

            except Exception:
                log.exception("Failed to schedule notification %s", sid)
