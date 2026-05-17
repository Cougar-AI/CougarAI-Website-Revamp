-- Optional RSVP flag per event
ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_enabled BOOLEAN DEFAULT FALSE;

-- RSVP records: one row per user per event
CREATE TABLE IF NOT EXISTS event_rsvps (
  rsvp_id    SERIAL PRIMARY KEY,
  event_id   INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);
