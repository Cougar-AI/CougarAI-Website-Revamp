-- Membership tracking fields for payments table.
-- Run once against the database.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS plan_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS expires_at DATE;
