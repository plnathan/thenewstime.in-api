import { describe, expect, it } from "vitest";

import {
  advertisementPaymentIdSchema,
  advertisementPaymentQuerySchema,
  advertisementPaymentRefundIdSchema,
  advertisementPaymentRefundSchema,
  createAdvertisementPaymentSchema,
  updateAdvertisementPaymentSchema
} from "../payment.validation.js";

describe("Advertisement Payment Validation", () => {
  describe("advertisementPaymentIdSchema", () => {
    it("should accept a valid positive integer id", () => {
      const result = advertisementPaymentIdSchema.safeParse({
        id: 10
      });

      expect(result.success).toBe(true);
    });

    it("should coerce a numeric string id", () => {
      const result = advertisementPaymentIdSchema.safeParse({
        id: "10"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(10);
      }
    });

    it("should reject zero", () => {
      const result = advertisementPaymentIdSchema.safeParse({
        id: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative ids", () => {
      const result = advertisementPaymentIdSchema.safeParse({
        id: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric ids", () => {
      const result = advertisementPaymentIdSchema.safeParse({
        id: "abc"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("advertisementPaymentRefundIdSchema", () => {
    it("should accept a valid refund id", () => {
      const result = advertisementPaymentRefundIdSchema.safeParse({
        id: "25"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(25);
      }
    });

    it("should reject an invalid refund id", () => {
      const result = advertisementPaymentRefundIdSchema.safeParse({
        id: "invalid"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("createAdvertisementPaymentSchema", () => {
    it("should accept a valid payment", () => {
      const result = createAdvertisementPaymentSchema.safeParse({
        advertisementId: 100,
        amount: 25000,
        paymentType: "ADVANCE",
        paymentDate: "2026-09-23T10:00:00+05:30",
        paymentMethod: "UPI",
        transactionReference: "TXN-10001",
        notes: "Advance payment"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(100);
        expect(result.data.amount).toBe(25000);
        expect(result.data.paymentType).toBe("ADVANCE");
        expect(result.data.paymentDate).toBeInstanceOf(Date);
      }
    });

    it("should accept a payment without optional fields", () => {
      const result = createAdvertisementPaymentSchema.safeParse({
        advertisementId: 100,
        amount: 10000,
        paymentType: "REGULAR"
      });

      expect(result.success).toBe(true);
    });

    it("should reject a zero amount", () => {
      const result = createAdvertisementPaymentSchema.safeParse({
        advertisementId: 100,
        amount: 0,
        paymentType: "REGULAR"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative amount", () => {
      const result = createAdvertisementPaymentSchema.safeParse({
        advertisementId: 100,
        amount: -500,
        paymentType: "REGULAR"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid payment type", () => {
      const result = createAdvertisementPaymentSchema.safeParse({
        advertisementId: 100,
        amount: 10000,
        paymentType: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid payment method", () => {
      const result = createAdvertisementPaymentSchema.safeParse({
        advertisementId: 100,
        amount: 10000,
        paymentType: "REGULAR",
        paymentMethod: "BITCOIN"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a non-positive advertisement id", () => {
      const result = createAdvertisementPaymentSchema.safeParse({
        advertisementId: 0,
        amount: 10000,
        paymentType: "REGULAR"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid payment date", () => {
      const result = createAdvertisementPaymentSchema.safeParse({
        advertisementId: 100,
        amount: 10000,
        paymentType: "REGULAR",
        paymentDate: "not-a-date"
      });

      expect(result.success).toBe(false);
    });

    it("should accept a Date instance", () => {
      const paymentDate = new Date("2026-09-23T10:00:00.000Z");

      const result = createAdvertisementPaymentSchema.safeParse({
        advertisementId: 100,
        amount: 10000,
        paymentType: "FINAL",
        paymentDate
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.paymentDate).toEqual(paymentDate);
      }
    });
  });

  describe("updateAdvertisementPaymentSchema", () => {
    it("should accept an amount update", () => {
      const result = updateAdvertisementPaymentSchema.safeParse({
        amount: 15000
      });

      expect(result.success).toBe(true);
    });

    it("should accept multiple update fields", () => {
      const result = updateAdvertisementPaymentSchema.safeParse({
        amount: 15000,
        paymentType: "INSTALLMENT",
        paymentDate: "2026-09-23T10:00:00+05:30",
        paymentMethod: "BANK_TRANSFER",
        transactionReference: "TXN-20001",
        notes: "Updated payment"
      });

      expect(result.success).toBe(true);
    });

    it("should reject an empty update object", () => {
      const result = updateAdvertisementPaymentSchema.safeParse({});

      expect(result.success).toBe(false);
    });

    it("should reject a non-positive amount", () => {
      const result = updateAdvertisementPaymentSchema.safeParse({
        amount: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid payment type", () => {
      const result = updateAdvertisementPaymentSchema.safeParse({
        paymentType: "INVALID"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("advertisementPaymentRefundSchema", () => {
    it("should accept a valid refund", () => {
      const result = advertisementPaymentRefundSchema.safeParse({
        paymentId: 100,
        amount: 5000,
        refundDate: "2026-09-23T10:00:00+05:30",
        refundReference: "REF-10001",
        refundReason: "Customer refund"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.paymentId).toBe(100);
        expect(result.data.amount).toBe(5000);
        expect(result.data.refundDate).toBeInstanceOf(Date);
      }
    });

    it("should accept a refund without optional fields", () => {
      const result = advertisementPaymentRefundSchema.safeParse({
        paymentId: 100,
        amount: 5000
      });

      expect(result.success).toBe(true);
    });

    it("should reject a zero refund amount", () => {
      const result = advertisementPaymentRefundSchema.safeParse({
        paymentId: 100,
        amount: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative refund amount", () => {
      const result = advertisementPaymentRefundSchema.safeParse({
        paymentId: 100,
        amount: -100
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid payment id", () => {
      const result = advertisementPaymentRefundSchema.safeParse({
        paymentId: 0,
        amount: 1000
      });

      expect(result.success).toBe(false);
    });
  });

  describe("advertisementPaymentQuerySchema", () => {
    it("should accept valid query filters", () => {
      const result = advertisementPaymentQuerySchema.safeParse({
        advertisementId: "100",
        paymentType: "ADVANCE",
        paymentStatus: "VERIFIED",
        paymentMethod: "UPI",
        fromDate: "2026-09-01T00:00:00+05:30",
        toDate: "2026-09-30T23:59:59+05:30",
        search: "TXN-100"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(100);
        expect(result.data.fromDate).toBeInstanceOf(Date);
        expect(result.data.toDate).toBeInstanceOf(Date);
      }
    });

    it("should accept an empty query", () => {
      const result = advertisementPaymentQuerySchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it("should reject an invalid payment status", () => {
      const result = advertisementPaymentQuerySchema.safeParse({
        paymentStatus: "UNKNOWN"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid payment method", () => {
      const result = advertisementPaymentQuerySchema.safeParse({
        paymentMethod: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid date", () => {
      const result = advertisementPaymentQuerySchema.safeParse({
        fromDate: "invalid-date"
      });

      expect(result.success).toBe(false);
    });
  });
});
