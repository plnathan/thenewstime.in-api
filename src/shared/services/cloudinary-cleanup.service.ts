import type { PoolClient } from "pg";
import { pool } from "../config/db.js";
import { deleteCloudinaryImage } from "../config/cloudinary.js";

/**
 * Durable cleanup outbox. Requires migrations/20261031_cloudinary_cleanup_jobs.sql.
 * Enqueue in the same transaction that unlinks the media.
 */
export const enqueueCloudinaryDeletion = async (
  publicId: string,
  client: PoolClient,
  reason:
    "NEWS_DELETED" | "MEDIA_REMOVED" | "FAILED_UPLOAD" | "ABANDONED_UPLOAD"
): Promise<void> => {
  await client.query(
    `INSERT INTO cloudinary_cleanup_jobs (public_id, reason, status, next_attempt_at)
     VALUES ($1, $2, 'PENDING', NOW())
     ON CONFLICT (public_id) DO UPDATE SET
       status = CASE WHEN cloudinary_cleanup_jobs.status = 'COMPLETED'
                     THEN 'COMPLETED' ELSE 'PENDING' END,
       next_attempt_at = CASE WHEN cloudinary_cleanup_jobs.status = 'COMPLETED'
                              THEN cloudinary_cleanup_jobs.next_attempt_at ELSE NOW() END,
       updated_at = NOW()`,
    [publicId, reason]
  );
};

/** Upload compensation can happen after its transaction has rolled back. */
export const enqueueFailedUpload = async (publicId: string): Promise<void> => {
  const client = await pool.connect();
  try {
    await enqueueCloudinaryDeletion(publicId, client, "FAILED_UPLOAD");
  } finally {
    client.release();
  }
};

type CleanupJob = { id: number; public_id: string; attempts: number };

/**
 * Claim a bounded batch with leases, then call Cloudinary outside the DB transaction.
 * Can run concurrently on multiple worker instances.
 */
export const runCloudinaryCleanupBatch = async (
  limit = 25
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> => {
  const boundedLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
  const claimed = await pool.query<CleanupJob>(
    `WITH picked AS (
       SELECT id FROM cloudinary_cleanup_jobs
       WHERE (status = 'PENDING' AND next_attempt_at <= NOW())
          OR (status = 'PROCESSING' AND locked_until < NOW())
       ORDER BY next_attempt_at, id
       LIMIT $1 FOR UPDATE SKIP LOCKED
     )
     UPDATE cloudinary_cleanup_jobs j SET
       status = 'PROCESSING',
       locked_until = NOW() + INTERVAL '5 minutes',
       attempts = j.attempts + 1,
       updated_at = NOW()
     FROM picked WHERE j.id = picked.id
     RETURNING j.id, j.public_id, j.attempts`,
    [boundedLimit]
  );

  let succeeded = 0;
  let failed = 0;
  for (const job of claimed.rows) {
    try {
      // Never delete an asset still referenced by an active news-media link.
      const active = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM news_media nm
         JOIN media_assets ma ON ma.id = nm.media_asset_id
         WHERE ma.provider = 'CLOUDINARY'
           AND ma.public_id = $1`,
        [job.public_id]
      );
      if (Number(active.rows[0]?.count ?? 0) > 0) {
        await pool.query(
          `UPDATE cloudinary_cleanup_jobs SET status = 'CANCELLED',
           locked_until = NULL, updated_at = NOW(), last_error = 'Asset still referenced'
           WHERE id = $1 AND status = 'PROCESSING'`,
          [job.id]
        );
        continue;
      }

      await deleteCloudinaryImage(job.public_id);
      await pool.query(
        `UPDATE cloudinary_cleanup_jobs SET status = 'COMPLETED',
         locked_until = NULL, last_error = NULL, updated_at = NOW()
         WHERE id = $1 AND status = 'PROCESSING'`,
        [job.id]
      );
      succeeded += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await pool.query(
        `UPDATE cloudinary_cleanup_jobs SET status = 'PENDING',
         locked_until = NULL, last_error = $2,
         next_attempt_at = NOW() + LEAST(INTERVAL '24 hours',
           INTERVAL '1 minute' * POWER(2, LEAST($3, 10))),
         updated_at = NOW()
         WHERE id = $1 AND status = 'PROCESSING'`,
        [job.id, message.slice(0, 2000), job.attempts]
      );
    }
  }
  return { processed: claimed.rows.length, succeeded, failed };
};
