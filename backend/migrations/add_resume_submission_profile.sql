-- Candidate-controlled recruiter profile snapshot. It is attached to a
-- specific sponsor submission, so later profile edits do not silently alter
-- what an already-selected sponsor was shown.
ALTER TABLE resume_submissions ADD COLUMN IF NOT EXISTS candidate_major VARCHAR(120);
ALTER TABLE resume_submissions ADD COLUMN IF NOT EXISTS graduation_date VARCHAR(60);
ALTER TABLE resume_submissions ADD COLUMN IF NOT EXISTS top_skills JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE resume_submissions ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(500);
ALTER TABLE resume_submissions ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500);
ALTER TABLE resume_submissions ADD COLUMN IF NOT EXISTS seeking_roles VARCHAR(300);
ALTER TABLE resume_submissions ADD COLUMN IF NOT EXISTS availability VARCHAR(160);
ALTER TABLE resume_submissions ADD COLUMN IF NOT EXISTS contact_preference VARCHAR(160);
