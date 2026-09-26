import { Router } from "express";

import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import * as controller from "./schedule.controller.js";

import {
  createScheduleSchema,
  scheduleIdSchema,
  scheduleQuerySchema,
  updateScheduleSchema
} from "./schedule.validation.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("ADVERTISEMENT", "advertisements.schedules", "read"),
  validate(scheduleQuerySchema, "query"),
  controller.getAll
);

router.get(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.schedules", "read"),
  validate(scheduleIdSchema, "params"),
  controller.getById
);

router.post(
  "/",
  authorize("ADVERTISEMENT", "advertisements.schedules", "create"),
  validate(createScheduleSchema, "body"),
  controller.create
);

router.patch(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.schedules", "update"),
  validate(scheduleIdSchema, "params"),
  validate(updateScheduleSchema, "body"),
  controller.update
);

router.post(
  "/:id/activate",
  authorize("ADVERTISEMENT", "advertisements.schedules", "activate"),
  validate(scheduleIdSchema, "params"),
  controller.activate
);

router.post(
  "/:id/pause",
  authorize("ADVERTISEMENT", "advertisements.schedules", "pause"),
  validate(scheduleIdSchema, "params"),
  controller.pause
);

router.post(
  "/:id/resume",
  authorize("ADVERTISEMENT", "advertisements.schedules", "resume"),
  validate(scheduleIdSchema, "params"),
  controller.resume
);

router.post(
  "/:id/complete",
  authorize("ADVERTISEMENT", "advertisements.schedules", "complete"),
  validate(scheduleIdSchema, "params"),
  controller.complete
);

router.post(
  "/:id/cancel",
  authorize("ADVERTISEMENT", "advertisements.schedules", "delete"),
  validate(scheduleIdSchema, "params"),
  controller.cancel
);

router.delete(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.schedules", "delete"),
  validate(scheduleIdSchema, "params"),
  controller.cancel
);

export default router;
