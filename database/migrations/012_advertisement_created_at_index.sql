-- Evaluate live indexes and query plan first. Run outside a transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_advertisements_created_at_id
ON public.advertisements (created_at DESC, id DESC);
