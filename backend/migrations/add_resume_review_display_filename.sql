-- User-facing only. Sponsor/officer views continue to identify submissions by
-- the member profile, not this client-supplied filename.
ALTER TABLE resume_reviews ADD COLUMN IF NOT EXISTS display_filename VARCHAR(255);
