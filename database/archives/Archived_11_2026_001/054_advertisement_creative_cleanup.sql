-- Run before deploying the updated advertisement archive service.
CREATE TABLE IF NOT EXISTS advertisement_creative_cleanup (
  id BIGSERIAL PRIMARY KEY,
  creative_id BIGINT NOT NULL UNIQUE REFERENCES advertisement_creatives(id),
  advertisement_id BIGINT NOT NULL REFERENCES advertisements(id),
  public_id TEXT NOT NULL,
  resource_type VARCHAR(10) NOT NULL CHECK (resource_type IN ('image','video')),
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','PROCESSING','FAILED','DELETED','SKIPPED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ad_creative_cleanup_pending
  ON advertisement_creative_cleanup(status, next_attempt_at, id);
