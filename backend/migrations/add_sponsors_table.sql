CREATE TABLE IF NOT EXISTS sponsors (
  sponsor_id    SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  logo_url      VARCHAR(500),
  website       VARCHAR(500),
  tier          VARCHAR(50) DEFAULT 'community',
  description   TEXT,
  contact_name  VARCHAR(255),
  contact_email VARCHAR(255),
  is_active     BOOLEAN DEFAULT TRUE,
  start_date    DATE,
  end_date      DATE,
  display_order INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Seed existing sponsors
INSERT INTO sponsors (name, website, tier, description, is_active) VALUES
  ('Ferguson Control Systems', 'https://www.fergusoncontrolsystems.com', 'gold', 'Industrial automation & control solutions', TRUE),
  ('Hewlett Packard Enterprise', 'https://www.hpe.com', 'platinum', 'Global edge-to-cloud technology company', TRUE)
ON CONFLICT DO NOTHING;
