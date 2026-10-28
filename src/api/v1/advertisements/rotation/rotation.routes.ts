import { Router } from "express";
import { z } from "zod";

import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import * as controller from "./rotation.controller.js";
import * as creativeController from "./creative-rotation.controller.js";

import {
  createRotationMemberSchema,
  memberIdSchema,
  placementIdSchema,
  updateRotationConfigSchema,
  updateRotationMemberSchema
} from "./rotation.validation.js";

const router = Router();

router.use(authenticate);

const creativeAdvertisementIdSchema = z.object({
  advertisementId: z.coerce.number().int().positive()
});

const updateCreativeRotationSchema = z
  .object({
    rotationEnabled: z.boolean().optional(),
    rotationIntervalSeconds: z.number().int().min(1).max(3600).optional(),
    rotationStrategy: z.literal("ROUND_ROBIN").optional()
  })
  .strict()
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: "At least one creative rotation field is required."
    }
  );

// Advertisement-specific creative rotation

router.get(
  "/advertisements/:advertisementId/creatives",
  authorize("ADVERTISEMENT", "advertisements.rotation", "read"),
  validate(creativeAdvertisementIdSchema, "params"),
  creativeController.getCreativeConfig
);

router.patch(
  "/advertisements/:advertisementId/creatives",
  authorize("ADVERTISEMENT", "advertisements.rotation", "update"),
  validate(creativeAdvertisementIdSchema, "params"),
  validate(updateCreativeRotationSchema, "body"),
  creativeController.updateCreativeConfig
);

// Existing placement-level advertisement rotation

router.get(
  "/placements/:placementId",
  authorize("ADVERTISEMENT", "advertisements.rotation", "read"),
  validate(placementIdSchema, "params"),
  controller.getConfig
);

router.patch(
  "/placements/:placementId",
  authorize("ADVERTISEMENT", "advertisements.rotation", "update"),
  validate(placementIdSchema, "params"),
  validate(updateRotationConfigSchema, "body"),
  controller.updateConfig
);

router.get(
  "/placements/:placementId/members",
  authorize("ADVERTISEMENT", "advertisements.rotation", "read"),
  validate(placementIdSchema, "params"),
  controller.getMembers
);

router.post(
  "/placements/:placementId/members",
  authorize("ADVERTISEMENT", "advertisements.rotation", "create"),
  validate(placementIdSchema, "params"),
  validate(createRotationMemberSchema, "body"),
  controller.addMember
);

router.patch(
  "/placements/:placementId/members/:memberId",
  authorize("ADVERTISEMENT", "advertisements.rotation", "update"),
  validate(memberIdSchema, "params"),
  validate(updateRotationMemberSchema, "body"),
  controller.updateMember
);

router.delete(
  "/placements/:placementId/members/:memberId",
  authorize("ADVERTISEMENT", "advertisements.rotation", "delete"),
  validate(memberIdSchema, "params"),
  controller.removeMember
);

export default router;

/*
GET
/api/v1/advertisements/rotation/placements/:placementId

PATCH
/api/v1/advertisements/rotation/placements/:placementId

GET
/api/v1/advertisements/rotation/placements/:placementId/members

POST
/api/v1/advertisements/rotation/placements/:placementId/members

PATCH
/api/v1/advertisements/rotation/placements/:placementId/members/:memberId

DELETE
/api/v1/advertisements/rotation/placements/:placementId/members/:memberId
*/
