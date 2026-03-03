-- CAI Website Database Schema Dump
-- Created for: cai_db
-- User: cai
-- Tables: profile, users, refresh_tokens, points, events, payments, announcements, officers, discord

-- Drop existing tables (if needed for reset)
-- DROP TABLE IF EXISTS refresh_tokens CASCADE;
-- DROP TABLE IF EXISTS points CASCADE;
-- DROP TABLE IF EXISTS profile CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS events CASCADE;
-- DROP TABLE IF EXISTS payments CASCADE;
-- DROP TABLE IF EXISTS announcements CASCADE;
-- DROP TABLE IF EXISTS officers CASCADE;
-- DROP TABLE IF EXISTS discord CASCADE;

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PROFILE TABLE (Student/Member Profiles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profile (
    student_id VARCHAR(50) PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(user_id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    discord_id VARCHAR(255),
    shirt_size VARCHAR(10),
    grade_level VARCHAR(50),
    gender INTEGER,
    join_source VARCHAR(255),
    phone VARCHAR(20),
    major VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- REFRESH TOKENS TABLE (JWT Token Management)
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    jti VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
    event_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(100),
    description TEXT,
    location VARCHAR(255),
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    capacity INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- POINTS TABLE (Member Points/Attendance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS points (
    points_id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL REFERENCES profile(student_id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES events(event_id) ON DELETE SET NULL,
    points INTEGER DEFAULT 0,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    payment_id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL REFERENCES profile(student_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2),
    date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50),
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ANNOUNCEMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS announcements (
    announcement_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    author_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- OFFICERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS officers (
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

-- ============================================================================
-- DISCORD TABLE (Discord Integration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS discord (
    discord_id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    discord_username VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DISCORD CONFIG TABLE (Discord Guild Configuration)
-- ============================================================================
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

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profile_user_id ON profile(user_id);
CREATE INDEX IF NOT EXISTS idx_points_student_id ON points(student_id);
CREATE INDEX IF NOT EXISTS idx_points_event_id ON points(event_id);
CREATE INDEX IF NOT EXISTS idx_points_date ON points(date);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_jti ON refresh_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_officers_student_id ON officers(student_id);
CREATE INDEX IF NOT EXISTS idx_officers_join_date ON officers(join_date);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_discord_config_guild_id ON discord_config(guild_id);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
