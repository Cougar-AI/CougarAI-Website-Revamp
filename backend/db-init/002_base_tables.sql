-- Base table DDL for tables that predate the migrations system.
-- Applied in test conftest after 001_auth.sql; safe to run in any order
-- after users table exists.

-- ── Profile ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile (
  student_id          VARCHAR(20) PRIMARY KEY,
  user_id             INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  first_name          VARCHAR(100),
  last_name           VARCHAR(100),
  preferred_email     VARCHAR(255),
  is_public           BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url          VARCHAR(500),
  notification_settings JSONB DEFAULT '{"email_events":true,"email_newsletter":true,"email_announcements":true}'::jsonb,
  current_streak      INTEGER NOT NULL DEFAULT 0,
  max_streak          INTEGER NOT NULL DEFAULT 0,
  last_event_month    VARCHAR(7),
  shirt_size          VARCHAR(20),
  major               VARCHAR(100),
  grade_level         VARCHAR(20),
  discord_id          VARCHAR(100),
  discord_username    VARCHAR(100)
);

-- ── Events ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  event_id            SERIAL PRIMARY KEY,
  name                VARCHAR(255) NOT NULL,
  event_type          VARCHAR(100) NOT NULL DEFAULT 'other',
  description         TEXT,
  location            VARCHAR(255),
  location_url        VARCHAR(500),
  starts_at           TIMESTAMP,
  ends_at             TIMESTAMP,
  capacity            INTEGER,
  check_in_code       VARCHAR(12),
  check_in_enabled    BOOLEAN DEFAULT FALSE,
  check_in_expires_at TIMESTAMP,
  points_value        INTEGER NOT NULL DEFAULT 10,
  google_event_id     VARCHAR(255),
  rsvp_enabled        BOOLEAN DEFAULT FALSE,
  require_location    BOOLEAN DEFAULT FALSE,
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  checkin_radius_m    INTEGER DEFAULT 100,
  type_id             INTEGER
);

-- ── Points ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS points (
  points_id       SERIAL PRIMARY KEY,
  student_id      VARCHAR(20) REFERENCES profile(student_id) ON DELETE CASCADE,
  event_id        INTEGER REFERENCES events(event_id) ON DELETE SET NULL,
  date            DATE DEFAULT CURRENT_DATE,
  points          INTEGER NOT NULL,
  reason          TEXT,
  officer_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL
);

-- ── Payments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  payment_id        SERIAL PRIMARY KEY,
  student_id        INTEGER,
  email             VARCHAR(255),
  date              DATE DEFAULT CURRENT_DATE,
  amount            NUMERIC,
  stripe_session_id VARCHAR(255),
  plan_id           VARCHAR(50),
  expires_at        DATE,
  is_manual         BOOLEAN DEFAULT FALSE
);

-- ── Officers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS officers (
  officer_id          SERIAL PRIMARY KEY,
  student_id          VARCHAR(20) REFERENCES profile(student_id) ON DELETE CASCADE,
  role                VARCHAR(50) DEFAULT 'officer',
  department          VARCHAR(100),
  sort_order          INTEGER DEFAULT 0,
  join_date           DATE DEFAULT CURRENT_DATE,
  end_date            DATE,
  photo_url           TEXT,
  photo_object_position TEXT DEFAULT '50% 50%',
  linkedin_url        TEXT,
  first_name          VARCHAR(100),
  last_name           VARCHAR(100),
  position_id         INTEGER
);

-- ── Event checkins ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_checkins (
  checkin_id    SERIAL PRIMARY KEY,
  event_id      INTEGER REFERENCES events(event_id) ON DELETE CASCADE,
  student_id    VARCHAR(20),
  user_id       INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  checked_in_at TIMESTAMP DEFAULT NOW(),
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  UNIQUE (event_id, user_id)
);

-- ── Event RSVPs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_rsvps (
  rsvp_id    SERIAL PRIMARY KEY,
  event_id   INTEGER NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ── Discord announcements ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discord_announcements (
  announcement_id   SERIAL PRIMARY KEY,
  guild_id          VARCHAR(100),
  event_id          INTEGER,
  title             VARCHAR(255),
  description       TEXT,
  announcement_date DATE,
  created_at        TIMESTAMP DEFAULT NOW()
);
