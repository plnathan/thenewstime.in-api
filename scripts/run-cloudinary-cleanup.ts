/**
 * -----------------------------------------------------------------------------
 * Project     : thenewstime.in
 * File        : scripts/run-cloudinary-cleanup.ts
 * Description : Manually or automatically process pending Cloudinary
 *               cleanup jobs.
 * -----------------------------------------------------------------------------
 * To manually , use the below command
 * npx tsx scripts/run-cloudinary-cleanup.ts
 * 
 * SELECT
        id,
        public_id,
        reason,
        status,
        attempts,
        next_attempt_at,
        last_error
  FROM cloudinary_cleanup_jobs
  ORDER BY created_at DESC
  LIMIT 20;

 */

import "dotenv/config";

import { runCloudinaryCleanupBatch } from "../src/shared/services/cloudinary-cleanup.service.js";

import { pool } from "../src/shared/config/db.js";

const main = async (): Promise<void> => {
  try {
    console.log("Starting Cloudinary cleanup...");

    const result = await runCloudinaryCleanupBatch(50);

    console.log("Cloudinary cleanup completed.");
    console.log(`Processed : ${result.processed}`);
    console.log(`Succeeded : ${result.succeeded}`);
    console.log(`Failed    : ${result.failed}`);
  } catch (error: unknown) {
    console.error("Cloudinary cleanup failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

void main();
