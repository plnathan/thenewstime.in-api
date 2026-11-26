BEGIN;
CREATE TABLE IF NOT EXISTS advertisement_feed_capacity_settings (id integer PRIMARY KEY CHECK(id=1), min_capacity smallint NOT NULL DEFAULT 1, max_capacity smallint NOT NULL DEFAULT 20, default_capacity smallint NOT NULL DEFAULT 6, created_by bigint REFERENCES users(id), updated_by bigint REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(min_capacity>=1 AND min_capacity<=default_capacity AND default_capacity<=max_capacity));
INSERT INTO advertisement_feed_capacity_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
ALTER TABLE advertisement_feed_batches ADD COLUMN IF NOT EXISTS capacity smallint NOT NULL DEFAULT 6 CHECK(capacity>=1);
ALTER TABLE advertisement_clicks DROP CONSTRAINT IF EXISTS advertisement_clicks_feed_position_check, ADD CONSTRAINT advertisement_clicks_feed_position_check CHECK(feed_position>=1);
ALTER TABLE advertisement_impressions DROP CONSTRAINT IF EXISTS advertisement_impressions_feed_position_check, ADD CONSTRAINT advertisement_impressions_feed_position_check CHECK(feed_position>=1);
COMMIT;
