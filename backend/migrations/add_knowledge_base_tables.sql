CREATE TABLE IF NOT EXISTS knowledge_entries (
    entry_id SERIAL PRIMARY KEY,
    content_type VARCHAR(40) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NOT NULL,
    body TEXT NOT NULL,
    source_label VARCHAR(120),
    source_url TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_active_published
    ON knowledge_entries (is_active, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_content_type
    ON knowledge_entries (content_type);

CREATE TABLE IF NOT EXISTS knowledge_comments (
    comment_id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES knowledge_entries(entry_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    display_name VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_comments_entry_created
    ON knowledge_comments (entry_id, created_at DESC);

INSERT INTO knowledge_entries (content_type, title, summary, body, source_label, source_url, tags, published_at, is_featured)
SELECT 'workshop', 'Intro to Machine Learning Workshop Notes', 'A quick recap of the first ML workshop and the practical ideas members took away.',
       'Covers the basic workflow we discussed: data cleaning, train/test splits, model selection, and the importance of starting with a small baseline before tuning. Good follow-up topics include feature engineering and model evaluation.',
       'Workshop archive', NULL, ARRAY['workshop', 'machine learning', 'basics'], NOW() - INTERVAL '90 days', TRUE
WHERE NOT EXISTS (SELECT 1 FROM knowledge_entries WHERE title = 'Intro to Machine Learning Workshop Notes');

INSERT INTO knowledge_entries (content_type, title, summary, body, source_label, source_url, tags, published_at, is_featured)
SELECT 'project', 'Project Team Advice from Past Officers', 'What previous officers wish every project team knew before kicking off.',
       'Start with a clear scope, define what success looks like, and keep a weekly checkpoint with a short demo. The strongest teams documented blockers early, split work into visible milestones, and kept a shared list of tools and datasets.',
       'Officer notes', NULL, ARRAY['project', 'officer advice', 'teamwork'], NOW() - INTERVAL '75 days', TRUE
WHERE NOT EXISTS (SELECT 1 FROM knowledge_entries WHERE title = 'Project Team Advice from Past Officers');

INSERT INTO knowledge_entries (content_type, title, summary, body, source_label, source_url, tags, published_at, is_featured)
SELECT 'cai_news', 'CougarAI Club Update: New Member Resources', 'A summary of the latest internal updates for members and organizers.',
       'Recent updates include a tighter event archive, stronger onboarding notes, and a growing library of reusable workshop content. Members asked for more searchable past material, which is what this knowledge base is built to support.',
       'CougarAI update', NULL, ARRAY['cai news', 'members', 'resources'], NOW() - INTERVAL '45 days', TRUE
WHERE NOT EXISTS (SELECT 1 FROM knowledge_entries WHERE title = 'CougarAI Club Update: New Member Resources');

INSERT INTO knowledge_entries (content_type, title, summary, body, source_label, source_url, tags, published_at, is_featured)
SELECT 'ai_news', 'AI News: Keep an Eye on Smaller Open Models', 'A lightweight digest of a broader AI trend worth following.',
       'The current direction in AI is not just bigger models, but more efficient models and better tooling around fine-tuning, retrieval, and deployment. That matters for student projects because smaller, faster models are easier to prototype with and cheaper to run.',
       'Curated AI news', NULL, ARRAY['ai news', 'open models', 'trends'], NOW() - INTERVAL '30 days', FALSE
WHERE NOT EXISTS (SELECT 1 FROM knowledge_entries WHERE title = 'AI News: Keep an Eye on Smaller Open Models');

INSERT INTO knowledge_entries (content_type, title, summary, body, source_label, source_url, tags, published_at, is_featured)
SELECT 'workshop', 'How to Turn a Workshop into a Portfolio Project', 'A practical checklist for members who want to keep building after the session ends.',
       'Take the workshop starter code, rebuild the demo in your own words, then add one useful extension such as a new dataset, UI refinement, or evaluation metric. The goal is to leave the workshop with something that looks like your own work, not just a copied notebook.',
       'Workshop archive', NULL, ARRAY['workshop', 'portfolio', 'projects'], NOW() - INTERVAL '15 days', FALSE
WHERE NOT EXISTS (SELECT 1 FROM knowledge_entries WHERE title = 'How to Turn a Workshop into a Portfolio Project');