CREATE TABLE IF NOT EXISTS partners (
  partner_id     SERIAL PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  type           VARCHAR(50) DEFAULT 'other',
  logo_url       VARCHAR(500),
  website        VARCHAR(500),
  description    TEXT,
  contact_name   VARCHAR(255),
  contact_email  VARCHAR(255),
  manager_user_id INTEGER REFERENCES users(user_id),
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_members (
  partner_id   INTEGER NOT NULL REFERENCES partners(partner_id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  partner_role VARCHAR(100) DEFAULT 'member',
  joined_at    TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY  (partner_id, user_id)
);
