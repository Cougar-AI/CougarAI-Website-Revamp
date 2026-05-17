-- Budget funds: named buckets with optional spending limits
CREATE TABLE IF NOT EXISTS budget_funds (
  fund_id      SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  budget_limit NUMERIC(10,2),
  fiscal_year  INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Receipts: individual spending records
CREATE TABLE IF NOT EXISTS receipts (
  receipt_id         SERIAL PRIMARY KEY,
  title              VARCHAR(255) NOT NULL,
  vendor             VARCHAR(255),
  amount             NUMERIC(10,2) NOT NULL,
  category           VARCHAR(100),
  fund_id            INTEGER REFERENCES budget_funds(fund_id) ON DELETE SET NULL,
  description        TEXT,
  notes              TEXT,
  receipt_image_path TEXT,
  submitted_by       INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
