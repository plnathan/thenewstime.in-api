import { z } from "zod";

/**
 * Shared validation rules
 */

const positiveIntegerIdSchema = z.coerce
  .number()
  .int("ID must be an integer")
  .positive("ID must be greater than zero");

const positiveAmountSchema = z.coerce
  .number()
  .finite("Amount must be a finite number")
  .positive("Amount must be greater than zero")
  .refine(
    (value) => Math.round(value * 100) === value * 100,
    "Amount cannot have more than two decimal places"
  );

const percentageSchema = z.coerce
  .number()
  .finite("Percentage must be a finite number")
  .min(0, "Percentage cannot be less than zero")
  .max(100, "Percentage cannot exceed 100")
  .refine(
    (value) => Math.round(value * 100) === value * 100,
    "Percentage cannot have more than two decimal places"
  );

const optionalPositiveAmountSchema = positiveAmountSchema.nullable().optional();

const optionalPercentageSchema = percentageSchema.nullable().optional();

const optionalRemarksSchema = z
  .string()
  .trim()
  .max(5000, "Remarks cannot exceed 5000 characters")
  .nullable()
  .optional();

const requiredReasonSchema = z
  .string()
  .trim()
  .min(1, "A reason is required")
  .max(5000, "Reason cannot exceed 5000 characters");

/**
 * Validate a real calendar date in YYYY-MM-DD format.
 *
 * Regex validation alone would accept invalid dates such as
 * 2026-02-31, so the calendar components are also checked.
 */
const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);

    if (year === undefined || month === undefined || day === undefined) {
      return false;
    }

    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Enter a valid calendar date");

/**
 * Enums
 */

export const advertisementFinancialApprovalTypeSchema = z.enum([
  "DISCOUNT",
  "ADJUSTMENT",
  "REFUND",
  "PARTIAL_REFUND",
  "CREDIT_EXCEPTION"
]);

export const advertisementFinancialApprovalStatusSchema = z.enum([
  "SUBMITTED",
  "HOLD",
  "APPROVED",
  "REJECTED"
]);

/**
 * Route parameter schemas
 */

export const advertisementFinancialApprovalIdSchema = z.object({
  id: positiveIntegerIdSchema
});

export const advertisementFinancialApprovalAdvertisementIdSchema = z.object({
  advertisementId: positiveIntegerIdSchema
});

export const advertisementFinancialApprovalPaymentIdSchema = z.object({
  paymentId: positiveIntegerIdSchema
});

/**
 * Create a financial approval request.
 *
 * Existing approval types:
 *   - Require exactly one of requestedAmount or requestedPercentage.
 *
 * CREDIT_EXCEPTION:
 *   - Requires requestedAmount.
 *   - Does not allow requestedPercentage.
 *   - Requires a reason.
 *   - Requires an expected payment due date.
 */
const createAdvertisementFinancialApprovalBaseSchema = z.object({
  advertisementId: positiveIntegerIdSchema,
  clientId: positiveIntegerIdSchema,

  paymentId: positiveIntegerIdSchema.nullable().optional(),

  approvalType: advertisementFinancialApprovalTypeSchema,

  requestedAmount: optionalPositiveAmountSchema,
  requestedPercentage: optionalPercentageSchema,

  approvalRemarks: optionalRemarksSchema,
  remarks: optionalRemarksSchema,

  creditExceptionReason: z
    .string()
    .trim()
    .max(5000, "Credit exception reason cannot exceed 5000 characters")
    .nullable()
    .optional(),

  expectedPaymentDueDate: dateOnlySchema.nullable().optional()
});

export const createAdvertisementFinancialApprovalSchema =
  createAdvertisementFinancialApprovalBaseSchema
    .superRefine((value, context) => {
      if (value.approvalRemarks != null && value.remarks != null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["remarks"],
          message: "Provide either approvalRemarks or remarks, not both"
        });
      }

      if (value.approvalType === "CREDIT_EXCEPTION") {
        if (value.requestedAmount == null) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["requestedAmount"],
            message: "A positive credit exception amount is required"
          });
        }

        if (value.requestedPercentage != null) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["requestedPercentage"],
            message:
              "Credit exceptions must be requested by amount, not percentage"
          });
        }

        if (
          value.creditExceptionReason == null ||
          value.creditExceptionReason.trim().length === 0
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["creditExceptionReason"],
            message: "A credit exception reason is required"
          });
        }

        if (
          value.expectedPaymentDueDate == null ||
          value.expectedPaymentDueDate.trim().length === 0
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["expectedPaymentDueDate"],
            message: "An expected payment due date is required"
          });
        }

        return;
      }

      const hasAmount = value.requestedAmount != null;
      const hasPercentage = value.requestedPercentage != null;

      if (hasAmount && hasPercentage) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requestedAmount"],
          message:
            "Provide either requestedAmount or requestedPercentage, not both."
        });
      } else if (!hasAmount && !hasPercentage) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requestedAmount"],
          message: "Either requestedAmount or requestedPercentage is required."
        });
      }
    })
    .transform((value) => {
      const { remarks: _legacyRemarks, ...rest } = value;

      return {
        ...rest,
        // Creation accepts canonical approvalRemarks only.
        // Legacy remarks is deliberately not copied during creation.
        approvalRemarks: value.approvalRemarks ?? null
      };
    });

