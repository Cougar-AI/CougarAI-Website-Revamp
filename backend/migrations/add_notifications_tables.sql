-- Configurable email notification schedules
CREATE TABLE IF NOT EXISTS notification_schedules (
  schedule_id      SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  type             VARCHAR(50) NOT NULL,           -- 'progress_report_reminder' | 'event_reminder'
  is_active        BOOLEAN DEFAULT TRUE,
  -- Cron fields (progress_report_reminder)
  cron_day_of_week INTEGER,                        -- 0=Mon … 6=Sun
  cron_hour        INTEGER DEFAULT 9,
  cron_minute      INTEGER DEFAULT 0,
  -- Event reminder fields
  hours_before     INTEGER,                        -- hours before event start
  -- Recipients
  target_roles     TEXT[] DEFAULT ARRAY['officer','admin'],
  -- Email content
  subject          VARCHAR(500),
  body_template    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Log of each send attempt
CREATE TABLE IF NOT EXISTS notification_logs (
  log_id           SERIAL PRIMARY KEY,
  schedule_id      INTEGER REFERENCES notification_schedules(schedule_id) ON DELETE SET NULL,
  sent_at          TIMESTAMPTZ DEFAULT NOW(),
  recipients_count INTEGER DEFAULT 0,
  status           VARCHAR(50) DEFAULT 'sent',     -- 'sent' | 'failed' | 'skipped'
  error_message    TEXT
);
