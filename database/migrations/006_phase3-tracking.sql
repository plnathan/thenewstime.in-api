BEGIN;
ALTER TABLE advertisement_impressions ADD COLUMN IF NOT EXISTS feed_view_id uuid;
ALTER TABLE advertisement_clicks ADD COLUMN IF NOT EXISTS feed_view_id uuid, ADD COLUMN IF NOT EXISTS feed_event_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS ux_feed_click_event_element ON advertisement_clicks(feed_event_id,feed_element);
CREATE INDEX IF NOT EXISTS idx_feed_impression_period ON advertisement_impressions(impression_at,feed_batch_id) WHERE feed_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_feed_click_period ON advertisement_clicks(click_at,feed_batch_id) WHERE feed_batch_id IS NOT NULL;
COMMIT;