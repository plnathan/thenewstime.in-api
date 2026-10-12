import { z } from "zod";

const financialApprovalTypeSchema = z.enum([
  "DISCOUNT",
  "ADJUSTMENT",
  "REFUND",
  "PARTIAL_REFUND"
]);

const financialApprovalStatusSchema = z.enum([
  "SUBMITTED",
  "HOLD",
  "APPROVED",
  "REJECTED"
]);

const positiveIntegerSchema = z.coerce.number().int().positive();

const financialApprovalAmountSchema = z.coerce
  .number()
  .positive("Requested amount must be greater than zero.")
  .finite("Requested amount must be a valid number.")
  .refine(
    (value) => Number.isInteger(value * 100),
    "Requested amount must have at most two decimal places."
  );

const financialApprovalPercentageSchema = z.coerce
  .number()
  .min(0, "Requested percentage cannot be less than 0.")
  .max(100, "Requested percentage cannot exceed 100.")
  .finite("Requested percentage must be a valid number.")
  .refine(
    (value) => Number.isInteger(value * 100),
    "Requested percentage must have at most two decimal places."
  );

const optionalNullableRemarksSchema = z
  .string()
  .trim()
  .max(5000, "Approval remarks must not exceed 5000 characters.")
  .nullable()
  .optional();

const approvedAmountSchema = z.coerce
  .number()
  .nonnegative("Approved amount cannot be negative.")
  .finite("Approved amount must be a valid number.")
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9,
    "Approved amount must have at most two decimal places."
  );

const approvedPercentageSchema = z.coerce
  .number()
  .min(0, "Approved percentage cannot be negative.")
  .max(100, "Approved percentage cannot exceed 100.")
  .finite("Approved percentage must be a valid number.")
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9,
    "Approved percentage must have at most two decimal places."
  );

/*
 * Keep the remarks fields as an object schema so approval-specific fields
 * can be added with .extend() before any transformation takes place.
 */
const workflowRemarksObjectSchema = z.object({
  approvalRemarks: optionalNullableRemarksSchema,
  remarks: optionalNullableRemarksSchema
});

/*
 * Validate the two supported remarks fields and then normalize them to
 * approvalRemarks for the service layer.
 */
const workflowRemarksSchema = workflowRemarksObjectSchema
  .superRefine((value, context) => {
    if (value.approvalRemarks !== undefined && value.remarks !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["remarks"],
        message: "Provide either approvalRemarks or remarks, not both."
      });
    }
  })
  .transform((value) => ({
    approvalRemarks:
      value.approvalRemarks !== undefined
        ? value.approvalRemarks
        : value.remarks
  }));

export const advertisementFinancialApprovalIdSchema = z.object({
  id: positiveIntegerSchema
});

export const advertisementFinancialApprovalAdvertisementIdSchema = z.object({
  advertisementId: positiveIntegerSchema
});

export const advertisementFinancialApprovalPaymentIdSchema = z.object({
  paymentId: positiveIntegerSchema
});

export const createAdvertisementFinancialApprovalSchema = z
  .object({
    advertisementId: positiveIntegerSchema,
    clientId: positiveIntegerSchema,
    paymentId: positiveIntegerSchema.nullable().optional(),
    approvalType: financialApprovalTypeSchema,
    requestedAmount: financialApprovalAmountSchema.nullable().optional(),
    requestedPercentage: financialApprovalPercentageSchema
      .nullable()
      .optional(),
    approvalRemarks: optionalNullableRemarksSchema
  })
  .superRefine((value, context) => {
    const hasAmount =
      value.requestedAmount !== undefined && value.requestedAmount !== null;

    const hasPercentage =
      value.requestedPercentage !== undefined &&
      value.requestedPercentage !== null;

    if (!hasAmount && !hasPercentage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestedAmount"],
        message: "Either requestedAmount or requestedPercentage is required."
      });
    }

    if (hasAmount && hasPercentage) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestedAmount"],
        message:
          "Provide either requestedAmount or requestedPercentage, not both."
      });
    }
  });

export const updateAdvertisementFinancialApprovalRemarksSchema = z.object({
  approvalRemarks: z
    .string()
    .trim()
    .max(5000, "Approval remarks must not exceed 5000 characters.")
    .nullable()
});

export const holdAdvertisementFinancialApprovalSchema = z.object({
  holdReason: z
    .string()
    .trim()
    .min(1, "Hold reason is required.")
    .max(5000, "Hold reason must not exceed 5000 characters.")
});

export const rejectAdvertisementFinancialApprovalSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(1, "Rejection reason is required.")
    .max(5000, "Rejection reason must not exceed 5000 characters.")
});

export const approveAdvertisementFinancialApprovalSchema =
  workflowRemarksObjectSchema
    .extend({
      approvedAmount: approvedAmountSchema.nullable().optional(),
      approvedPercentage: approvedPercentageSchema.nullable().optional()
    })
    .superRefine((value, context) => {
      if (value.approvalRemarks !== undefined && value.remarks !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["remarks"],
          message: "Provide either approvalRemarks or remarks, not both."
        });
      }

      const hasAmount =
        value.approvedAmount !== undefined && value.approvedAmount !== null;

      const hasPercentage =
        value.approvedPercentage !== undefined &&
        value.approvedPercentage !== null;

      if (hasAmount && hasPercentage) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["approvedAmount"],
          message:
            "Provide either approvedAmount or approvedPercentage, not both."
        });
      }
    })
    .transform((value) => ({
      approvalRemarks:
        value.approvalRemarks !== undefined
          ? value.approvalRemarks
          : value.remarks,
      approvedAmount: value.approvedAmount,
      approvedPercentage: value.approvedPercentage
    }));

export const resubmitAdvertisementFinancialApprovalSchema =
  workflowRemarksSchema;

export const advertisementFinancialApprovalQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  advertisementId: positiveIntegerSchema.optional(),
  clientId: positiveIntegerSchema.optional(),
  paymentId: positiveIntegerSchema.optional(),
  approvalType: financialApprovalTypeSchema.optional(),
  status: financialApprovalStatusSchema.optional(),
  requestedBy: positiveIntegerSchema.optional(),
  reviewedBy: positiveIntegerSchema.optional()
});

export type CreateAdvertisementFinancialApprovalValidatedInput = z.infer<
  typeof createAdvertisementFinancialApprovalSchema
>;

export type UpdateAdvertisementFinancialApprovalRemarksValidatedInput = z.infer<
  typeof updateAdvertisementFinancialApprovalRemarksSchema
>;

export type HoldAdvertisementFinancialApprovalValidatedInput = z.infer<
  typeof holdAdvertisementFinancialApprovalSchema
>;

export type RejectAdvertisementFinancialApprovalValidatedInput = z.infer<
  typeof rejectAdvertisementFinancialApprovalSchema
>;

export type ApproveAdvertisementFinancialApprovalValidatedInput = z.infer<
  typeof approveAdvertisementFinancialApprovalSchema
>;

export type ResubmitAdvertisementFinancialApprovalValidatedInput = z.infer<
  typeof resubmitAdvertisementFinancialApprovalSchema
>;

export type AdvertisementFinancialApprovalQueryValidatedInput = z.infer<
  typeof advertisementFinancialApprovalQuerySchema
>;
