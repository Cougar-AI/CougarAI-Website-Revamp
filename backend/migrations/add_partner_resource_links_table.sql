CREATE TABLE IF NOT EXISTS partner_resource_links (
  link_id    SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partners(partner_id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  url        VARCHAR(500) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
