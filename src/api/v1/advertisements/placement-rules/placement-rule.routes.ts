import { Router } from "express";

import { authenticate } from "../../../../api/v1/security/middleware/authenticate.middleware.js";
import { authorize } from "../../../../api/v1/security/middleware/authorize.middleware.js";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import * as controller from "./placement-rule.controller.js";
import {
  createPlacementRuleSchema,
  placementRuleIdSchema,
  placementRuleQuerySchema,
  updatePlacementRuleSchema
} from "./placement-rule.validation.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("ADVERTISEMENT", "advertisements.placement_rules", "read"),
  validate(placementRuleQuerySchema, "query"),
  controller.getAll
);

router.get(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.placement_rules", "read"),
  validate(placementRuleIdSchema, "params"),
  controller.getById
);

router.post(
  "/",
  authorize("ADVERTISEMENT", "advertisements.placement_rules", "create"),
  validate(createPlacementRuleSchema, "body"),
  controller.create
);

router.patch(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.placement_rules", "update"),
  validate(placementRuleIdSchema, "params"),
  validate(updatePlacementRuleSchema, "body"),
  controller.update
);

router.delete(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.placement_rules", "delete"),
  validate(placementRuleIdSchema, "params"),
  controller.deactivate
);

export default router;
