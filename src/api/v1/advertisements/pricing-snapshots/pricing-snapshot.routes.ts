import { Router } from "express";

import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";

import * as controller from "./pricing-snapshot.controller.js";

const router = Router();

router.use(authenticate);

/*
 * Pricing snapshots are immutable historical pricing records.
 *
 * The pricing E2E creator uses the existing advertisement-level
 * permissions, so these routes intentionally use:
 *
 *   advertisements.create
 *   advertisements.read
 *
 * rather than introducing separate pricing-snapshot permissions.
 */

router.post(
  "/",
  authorize("ADVERTISEMENT", "advertisements", "create"),
  controller.createPricingSnapshot
);

router.get(
  "/advertisement/:advertisementId",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  controller.getPricingSnapshotsByAdvertisement
);

router.get(
  "/advertisement/:advertisementId/latest",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  controller.getLatestPricingSnapshot
);

router.get(
  "/advertisement/:advertisementId/placement/:placementId/latest",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  controller.getLatestPricingSnapshotByPlacement
);

router.get(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  controller.getPricingSnapshot
);

export default router;
