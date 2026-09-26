import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import * as controller from "./delivery.controller.js";

import { advertisementDeliveryQuerySchema } from "./delivery.validation.js";

const router = Router();

router.get(
  "/",
  validate(advertisementDeliveryQuerySchema, "query"),
  controller.getEligibleAdvertisements
);

export default router;
