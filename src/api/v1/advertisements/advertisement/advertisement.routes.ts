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

import clientRoutes from "../clients/client.routes.js";
import creativeRoutes from "../creatives/creative.routes.js";
import * as creativeUploadController from "../creatives/creative-upload.controller.js";
import { advertisementCreativeUpload } from "../creatives/creative-upload.middleware.js";

import deliveryRoutes from "../delivery/delivery.routes.js";
import financialApprovalThresholdRoutes from "../financial-approval-thresholds/financial-approval-threshold.routes.js";
import financialApprovalRoutes from "../financial-approvals/financial-approval.routes.js";
import paymentRoutes from "../payments/payment.routes.js";
import placementRuleRoutes from "../placement-rules/placement-rule.routes.js";
import pricingSnapshotRoutes from "../pricing-snapshots/pricing-snapshot.routes.js";
import pricingRoutes from "../pricing/pricing.routes.js";
import rateCardRoutes from "../rate-cards/rate-card.routes.js";
import rotationRoutes from "../rotation/rotation.routes.js";
import scheduleRoutes from "../schedules/schedule.routes.js";
import targetRoutes from "../targets/target.routes.js";

const router = Router();

/**
 * --------------------------------------------------------------------------
 * Public Advertisement Delivery API
 * --------------------------------------------------------------------------
 *
 * Delivery APIs are intentionally registered before authentication because
 * advertisement delivery is public.
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

/**
 * --------------------------------------------------------------------------
 * Advertisement Creative File Upload
 * --------------------------------------------------------------------------
 *
 * POST /api/v1/advertisements/creatives/upload
 *
 * Uploads creative files before an advertisement record exists.
 *
 * The middleware validates the uploaded file and accepts the multipart
 * field named "file". The controller uploads it to Cloudinary and returns
 * the permanent URL, dimensions, and related metadata.
 *
 * RBAC:
 *   Resource: advertisements.creatives
 *   Action:   create
 */
router.post(
  "/creatives/upload",
  authorize("ADVERTISEMENT", "advertisements.creatives", "create"),
  advertisementCreativeUpload.single("file"),
  creativeUploadController.upload
);

/**
 * --------------------------------------------------------------------------
 * Advertisement Pricing
 * --------------------------------------------------------------------------
 */
router.use("/pricing", pricingRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Pricing Snapshots
 * --------------------------------------------------------------------------
 */
router.use("/pricing-snapshots", pricingSnapshotRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Rate Cards
 * --------------------------------------------------------------------------
 */
router.use("/rate-cards", rateCardRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Financial Approval Threshold Configuration
 * --------------------------------------------------------------------------
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
 * Registered before generic advertisement routes.
 */
router.use("/financial-approval-thresholds", financialApprovalThresholdRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Financial Approval
 * --------------------------------------------------------------------------
 *
 * Registered before /payments so that:
 *
 * GET /api/v1/advertisements/payments/financial-approval
 *
 * is handled by the financial approval module rather than the generic
 * payment module.
 */
router.use("/payments/financial-approval", financialApprovalRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Payments
 * --------------------------------------------------------------------------
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
 * Advertisement Rotation
 * --------------------------------------------------------------------------
 *
 * Rotation is a placement-level Advertisement sub-module.
 *
 * Final API paths:
 *
 * GET
 * /api/v1/advertisements/rotation/placements/:placementId
 *
 * PATCH
 * /api/v1/advertisements/rotation/placements/:placementId
 *
 * GET
 * /api/v1/advertisements/rotation/placements/:placementId/members
 *
 * POST
 * /api/v1/advertisements/rotation/placements/:placementId/members
 *
 * PATCH
 * /api/v1/advertisements/rotation/placements/:placementId/members/:memberId
 *
 * DELETE
 * /api/v1/advertisements/rotation/placements/:placementId/members/:memberId
 *
 * IMPORTANT:
 *
 * This route must be registered before the generic "/:id" routes below.
 * Otherwise "rotation" could potentially be interpreted as an
 * advertisement identifier.
 *
 * RBAC resource:
 *   advertisements.rotation
 *
 * Actions:
 *   read
 *   create
 *   update
 *   delete
 */
router.use("/rotation", rotationRoutes);

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
 * Calculates the agreed amount without persisting it.
 *
 * RBAC:
 *   Resource: advertisements
 *   Action:   read
 */
router.post(
  "/agreed-amount/calculate",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  validate(calculateAdvertisementAgreedAmountSchema, "body"),
  calculateAdvertisementAgreedAmount
);

/**
 * --------------------------------------------------------------------------
 * List Advertisements
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
 * Get Advertisement Workflow History
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

/**
 * --------------------------------------------------------------------------
 * Advertisement Clients
 * --------------------------------------------------------------------------
 *
 * Final API paths:
 *
 * GET    /api/v1/advertisements/clients
 * GET    /api/v1/advertisements/clients/:id
 * POST   /api/v1/advertisements/clients
 * PATCH  /api/v1/advertisements/clients/:id
 *
 * Registered before generic "/:id" routes.
 */
router.use("/clients", clientRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Creatives
 * --------------------------------------------------------------------------
 *
 * Final API paths:
 *
 * GET    /api/v1/advertisements/:advertisementId/creatives
 * GET    /api/v1/advertisements/:advertisementId/creatives/preview
 * POST   /api/v1/advertisements/:advertisementId/creatives
 * GET    /api/v1/advertisements/:advertisementId/creatives/:creativeId
 * GET    /api/v1/advertisements/:advertisementId/creatives/:creativeId/preview
 * PATCH  /api/v1/advertisements/:advertisementId/creatives/:creativeId
 * DELETE /api/v1/advertisements/:advertisementId/creatives/:creativeId
 *
 * The creative router uses mergeParams so advertisementId is available
 * inside the creative module.
 */
router.use("/:advertisementId/creatives", creativeRoutes);

/**
 * --------------------------------------------------------------------------
 * Advertisement Targeting
 * --------------------------------------------------------------------------
 *
 * Final API paths:
 *
 * GET    /api/v1/advertisements/:advertisementId/targets
 * POST   /api/v1/advertisements/:advertisementId/targets
 * PUT    /api/v1/advertisements/:advertisementId/targets
 * PATCH  /api/v1/advertisements/:advertisementId/targets/:targetId
 * DELETE /api/v1/advertisements/:advertisementId/targets/:targetId
 */
router.use("/", targetRoutes);

/**
 * --------------------------------------------------------------------------
 * Get Advertisement By ID
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
 * Create Advertisement
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
 * Update Advertisement
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
 * Submit Advertisement
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
 * Approve Advertisement
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
 * Reject Advertisement
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
 * Hold Advertisement
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
 * Resume Advertisement
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
 * Activate Advertisement
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
 * Archive Advertisement
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

/**
 * --------------------------------------------------------------------------
 * Advertisement Creatives
 * --------------------------------------------------------------------------
 *
 * Final API paths:
 *
 * GET    /api/v1/advertisements/:advertisementId/creatives
 * GET    /api/v1/advertisements/:advertisementId/creatives/preview
 * GET    /api/v1/advertisements/:advertisementId/creatives/:creativeId
 * GET    /api/v1/advertisements/:advertisementId/creatives/:creativeId/preview
 * POST   /api/v1/advertisements/:advertisementId/creatives
 * PATCH  /api/v1/advertisements/:advertisementId/creatives/:creativeId
 * DELETE /api/v1/advertisements/:advertisementId/creatives/:creativeId
 *
 * IMPORTANT:
 * This must be registered before /:id so that the advertisement ID
 * hierarchy remains explicit and no generic advertisement route interferes.
 */
