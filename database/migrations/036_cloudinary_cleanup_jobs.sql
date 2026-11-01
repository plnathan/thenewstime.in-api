CREATE TABLE IF NOT EXISTS cloudinary_cleanup_jobs (
  id BIGSERIAL PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL CHECK (reason IN ('NEWS_DELETED','MEDIA_REMOVED','FAILED_UPLOAD','ABANDONED_UPLOAD')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','CANCELLED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cloudinary_cleanup_pending
ON cloudinary_cleanup_jobs (next_attempt_at, id) WHERE status = 'PENDING';
