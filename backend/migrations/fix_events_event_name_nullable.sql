-- The events table has a legacy event_name column that conflicts with the app's
-- name column. Make it nullable so inserts via the app's name field don't fail.
ALTER TABLE events ALTER COLUMN event_name DROP NOT NULL;
