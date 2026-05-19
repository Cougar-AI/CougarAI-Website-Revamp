CREATE TABLE IF NOT EXISTS bulk_email_logs (
  log_id           SERIAL PRIMARY KEY,
  subject          VARCHAR(500) NOT NULL,
  recipient_filter VARCHAR(50)  NOT NULL,
  recipients_count INTEGER      DEFAULT 0,
  sent_by          INTEGER      REFERENCES users(user_id) ON DELETE SET NULL,
  status           VARCHAR(50)  DEFAULT 'sent',
  error_message    TEXT,
  sent_at          TIMESTAMPTZ  DEFAULT NOW()
);
