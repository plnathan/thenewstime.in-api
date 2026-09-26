import { describe, expect, it } from "vitest";

import {
  advertisementMetricsParamsSchema,
  advertisementMetricsQuerySchema,
  advertisementTrackingSchema
} from "../tracking.validation.js";

describe("tracking.validation", () => {
  describe("advertisementTrackingSchema", () => {
    const validInput = {
      advertisementId: 101,
      placementId: 201,
      placementRuleId: 301,
      scheduleId: 401,
      creativeId: 501,
      pageType: "HOME",
      placementType: "HOME_TOP"
    };

    it("accepts a valid tracking request", () => {
      const result = advertisementTrackingSchema.safeParse(validInput);

      expect(result.success).toBe(true);
    });

    it("coerces numeric identifiers", () => {
      const result = advertisementTrackingSchema.safeParse({
        ...validInput,
        advertisementId: "101",
        placementId: "201",
        placementRuleId: "301",
        scheduleId: "401",
        creativeId: "501"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(101);
        expect(result.data.placementId).toBe(201);
        expect(result.data.placementRuleId).toBe(301);
        expect(result.data.scheduleId).toBe(401);
        expect(result.data.creativeId).toBe(501);
      }
    });

    it("accepts all supported page types", () => {
      for (const pageType of ["HOME", "NEWS_LIST", "NEWS_DETAIL"]) {
        const result = advertisementTrackingSchema.safeParse({
          ...validInput,
          pageType
        });

        expect(result.success).toBe(true);
      }
    });

    it("accepts all supported placement types", () => {
      const placementTypes = [
        "HOME_BANNER",
        "HOME_TOP",
        "HOME_BETWEEN_SECTIONS",
        "HOME_SIDEBAR",
        "NEWS_LIST_TOP",
        "NEWS_LIST_BETWEEN",
        "NEWS_LIST_SIDEBAR",
        "NEWS_LIST_BOTTOM",
        "NEWS_LIST_MODAL",
        "NEWS_DETAIL_TOP",
        "NEWS_DETAIL_BETWEEN",
        "NEWS_DETAIL_SIDEBAR",
        "NEWS_DETAIL_BOTTOM",
        "NEWS_DETAIL_MODAL"
      ];

      for (const placementType of placementTypes) {
        const result = advertisementTrackingSchema.safeParse({
          ...validInput,
          placementType
        });

        expect(result.success).toBe(true);
      }
    });

    it("accepts optional tracking metadata", () => {
      const result = advertisementTrackingSchema.safeParse({
        ...validInput,
        sessionId: "session-101",
        visitorId: "550e8400-e29b-41d4-a716-446655440000",
        browser: "Chrome",
        operatingSystem: "Windows",
        deviceType: "DESKTOP",
        pageUrl: "https://www.thenewstime.in/news/example",
        referrerUrl: "https://www.google.com/"
      });

      expect(result.success).toBe(true);
    });

    it("accepts tracking context", () => {
      const result = advertisementTrackingSchema.safeParse({
        ...validInput,
        context: {
          site: "thenewstime.in",
          newsId: 1001,
          category: "Tamil Nadu",
          state: "Tamil Nadu",
          district: "Chennai",
          country: "India"
        }
      });

      expect(result.success).toBe(true);
    });

    it("rejects a missing advertisement id", () => {
      const {
        advertisementId: _advertisementId,
        ...inputWithoutAdvertisementId
      } = validInput;

      const result = advertisementTrackingSchema.safeParse(
        inputWithoutAdvertisementId
      );

      expect(result.success).toBe(false);
    });

    it("rejects zero or negative identifiers", () => {
      for (const field of [
        "advertisementId",
        "placementId",
        "placementRuleId",
        "scheduleId",
        "creativeId"
      ]) {
        const result = advertisementTrackingSchema.safeParse({
          ...validInput,
          [field]: 0
        });

        expect(result.success).toBe(false);
      }
    });

    it("rejects an invalid visitor id", () => {
      const result = advertisementTrackingSchema.safeParse({
        ...validInput,
        visitorId: "invalid-visitor-id"
      });

      expect(result.success).toBe(false);
    });

    it("rejects an invalid page url", () => {
      const result = advertisementTrackingSchema.safeParse({
        ...validInput,
        pageUrl: "not-a-url"
      });

      expect(result.success).toBe(false);
    });

    it("rejects an invalid referrer url", () => {
      const result = advertisementTrackingSchema.safeParse({
        ...validInput,
        referrerUrl: "not-a-url"
      });

      expect(result.success).toBe(false);
    });

    it("rejects an unsupported page type", () => {
      const result = advertisementTrackingSchema.safeParse({
        ...validInput,
        pageType: "ADMIN"
      });

      expect(result.success).toBe(false);
    });

    it("rejects an unsupported placement type", () => {
      const result = advertisementTrackingSchema.safeParse({
        ...validInput,
        placementType: "INVALID_PLACEMENT"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("advertisementMetricsParamsSchema", () => {
    it("accepts a positive numeric advertisement id", () => {
      const result = advertisementMetricsParamsSchema.safeParse({
        advertisementId: "101"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(101);
      }
    });

    it("rejects a non-positive advertisement id", () => {
      const result = advertisementMetricsParamsSchema.safeParse({
        advertisementId: "0"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("advertisementMetricsQuerySchema", () => {
    it("accepts no date filters", () => {
      const result = advertisementMetricsQuerySchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it("accepts only from", () => {
      const result = advertisementMetricsQuerySchema.safeParse({
        from: "2026-09-01T00:00:00.000Z"
      });

      expect(result.success).toBe(true);
    });

    it("accepts only to", () => {
      const result = advertisementMetricsQuerySchema.safeParse({
        to: "2026-09-22T00:00:00.000Z"
      });

      expect(result.success).toBe(true);
    });

    it("accepts from earlier than to", () => {
      const result = advertisementMetricsQuerySchema.safeParse({
        from: "2026-09-01T00:00:00.000Z",
        to: "2026-09-22T00:00:00.000Z"
      });

      expect(result.success).toBe(true);
    });

    it("accepts from equal to", () => {
      const result = advertisementMetricsQuerySchema.safeParse({
        from: "2026-09-22T00:00:00.000Z",
        to: "2026-09-22T00:00:00.000Z"
      });

      expect(result.success).toBe(true);
    });

    it("rejects from later than to", () => {
      const result = advertisementMetricsQuerySchema.safeParse({
        from: "2026-09-23T00:00:00.000Z",
        to: "2026-09-22T00:00:00.000Z"
      });

      expect(result.success).toBe(false);
    });

    it("rejects invalid dates", () => {
      const result = advertisementMetricsQuerySchema.safeParse({
        from: "invalid-date"
      });

      expect(result.success).toBe(false);
    });
  });
});
