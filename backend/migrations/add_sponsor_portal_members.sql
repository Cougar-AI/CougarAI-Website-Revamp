-- Sponsor resume access is independent from the broader Partner feature.
ALTER TABLE sponsors
  ADD COLUMN IF NOT EXISTS resume_portal_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS sponsor_portal_members (
  sponsor_id INTEGER NOT NULL REFERENCES sponsors(sponsor_id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  portal_role VARCHAR(32) NOT NULL DEFAULT 'recruiter',
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sponsor_id, user_id),
  CHECK (portal_role IN ('recruiter', 'manager'))
);

-- Preserve access from the original integration while new sponsor-specific
-- recruiter access is configured in Admin > Sponsors.
UPDATE sponsors SET resume_portal_enabled = TRUE
WHERE portal_partner_id IS NOT NULL;

INSERT INTO sponsor_portal_members (sponsor_id, user_id, portal_role)
SELECT s.sponsor_id, pm.user_id, 'manager'
FROM sponsors s
JOIN partner_members pm ON pm.partner_id = s.portal_partner_id
WHERE s.portal_partner_id IS NOT NULL
ON CONFLICT (sponsor_id, user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS sponsor_portal_members_user_idx
  ON sponsor_portal_members (user_id, sponsor_id);

-- The production API uses this least-privilege application role rather than
-- the PostgreSQL owner that runs migrations.
GRANT SELECT, INSERT, UPDATE, DELETE ON sponsor_portal_members TO cai_prod_api;
