CREATE TABLE IF NOT EXISTS slideshow_photos (
    photo_id        SERIAL PRIMARY KEY,
    page            VARCHAR(20) NOT NULL CHECK (page IN ('home', 'about')),
    url             TEXT NOT NULL,
    object_position VARCHAR(50) NOT NULL DEFAULT 'center',
    caption         TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    display_order   INTEGER NOT NULL DEFAULT 0,
    uploaded_by     INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slideshow_photos_page ON slideshow_photos(page, display_order);
