import { z } from "zod";

const paymentTypeSchema = z.enum([
  "ADVANCE",
  "REGULAR",
  "FINAL",
  "INSTALLMENT"
]);

const paymentStatusSchema = z.enum([
  "PENDING",
  "RECEIVED",
  "VERIFIED",
  "CANCELLED",
  "REFUNDED"
]);

const paymentMethodSchema = z.enum([
  "CASH",
  "BANK_TRANSFER",
  "UPI",
  "CARD",
  "CHEQUE",
  "DEMAND_DRAFT",
  "OTHER"
]);

const dateSchema = z
  .union([
    z.date(),
    z.string().datetime({
      offset: true
    })
  ])
  .transform((value) => {
    if (value instanceof Date) {
      return value;
    }

    return new Date(value);
  });

const optionalDateSchema = dateSchema.optional();

const paymentAmountSchema = z.coerce
  .number()
  .positive("Payment amount must be greater than zero.")
  .finite("Payment amount must be a valid number.")
  .refine(
    (value) => Number.isInteger(value * 100),
    "Payment amount must have at most two decimal places."
  );

const refundAmountSchema = z.coerce
  .number()
  .positive("Refund amount must be greater than zero.")
  .finite("Refund amount must be a valid number.")
  .refine(
    (value) => Number.isInteger(value * 100),
    "Refund amount must have at most two decimal places."
  );

export const advertisementPaymentIdSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const createAdvertisementPaymentSchema = z.object({
  advertisementId: z.coerce
    .number()
    .int()
    .positive("Advertisement ID must be a positive integer."),

  amount: paymentAmountSchema,

  paymentType: paymentTypeSchema,

  paymentDate: optionalDateSchema,

  paymentMethod: paymentMethodSchema.optional(),

  transactionReference: z
    .string()
    .trim()
    .min(1, "Transaction reference cannot be empty.")
    .max(150, "Transaction reference must not exceed 150 characters.")
    .optional(),

  notes: z
    .string()
    .trim()
    .max(5000, "Notes must not exceed 5000 characters.")
    .optional()
});

export const updateAdvertisementPaymentSchema = z
  .object({
    amount: paymentAmountSchema.optional(),

    paymentType: paymentTypeSchema.optional(),

    paymentDate: optionalDateSchema,

    paymentMethod: paymentMethodSchema.optional(),

    transactionReference: z
      .string()
      .trim()
      .min(1, "Transaction reference cannot be empty.")
      .max(150, "Transaction reference must not exceed 150 characters.")
      .optional(),

    notes: z
      .string()
      .trim()
      .max(5000, "Notes must not exceed 5000 characters.")
      .optional()
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required for update."
  );

export const advertisementPaymentRefundSchema = z.object({
  paymentId: z.coerce
    .number()
    .int()
    .positive("Payment ID must be a positive integer."),

  amount: refundAmountSchema,

  refundDate: optionalDateSchema,

  refundReference: z
    .string()
    .trim()
    .min(1, "Refund reference cannot be empty.")
    .max(150, "Refund reference must not exceed 150 characters.")
    .optional(),

  refundReason: z
    .string()
    .trim()
    .max(5000, "Refund reason must not exceed 5000 characters.")
    .optional()
});

export const advertisementPaymentRefundIdSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const advertisementPaymentCancellationSchema = z.object({
  cancellationReason: z
    .string()
    .trim()
    .min(1, "Cancellation reason is required.")
    .max(5000, "Cancellation reason must not exceed 5000 characters.")
});

export const advertisementPaymentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce.number().int().positive().max(100).default(20),

  advertisementId: z.coerce.number().int().positive().optional(),

  paymentType: paymentTypeSchema.optional(),

  paymentStatus: paymentStatusSchema.optional(),

  paymentMethod: paymentMethodSchema.optional(),

  fromDate: optionalDateSchema,

  toDate: optionalDateSchema,

  search: z
    .string()
    .trim()
    .max(200, "Search text must not exceed 200 characters.")
    .optional()
});

export type CreateAdvertisementPaymentValidatedInput = z.infer<
  typeof createAdvertisementPaymentSchema
>;

export type UpdateAdvertisementPaymentValidatedInput = z.infer<
  typeof updateAdvertisementPaymentSchema
>;

export type CreateAdvertisementPaymentRefundValidatedInput = z.infer<
  typeof advertisementPaymentRefundSchema
>;

export type AdvertisementPaymentCancellationValidatedInput = z.infer<
  typeof advertisementPaymentCancellationSchema
>;

export type AdvertisementPaymentQueryValidatedInput = z.infer<
  typeof advertisementPaymentQuerySchema
>;
