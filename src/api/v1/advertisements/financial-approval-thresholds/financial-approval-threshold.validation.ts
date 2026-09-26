import { z } from "zod";

const approvalTypeSchema = z.enum([
  "DISCOUNT",
  "REFUND",
  "PARTIAL_REFUND",
  "ADJUSTMENT"
]);

const thresholdValuesSchema = z
  .object({
    amountThreshold: z.number().positive().optional(),

    percentageThreshold: z.number().min(0).max(100).optional()
  })
  .refine(
    (value) =>
      value.amountThreshold !== undefined ||
      value.percentageThreshold !== undefined,
    {
      message: "At least one threshold value is required."
    }
  )
  .refine(
    (value) =>
      !(
        value.amountThreshold !== undefined &&
        value.percentageThreshold !== undefined
      ),
    {
      message:
        "Configure either amount threshold or percentage threshold, not both."
    }
  );

export const financialApprovalThresholdIdSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const createFinancialApprovalThresholdSchema = z
  .object({
    approvalType: approvalTypeSchema
  })
  .and(thresholdValuesSchema);

export const updateFinancialApprovalThresholdSchema = z
  .object({
    approvalType: approvalTypeSchema.optional(),
    amountThreshold: z.number().positive().nullable().optional(),
    percentageThreshold: z.number().min(0).max(100).nullable().optional()
  })
  .refine(
    (value) =>
      value.approvalType !== undefined ||
      value.amountThreshold !== undefined ||
      value.percentageThreshold !== undefined,
    {
      message: "At least one field must be provided for update."
    }
  );

export const listFinancialApprovalThresholdSchema = z.object({
  approvalType: approvalTypeSchema.optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
});
