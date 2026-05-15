-- Self-check-in fields for events table.
-- Run once against the database.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS check_in_code VARCHAR(12),
  ADD COLUMN IF NOT EXISTS check_in_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS check_in_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS points_value INTEGER NOT NULL DEFAULT 10;

-- Prevent duplicate check-ins per user per event.
CREATE TABLE IF NOT EXISTS event_checkins (
  checkin_id   SERIAL PRIMARY KEY,
  event_id     INTEGER NOT NULL,
  student_id   VARCHAR(20),
  user_id      INTEGER,
  checked_in_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);
