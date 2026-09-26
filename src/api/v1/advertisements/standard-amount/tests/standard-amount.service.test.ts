import { describe, expect, it } from "vitest";

import { ApiError } from "../../../../../shared/utils/apiErrorInfo.js";

import { calculateStandardAmount } from "../standard-amount.service.js";

describe("Advertisement Standard Amount Service", () => {
  describe("calculateStandardAmount", () => {
    it("should calculate a DAY-based standard amount", () => {
      const result = calculateStandardAmount({
        pricingUnit: "DAY",
        rateAmount: 1000,
        quantity: 7,
        currencyCode: "INR"
      });

      expect(result).toEqual({
        pricingUnit: "DAY",
        rateAmount: 1000,
        quantity: 7,
        standardAmount: 7000,
        currencyCode: "INR"
      });
    });

    it("should calculate a WEEK-based standard amount", () => {
      const result = calculateStandardAmount({
        pricingUnit: "WEEK",
        rateAmount: 5000,
        quantity: 4,
        currencyCode: "INR"
      });

      expect(result.standardAmount).toBe(20000);
    });

    it("should calculate a MONTH-based standard amount", () => {
      const result = calculateStandardAmount({
        pricingUnit: "MONTH",
        rateAmount: 25000,
        quantity: 3,
        currencyCode: "INR"
      });

      expect(result.standardAmount).toBe(75000);
    });

    it("should calculate an IMPRESSION-based standard amount", () => {
      const result = calculateStandardAmount({
        pricingUnit: "IMPRESSION",
        rateAmount: 2.5,
        quantity: 10000,
        currencyCode: "INR"
      });

      expect(result.standardAmount).toBe(25000);
    });

    it("should calculate a CAMPAIGN-based standard amount", () => {
      const result = calculateStandardAmount({
        pricingUnit: "CAMPAIGN",
        rateAmount: 50000,
        quantity: 1,
        currencyCode: "INR"
      });

      expect(result.standardAmount).toBe(50000);
    });

    it("should calculate a FIXED-based standard amount", () => {
      const result = calculateStandardAmount({
        pricingUnit: "FIXED",
        rateAmount: 15000,
        quantity: 1,
        currencyCode: "INR"
      });

      expect(result.standardAmount).toBe(15000);
    });

    it("should support decimal quantities", () => {
      const result = calculateStandardAmount({
        pricingUnit: "DAY",
        rateAmount: 1250.5,
        quantity: 2.5,
        currencyCode: "INR"
      });

      expect(result.standardAmount).toBe(3126.25);
    });

    it("should round the standard amount to two decimal places", () => {
      const result = calculateStandardAmount({
        pricingUnit: "DAY",
        rateAmount: 10.123,
        quantity: 3,
        currencyCode: "INR"
      });

      expect(result.rateAmount).toBe(10.12);
      expect(result.standardAmount).toBe(30.37);
    });

    it("should normalize the currency code to uppercase", () => {
      const result = calculateStandardAmount({
        pricingUnit: "DAY",
        rateAmount: 1000,
        quantity: 2,
        currencyCode: "inr"
      });

      expect(result.currencyCode).toBe("INR");
    });

    it("should trim whitespace from the currency code", () => {
      const result = calculateStandardAmount({
        pricingUnit: "DAY",
        rateAmount: 1000,
        quantity: 2,
        currencyCode: " inr "
      });

      expect(result.currencyCode).toBe("INR");
    });

    it("should allow a zero rate amount", () => {
      const result = calculateStandardAmount({
        pricingUnit: "DAY",
        rateAmount: 0,
        quantity: 10,
        currencyCode: "INR"
      });

      expect(result.standardAmount).toBe(0);
    });

    it("should reject a negative rate amount", () => {
      expect(() =>
        calculateStandardAmount({
          pricingUnit: "DAY",
          rateAmount: -1,
          quantity: 10,
          currencyCode: "INR"
        })
      ).toThrow(ApiError);

      expect(() =>
        calculateStandardAmount({
          pricingUnit: "DAY",
          rateAmount: -1,
          quantity: 10,
          currencyCode: "INR"
        })
      ).toThrow("Advertisement rate amount cannot be negative.");
    });

    it("should reject a non-finite rate amount", () => {
      expect(() =>
        calculateStandardAmount({
          pricingUnit: "DAY",
          rateAmount: Number.NaN,
          quantity: 10,
          currencyCode: "INR"
        })
      ).toThrow("Advertisement rate amount must be a finite number.");
    });

    it("should reject positive infinity as a rate amount", () => {
      expect(() =>
        calculateStandardAmount({
          pricingUnit: "DAY",
          rateAmount: Number.POSITIVE_INFINITY,
          quantity: 10,
          currencyCode: "INR"
        })
      ).toThrow("Advertisement rate amount must be a finite number.");
    });

    it("should reject a zero quantity", () => {
      expect(() =>
        calculateStandardAmount({
          pricingUnit: "DAY",
          rateAmount: 1000,
          quantity: 0,
          currencyCode: "INR"
        })
      ).toThrow("Advertisement pricing quantity must be greater than zero.");
    });

    it("should reject a negative quantity", () => {
      expect(() =>
        calculateStandardAmount({
          pricingUnit: "DAY",
          rateAmount: 1000,
          quantity: -2,
          currencyCode: "INR"
        })
      ).toThrow("Advertisement pricing quantity must be greater than zero.");
    });

    it("should reject a non-finite quantity", () => {
      expect(() =>
        calculateStandardAmount({
          pricingUnit: "DAY",
          rateAmount: 1000,
          quantity: Number.NaN,
          currencyCode: "INR"
        })
      ).toThrow("Advertisement pricing quantity must be a finite number.");
    });

    it("should reject an invalid currency code", () => {
      expect(() =>
        calculateStandardAmount({
          pricingUnit: "DAY",
          rateAmount: 1000,
          quantity: 2,
          currencyCode: "US"
        })
      ).toThrow(
        "Advertisement pricing currency code must contain exactly three letters."
      );
    });

    it("should reject a currency code containing numbers", () => {
      expect(() =>
        calculateStandardAmount({
          pricingUnit: "DAY",
          rateAmount: 1000,
          quantity: 2,
          currencyCode: "IN1"
        })
      ).toThrow(
        "Advertisement pricing currency code must contain exactly three letters."
      );
    });

    it("should reject an unsupported pricing unit at runtime", () => {
      expect(() =>
        calculateStandardAmount({
          pricingUnit: "INVALID" as never,
          rateAmount: 1000,
          quantity: 2,
          currencyCode: "INR"
        })
      ).toThrow("Unsupported advertisement pricing unit 'INVALID'.");
    });

    it("should calculate a large monetary value correctly", () => {
      const result = calculateStandardAmount({
        pricingUnit: "CAMPAIGN",
        rateAmount: 999999.99,
        quantity: 10,
        currencyCode: "INR"
      });

      expect(result.standardAmount).toBe(9999999.9);
    });

    it("should preserve the requested quantity in the result", () => {
      const result = calculateStandardAmount({
        pricingUnit: "IMPRESSION",
        rateAmount: 1.25,
        quantity: 250000,
        currencyCode: "INR"
      });

      expect(result.quantity).toBe(250000);
      expect(result.standardAmount).toBe(312500);
    });
  });
});
