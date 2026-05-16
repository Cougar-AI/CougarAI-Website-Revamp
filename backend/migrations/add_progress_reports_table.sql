CREATE TABLE IF NOT EXISTS progress_reports (
  report_id          SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(user_id),
  week_of            DATE NOT NULL,
  summary            TEXT,
  tasks_completed    TEXT,
  tasks_in_progress  TEXT,
  tasks_on_hold      TEXT,
  upcoming_tasks     TEXT,
  comments           TEXT,
  feedback           TEXT,
  questions          TEXT,
  submitted_at       TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, week_of)
);
