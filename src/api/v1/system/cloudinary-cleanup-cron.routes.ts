/**
 * Project: thenewstime.in
 * Description: Secured Cloudinary cleanup Cron endpoint
 * Route: GET /api/v1/system/cloudinary-cleanup
 */

import { Router } from "express";
import { timingSafeEqual } from "node:crypto";

import {
  enqueueAbandonedMediaUploads,
  runCloudinaryCleanupBatch
} from "../../../shared/services/cloudinary-cleanup.service.js";

import { pool } from "../../../shared/config/db.js";
import { processArchiveCreativeCleanup } from "../advertisements/advertisement/advertisement-archive-cleanup.service.js";

const router = Router();

const validToken = (
  authorization: string | undefined,
  secret: string
): boolean => {
  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const supplied = Buffer.from(authorization.slice(7), "utf8");
  const expected = Buffer.from(secret, "utf8");

  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
};

router.get("/", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const secret = process.env.CRON_SECRET;

  console.log("[Cloudinary Cron] Authentication diagnostic:", {
    secretConfigured: Boolean(secret),
    secretLengthValid: (secret?.length ?? 0) >= 32,
    authorizationPresent: Boolean(req.header("authorization")),
    bearerPrefixValid:
      req.header("authorization")?.startsWith("Bearer ") ?? false
  });

  if (
    !secret ||
    secret.length < 32 ||
    !validToken(req.header("authorization"), secret)
  ) {
    res.status(401).json({
      success: false,
      message: "Unauthorized"
    });
    return;
  }

  const newsEnabled = process.env.CLOUDINARY_CLEANUP_ENABLED === "true";
  const archiveEnabled =
    process.env.ADVERTISEMENT_ARCHIVE_CLEANUP_ENABLED === "true";

  if (!newsEnabled && !archiveEnabled) {
    console.log("[Cloudinary Cron] Cleanup flags:", {
      newsEnabled,
      archiveEnabled,
      abandonedCleanupEnabled:
        process.env.CLOUDINARY_ABANDONED_CLEANUP_ENABLED === "true"
    });

    res.status(200).json({
      success: true,
      status: "PAUSED",
      processed: 0
    });
    return;
  }

  try {
    // Preserve the existing database diagnostics from the current route.
    const diagnostic = await pool.query<{
      database_name: string;
      database_user: string;
      mock_count: string;
      cleanup_job_count: string;
    }>(`
  SELECT
    current_database() AS database_name,
    current_user AS database_user,
    (
      SELECT COUNT(*)::text
      FROM media_assets
      WHERE public_id = 'cleanup-testing/abandoned-test-001'
    ) AS mock_count,
    (
      SELECT COUNT(*)::text
      FROM cloudinary_cleanup_jobs
    ) AS cleanup_job_count
`);

    console.log(
      "[Cloudinary Cleanup] Database diagnostic:",
      diagnostic.rows[0]
    );

    const retentionDays = Number(
      process.env.CLOUDINARY_ABANDONED_RETENTION_DAYS ?? "7"
    );

    const abandonedQueued =
      newsEnabled && process.env.CLOUDINARY_ABANDONED_CLEANUP_ENABLED === "true"
        ? await enqueueAbandonedMediaUploads(retentionDays, 10)
        : 0;

    const newsCleanup = newsEnabled
      ? await runCloudinaryCleanupBatch(10)
      : null;

    const archiveCleanup = archiveEnabled
      ? await processArchiveCreativeCleanup(undefined, 10)
      : null;

    res.status(200).json({
      success: true,
      status: "COMPLETED",
      abandonedQueued,
      newsCleanup,
      archiveCleanup
    });
  } catch (error: unknown) {
    console.error("Cloudinary cleanup cron failed", error);

    res.status(500).json({
      success: false,
      message: "Cloudinary cleanup failed"
    });
  }
});

export default router;
