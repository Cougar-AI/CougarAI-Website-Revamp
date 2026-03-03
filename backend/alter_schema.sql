-- Alter existing tables to match new schema

-- Add columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Rename or restructure events table columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type VARCHAR(100);
ALTER TABLE events ADD COLUMN IF NOT EXISTS starts_at TIMESTAMP;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP;
ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INTEGER;

-- Recreate payments table with correct structure
-- First, backup and recreate
DROP TABLE IF EXISTS payments_old CASCADE;
ALTER TABLE IF EXISTS payments RENAME TO payments_old;

CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL REFERENCES profile(student_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2),
    date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50),
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrate data if it exists
INSERT INTO payments (payment_id, student_id, amount, date, status, description, created_at, updated_at)
SELECT payment_id, 'TEMP', amount, CURRENT_DATE, status, description, created_at, updated_at
FROM payments_old
ON CONFLICT (payment_id) DO NOTHING;

-- Recreate officers table with correct structure
DROP TABLE IF EXISTS officers_old CASCADE;
ALTER TABLE IF EXISTS officers RENAME TO officers_old;

CREATE TABLE officers (
    officer_id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL REFERENCES profile(student_id) ON DELETE CASCADE,
    role VARCHAR(100),
    position VARCHAR(100),
    join_date DATE,
    end_date DATE,
    department VARCHAR(100),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrate data if it exists
INSERT INTO officers (officer_id, student_id, role, position, join_date, end_date, department, bio, created_at, updated_at)
SELECT officer_id, 'TEMP', NULL, position, term_start, term_end, department, bio, created_at, updated_at
FROM officers_old
ON CONFLICT (officer_id) DO NOTHING;

-- Create discord_config table if it doesn't exist
CREATE TABLE IF NOT EXISTS discord_config (
    guild_id VARCHAR(255) PRIMARY KEY,
    announcement_channel VARCHAR(255),
    welcome_channel VARCHAR(255),
    log_channel VARCHAR(255),
    executive_role VARCHAR(255),
    member_role VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate indexes
DROP INDEX IF EXISTS idx_payments_student_id CASCADE;
DROP INDEX IF EXISTS idx_payments_date CASCADE;
DROP INDEX IF EXISTS idx_officers_student_id CASCADE;
DROP INDEX IF EXISTS idx_officers_join_date CASCADE;
DROP INDEX IF EXISTS idx_discord_config_guild_id CASCADE;

CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_date ON payments(date);
CREATE INDEX idx_officers_student_id ON officers(student_id);
CREATE INDEX idx_officers_join_date ON officers(join_date);
CREATE INDEX idx_discord_config_guild_id ON discord_config(guild_id);

-- Clean up backups
DROP TABLE IF EXISTS payments_old CASCADE;
DROP TABLE IF EXISTS officers_old CASCADE;
