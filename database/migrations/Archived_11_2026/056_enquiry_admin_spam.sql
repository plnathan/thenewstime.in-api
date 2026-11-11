-- Apply after initial advertisement_enquiries migration. Run once in UAT first.
ALTER TABLE advertisement_enquiries ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE advertisement_enquiries ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE advertisement_enquiries ADD COLUMN IF NOT EXISTS deleted_by bigint;
ALTER TABLE advertisement_enquiries ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE advertisement_enquiries ADD COLUMN IF NOT EXISTS updated_by bigint;
ALTER TABLE advertisement_enquiries DROP CONSTRAINT IF EXISTS advertisement_enquiries_status_check;
-- The initial migration may use a differently named status constraint. Drop it only after inspection.
DO $$ DECLARE c record; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='advertisement_enquiries'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%status%' LOOP
    EXECUTE format('ALTER TABLE advertisement_enquiries DROP CONSTRAINT %I',c.conname);
  END LOOP;
END $$;
UPDATE advertisement_enquiries SET status = CASE status WHEN 'NEW' THEN 'PENDING' WHEN 'CONTACTED' THEN 'RESPONDED' WHEN 'CONVERTED' THEN 'BOOKED' WHEN 'CLOSED' THEN 'REJECTED' ELSE 'PENDING' END;
ALTER TABLE advertisement_enquiries ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE advertisement_enquiries ADD CONSTRAINT advertisement_enquiries_status_check CHECK(status IN ('PENDING','RESPONDED','REJECTED','BOOKED'));
CREATE INDEX IF NOT EXISTS idx_ad_enquiries_active_status ON advertisement_enquiries(status, created_at DESC) WHERE deleted_at IS NULL;
-- Shared database rate limits work across Vercel instances (unlike in-memory counters).
CREATE TABLE IF NOT EXISTS advertisement_enquiry_rate_limits (
  bucket_key text PRIMARY KEY, requests integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ad_enquiry_rate_expiry ON advertisement_enquiry_rate_limits(expires_at);
