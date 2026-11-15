"""One-process PostgreSQL queue worker for private resume reviews.

Run one instance per Ollama GPU/host.  It never logs uploaded text or model
output.  The original file moves from the transient queue column to the
private sponsor-download column only after processing succeeds.
"""
from __future__ import annotations

import logging
import time
from psycopg2.extras import Json

from app import create_app
from ats.pipeline import process_resume
from ats.security import UploadRejected

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ats_worker")


def claim(conn):
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE resume_reviews SET status = 'processing'
               WHERE review_id = (
                 SELECT review_id FROM resume_reviews WHERE status = 'queued'
                 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
               )
               RETURNING review_id, filename_ext, upload, job_description"""
        )
        row = cur.fetchone()
        conn.commit()
        return row


def finish(conn, review_id: int, **fields):
    columns = list(fields)
    assignments = ", ".join(f"{column} = %s" for column in columns)
    values = [fields[c] for c in columns] + [review_id]
    with conn.cursor() as cur:
        cur.execute(f"UPDATE resume_reviews SET {assignments}, finished_at = NOW(), upload = NULL WHERE review_id = %s", values)
    conn.commit()


def main():
    # Loads the same config as Flask before opening the raw psycopg2 connection.
    app = create_app("config.ProductionConfig")
    with app.app_context():
        # Import after Flask has loaded the app package.  raw_db imports the
        # shared app utilities, so importing it at module load time creates a
        # circular import when this script is executed directly.
        from app.raw_db import connect
        conn = connect()
        with conn.cursor() as cur:
            cur.execute("UPDATE resume_reviews SET status = 'queued' WHERE status = 'processing'")
        conn.commit()
        while True:
            row = claim(conn)
            if not row:
                time.sleep(2)
                continue
            review_id = row["review_id"]
            try:
                report = process_resume(f"resume.{row['filename_ext']}", bytes(row["upload"]), row["job_description"])
                finish(
                    conn, review_id, status="done", report=Json(report),
                    needs_review=not report["security"]["sponsor_submission_allowed"],
                    resume_sha256=report["meta"]["resume_sha256"], resume_blob=row["upload"], error_message=None,
                )
                log.info("resume review completed review_id=%s", review_id)
            except UploadRejected as exc:
                finish(conn, review_id, status="rejected", error_message=str(exc), resume_blob=None)
                log.info("resume review rejected review_id=%s", review_id)
            except Exception:
                log.exception("resume review failed review_id=%s", review_id)
                finish(conn, review_id, status="failed", error_message="Something went wrong. Please try again later.", resume_blob=None)


if __name__ == "__main__":
    main()
