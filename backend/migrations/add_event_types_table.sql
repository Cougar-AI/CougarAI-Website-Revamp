-- Create event_types table: admin-managed list of event categories with default point values.
CREATE TABLE IF NOT EXISTS event_types (
  type_id        SERIAL PRIMARY KEY,
  name           VARCHAR(100) NOT NULL UNIQUE,
  default_points INTEGER NOT NULL DEFAULT 10,
  color          VARCHAR(7) DEFAULT '#b91c1c',
  description    TEXT,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- Seed default types (matching existing hard-coded values)
INSERT INTO event_types (name, default_points, color) VALUES
  ('workshop',  20, '#1d4ed8'),
  ('meeting',   10, '#0f766e'),
  ('social',    10, '#7c3aed'),
  ('hackathon', 30, '#b45309'),
  ('other',     10, '#6b7280')
ON CONFLICT (name) DO NOTHING;

-- Add type_id FK to events table (nullable to avoid breaking existing rows)
ALTER TABLE events ADD COLUMN IF NOT EXISTS type_id INTEGER REFERENCES event_types(type_id);

-- Back-fill existing rows from the varchar event_type column
UPDATE events e
SET type_id = (
  SELECT type_id FROM event_types et WHERE et.name = e.event_type
)
WHERE e.type_id IS NULL AND e.event_type IS NOT NULL;
