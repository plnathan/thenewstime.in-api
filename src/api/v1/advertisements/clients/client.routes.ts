import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";

import * as controller from "./client.controller.js";

import {
  clientIdSchema,
  clientQuerySchema,
  createClientSchema,
  updateClientSchema
} from "./client.validation.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("ADVERTISEMENT", "advertisements.client", "read"),
  validate(clientQuerySchema, "query"),
  controller.getAll
);

router.get(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.client", "read"),
  validate(clientIdSchema, "params"),
  controller.getById
);

router.post(
  "/",
  authorize("ADVERTISEMENT", "advertisements.client", "create"),
  validate(createClientSchema, "body"),
  controller.create
);

router.patch(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.client", "update"),
  validate(clientIdSchema, "params"),
  validate(updateClientSchema, "body"),
  controller.update
);

export default router;
