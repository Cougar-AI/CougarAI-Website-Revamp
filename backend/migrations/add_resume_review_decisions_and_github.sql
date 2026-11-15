-- Officer decisions remain private to the member and officers.  A rejection
-- prevents the reviewed file from ever being shared with a sponsor.
ALTER TABLE resume_reviews
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE resume_reviews
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Keep candidate links distinct so recruiters can immediately tell what each
-- destination is without having to infer it from the URL.
ALTER TABLE resume_submissions
  ADD COLUMN IF NOT EXISTS github_url VARCHAR(500);
