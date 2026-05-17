-- Add geolocation check-in fields to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS latitude        DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS longitude       DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS checkin_radius_m INTEGER DEFAULT 400,
  ADD COLUMN IF NOT EXISTS require_location BOOLEAN DEFAULT FALSE;