/**
 * Update approval remarks.
 *
 * Supports either approvalRemarks or remarks and normalizes the result.
 * At least one field must be supplied. An explicitly supplied empty
 * string remains valid after trimming.
 */
const updateAdvertisementFinancialApprovalRemarksBaseSchema = z.object({
  approvalRemarks: optionalRemarksSchema,
  remarks: optionalRemarksSchema
});

export const updateAdvertisementFinancialApprovalRemarksSchema =
  updateAdvertisementFinancialApprovalRemarksBaseSchema
    .superRefine((value, context) => {
      const hasApprovalRemarks = value.approvalRemarks !== undefined;
      const hasRemarks = value.remarks !== undefined;

      if (!hasApprovalRemarks && !hasRemarks) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["remarks"],
          message: "Remarks are required"
        });
      }

      if (value.approvalRemarks != null && value.remarks != null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["remarks"],
          message: "Provide either approvalRemarks or remarks, not both"
        });
      }
    })
    .transform((value) => ({
      approvalRemarks: value.approvalRemarks ?? value.remarks ?? null
    }));

/**
 * Put an approval request on hold.
 */
const holdAdvertisementFinancialApprovalBaseSchema = z.object({
  holdReason: requiredReasonSchema,
  remarks: optionalRemarksSchema
});

export const holdAdvertisementFinancialApprovalSchema =
  holdAdvertisementFinancialApprovalBaseSchema.transform((value) => ({
    holdReason: value.holdReason,
    remarks: value.remarks ?? null
  }));

/**
 * Reject an approval request.
 */
const rejectAdvertisementFinancialApprovalBaseSchema = z.object({
  rejectionReason: requiredReasonSchema,
  remarks: optionalRemarksSchema
});

export const rejectAdvertisementFinancialApprovalSchema =
  rejectAdvertisementFinancialApprovalBaseSchema.transform((value) => ({
    rejectionReason: value.rejectionReason,
    remarks: value.remarks ?? null
  }));

/**
 * Approve a financial approval request.
 *
 * Supports both approvalRemarks and the legacy remarks property.
 * The parsed result always exposes approvalRemarks so the controller
 * and service receive the approver's remarks under one canonical name.
 *
 * The service additionally enforces amount, percentage, threshold,
 * and CREDIT_EXCEPTION outstanding-balance rules.
 */
const approveAdvertisementFinancialApprovalBaseSchema = z.object({
  approvedAmount: optionalPositiveAmountSchema,
  approvedPercentage: optionalPercentageSchema,
  approvalRemarks: optionalRemarksSchema,
  remarks: optionalRemarksSchema
});

export const approveAdvertisementFinancialApprovalSchema =
  approveAdvertisementFinancialApprovalBaseSchema
    .superRefine((value, context) => {
      if (value.approvedAmount != null && value.approvedPercentage != null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["approvedAmount"],
          message: "Provide approvedAmount or approvedPercentage, not both"
        });
      }

      if (value.approvalRemarks != null && value.remarks != null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["remarks"],
          message: "Provide either approvalRemarks or remarks, not both"
        });
      }
    })
    .transform((value) => ({
      approvedAmount: value.approvedAmount,
      approvedPercentage: value.approvedPercentage,
      approvalRemarks: value.approvalRemarks ?? value.remarks ?? null
    }));

/**
 * Resubmit a rejected or held approval request.
 */
const resubmitAdvertisementFinancialApprovalBaseSchema = z.object({
  approvalRemarks: optionalRemarksSchema,
  remarks: optionalRemarksSchema
});

export const resubmitAdvertisementFinancialApprovalSchema =
  resubmitAdvertisementFinancialApprovalBaseSchema
    .superRefine((value, context) => {
      if (value.approvalRemarks != null && value.remarks != null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["remarks"],
          message: "Provide either approvalRemarks or remarks, not both"
        });
      }
    })
    .transform((value) => ({
      approvalRemarks: value.approvalRemarks ?? value.remarks ?? null
    }));

/**
 * List and search query validation.
 */
export const advertisementFinancialApprovalQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(100, "Page size cannot exceed 100")
    .default(20),

  advertisementId: positiveIntegerIdSchema.optional(),
  clientId: positiveIntegerIdSchema.optional(),
  paymentId: positiveIntegerIdSchema.optional(),

  approvalType: advertisementFinancialApprovalTypeSchema.optional(),
  status: advertisementFinancialApprovalStatusSchema.optional(),

  requestedBy: positiveIntegerIdSchema.optional(),
  reviewedBy: positiveIntegerIdSchema.optional()
});

/**
 * Inferred validation types.
 *
 * These describe parsed outputs, including transformations.
 */
export type AdvertisementFinancialApprovalIdValidatedInput = z.infer<
  typeof advertisementFinancialApprovalIdSchema
>;

export type AdvertisementFinancialApprovalAdvertisementIdValidatedInput =
  z.infer<typeof advertisementFinancialApprovalAdvertisementIdSchema>;

export type AdvertisementFinancialApprovalPaymentIdValidatedInput = z.infer<
  typeof advertisementFinancialApprovalPaymentIdSchema
>;

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
