import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import { authorize } from "../../security/middleware/authorize.middleware.js";

import * as controller from "./financial-approval.controller.js";

import {
  advertisementFinancialApprovalAdvertisementIdSchema,
  advertisementFinancialApprovalIdSchema,
  advertisementFinancialApprovalPaymentIdSchema,
  advertisementFinancialApprovalQuerySchema,
  approveAdvertisementFinancialApprovalSchema,
  createAdvertisementFinancialApprovalSchema,
  holdAdvertisementFinancialApprovalSchema,
  rejectAdvertisementFinancialApprovalSchema,
  resubmitAdvertisementFinancialApprovalSchema,
  updateAdvertisementFinancialApprovalRemarksSchema
} from "./financial-approval.validation.js";

const router = Router();

/**
 * Financial approval RBAC resource.
 *
 * Production permission resource:
 *
 * advertisements.financial_approvals
 */
const FINANCIAL_APPROVAL_RESOURCE = "advertisements.financial_approvals";

/**
 * Advertisement RBAC resource.
 *
 * Financial approval creation, remarks update and resubmission
 * are part of the advertisement submission workflow.
 */
const ADVERTISEMENT_RESOURCE = "advertisements";

/**
 * ============================================================================
 * FINANCIAL APPROVAL CREATION
 * ============================================================================
 *
 * Ad Creator creates/submits a financial approval request.
 *
 * Production permission:
 *
 * advertisements.submit
 *
 * IMPORTANT:
 * Do NOT use:
 *
 * advertisements.financial_approvals.create
 *
 * because financial approval creation belongs to the advertisement
 * submission workflow.
 */
router.post(
  "/",
  authorize("ADVERTISEMENT", ADVERTISEMENT_RESOURCE, "submit"),
  validate(createAdvertisementFinancialApprovalSchema, "body"),
  controller.createFinancialApproval
);

/**
 * ============================================================================
 * FINANCIAL APPROVAL LIST
 * ============================================================================
 *
 * Production permission:
 *
 * advertisements.financial_approvals.read
 */
router.get(
  "/",
  authorize("ADVERTISEMENT", FINANCIAL_APPROVAL_RESOURCE, "read"),
  validate(advertisementFinancialApprovalQuerySchema, "query"),
  controller.getFinancialApprovals
);

/**
 * ============================================================================
 * ADVERTISEMENT-LEVEL LOOKUPS
 * ============================================================================
 */

/**
 * Check whether any financial approval exists for an advertisement.
 */
router.get(
  "/advertisements/:advertisementId/exists",
  authorize("ADVERTISEMENT", FINANCIAL_APPROVAL_RESOURCE, "read"),
  validate(advertisementFinancialApprovalAdvertisementIdSchema, "params"),
  controller.checkFinancialApprovalExistsForAdvertisement
);

/**
 * Get the latest financial approval for an advertisement.
 */
router.get(
  "/advertisements/:advertisementId/latest",
  authorize("ADVERTISEMENT", FINANCIAL_APPROVAL_RESOURCE, "read"),
  validate(advertisementFinancialApprovalAdvertisementIdSchema, "params"),
  controller.getLatestFinancialApprovalByAdvertisementId
);

/**
 * Get the current pending financial approval for an advertisement.
 *
 * Pending states are controlled by the service/repository workflow.
 */
router.get(
  "/advertisements/:advertisementId/pending",
  authorize("ADVERTISEMENT", FINANCIAL_APPROVAL_RESOURCE, "read"),
  validate(advertisementFinancialApprovalAdvertisementIdSchema, "params"),
  controller.getPendingFinancialApprovalByAdvertisementId
);

/**
 * ============================================================================
 * PAYMENT-LEVEL LOOKUP
 * ============================================================================
 */

/**
 * Get the current pending financial approval for a payment.
 */
router.get(
  "/payments/:paymentId/pending",
  authorize("ADVERTISEMENT", FINANCIAL_APPROVAL_RESOURCE, "read"),
  validate(advertisementFinancialApprovalPaymentIdSchema, "params"),
  controller.getPendingFinancialApprovalByPaymentId
);

/**
 * ============================================================================
 * FINANCIAL APPROVAL REMARK UPDATE
 * ============================================================================
 *
 * Ad Creator can update the request remarks while the request remains
 * editable.
 *
 * Production permission:
 *
 * advertisements.update
 */
