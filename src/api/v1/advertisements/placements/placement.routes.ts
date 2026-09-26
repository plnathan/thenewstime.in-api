import { Router } from "express";

import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import * as controller from "./placement.controller.js";

import {
  createPlacementSchema,
  placementIdSchema,
  updatePlacementSchema
} from "./placement.validation.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("ADVERTISEMENT", "advertisements.placements", "read"),
  controller.getAll
);

router.post(
  "/:id/enable",
  authorize("ADVERTISEMENT", "advertisements.placements", "update"),
  validate(placementIdSchema, "params"),
  controller.enable
);

router.post(
  "/:id/disable",
  authorize("ADVERTISEMENT", "advertisements.placements", "update"),
  validate(placementIdSchema, "params"),
  controller.disable
);

router.get(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.placements", "read"),
  validate(placementIdSchema, "params"),
  controller.getById
);

router.post(
  "/",
  authorize("ADVERTISEMENT", "advertisements.placements", "create"),
  validate(createPlacementSchema, "body"),
  controller.create
);

router.patch(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.placements", "update"),
  validate(placementIdSchema, "params"),
  validate(updatePlacementSchema, "body"),
  controller.update
);

router.delete(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.placements", "delete"),
  validate(placementIdSchema, "params"),
  controller.deactivate
);

export default router;
