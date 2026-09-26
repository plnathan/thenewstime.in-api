import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";

import * as controller from "./tracking.controller.js";

import {
  advertisementMetricsParamsSchema,
  advertisementMetricsQuerySchema,
  advertisementTrackingSchema
} from "./tracking.validation.js";

const router = Router();

/**
 * Public advertisement impression tracking.
 *
 * POST /api/v1/advertisements/tracking/impression
 */
router.post(
  "/impression",
  validate(advertisementTrackingSchema, "body"),
  controller.trackImpression
);

/**
 * Public advertisement click tracking.
 *
 * POST /api/v1/advertisements/tracking/click
 */
router.post(
  "/click",
  validate(advertisementTrackingSchema, "body"),
  controller.trackClick
);

/**
 * Advertisement metrics.
 *
 * Admin/security protected because this endpoint exposes
 * advertiser performance information.
 *
 * GET /api/v1/advertisements/tracking/metrics/:advertisementId
 */
router.get(
  "/metrics/:advertisementId",
  authenticate,
  authorize("ADVERTISEMENTS", "advertisements", "read"),
  validate(advertisementMetricsParamsSchema, "params"),
  validate(advertisementMetricsQuerySchema, "query"),
  controller.getMetrics
);

export default router;
