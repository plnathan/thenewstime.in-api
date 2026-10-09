import { Router } from "express";

import { authorize } from "../../security/middleware/authorize.middleware.js";

import {
  createTarget,
  deleteTarget,
  getTargets,
  replaceAllTargets,
  updateTarget
} from "./target.controller.js";

const router = Router();

router.get(
  "/:advertisementId/targets",
  authorize("ADVERTISEMENT", "advertisements.targets", "read"),
  getTargets
);

router.post(
  "/:advertisementId/targets",
  authorize("ADVERTISEMENT", "advertisements.targets", "create"),
  createTarget
);

router.put(
  "/:advertisementId/targets",
  authorize("ADVERTISEMENT", "advertisements.targets", "update"),
  replaceAllTargets
);

router.patch(
  "/:advertisementId/targets/:targetId",
  authorize("ADVERTISEMENT", "advertisements.targets", "update"),
  updateTarget
);

router.delete(
  "/:advertisementId/targets/:targetId",
  authorize("ADVERTISEMENT", "advertisements.targets", "delete"),
  deleteTarget
);

export default router;
