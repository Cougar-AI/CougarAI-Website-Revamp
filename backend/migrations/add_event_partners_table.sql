CREATE TABLE IF NOT EXISTS event_partners (
  event_id   INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  partner_id INTEGER NOT NULL REFERENCES partners(partner_id) ON DELETE CASCADE,
  role       VARCHAR(100) DEFAULT 'collaborator',
  PRIMARY KEY (event_id, partner_id)
);