router.patch(
  "/:id/remarks",
  authorize("ADVERTISEMENT", ADVERTISEMENT_RESOURCE, "update"),
  validate(advertisementFinancialApprovalIdSchema, "params"),
  validate(updateAdvertisementFinancialApprovalRemarksSchema, "body"),
  controller.updateFinancialApprovalRemarks
);

/**
 * ============================================================================
 * FINANCE APPROVER ACTIONS
 * ============================================================================
 */

/**
 * Put a submitted financial approval on hold.
 *
 * Production permission:
 *
 * advertisements.financial_approvals.hold
 */
router.post(
  "/:id/hold",
  authorize("ADVERTISEMENT", FINANCIAL_APPROVAL_RESOURCE, "hold"),
  validate(advertisementFinancialApprovalIdSchema, "params"),
  validate(holdAdvertisementFinancialApprovalSchema, "body"),
  controller.holdFinancialApproval
);

/**
 * Reject a financial approval.
 *
 * Production permission:
 *
 * advertisements.financial_approvals.reject
 */
router.post(
  "/:id/reject",
  authorize("ADVERTISEMENT", FINANCIAL_APPROVAL_RESOURCE, "reject"),
  validate(advertisementFinancialApprovalIdSchema, "params"),
  validate(rejectAdvertisementFinancialApprovalSchema, "body"),
  controller.rejectFinancialApproval
);

/**
 * Approve a financial approval.
 *
 * Production permission:
 *
 * advertisements.financial_approvals.approve
 */
router.post(
  "/:id/approve",
  authorize("ADVERTISEMENT", FINANCIAL_APPROVAL_RESOURCE, "approve"),
  validate(advertisementFinancialApprovalIdSchema, "params"),
  validate(approveAdvertisementFinancialApprovalSchema, "body"),
  controller.approveFinancialApproval
);

/**
 * ============================================================================
 * RESUBMISSION
 * ============================================================================
 *
 * Resubmission returns a HOLD/REJECTED financial approval to SUBMITTED.
 *
 * This is an Ad Creator operation and therefore uses:
 *
 * advertisements.submit
 */
router.post(
  "/:id/resubmit",
  authorize("ADVERTISEMENT", ADVERTISEMENT_RESOURCE, "submit"),
  validate(advertisementFinancialApprovalIdSchema, "params"),
  validate(resubmitAdvertisementFinancialApprovalSchema, "body"),
  controller.resubmitFinancialApproval
);

/**
 * ============================================================================
 * INDIVIDUAL READ / HISTORY
 * ============================================================================
 */

/**
 * Get financial approval history.
 */
router.get(
  "/:id/history",
  authorize("ADVERTISEMENT", FINANCIAL_APPROVAL_RESOURCE, "read"),
  validate(advertisementFinancialApprovalIdSchema, "params"),
  controller.getFinancialApprovalHistory
);

/**
 * Check whether a financial approval exists by ID.
 */
router.get(
  "/:id/exists",
  authorize("ADVERTISEMENT", FINANCIAL_APPROVAL_RESOURCE, "read"),
  validate(advertisementFinancialApprovalIdSchema, "params"),
  controller.checkFinancialApprovalExists
);

/**
 * Get a financial approval by ID.
 */
router.get(
  "/:id",
  authorize("ADVERTISEMENT", FINANCIAL_APPROVAL_RESOURCE, "read"),
  validate(advertisementFinancialApprovalIdSchema, "params"),
  controller.getFinancialApprovalById
);

export default router;

/*

Collection
GET    /api/v1/advertisements/payments/financial-approval
POST   /api/v1/advertisements/payments/financial-approval
Individual approval
GET    /api/v1/advertisements/payments/financial-approval/:id
GET    /api/v1/advertisements/payments/financial-approval/:id/exists
PATCH  /api/v1/advertisements/payments/financial-approval/:id/remarks
GET    /api/v1/advertisements/payments/financial-approval/:id/history
Workflow
POST /api/v1/advertisements/payments/financial-approval/:id/hold
POST /api/v1/advertisements/payments/financial-approval/:id/reject
POST /api/v1/advertisements/payments/financial-approval/:id/approve
POST /api/v1/advertisements/payments/financial-approval/:id/resubmit
Advertisement lookups
GET /api/v1/advertisements/payments/financial-approval/advertisements/:advertisementId/exists
GET /api/v1/advertisements/payments/financial-approval/advertisements/:advertisementId/latest
GET /api/v1/advertisements/payments/financial-approval/advertisements/:advertisementId/pending
Payment lookup
GET /api/v1/advertisements/payments/financial-approval/payments/:paymentId/pending
*/
