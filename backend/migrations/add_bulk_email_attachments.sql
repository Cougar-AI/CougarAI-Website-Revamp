-- Bulk email: background sending, attachments, and one in-flight send at a time.
ALTER TABLE bulk_email_logs
  ADD COLUMN IF NOT EXISTS recipients_total INTEGER,
  ADD COLUMN IF NOT EXISTS attachment_names TEXT[],
  ADD COLUMN IF NOT EXISTS heartbeat_at     TIMESTAMPTZ;

-- At most one row may be 'sending'; a second concurrent send fails its INSERT (→ 409).
-- Enforced by the database so it holds across all gunicorn workers.
CREATE UNIQUE INDEX IF NOT EXISTS bulk_email_logs_one_sending
  ON bulk_email_logs ((TRUE)) WHERE status = 'sending';
