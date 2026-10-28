import { Router } from "express";
import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";
import { validate } from "../../../../shared/middleware/validate.middleware.js";
import { formatIdSchema, formatInputSchema } from "./format.validation.js";
import * as controller from "./format.controller.js";
const router = Router();
router.use(authenticate);
router.get(
  "/",
  authorize("ADVERTISEMENT", "advertisements.formats", "read"),
  controller.getAll
);
router.get(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.formats", "read"),
  validate(formatIdSchema, "params"),
  controller.getById
);
router.post(
  "/",
  authorize("ADVERTISEMENT", "advertisements.formats", "create"),
  validate(formatInputSchema, "body"),
  controller.create
);
router.patch(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.formats", "update"),
  validate(formatIdSchema, "params"),
  controller.update
);
router.post(
  "/:id/activate",
  authorize("ADVERTISEMENT", "advertisements.formats", "update"),
  validate(formatIdSchema, "params"),
  controller.activate
);
router.post(
  "/:id/deactivate",
  authorize("ADVERTISEMENT", "advertisements.formats", "update"),
  validate(formatIdSchema, "params"),
  controller.deactivate
);
router.post(
  "/:id/archive",
  authorize("ADVERTISEMENT", "advertisements.formats", "update"),
  validate(formatIdSchema, "params"),
  controller.archive
);
export default router;
