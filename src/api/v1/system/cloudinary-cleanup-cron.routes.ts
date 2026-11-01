/**
 * Project: thenewstime.in
 * Description: Secured Cloudinary cleanup Cron endpoint
 * Route: GET /api/v1/system/cloudinary-cleanup
 */

import { timingSafeEqual } from "node:crypto";
import { Router } from "express";

import { runCloudinaryCleanupBatch } from "../../../shared/services/cloudinary-cleanup.service.js";

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

  if (process.env.CLOUDINARY_CLEANUP_ENABLED !== "true") {
    console.log(
    "[Cloudinary Cron] Cleanup enabled:",
    JSON.stringify(process.env.CLOUDINARY_CLEANUP_ENABLED)
    );
    
    res.status(200).json({
      success: true,
      status: "PAUSED",
      processed: 0
    });
    return;
  }

  try {
    const result = await runCloudinaryCleanupBatch(10);

    res.status(200).json({
      success: true,
      status: "COMPLETED",
      ...result
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
