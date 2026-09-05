import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import { authenticate } from "../middleware/authenticate.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";

import * as controller from "./role.controller.js";

import {
  createRoleSchema,
  roleIdSchema,
  updateRoleSchema,
  userIdParamSchema,
  userRoleParamSchema
} from "./role.validation.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("SECURITY", "roles", "read"), controller.getAll);

router.get(
  "/:id",
  authorize("SECURITY", "roles", "read"),
  validate(roleIdSchema, "params"),
  controller.getById
);

router.post(
  "/",
  authorize("SECURITY", "roles", "create"),
  validate(createRoleSchema, "body"),
  controller.create
);

router.patch(
  "/:id",
  authorize("SECURITY", "roles", "update"),
  validate(roleIdSchema, "params"),
  validate(updateRoleSchema, "body"),
  controller.update
);

router.get(
  "/user/:userId",
  authorize("SECURITY", "roles", "read"),
  validate(userIdParamSchema, "params"),
  controller.getUserRoles
);

router.post(
  "/user/:userId/:roleId",
  authorize("SECURITY", "roles", "assign"),
  validate(userRoleParamSchema, "params"),
  controller.assignUserRole
);

router.delete(
  "/user/:userId/:roleId",
  authorize("SECURITY", "roles", "assign"),
  validate(userRoleParamSchema, "params"),
  controller.removeUserRole
);

export default router;
