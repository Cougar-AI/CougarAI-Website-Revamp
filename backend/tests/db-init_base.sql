-- Reconstructed base schema for tables that exist only in production and were
-- never captured as committed migrations (events, points, payments).
--
-- These tables predate the migrations/ directory, which only contains
-- incremental ALTER TABLE statements assuming the base tables already exist.
-- The `profile` and `officers` base tables are separately bootstrapped in
-- tests/conftest.py::app (bootstrap_schema) alongside db-init/001_auth.sql.
--
-- Columns are intentionally generous/nullable so downstream migrations in
-- migrations/*.sql (which mostly do `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
-- can layer on top without conflicting with this file.
--
-- Safe to re-run: everything uses CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS events (
    event_id      SERIAL PRIMARY KEY,
    name          VARCHAR(255),
    event_name    VARCHAR(255),
    event_type    VARCHAR(100),
    description   TEXT,
    location      VARCHAR(255),
    starts_at     TIMESTAMP,
    ends_at       TIMESTAMP,
    capacity      INTEGER,
    google_event_id VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS points (
    point_id    SERIAL PRIMARY KEY,
    student_id  VARCHAR(32),
    event_id    INTEGER REFERENCES events(event_id) ON DELETE CASCADE,
    points      INTEGER NOT NULL DEFAULT 0,
    date        DATE DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id        SERIAL PRIMARY KEY,
    student_id        INTEGER,
    email             VARCHAR(255),
    date              DATE DEFAULT CURRENT_DATE,
    amount            NUMERIC,
    stripe_session_id VARCHAR(255),
    plan_id           VARCHAR(50),
    expires_at        DATE,
    is_manual         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
