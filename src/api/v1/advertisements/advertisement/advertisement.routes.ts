import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";

import {
  activateAdvertisement,
  approveAdvertisement,
  archiveAdvertisement,
  createAdvertisement,
  getAdvertisementById,
  getAdvertisements,
  getAdvertisementWorkflowHistory,
  holdAdvertisement,
  rejectAdvertisement,
  resumeAdvertisement,
  submitAdvertisement,
  updateAdvertisement
} from "./advertisement.controller.js";

import {
  advertisementHoldSchema,
  advertisementIdSchema,
  advertisementQuerySchema,
  advertisementRejectSchema,
  advertisementWorkflowSchema,
  createAdvertisementSchema,
  updateAdvertisementSchema
} from "./advertisement.validation.js";

import { calculateAdvertisementAgreedAmount } from "../agreed-amount/agreed-amount.controller.js";

import { calculateAdvertisementAgreedAmountSchema } from "../agreed-amount/agreed-amount.validation.js";

import deliveryRoutes from "../delivery/delivery.routes.js";
import financialApprovalRoutes from "../financial-approvals/financial-approval.routes.js";
import financialApprovalThresholdRoutes from "../financial-approval-thresholds/financial-approval-threshold.routes.js";
import paymentRoutes from "../payments/payment.routes.js";
import placementRuleRoutes from "../placement-rules/placement-rule.routes.js";
import scheduleRoutes from "../schedules/schedule.routes.js";
import pricingRoutes from "../pricing/pricing.routes.js";
import pricingSnapshotRoutes from "../pricing-snapshots/pricing-snapshot.routes.js";
import rateCardRoutes from "../rate-cards/rate-card.routes.js";
import clientRoutes from "../clients/client.routes.js";

const router = Router();

/**
 * --------------------------------------------------------------------------
 * Public Advertisement Delivery API
 * --------------------------------------------------------------------------
 *
 * Must be registered before the authentication middleware because delivery
 * APIs are public.
 */
