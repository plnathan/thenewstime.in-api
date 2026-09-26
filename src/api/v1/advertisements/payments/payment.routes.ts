import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import { authorize } from "../../security/middleware/authorize.middleware.js";

import * as controller from "./payment.controller.js";

import {
  advertisementPaymentCancellationSchema,
  advertisementPaymentIdSchema,
  advertisementPaymentQuerySchema,
  advertisementPaymentRefundSchema,
  createAdvertisementPaymentSchema,
  updateAdvertisementPaymentSchema
} from "./payment.validation.js";

const router = Router();

/**
 * List advertisement payments.
 *
 * GET /payments
 */
router.get(
  "/",
  authorize("ADVERTISEMENT", "advertisements.payments", "read"),
  validate(advertisementPaymentQuerySchema, "query"),
  controller.listPayments
);

/**
 * Create advertisement payment.
 *
 * POST /payments
 */
router.post(
  "/",
  authorize("ADVERTISEMENT", "advertisements.payments", "create"),
  validate(createAdvertisementPaymentSchema, "body"),
  controller.createPayment
);

/**
 * Get advertisement payment.
 *
 * GET /payments/:id
 */
router.get(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.payments", "read"),
  validate(advertisementPaymentIdSchema, "params"),
  controller.getPaymentById
);

/**
 * Update advertisement payment.
 *
 * PATCH /payments/:id
 */
router.patch(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.payments", "update"),
  validate(advertisementPaymentIdSchema, "params"),
  validate(updateAdvertisementPaymentSchema, "body"),
  controller.updatePayment
);

/**
 * Verify advertisement payment.
 *
 * POST /payments/:id/verify
 */
router.post(
  "/:id/verify",
  authorize("ADVERTISEMENT", "advertisements.payments", "verify"),
  validate(advertisementPaymentIdSchema, "params"),
  controller.verifyPayment
);

/**
 * Cancel advertisement payment.
 *
 * POST /payments/:id/cancel
 */
router.post(
  "/:id/cancel",
  authorize("ADVERTISEMENT", "advertisements.payments", "cancel"),
  validate(advertisementPaymentIdSchema, "params"),
  validate(advertisementPaymentCancellationSchema, "body"),
  controller.cancelPayment
);

/**
 * Get payment summary for the advertisement.
 *
 * GET /payments/:id/summary
 */
router.get(
  "/:id/summary",
  authorize("ADVERTISEMENT", "advertisements.payments", "read"),
  validate(advertisementPaymentIdSchema, "params"),
  controller.getPaymentSummary
);

/**
 * Get refunds for a payment.
 *
 * GET /payments/:id/refunds
 */
router.get(
  "/:id/refunds",
  authorize("ADVERTISEMENT", "advertisements.payments", "read"),
  validate(advertisementPaymentIdSchema, "params"),
  controller.getPaymentRefunds
);

/**
 * Create refund for a payment.
 *
 * POST /payments/:id/refunds
 */
router.post(
  "/:id/refunds",
  authorize("ADVERTISEMENT", "advertisements.payments", "refund"),
  validate(advertisementPaymentIdSchema, "params"),
  validate(
    advertisementPaymentRefundSchema.omit({
      paymentId: true
    }),
    "body"
  ),
  controller.createPaymentRefund
);

export default router;


/*
GET    /api/v1/advertisements/payments
POST   /api/v1/advertisements/payments

GET    /api/v1/advertisements/payments/:id
PATCH  /api/v1/advertisements/payments/:id

POST   /api/v1/advertisements/payments/:id/verify
POST   /api/v1/advertisements/payments/:id/cancel

GET    /api/v1/advertisements/payments/:id/summary

GET    /api/v1/advertisements/payments/:id/refunds
POST   /api/v1/advertisements/payments/:id/refunds
*/