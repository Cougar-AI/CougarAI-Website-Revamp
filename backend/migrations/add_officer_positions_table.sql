CREATE TABLE IF NOT EXISTS officer_positions (
  position_id  SERIAL PRIMARY KEY,
  title        VARCHAR(100) NOT NULL UNIQUE,
  department   VARCHAR(100) NOT NULL,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMP DEFAULT NOW()
);

INSERT INTO officer_positions (title, department, sort_order) VALUES
  ('President',                'Executive Board',      1),
  ('Vice President Internal',  'Executive Board',      2),
  ('Vice President External',  'Executive Board',      3),
  ('Secretary',                'Executive Board',      4),
  ('Treasurer',                'Executive Board',      5),
  ('Advisor',                  'Advisors',             10),
  ('Historian',                'Historians',           20),
  ('Marketing Director',       'Marketing',            30),
  ('Marketing Committee',      'Marketing',            31),
  ('Events Director',          'Events Directors',     40),
  ('Technical Officer',        'Workshops / Projects', 50),
  ('Workshop Committee',       'Workshops / Projects', 51),
  ('Project Officer',          'Workshops / Projects', 52),
  ('Webmaster Director',       'Webmasters',           60),
  ('Webmaster',                'Webmasters',           61),
  ('Corporate Relations',      'Corporate Relations',  70)
ON CONFLICT (title) DO NOTHING;

ALTER TABLE officers
  ADD COLUMN IF NOT EXISTS position_id INTEGER REFERENCES officer_positions(position_id);
