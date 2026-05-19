-- Prevent duplicate check-in points rows for the same student+event.
-- ON CONFLICT DO NOTHING in officer-checkin relies on this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS points_student_event_unique ON points (student_id, event_id);
