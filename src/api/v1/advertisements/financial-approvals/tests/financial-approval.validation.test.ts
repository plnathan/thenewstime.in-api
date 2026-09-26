import { describe, expect, it } from "vitest";

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
} from "../financial-approval.validation.js";

describe("financial-approval.validation", () => {
  describe("advertisementFinancialApprovalIdSchema", () => {
    it("should accept a positive integer ID", () => {
      const result = advertisementFinancialApprovalIdSchema.safeParse({
        id: 1
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(1);
      }
    });

    it("should coerce a numeric string to a number", () => {
      const result = advertisementFinancialApprovalIdSchema.safeParse({
        id: "25"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(25);
      }
    });

    it("should reject zero", () => {
      const result = advertisementFinancialApprovalIdSchema.safeParse({
        id: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative integers", () => {
      const result = advertisementFinancialApprovalIdSchema.safeParse({
        id: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject decimal IDs", () => {
      const result = advertisementFinancialApprovalIdSchema.safeParse({
        id: 1.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric IDs", () => {
      const result = advertisementFinancialApprovalIdSchema.safeParse({
        id: "abc"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("advertisementFinancialApprovalAdvertisementIdSchema", () => {
    it("should accept a positive advertisement ID", () => {
      const result =
        advertisementFinancialApprovalAdvertisementIdSchema.safeParse({
          advertisementId: 10
        });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(10);
      }
    });

    it("should coerce a numeric string to a number", () => {
      const result =
        advertisementFinancialApprovalAdvertisementIdSchema.safeParse({
          advertisementId: "10"
        });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(10);
      }
    });

    it("should reject zero", () => {
      const result =
        advertisementFinancialApprovalAdvertisementIdSchema.safeParse({
          advertisementId: 0
        });

      expect(result.success).toBe(false);
    });

    it("should reject a negative advertisement ID", () => {
      const result =
        advertisementFinancialApprovalAdvertisementIdSchema.safeParse({
          advertisementId: -10
        });

      expect(result.success).toBe(false);
    });

    it("should reject a decimal advertisement ID", () => {
      const result =
        advertisementFinancialApprovalAdvertisementIdSchema.safeParse({
          advertisementId: 10.5
        });

      expect(result.success).toBe(false);
    });
  });

  describe("advertisementFinancialApprovalPaymentIdSchema", () => {
    it("should accept a positive payment ID", () => {
      const result = advertisementFinancialApprovalPaymentIdSchema.safeParse({
        paymentId: 20
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.paymentId).toBe(20);
      }
    });

    it("should coerce a numeric string to a number", () => {
      const result = advertisementFinancialApprovalPaymentIdSchema.safeParse({
        paymentId: "20"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.paymentId).toBe(20);
      }
    });

    it("should reject zero", () => {
      const result = advertisementFinancialApprovalPaymentIdSchema.safeParse({
        paymentId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative payment ID", () => {
      const result = advertisementFinancialApprovalPaymentIdSchema.safeParse({
        paymentId: -20
      });

      expect(result.success).toBe(false);
    });

    it("should reject a decimal payment ID", () => {
      const result = advertisementFinancialApprovalPaymentIdSchema.safeParse({
        paymentId: 20.5
      });

      expect(result.success).toBe(false);
    });
  });

  describe("createAdvertisementFinancialApprovalSchema", () => {
    it("should accept a valid amount-based financial approval", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        paymentId: 3,
        approvalType: "DISCOUNT",
        requestedAmount: 1250.5,
        approvalRemarks: "Discount requested by advertiser."
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          advertisementId: 1,
          clientId: 2,
          paymentId: 3,
          approvalType: "DISCOUNT",
          requestedAmount: 1250.5,
          approvalRemarks: "Discount requested by advertiser."
        });
      }
    });

    it("should accept a valid percentage-based financial approval", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "ADJUSTMENT",
        requestedPercentage: 25.5
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.requestedPercentage).toBe(25.5);
        expect(result.data.requestedAmount).toBeUndefined();
      }
    });

    it("should accept every supported approval type", () => {
      const approvalTypes = [
        "DISCOUNT",
        "ADJUSTMENT",
        "REFUND",
        "PARTIAL_REFUND"
      ] as const;

      for (const approvalType of approvalTypes) {
        const result = createAdvertisementFinancialApprovalSchema.safeParse({
          advertisementId: 1,
          clientId: 2,
          approvalType,
          requestedAmount: 100
        });

        expect(result.success).toBe(true);
      }
    });

    it("should accept a nullable payment ID", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        paymentId: null,
        approvalType: "REFUND",
        requestedAmount: 500
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.paymentId).toBeNull();
      }
    });

    it("should accept an omitted payment ID", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "REFUND",
        requestedAmount: 500
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.paymentId).toBeUndefined();
      }
    });

    it("should coerce numeric ID strings", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: "1",
        clientId: "2",
        paymentId: "3",
        approvalType: "DISCOUNT",
        requestedAmount: 100
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(1);
        expect(result.data.clientId).toBe(2);
        expect(result.data.paymentId).toBe(3);
      }
    });

    it("should reject when both requestedAmount and requestedPercentage are provided", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "DISCOUNT",
        requestedAmount: 1000,
        requestedPercentage: 10
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path[0] === "requestedAmount" &&
              issue.message ===
                "Provide either requestedAmount or requestedPercentage, not both."
          )
        ).toBe(true);
      }
    });

    it("should reject when neither requestedAmount nor requestedPercentage is provided", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "DISCOUNT"
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path[0] === "requestedAmount" &&
              issue.message ===
                "Either requestedAmount or requestedPercentage is required."
          )
        ).toBe(true);
      }
    });

    it("should reject when both requestedAmount and requestedPercentage are null", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "DISCOUNT",
        requestedAmount: null,
        requestedPercentage: null
      });

      expect(result.success).toBe(false);
    });

    it("should reject a zero requested amount", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "DISCOUNT",
        requestedAmount: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative requested amount", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "DISCOUNT",
        requestedAmount: -100
      });

      expect(result.success).toBe(false);
    });

    it("should reject a non-finite requested amount", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "DISCOUNT",
        requestedAmount: Number.POSITIVE_INFINITY
      });

      expect(result.success).toBe(false);
    });

    it("should accept an amount with two decimal places", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "DISCOUNT",
        requestedAmount: 100.99
      });

      expect(result.success).toBe(true);
    });

    it("should reject an amount with more than two decimal places", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "DISCOUNT",
        requestedAmount: 100.999
      });

      expect(result.success).toBe(false);
    });

    it("should accept requested percentage of zero", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "ADJUSTMENT",
        requestedPercentage: 0
      });

      expect(result.success).toBe(true);
    });

    it("should accept requested percentage of 100", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "ADJUSTMENT",
        requestedPercentage: 100
      });

      expect(result.success).toBe(true);
    });

    it("should reject requested percentage below zero", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "ADJUSTMENT",
        requestedPercentage: -0.01
      });

      expect(result.success).toBe(false);
    });

    it("should reject requested percentage above 100", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "ADJUSTMENT",
        requestedPercentage: 100.01
      });

      expect(result.success).toBe(false);
    });

    it("should accept a percentage with two decimal places", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "ADJUSTMENT",
        requestedPercentage: 25.75
      });

      expect(result.success).toBe(true);
    });

    it("should reject a percentage with more than two decimal places", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "ADJUSTMENT",
        requestedPercentage: 25.755
      });

      expect(result.success).toBe(false);
    });

    it("should accept optional approval remarks", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "DISCOUNT",
        requestedAmount: 100,
        approvalRemarks: "Please review."
      });

      expect(result.success).toBe(true);
    });

    it("should accept null approval remarks", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "DISCOUNT",
        requestedAmount: 100,
        approvalRemarks: null
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.approvalRemarks).toBeNull();
      }
    });

    it("should trim approval remarks", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "DISCOUNT",
        requestedAmount: 100,
        approvalRemarks: "  Please review.  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.approvalRemarks).toBe("Please review.");
      }
    });

    it("should reject approval remarks longer than 5000 characters", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "DISCOUNT",
        requestedAmount: 100,
        approvalRemarks: "a".repeat(5001)
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid approval type", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 2,
        approvalType: "INVALID",
        requestedAmount: 100
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid advertisement ID", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 0,
        clientId: 2,
        approvalType: "DISCOUNT",
        requestedAmount: 100
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid client ID", () => {
      const result = createAdvertisementFinancialApprovalSchema.safeParse({
        advertisementId: 1,
        clientId: 0,
        approvalType: "DISCOUNT",
        requestedAmount: 100
      });

      expect(result.success).toBe(false);
    });
  });

  describe("updateAdvertisementFinancialApprovalRemarksSchema", () => {
    it("should accept valid remarks", () => {
      const result =
        updateAdvertisementFinancialApprovalRemarksSchema.safeParse({
          approvalRemarks: "Updated remarks."
        });

      expect(result.success).toBe(true);
    });

    it("should trim remarks", () => {
      const result =
        updateAdvertisementFinancialApprovalRemarksSchema.safeParse({
          approvalRemarks: "  Updated remarks.  "
        });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.approvalRemarks).toBe("Updated remarks.");
      }
    });

    it("should accept null remarks", () => {
      const result =
        updateAdvertisementFinancialApprovalRemarksSchema.safeParse({
          approvalRemarks: null
        });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.approvalRemarks).toBeNull();
      }
    });

    it("should reject omitted remarks", () => {
      const result =
        updateAdvertisementFinancialApprovalRemarksSchema.safeParse({});

      expect(result.success).toBe(false);
    });

    it("should accept an empty string after trimming", () => {
      const result =
        updateAdvertisementFinancialApprovalRemarksSchema.safeParse({
          approvalRemarks: "   "
        });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.approvalRemarks).toBe("");
      }
    });

    it("should reject remarks longer than 5000 characters", () => {
      const result =
        updateAdvertisementFinancialApprovalRemarksSchema.safeParse({
          approvalRemarks: "a".repeat(5001)
        });

      expect(result.success).toBe(false);
    });
  });

  describe("holdAdvertisementFinancialApprovalSchema", () => {
    it("should accept a valid hold reason", () => {
      const result = holdAdvertisementFinancialApprovalSchema.safeParse({
        holdReason: "Payment verification is pending."
      });

      expect(result.success).toBe(true);
    });

    it("should trim the hold reason", () => {
      const result = holdAdvertisementFinancialApprovalSchema.safeParse({
        holdReason: "  Payment verification is pending.  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.holdReason).toBe(
          "Payment verification is pending."
        );
      }
    });

    it("should reject an empty hold reason", () => {
      const result = holdAdvertisementFinancialApprovalSchema.safeParse({
        holdReason: ""
      });

      expect(result.success).toBe(false);
    });

    it("should reject whitespace-only hold reason", () => {
      const result = holdAdvertisementFinancialApprovalSchema.safeParse({
        holdReason: "   "
      });

      expect(result.success).toBe(false);
    });

    it("should reject a hold reason longer than 5000 characters", () => {
      const result = holdAdvertisementFinancialApprovalSchema.safeParse({
        holdReason: "a".repeat(5001)
      });

      expect(result.success).toBe(false);
    });

    it("should reject an omitted hold reason", () => {
      const result = holdAdvertisementFinancialApprovalSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  describe("rejectAdvertisementFinancialApprovalSchema", () => {
    it("should accept a valid rejection reason", () => {
      const result = rejectAdvertisementFinancialApprovalSchema.safeParse({
        rejectionReason: "Payment amount does not match the approved request."
      });

      expect(result.success).toBe(true);
    });

    it("should trim the rejection reason", () => {
      const result = rejectAdvertisementFinancialApprovalSchema.safeParse({
        rejectionReason: "  Payment amount does not match.  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.rejectionReason).toBe(
          "Payment amount does not match."
        );
      }
    });

    it("should reject an empty rejection reason", () => {
      const result = rejectAdvertisementFinancialApprovalSchema.safeParse({
        rejectionReason: ""
      });

      expect(result.success).toBe(false);
    });

    it("should reject whitespace-only rejection reason", () => {
      const result = rejectAdvertisementFinancialApprovalSchema.safeParse({
        rejectionReason: "   "
      });

      expect(result.success).toBe(false);
    });

    it("should reject a rejection reason longer than 5000 characters", () => {
      const result = rejectAdvertisementFinancialApprovalSchema.safeParse({
        rejectionReason: "a".repeat(5001)
      });

      expect(result.success).toBe(false);
    });

    it("should reject an omitted rejection reason", () => {
      const result = rejectAdvertisementFinancialApprovalSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  describe("approveAdvertisementFinancialApprovalSchema", () => {
    it("should accept an empty request body", () => {
      const result = approveAdvertisementFinancialApprovalSchema.safeParse(
        {}
      );

      expect(result.success).toBe(true);
    });

    it("should accept approval remarks", () => {
      const result = approveAdvertisementFinancialApprovalSchema.safeParse({
        approvalRemarks: "Approved after payment verification."
      });

      expect(result.success).toBe(true);
    });

    it("should trim approval remarks", () => {
      const result = approveAdvertisementFinancialApprovalSchema.safeParse({
        approvalRemarks: "  Approved after payment verification.  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.approvalRemarks).toBe(
          "Approved after payment verification."
        );
      }
    });

    it("should accept null approval remarks", () => {
      const result = approveAdvertisementFinancialApprovalSchema.safeParse({
        approvalRemarks: null
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.approvalRemarks).toBeNull();
      }
    });

    it("should reject approval remarks longer than 5000 characters", () => {
      const result = approveAdvertisementFinancialApprovalSchema.safeParse({
        approvalRemarks: "a".repeat(5001)
      });

      expect(result.success).toBe(false);
    });
  });

  describe("resubmitAdvertisementFinancialApprovalSchema", () => {
    it("should accept an empty request body", () => {
      const result = resubmitAdvertisementFinancialApprovalSchema.safeParse(
        {}
      );

      expect(result.success).toBe(true);
    });

    it("should accept resubmission remarks", () => {
      const result = resubmitAdvertisementFinancialApprovalSchema.safeParse({
        approvalRemarks: "Payment details have been updated."
      });

      expect(result.success).toBe(true);
    });

    it("should trim resubmission remarks", () => {
      const result = resubmitAdvertisementFinancialApprovalSchema.safeParse({
        approvalRemarks: "  Payment details have been updated.  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.approvalRemarks).toBe(
          "Payment details have been updated."
        );
      }
    });

    it("should accept null resubmission remarks", () => {
      const result = resubmitAdvertisementFinancialApprovalSchema.safeParse({
        approvalRemarks: null
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.approvalRemarks).toBeNull();
      }
    });

    it("should reject resubmission remarks longer than 5000 characters", () => {
      const result = resubmitAdvertisementFinancialApprovalSchema.safeParse({
        approvalRemarks: "a".repeat(5001)
      });

      expect(result.success).toBe(false);
    });
  });

  describe("advertisementFinancialApprovalQuerySchema", () => {
    it("should apply default pagination values", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
      }
    });

    it("should coerce pagination values from strings", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        page: "2",
        pageSize: "50"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(50);
      }
    });

    it("should accept all supported query filters", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        page: "2",
        pageSize: "25",
        advertisementId: "10",
        clientId: "20",
        paymentId: "30",
        approvalType: "REFUND",
        status: "HOLD",
        requestedBy: "40",
        reviewedBy: "50"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          page: 2,
          pageSize: 25,
          advertisementId: 10,
          clientId: 20,
          paymentId: 30,
          approvalType: "REFUND",
          status: "HOLD",
          requestedBy: 40,
          reviewedBy: 50
        });
      }
    });

    it("should accept every supported approval type", () => {
      const approvalTypes = [
        "DISCOUNT",
        "ADJUSTMENT",
        "REFUND",
        "PARTIAL_REFUND"
      ] as const;

      for (const approvalType of approvalTypes) {
        const result = advertisementFinancialApprovalQuerySchema.safeParse({
          approvalType
        });

        expect(result.success).toBe(true);
      }
    });

    it("should accept every supported status", () => {
      const statuses = [
        "SUBMITTED",
        "HOLD",
        "APPROVED",
        "REJECTED"
      ] as const;

      for (const status of statuses) {
        const result = advertisementFinancialApprovalQuerySchema.safeParse({
          status
        });

        expect(result.success).toBe(true);
      }
    });

    it("should reject page zero", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        page: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative page", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        page: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject a decimal page", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        page: 1.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject pageSize zero", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        pageSize: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject pageSize greater than 100", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        pageSize: 101
      });

      expect(result.success).toBe(false);
    });

    it("should accept pageSize of 100", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        pageSize: 100
      });

      expect(result.success).toBe(true);
    });

    it("should reject invalid advertisementId", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        advertisementId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject invalid clientId", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        clientId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject invalid paymentId", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        paymentId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject invalid requestedBy", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        requestedBy: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject invalid reviewedBy", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        reviewedBy: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid approval type", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        approvalType: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid status", () => {
      const result = advertisementFinancialApprovalQuerySchema.safeParse({
        status: "INVALID"
      });

      expect(result.success).toBe(false);
    });
  });
});
;
