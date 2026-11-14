-- Run once on Neon before deploying the updated backend.
BEGIN;
ALTER TABLE news ADD COLUMN IF NOT EXISTS show_on_homepage BOOLEAN NOT NULL DEFAULT FALSE;
-- Preserve homepage eligibility of existing published articles.
UPDATE news SET show_on_homepage = TRUE WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_news_homepage_published
  ON news (published_at DESC, id DESC)
  WHERE status = 'PUBLISHED' AND show_on_homepage = TRUE;
COMMIT;
