-- Club projects shown on the public /projects page and managed from Admin → Projects.
CREATE TABLE IF NOT EXISTS projects (
  project_id      SERIAL PRIMARY KEY,
  title           VARCHAR(200) NOT NULL,
  summary         VARCHAR(500),
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed')),
  semester        VARCHAR(50),
  tags            TEXT[] NOT NULL DEFAULT '{}',
  team_members    TEXT[] NOT NULL DEFAULT '{}',
  cover_image_url VARCHAR(500),
  github_url      VARCHAR(500),
  demo_url        VARCHAR(500),
  sponsor_id      INTEGER REFERENCES sponsors(sponsor_id) ON DELETE SET NULL,
  is_published    BOOLEAN NOT NULL DEFAULT TRUE,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_published_order ON projects (is_published, display_order, created_at DESC);
