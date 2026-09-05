import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import { authenticate } from "../middleware/authenticate.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";

import * as controller from "./user.controller.js";

import {
  createUserSchema,
  updateUserSchema,
  userIdSchema
} from "./user.validation.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SECURITY", "users", "read"), controller.getAll);

router.get(
  "/:id",
  authorize("SECURITY", "users", "read"),
  validate(userIdSchema, "params"),
  controller.getById
);

router.post(
  "/",
  authorize("SECURITY", "users", "create"),
  validate(createUserSchema),
  controller.create
);

router.patch(
  "/:id",
  authorize("SECURITY", "users", "update"),
  validate(userIdSchema, "params"),
  validate(updateUserSchema, "body"),
  controller.update
);

router.delete(
  "/:id",
  authorize("SECURITY", "users", "delete"),
  validate(userIdSchema, "params"),
  controller.remove
);

export default router;
