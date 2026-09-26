import { describe, expect, it } from "vitest";

import {
  createFinancialApprovalThresholdSchema,
  financialApprovalThresholdIdSchema,
  listFinancialApprovalThresholdSchema,
  updateFinancialApprovalThresholdSchema
} from "../financial-approval-threshold.validation.js";

describe("Financial Approval Threshold Validation", () => {
  describe("financialApprovalThresholdIdSchema", () => {
    it("should accept a positive integer", () => {
      const result = financialApprovalThresholdIdSchema.safeParse({
        id: "100"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(100);
      }
    });

    it("should accept a numeric id", () => {
      const result = financialApprovalThresholdIdSchema.safeParse({
        id: 100
      });

      expect(result.success).toBe(true);
    });

    it("should reject zero", () => {
      const result = financialApprovalThresholdIdSchema.safeParse({
        id: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative id", () => {
      const result = financialApprovalThresholdIdSchema.safeParse({
        id: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject a decimal id", () => {
      const result = financialApprovalThresholdIdSchema.safeParse({
        id: 1.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject a non-numeric id", () => {
      const result = financialApprovalThresholdIdSchema.safeParse({
        id: "abc"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("createFinancialApprovalThresholdSchema", () => {
    it("should accept an amount threshold", () => {
      const result = createFinancialApprovalThresholdSchema.safeParse({
        approvalType: "DISCOUNT",
        amountThreshold: 5000
      });

      expect(result.success).toBe(true);
    });

    it("should accept a percentage threshold", () => {
      const result = createFinancialApprovalThresholdSchema.safeParse({
        approvalType: "REFUND",
        percentageThreshold: 10
      });

      expect(result.success).toBe(true);
    });

    it("should accept a zero percentage threshold", () => {
      const result = createFinancialApprovalThresholdSchema.safeParse({
        approvalType: "REFUND",
        percentageThreshold: 0
      });

      expect(result.success).toBe(true);
    });

    it("should accept a 100 percent threshold", () => {
      const result = createFinancialApprovalThresholdSchema.safeParse({
        approvalType: "REFUND",
        percentageThreshold: 100
      });

      expect(result.success).toBe(true);
    });

    it("should accept all supported approval types", () => {
      const approvalTypes = [
        "DISCOUNT",
        "REFUND",
        "PARTIAL_REFUND",
        "ADJUSTMENT"
      ] as const;

      for (const approvalType of approvalTypes) {
        const result = createFinancialApprovalThresholdSchema.safeParse({
          approvalType,
          amountThreshold: 1000
        });

        expect(result.success).toBe(true);
      }
    });

    it("should reject an invalid approval type", () => {
      const result = createFinancialApprovalThresholdSchema.safeParse({
        approvalType: "INVALID",
        amountThreshold: 1000
      });

      expect(result.success).toBe(false);
    });

    it("should reject when no threshold value is supplied", () => {
      const result = createFinancialApprovalThresholdSchema.safeParse({
        approvalType: "DISCOUNT"
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.message === "At least one threshold value is required."
          )
        ).toBe(true);
      }
    });

    it("should reject when both threshold values are supplied", () => {
      const result = createFinancialApprovalThresholdSchema.safeParse({
        approvalType: "DISCOUNT",
        amountThreshold: 5000,
        percentageThreshold: 10
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.message ===
              "Configure either amount threshold or percentage threshold, not both."
          )
        ).toBe(true);
      }
    });

    it("should reject a zero amount threshold", () => {
      const result = createFinancialApprovalThresholdSchema.safeParse({
        approvalType: "DISCOUNT",
        amountThreshold: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative amount threshold", () => {
      const result = createFinancialApprovalThresholdSchema.safeParse({
        approvalType: "DISCOUNT",
        amountThreshold: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative percentage", () => {
      const result = createFinancialApprovalThresholdSchema.safeParse({
        approvalType: "DISCOUNT",
        percentageThreshold: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject a percentage above 100", () => {
      const result = createFinancialApprovalThresholdSchema.safeParse({
        approvalType: "DISCOUNT",
        percentageThreshold: 100.01
      });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric threshold values", () => {
      const result = createFinancialApprovalThresholdSchema.safeParse({
        approvalType: "DISCOUNT",
        amountThreshold: "5000"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("updateFinancialApprovalThresholdSchema", () => {
    it("should accept an approval type update", () => {
      const result = updateFinancialApprovalThresholdSchema.safeParse({
        approvalType: "REFUND"
      });

      expect(result.success).toBe(true);
    });

    it("should accept an amount update", () => {
      const result = updateFinancialApprovalThresholdSchema.safeParse({
        amountThreshold: 7500
      });

      expect(result.success).toBe(true);
    });

    it("should accept a percentage update", () => {
      const result = updateFinancialApprovalThresholdSchema.safeParse({
        percentageThreshold: 15
      });

      expect(result.success).toBe(true);
    });

    it("should accept null amount threshold", () => {
      const result = updateFinancialApprovalThresholdSchema.safeParse({
        amountThreshold: null
      });

      expect(result.success).toBe(true);
    });

    it("should accept null percentage threshold", () => {
      const result = updateFinancialApprovalThresholdSchema.safeParse({
        percentageThreshold: null
      });

      expect(result.success).toBe(true);
    });

    it("should accept multiple update fields", () => {
      const result = updateFinancialApprovalThresholdSchema.safeParse({
        approvalType: "REFUND",
        amountThreshold: 7500
      });

      expect(result.success).toBe(true);
    });

    it("should reject an empty update", () => {
      const result = updateFinancialApprovalThresholdSchema.safeParse({});

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.message ===
              "At least one field must be provided for update."
          )
        ).toBe(true);
      }
    });

    it("should reject an invalid approval type", () => {
      const result = updateFinancialApprovalThresholdSchema.safeParse({
        approvalType: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should reject zero amount threshold", () => {
      const result = updateFinancialApprovalThresholdSchema.safeParse({
        amountThreshold: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative amount threshold", () => {
      const result = updateFinancialApprovalThresholdSchema.safeParse({
        amountThreshold: -100
      });

      expect(result.success).toBe(false);
    });

    it("should reject percentage above 100", () => {
      const result = updateFinancialApprovalThresholdSchema.safeParse({
        percentageThreshold: 101
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative percentage", () => {
      const result = updateFinancialApprovalThresholdSchema.safeParse({
        percentageThreshold: -1
      });

      expect(result.success).toBe(false);
    });

    it("should accept both threshold fields at schema level", () => {
      /*
       * The update schema intentionally only requires at least one field
       * and does not apply the create-time mutually-exclusive refinement.
       * The service performs the final business-rule validation.
       */
      const result = updateFinancialApprovalThresholdSchema.safeParse({
        amountThreshold: 5000,
        percentageThreshold: 10
      });

      expect(result.success).toBe(true);
    });
  });

  describe("listFinancialApprovalThresholdSchema", () => {
    it("should accept approval type", () => {
      const result = listFinancialApprovalThresholdSchema.safeParse({
        approvalType: "DISCOUNT"
      });

      expect(result.success).toBe(true);
    });

    it("should accept active status", () => {
      const result = listFinancialApprovalThresholdSchema.safeParse({
        status: "ACTIVE"
      });

      expect(result.success).toBe(true);
    });

    it("should accept inactive status", () => {
      const result = listFinancialApprovalThresholdSchema.safeParse({
        status: "INACTIVE"
      });

      expect(result.success).toBe(true);
    });

    it("should accept an empty query", () => {
      const result = listFinancialApprovalThresholdSchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it("should reject an invalid approval type", () => {
      const result = listFinancialApprovalThresholdSchema.safeParse({
        approvalType: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid status", () => {
      const result = listFinancialApprovalThresholdSchema.safeParse({
        status: "INVALID"
      });

      expect(result.success).toBe(false);
    });
  });
});
