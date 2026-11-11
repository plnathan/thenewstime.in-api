import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import * as controller from "./delivery.controller.js";

import {
  advertisementDeliveryQuerySchema,
  advertisementPageDeliveryQuerySchema
} from "./delivery.validation.js";

const router = Router();

/**
 * Public placement discovery.
 *
 * GET /api/v1/advertisements/delivery/slots
 *
 * No authentication required.
 */
router.get("/slots", controller.getPublicPlacementSlots);

/** One request returns discovery and eligible inventory for every enabled slot. */
router.get(
  "/page",
  validate(advertisementPageDeliveryQuerySchema, "query"),
  controller.getPublicPageDelivery
);

/**
 * Public advertisement delivery.
 *
 * GET /api/v1/advertisements/delivery
 *
 * No authentication required.
 */
router.get(
  "/",
  validate(advertisementDeliveryQuerySchema, "query"),
  controller.getEligibleAdvertisements
);

export default router;
