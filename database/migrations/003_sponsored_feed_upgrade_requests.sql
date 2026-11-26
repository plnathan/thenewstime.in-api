BEGIN;
ALTER TABLE advertisement_feed_upgrades ADD COLUMN reserved_start_at timestamptz, ADD COLUMN reserved_end_at timestamptz, ADD CONSTRAINT chk_feed_upgrade_window CHECK (reserved_end_at > reserved_start_at);
CREATE INDEX idx_feed_upgrade_reservation ON advertisement_feed_upgrades(target_batch_id,reserved_start_at,reserved_end_at) WHERE status='PENDING';
COMMIT;
