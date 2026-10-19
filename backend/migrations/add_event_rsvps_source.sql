-- Where an RSVP came from: 'website' (the web app) or 'discord' (the bot).
-- Existing rows backfill to 'website'. The bot may only remove 'discord' rows.
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS source VARCHAR(16) NOT NULL DEFAULT 'website';
