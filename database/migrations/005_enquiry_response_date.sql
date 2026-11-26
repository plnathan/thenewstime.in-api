BEGIN;
ALTER TABLE advertisement_enquiries ADD COLUMN IF NOT EXISTS responded_at timestamptz;
-- Historical response dates are unavailable. Do not fabricate them from updated_at.
CREATE INDEX IF NOT EXISTS idx_ad_enquiries_period ON advertisement_enquiries ((COALESCE(responded_at, created_at))) WHERE deleted_at IS NULL;
COMMIT;
