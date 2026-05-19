CREATE TABLE IF NOT EXISTS event_sponsors (
  event_id   INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  sponsor_id INTEGER NOT NULL REFERENCES sponsors(sponsor_id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, sponsor_id)
);
