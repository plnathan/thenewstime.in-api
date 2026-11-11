import { deleteCloudinaryAsset } from "../../../../shared/config/cloudinary.js";
import type { PoolClient } from "pg";
import { pool } from "../../../../shared/config/db.js";

/**
 * Archive cleanup outbox. Install the accompanying SQL migration before deploying.
 * Only Cloudinary-owned advertisement images/videos are eligible for deletion.
 */
const ROOT = /^thenewstime_(?:dev|uat|prod)\/advertisement\/(images|videos)\//;

function identifyAsset(
  url: string
): { publicId: string; resourceType: "image" | "video" } | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "res.cloudinary.com"
    )
      return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    const uploadAt = parts.indexOf("upload");
    if (uploadAt < 2) return null;
    const resourceType = parts[uploadAt - 1];
    if (resourceType !== "image" && resourceType !== "video") return null;
    let asset = parts.slice(uploadAt + 1);
    if (/^v\d+$/.test(asset[0] ?? "")) asset = asset.slice(1);
    // Do not guess public IDs when transformations or custom URL structures exist.
    const path = asset.join("/");
    if (!ROOT.test(path)) return null;
    const publicId = path.replace(/\.[^/.]+$/, "");
    if (!ROOT.test(publicId)) return null;
    return { publicId, resourceType };
  } catch {
    return null;
  }
}

export async function queueArchivedCreatives(
  client: PoolClient,
  advertisementId: number,
  archivedBy: number
): Promise<void> {
  const creatives = await client.query<{ id: number; media_url: string }>(
    `SELECT id, media_url FROM advertisement_creatives
     WHERE advertisement_id = $1 FOR UPDATE`,
    [advertisementId]
  );
  for (const creative of creatives.rows) {
    const asset = identifyAsset(creative.media_url);
    if (asset) {
      await client.query(
        `INSERT INTO advertisement_creative_cleanup
           (creative_id, advertisement_id, public_id, resource_type, status)
         VALUES ($1, $2, $3, $4, 'PENDING')
         ON CONFLICT (creative_id) DO NOTHING`,
        [creative.id, advertisementId, asset.publicId, asset.resourceType]
      );
    }
  }
  await client.query(
    `UPDATE advertisement_creatives
     SET status = 'INACTIVE', updated_by = $2, updated_at = CURRENT_TIMESTAMP
     WHERE advertisement_id = $1 AND status <> 'INACTIVE'`,
    [advertisementId, archivedBy]
  );
}

/** Idempotent retry entrypoint. Can be called by a protected scheduled worker. */
export async function processArchiveCreativeCleanup(
  advertisementId?: number,
  batchSize = 50
): Promise<{
  processed: number;
  deleted: number;
  failed: number;
  skipped: number;
}> {
  const result = { processed: 0, deleted: 0, failed: 0, skipped: 0 };
  const boundedBatchSize = Math.min(Math.max(1, Math.floor(batchSize)), 50);
  // Atomic claim prevents two cron invocations from processing the same job.
  // Expired leases allow recovery after a serverless invocation is terminated.
  const jobs = await pool.query<{
    id: number;
    public_id: string;
    resource_type: "image" | "video";
    advertisement_id: number;
    attempts: number;
  }>(
    `WITH picked AS (
       SELECT id FROM advertisement_creative_cleanup
       WHERE ($1::bigint IS NULL OR advertisement_id = $1)
         AND (
           (status IN ('PENDING', 'FAILED') AND
            (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP))
           OR (status = 'PROCESSING' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
         )
       ORDER BY id LIMIT $2 FOR UPDATE SKIP LOCKED
     )
     UPDATE advertisement_creative_cleanup AS job
     SET status = 'PROCESSING', attempts = job.attempts + 1,
         updated_at = CURRENT_TIMESTAMP
     FROM picked WHERE job.id = picked.id
     RETURNING job.id, job.public_id, job.resource_type,
               job.advertisement_id, job.attempts`,
    [advertisementId ?? null, boundedBatchSize]
  );
  for (const job of jobs.rows) {
    result.processed++;
    try {
      // Do not delete if another advertisement still references this asset.
      const shared = await pool.query(
        `SELECT 1 FROM advertisement_creatives c
         JOIN advertisements a ON a.id = c.advertisement_id
         WHERE c.advertisement_id <> $1 AND a.workflow_status <> 'ARCHIVED'
           AND c.status = 'ACTIVE' AND c.media_url LIKE $2 LIMIT 1`,
        [job.advertisement_id, `%/${job.public_id}.%`]
      );
      if (shared.rowCount) {
        await pool.query(
          `UPDATE advertisement_creative_cleanup SET status = 'SKIPPED',
           last_error = 'Asset referenced by another active creative',
           updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND attempts = $2 AND status = 'PROCESSING'`,
          [job.id, job.attempts]
        );
        result.skipped++;
        continue;
      }
      await deleteCloudinaryAsset(job.public_id, job.resource_type);
      await pool.query(
        `UPDATE advertisement_creative_cleanup SET status = 'DELETED',
         deleted_at = CURRENT_TIMESTAMP, last_error = NULL,
         updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND attempts = $2 AND status = 'PROCESSING'`,
        [job.id, job.attempts]
      );
      result.deleted++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await pool.query(
        `UPDATE advertisement_creative_cleanup
         SET status = 'FAILED', last_error = $2,
         next_attempt_at = CURRENT_TIMESTAMP + (LEAST(POWER(2, LEAST(attempts, 8)), 256) * INTERVAL '1 minute'),
         updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND attempts = $3 AND status = 'PROCESSING'`,
        [job.id, message.slice(0, 1000), job.attempts]
      );
      result.failed++;
    }
  }
  return result;
}
