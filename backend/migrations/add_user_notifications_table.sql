-- Add delivery channel flags to existing notification schedules
ALTER TABLE notification_schedules
  ADD COLUMN IF NOT EXISTS send_email  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS send_in_app BOOLEAN NOT NULL DEFAULT TRUE;

-- Per-user in-app notification inbox
CREATE TABLE IF NOT EXISTS user_notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  body            TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  schedule_id     INTEGER REFERENCES notification_schedules(schedule_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_notif_user   ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notif_unread ON user_notifications(user_id, is_read);
