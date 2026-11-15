-- A single-row heartbeat lets monitoring distinguish a healthy web API from a
-- stalled resume-processing worker.
CREATE TABLE IF NOT EXISTS resume_worker_heartbeats (
  worker_name VARCHAR(64) PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_review_id INTEGER REFERENCES resume_reviews(review_id) ON DELETE SET NULL
);
