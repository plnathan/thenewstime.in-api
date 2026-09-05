import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import { authenticate } from "../middleware/authenticate.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";

import * as controller from "./permission.controller.js";

import {
  createPermissionSchema,
  permissionIdSchema,
  updatePermissionSchema
} from "./permission.validation.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("SECURITY", "permissions", "read"),
  controller.getAll
);

router.get(
  "/:id",
  authorize("SECURITY", "permissions", "read"),
  validate(permissionIdSchema, "params"),
  controller.getById
);

router.post(
  "/",
  authorize("SECURITY", "permissions", "create"),
  validate(createPermissionSchema, "body"),
  controller.create
);

router.patch(
  "/:id",
  authorize("SECURITY", "permissions", "update"),
  validate(permissionIdSchema, "params"),
  validate(updatePermissionSchema, "body"),
  controller.update
);

router.get(
  "/role/:roleId",
  authorize("SECURITY", "permissions", "read"),
  controller.getRolePermissions
);

router.post(
  "/role/:roleId/:permissionId",
  authorize("SECURITY", "roles", "assign"),
  controller.assignToRole
);

router.delete(
  "/role/:roleId/:permissionId",
  authorize("SECURITY", "roles", "assign"),
  controller.removeFromRole
);

export default router;
