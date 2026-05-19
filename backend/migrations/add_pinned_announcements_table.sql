CREATE TABLE IF NOT EXISTS pinned_announcements (
  id          SERIAL PRIMARY KEY,
  message     TEXT NOT NULL,
  created_by  INTEGER REFERENCES users(user_id),
  created_at  TIMESTAMP DEFAULT NOW(),
  expires_at  TIMESTAMP,
  is_active   BOOLEAN DEFAULT TRUE
);
