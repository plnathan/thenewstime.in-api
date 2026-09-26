import { describe, expect, it } from "vitest";

import { ApiError } from "../../../../../shared/utils/apiErrorInfo.js";

import { calculateAgreedAmount } from "../agreed-amount.service.js";

describe("Advertisement Agreed Amount Service", () => {
  describe("calculateAgreedAmount", () => {
    it("should calculate an agreed amount below the standard amount", () => {
      const result = calculateAgreedAmount({
        standardAmount: 10000,
        agreedAmount: 8500,
        currencyCode: "INR"
      });

      expect(result).toEqual({
        standardAmount: 10000,
        agreedAmount: 8500,
        varianceAmount: -1500,
        variancePercentage: -15,
        currencyCode: "INR"
      });
    });

    it("should calculate an agreed amount equal to the standard amount", () => {
      const result = calculateAgreedAmount({
        standardAmount: 10000,
        agreedAmount: 10000,
        currencyCode: "INR"
      });

      expect(result).toEqual({
        standardAmount: 10000,
        agreedAmount: 10000,
        varianceAmount: 0,
        variancePercentage: 0,
        currencyCode: "INR"
      });
    });

    it("should calculate an agreed amount above the standard amount", () => {
      const result = calculateAgreedAmount({
        standardAmount: 10000,
        agreedAmount: 12500,
        currencyCode: "INR"
      });

      expect(result).toEqual({
        standardAmount: 10000,
        agreedAmount: 12500,
        varianceAmount: 2500,
        variancePercentage: 25,
        currencyCode: "INR"
      });
    });

    it("should support zero agreed amount", () => {
      const result = calculateAgreedAmount({
        standardAmount: 10000,
        agreedAmount: 0,
        currencyCode: "INR"
      });

      expect(result).toEqual({
        standardAmount: 10000,
        agreedAmount: 0,
        varianceAmount: -10000,
        variancePercentage: -100,
        currencyCode: "INR"
      });
    });

    it("should support zero standard amount", () => {
      const result = calculateAgreedAmount({
        standardAmount: 0,
        agreedAmount: 5000,
        currencyCode: "INR"
      });

      expect(result).toEqual({
        standardAmount: 0,
        agreedAmount: 5000,
        varianceAmount: 5000,
        variancePercentage: null,
        currencyCode: "INR"
      });
    });

    it("should support both amounts being zero", () => {
      const result = calculateAgreedAmount({
        standardAmount: 0,
        agreedAmount: 0,
        currencyCode: "INR"
      });

      expect(result).toEqual({
        standardAmount: 0,
        agreedAmount: 0,
        varianceAmount: 0,
        variancePercentage: null,
        currencyCode: "INR"
      });
    });

    it("should round standard amount to two decimals", () => {
      const result = calculateAgreedAmount({
        standardAmount: 1000.456,
        agreedAmount: 900,
        currencyCode: "INR"
      });

      expect(result.standardAmount).toBe(1000.46);
      expect(result.agreedAmount).toBe(900);
      expect(result.varianceAmount).toBe(-100.46);
      expect(result.variancePercentage).toBe(-10.04);
    });

    it("should round agreed amount to two decimals", () => {
      const result = calculateAgreedAmount({
        standardAmount: 1000,
        agreedAmount: 900.456,
        currencyCode: "INR"
      });

      expect(result.standardAmount).toBe(1000);
      expect(result.agreedAmount).toBe(900.46);
      expect(result.varianceAmount).toBe(-99.54);
      expect(result.variancePercentage).toBe(-9.95);
    });

    it("should calculate a fractional percentage correctly", () => {
      const result = calculateAgreedAmount({
        standardAmount: 3000,
        agreedAmount: 2750,
        currencyCode: "INR"
      });

      expect(result.varianceAmount).toBe(-250);
      expect(result.variancePercentage).toBe(-8.33);
    });

    it("should trim and uppercase the currency code", () => {
      const result = calculateAgreedAmount({
        standardAmount: 1000,
        agreedAmount: 900,
        currencyCode: " inr "
      });

      expect(result.currencyCode).toBe("INR");
    });

    it("should support other valid three-letter currency codes", () => {
      const result = calculateAgreedAmount({
        standardAmount: 1000,
        agreedAmount: 900,
        currencyCode: "USD"
      });

      expect(result.currencyCode).toBe("USD");
    });

    it("should reject a missing input object", () => {
      expect(() =>
        calculateAgreedAmount(
          undefined as unknown as {
            standardAmount: number;
            agreedAmount: number;
            currencyCode: string;
          }
        )
      ).toThrow(ApiError);
    });

    it("should reject an infinite standard amount", () => {
      expect(() =>
        calculateAgreedAmount({
          standardAmount: Infinity,
          agreedAmount: 1000,
          currencyCode: "INR"
        })
      ).toThrow(ApiError);
    });

    it("should reject a negative standard amount", () => {
      expect(() =>
        calculateAgreedAmount({
          standardAmount: -1,
          agreedAmount: 1000,
          currencyCode: "INR"
        })
      ).toThrow(ApiError);
    });

    it("should reject an infinite agreed amount", () => {
      expect(() =>
        calculateAgreedAmount({
          standardAmount: 1000,
          agreedAmount: Infinity,
          currencyCode: "INR"
        })
      ).toThrow(ApiError);
    });

    it("should reject a negative agreed amount", () => {
      expect(() =>
        calculateAgreedAmount({
          standardAmount: 1000,
          agreedAmount: -1,
          currencyCode: "INR"
        })
      ).toThrow(ApiError);
    });

    it("should reject a missing currency code", () => {
      expect(() =>
        calculateAgreedAmount({
          standardAmount: 1000,
          agreedAmount: 900,
          currencyCode: undefined as unknown as string
        })
      ).toThrow(ApiError);
    });

    it("should reject a currency code with fewer than three characters", () => {
      expect(() =>
        calculateAgreedAmount({
          standardAmount: 1000,
          agreedAmount: 900,
          currencyCode: "IN"
        })
      ).toThrow(ApiError);
    });

    it("should reject a currency code with more than three characters", () => {
      expect(() =>
        calculateAgreedAmount({
          standardAmount: 1000,
          agreedAmount: 900,
          currencyCode: "INRR"
        })
      ).toThrow(ApiError);
    });

    it("should reject a currency code containing numbers", () => {
      expect(() =>
        calculateAgreedAmount({
          standardAmount: 1000,
          agreedAmount: 900,
          currencyCode: "I2R"
        })
      ).toThrow(ApiError);
    });

    it("should reject a currency code containing symbols", () => {
      expect(() =>
        calculateAgreedAmount({
          standardAmount: 1000,
          agreedAmount: 900,
          currencyCode: "IN$"
        })
      ).toThrow(ApiError);
    });

    it("should reject a whitespace-only currency code", () => {
      expect(() =>
        calculateAgreedAmount({
          standardAmount: 1000,
          agreedAmount: 900,
          currencyCode: "   "
        })
      ).toThrow(ApiError);
    });

    it("should not reject a negotiated amount simply because it differs from standard pricing", () => {
      const result = calculateAgreedAmount({
        standardAmount: 25000,
        agreedAmount: 18000,
        currencyCode: "INR"
      });

      expect(result.varianceAmount).toBe(-7000);
      expect(result.variancePercentage).toBe(-28);
    });
  });
});
