-- Private resume-review queue and sponsor portal.  Resume bytes are never stored
-- in the public uploads tree: only authenticated owners and authorised sponsor
-- portal members may read them.
CREATE TABLE IF NOT EXISTS resume_reviews (
  review_id          SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued', 'processing', 'done', 'rejected', 'failed')),
  filename_ext       VARCHAR(5) NOT NULL CHECK (filename_ext IN ('pdf', 'docx')),
  upload             BYTEA,
  resume_blob        BYTEA,
  job_description    TEXT NOT NULL DEFAULT '',
  report             JSONB,
  error_message      TEXT,
  needs_review       BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by        INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  resume_sha256      CHAR(64),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS resume_reviews_queue_idx ON resume_reviews (created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS resume_reviews_user_idx ON resume_reviews (user_id, created_at DESC);

-- A sponsor is explicitly linked to one existing partner organisation.  The
-- partner's authenticated users are its portal users; this avoids a second
-- account system and lets CougarAI revoke access immediately.
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS portal_partner_id INTEGER
  REFERENCES partners(partner_id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sponsors_portal_partner_unique
  ON sponsors (portal_partner_id) WHERE portal_partner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS resume_submissions (
  submission_id      SERIAL PRIMARY KEY,
  review_id          INTEGER NOT NULL REFERENCES resume_reviews(review_id) ON DELETE CASCADE,
  user_id            INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  sponsor_id         INTEGER NOT NULL REFERENCES sponsors(sponsor_id) ON DELETE RESTRICT,
  consent_version    VARCHAR(32) NOT NULL,
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at       TIMESTAMPTZ,
  first_viewed_at    TIMESTAMPTZ,
  last_viewed_at     TIMESTAMPTZ,
  last_viewed_by     INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE (review_id, sponsor_id)
);
CREATE INDEX IF NOT EXISTS resume_submissions_applicant_idx ON resume_submissions (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS resume_submissions_sponsor_idx ON resume_submissions (sponsor_id, submitted_at DESC)
  WHERE withdrawn_at IS NULL;
