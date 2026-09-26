import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";

import * as controller from "./financial-approval-threshold.controller.js";

import {
  createFinancialApprovalThresholdSchema,
  financialApprovalThresholdIdSchema,
  listFinancialApprovalThresholdSchema,
  updateFinancialApprovalThresholdSchema
} from "./financial-approval-threshold.validation.js";

const router = Router();

const RESOURCE = "advertisements.financial_approval_thresholds";

router.use(authenticate);

router.get(
  "/",
  authorize("ADVERTISEMENT", RESOURCE, "read"),
  validate(listFinancialApprovalThresholdSchema, "query"),
  controller.getAll
);

router.get(
  "/:id",
  authorize("ADVERTISEMENT", RESOURCE, "read"),
  validate(financialApprovalThresholdIdSchema, "params"),
  controller.getById
);

router.post(
  "/",
  authorize("ADVERTISEMENT", RESOURCE, "create"),
  validate(createFinancialApprovalThresholdSchema, "body"),
  controller.create
);

router.patch(
  "/:id",
  authorize("ADVERTISEMENT", RESOURCE, "update"),
  validate(financialApprovalThresholdIdSchema, "params"),
  validate(updateFinancialApprovalThresholdSchema, "body"),
  controller.update
);

router.post(
  "/:id/activate",
  authorize("ADVERTISEMENT", RESOURCE, "update"),
  validate(financialApprovalThresholdIdSchema, "params"),
  controller.activate
);

router.post(
  "/:id/deactivate",
  authorize("ADVERTISEMENT", RESOURCE, "update"),
  validate(financialApprovalThresholdIdSchema, "params"),
  controller.deactivate
);

export default router;
