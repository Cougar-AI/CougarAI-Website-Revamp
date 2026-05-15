-- Dashboard and streak fields for profile table.
-- Run once against the database.

ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS preferred_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS notification_settings JSONB
    DEFAULT '{"email_events":true,"email_newsletter":true,"email_announcements":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_event_month VARCHAR(7);