router.use("/delivery", deliveryRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Management APIs
 * --------------------------------------------------------------------------
 *
 * All routes below require authentication.
 */
router.use(authenticate);

router.use("/pricing", pricingRoutes);

router.use("/pricing-snapshots", pricingSnapshotRoutes);

router.use("/rate-cards", rateCardRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Financial Approval Threshold Configuration
 * --------------------------------------------------------------------------
 *
 * Threshold configuration is a protected advertisement sub-module.
 *
 * Final API paths:
 *
 * GET    /api/v1/advertisements/financial-approval-thresholds
 * GET    /api/v1/advertisements/financial-approval-thresholds/:id
 * POST   /api/v1/advertisements/financial-approval-thresholds
 * PATCH  /api/v1/advertisements/financial-approval-thresholds/:id
 * POST   /api/v1/advertisements/financial-approval-thresholds/:id/activate
 * POST   /api/v1/advertisements/financial-approval-thresholds/:id/deactivate
 *
 * These routes are registered before generic advertisement routes.
 */
router.use("/financial-approval-thresholds", financialApprovalThresholdRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Financial Approval
 * --------------------------------------------------------------------------
 *
 * Must be registered before the generic /payments router.
 *
 * Otherwise a request such as:
 *
 * GET /payments/financial-approval
 *
 * could be captured by paymentRoutes first and authorized against
 * advertisements.payments instead of the financial-approval module.
 */
router.use("/payments/financial-approval", financialApprovalRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Payments
 * --------------------------------------------------------------------------
 *
 * Registered after the more-specific financial approval route.
 */
router.use("/payments", paymentRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Placement Rules
 * --------------------------------------------------------------------------
 */
router.use("/placement-rules", placementRuleRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Schedules
 * --------------------------------------------------------------------------
 */
router.use("/schedules", scheduleRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Agreed Amount Calculation
 * --------------------------------------------------------------------------
 *
 * POST /api/v1/advertisements/agreed-amount/calculate
 *
 * Compares the system-calculated standard amount with the negotiated
 * advertisement agreed amount.
 *
 * RBAC:
 *
 *   Resource : advertisements
 *   Action   : read
 *
 * This endpoint is registered before /:id routes so that "agreed-amount"
 * can never be interpreted as an advertisement ID.
 *
 * IMPORTANT:
 *
 * This endpoint performs calculation only.
 * It does not persist or modify advertisements.agreed_amount.
 */
router.post(
  "/agreed-amount/calculate",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  validate(calculateAdvertisementAgreedAmountSchema, "body"),
  calculateAdvertisementAgreedAmount
);

/**
 * --------------------------------------------------------------------------
 * List advertisements
 * --------------------------------------------------------------------------
 *
 * GET /api/v1/advertisements
 */
router.get(
  "/",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  validate(advertisementQuerySchema, "query"),
  getAdvertisements
);

/**
 * --------------------------------------------------------------------------
 * Get advertisement workflow history
 * --------------------------------------------------------------------------
 *
 * GET /api/v1/advertisements/:id/workflow-history
 */
router.get(
  "/:id/workflow-history",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  validate(advertisementIdSchema, "params"),
  getAdvertisementWorkflowHistory
);

router.use("/clients", clientRoutes);

/**
 * --------------------------------------------------------------------------
 * Get advertisement by ID
 * --------------------------------------------------------------------------
 *
 * GET /api/v1/advertisements/:id
 */
router.get(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  validate(advertisementIdSchema, "params"),
  getAdvertisementById
);

/**
 * --------------------------------------------------------------------------
 * Create advertisement
 * --------------------------------------------------------------------------
 *
 * POST /api/v1/advertisements
 */
router.post(
  "/",
  authorize("ADVERTISEMENT", "advertisements", "create"),
  validate(createAdvertisementSchema, "body"),
  createAdvertisement
);

/**
 * --------------------------------------------------------------------------
 * Update advertisement
 * --------------------------------------------------------------------------
 *
 * PATCH /api/v1/advertisements/:id
 */
router.patch(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements", "update"),
  validate(advertisementIdSchema, "params"),
  validate(updateAdvertisementSchema, "body"),
  updateAdvertisement
);

/**
 * --------------------------------------------------------------------------
 * Submit advertisement
 * --------------------------------------------------------------------------
 *
 * POST /api/v1/advertisements/:id/submit
 */
router.post(
  "/:id/submit",
  authorize("ADVERTISEMENT", "advertisements", "submit"),
  validate(advertisementIdSchema, "params"),
  validate(advertisementWorkflowSchema, "body"),
  submitAdvertisement
);

/**
 * --------------------------------------------------------------------------
 * Approve advertisement
 * --------------------------------------------------------------------------
 *
 * POST /api/v1/advertisements/:id/approve
 */
router.post(
  "/:id/approve",
  authorize("ADVERTISEMENT", "advertisements", "approve"),
  validate(advertisementIdSchema, "params"),
  validate(advertisementWorkflowSchema, "body"),
  approveAdvertisement
);

/**
 * --------------------------------------------------------------------------
 * Reject advertisement
 * --------------------------------------------------------------------------
 *
 * POST /api/v1/advertisements/:id/reject
 */
router.post(
  "/:id/reject",
  authorize("ADVERTISEMENT", "advertisements", "reject"),
  validate(advertisementIdSchema, "params"),
  validate(advertisementRejectSchema, "body"),
  rejectAdvertisement
);

/**
 * --------------------------------------------------------------------------
 * Hold advertisement
 * --------------------------------------------------------------------------
 *
 * POST /api/v1/advertisements/:id/hold
 */
router.post(
  "/:id/hold",
  authorize("ADVERTISEMENT", "advertisements", "hold"),
  validate(advertisementIdSchema, "params"),
  validate(advertisementHoldSchema, "body"),
  holdAdvertisement
);

/**
 * --------------------------------------------------------------------------
 * Resume advertisement
 * --------------------------------------------------------------------------
 *
 * POST /api/v1/advertisements/:id/resume
 */
router.post(
  "/:id/resume",
  authorize("ADVERTISEMENT", "advertisements", "resume"),
  validate(advertisementIdSchema, "params"),
  validate(advertisementWorkflowSchema, "body"),
  resumeAdvertisement
);

/**
 * --------------------------------------------------------------------------
 * Activate advertisement
 * --------------------------------------------------------------------------
 *
 * POST /api/v1/advertisements/:id/activate
 */
router.post(
  "/:id/activate",
  authorize("ADVERTISEMENT", "advertisements", "activate"),
  validate(advertisementIdSchema, "params"),
  validate(advertisementWorkflowSchema, "body"),
  activateAdvertisement
);

/**
 * --------------------------------------------------------------------------
 * Archive advertisement
 * --------------------------------------------------------------------------
 *
 * POST /api/v1/advertisements/:id/archive
 */
router.post(
  "/:id/archive",
  authorize("ADVERTISEMENT", "advertisements", "archive"),
  validate(advertisementIdSchema, "params"),
  validate(advertisementWorkflowSchema, "body"),
  archiveAdvertisement
);

export default router;
