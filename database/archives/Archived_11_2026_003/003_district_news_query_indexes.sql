-- District News Page: index-only candidate discovery and bounded news pagination.
-- Run on UAT first. CREATE INDEX CONCURRENTLY cannot run inside BEGIN/COMMIT.
-- Existing indexes should be reviewed before applying to avoid duplicates.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_news_district_published_recent
ON public.news (district_id, published_at DESC, id DESC)
WHERE news_scope = 'DISTRICT' AND status = 'PUBLISHED';

-- Helps fetch district section metadata in display order.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_districts_active_state_order
ON public.districts (state_id, display_order, id)
WHERE status = 'ACTIVE';

-- Query plan inspection (run after deployment with representative UAT data):
-- EXPLAIN (ANALYZE, BUFFERS) SELECT id, published_at FROM public.news
-- WHERE district_id = <existing_district_id>
--   AND news_scope = 'DISTRICT' AND status = 'PUBLISHED'
--   AND published_at <= NOW()
-- ORDER BY published_at DESC, id DESC LIMIT 6;
-- Substitute a real district ID before running EXPLAIN.
