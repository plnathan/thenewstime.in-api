import { Router } from "express";

import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";

import * as controller from "./rate-card.controller.js";

const router = Router();

router.use(authenticate);

/*
 * Keep the rate-card API under the existing advertisement permission
 * resource for compatibility with the current advertisement pricing
 * workflow and E2E creator role.
 */

router.get(
  "/",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  controller.getAll
);

router.get(
  "/placement/:placementId/effective/:pricingUnit",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  controller.getEffectiveRate
);

router.get(
  "/placement/:placementId",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  controller.getByPlacementId
);

router.get(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  controller.getById
);

router.post(
  "/",
  authorize("ADVERTISEMENT", "advertisements", "create"),
  controller.create
);

router.patch(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements", "update"),
  controller.update
);

router.delete(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements", "update"),
  controller.deactivate
);

router.post(
  "/:id/archive",
  authorize("ADVERTISEMENT", "advertisements", "update"),
  controller.archive
);

export default router;
