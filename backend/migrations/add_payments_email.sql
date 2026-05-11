-- Allow payments to be recorded for members who checked out without a student ID.
-- Run once against the database.

ALTER TABLE payments
    ALTER COLUMN student_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS email VARCHAR(255);
