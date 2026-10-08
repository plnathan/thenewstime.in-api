import { describe, expect, it } from "vitest";

import {
  advertisementIdSchema,
  advertisementQuerySchema,
  createAdvertisementSchema,
  updateAdvertisementSchema
} from "../advertisement.validation.js";

describe("Advertisement Validation", () => {
  describe("advertisementIdSchema", () => {
    it("should accept a valid positive numeric ID", () => {
      const result = advertisementIdSchema.safeParse({
        id: 123
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(123);
      }
    });

    it("should coerce a numeric string to a number", () => {
      const result = advertisementIdSchema.safeParse({
        id: "123"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(123);
      }
    });

    it("should reject zero", () => {
      const result = advertisementIdSchema.safeParse({
        id: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative IDs", () => {
      const result = advertisementIdSchema.safeParse({
        id: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric IDs", () => {
      const result = advertisementIdSchema.safeParse({
        id: "abc"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("createAdvertisementSchema", () => {
    it("should accept a valid advertisement", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Homepage Banner",
        advertisementType: "BANNER",
        destinationUrl: "https://example.com",
        priority: 10,
        startAt: "2026-10-01T09:00:00+05:30",
        endAt: "2026-10-10T18:00:00+05:30",
        isClickable: true,
        openInNewTab: true,
        notes: "Homepage campaign",
        advertisementAmount: 25000,
        currencyCode: "inr",
        campaignId: 5
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.clientId).toBe(1);
        expect(result.data.placementId).toBe(100);
        expect(result.data.name).toBe("Homepage Banner");
        expect(result.data.advertisementType).toBe("BANNER");
        expect(result.data.currencyCode).toBe("INR");
      }
    });

    it("should apply the default values", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Display Advertisement",
        destinationUrl: "https://example.com"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBe(100);
        expect(result.data.advertisementType).toBe("DISPLAY");
        expect(result.data.priority).toBe(0);
        expect(result.data.isClickable).toBe(true);
        expect(result.data.openInNewTab).toBe(true);
        expect(result.data.currencyCode).toBe("INR");
      }
    });

    it("should reject a missing client ID", () => {
      const result = createAdvertisementSchema.safeParse({
        placementId: 100,
        name: "Advertisement",
        destinationUrl: "https://example.com"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an empty advertisement name", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "",
        destinationUrl: "https://example.com"
      });

      expect(result.success).toBe(false);
    });

    it("should trim the advertisement name", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "  Homepage Advertisement  ",
        destinationUrl: "https://example.com"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBe(100);
        expect(result.data.name).toBe("Homepage Advertisement");
      }
    });

    it("should reject an invalid advertisement type", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Advertisement",
        advertisementType: "INVALID",
        destinationUrl: "https://example.com"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid destination URL", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Advertisement",
        destinationUrl: "not-a-url"
      });

      expect(result.success).toBe(false);
    });

    it("should require destination URL for clickable advertisements", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Clickable Advertisement",
        isClickable: true
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path[0] === "destinationUrl" &&
              issue.message ===
                "Destination URL is required when the advertisement is clickable."
          )
        ).toBe(true);
      }
    });

    it("should allow a non-clickable advertisement without a destination URL", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Non-clickable Advertisement",
        isClickable: false
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBe(100);
      }
    });

    it("should reject a negative priority", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Advertisement",
        priority: -1,
        destinationUrl: "https://example.com"
      });

      expect(result.success).toBe(false);
    });

    it("should coerce numeric string values", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: "10",
        placementId: "100",
        name: "Advertisement",
        priority: "5",
        advertisementAmount: "25000",
        destinationUrl: "https://example.com"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.clientId).toBe(10);
        expect(result.data.placementId).toBe(100);
        expect(result.data.priority).toBe(5);
        expect(result.data.advertisementAmount).toBe(25000);
      }
    });

    it("should reject a negative advertisement amount", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Advertisement",
        advertisementAmount: -100,
        destinationUrl: "https://example.com"
      });

      expect(result.success).toBe(false);
    });

    it("should uppercase the currency code", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Advertisement",
        currencyCode: "usd",
        destinationUrl: "https://example.com"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBe(100);
        expect(result.data.currencyCode).toBe("USD");
      }
    });

    it("should reject a currency code that is not three characters", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Advertisement",
        currencyCode: "US",
        destinationUrl: "https://example.com"
      });

      expect(result.success).toBe(false);
    });

    it("should accept a valid date range", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Scheduled Advertisement",
        destinationUrl: "https://example.com",
        startAt: "2026-10-01T09:00:00+05:30",
        endAt: "2026-10-01T18:00:00+05:30"
      });

      expect(result.success).toBe(true);
    });

    it("should reject an end date before the start date", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Invalid Schedule",
        destinationUrl: "https://example.com",
        startAt: "2026-10-10T18:00:00+05:30",
        endAt: "2026-10-01T18:00:00+05:30"
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path[0] === "endAt" &&
              issue.message === "End date/time must be after start date/time."
          )
        ).toBe(true);
      }
    });

    it("should reject an end date equal to the start date", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Invalid Schedule",
        destinationUrl: "https://example.com",
        startAt: "2026-10-01T18:00:00+05:30",
        endAt: "2026-10-01T18:00:00+05:30"
      });

      expect(result.success).toBe(false);
    });

    it("should accept an advertisement without a schedule", () => {
      const result = createAdvertisementSchema.safeParse({
        clientId: 1,
        placementId: 100,
        name: "Unscheduled Advertisement",
        destinationUrl: "https://example.com"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBe(100);
      }
    });
  });

  describe("updateAdvertisementSchema", () => {
    it("should accept an empty update object", () => {
      const result = updateAdvertisementSchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it("should accept a valid partial update", () => {
      const result = updateAdvertisementSchema.safeParse({
        name: "Updated Advertisement",
        priority: "20",
        advertisementType: "OVERLAY",
        destinationUrl: "https://example.com/updated",
        currencyCode: "usd"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.name).toBe("Updated Advertisement");
        expect(result.data.priority).toBe(20);
        expect(result.data.advertisementType).toBe("OVERLAY");
        expect(result.data.currencyCode).toBe("USD");
      }
    });

    it("should reject an invalid update advertisement type", () => {
      const result = updateAdvertisementSchema.safeParse({
        advertisementType: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid update URL", () => {
      const result = updateAdvertisementSchema.safeParse({
        destinationUrl: "invalid-url"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative update priority", () => {
      const result = updateAdvertisementSchema.safeParse({
        priority: -10
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid update date range", () => {
      const result = updateAdvertisementSchema.safeParse({
        startAt: "2026-10-10T18:00:00+05:30",
        endAt: "2026-10-01T18:00:00+05:30"
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path[0] === "endAt" &&
              issue.message === "End date/time must be after start date/time."
          )
        ).toBe(true);
      }
    });

    it("should allow destination URL to be omitted from an update", () => {
      const result = updateAdvertisementSchema.safeParse({
        name: "Updated Advertisement"
      });

      expect(result.success).toBe(true);
    });
  });

  describe("advertisementQuerySchema", () => {
    it("should apply default pagination values", () => {
      const result = advertisementQuerySchema.safeParse({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
      }
    });

    it("should coerce pagination values from strings", () => {
      const result = advertisementQuerySchema.safeParse({
        page: "2",
        pageSize: "50"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.pageSize).toBe(50);
      }
    });

    it("should reject page zero", () => {
      const result = advertisementQuerySchema.safeParse({
        page: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject page size above 100", () => {
      const result = advertisementQuerySchema.safeParse({
        pageSize: 101
      });

      expect(result.success).toBe(false);
    });

    it("should accept valid workflow statuses", () => {
      const statuses = [
        "DRAFT",
        "SUBMITTED",
        "APPROVED",
        "REJECTED",
        "ON_HOLD",
        "ARCHIVED"
      ];

      for (const workflowStatus of statuses) {
        const result = advertisementQuerySchema.safeParse({
          workflowStatus
        });

        expect(result.success).toBe(true);
      }
    });

    it("should reject an invalid workflow status", () => {
      const result = advertisementQuerySchema.safeParse({
        workflowStatus: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should accept valid advertisement statuses", () => {
      const statuses = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"];

      for (const status of statuses) {
        const result = advertisementQuerySchema.safeParse({
          status
        });

        expect(result.success).toBe(true);
      }
    });

    it("should reject an invalid advertisement status", () => {
      const result = advertisementQuerySchema.safeParse({
        status: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should coerce client ID from a string", () => {
      const result = advertisementQuerySchema.safeParse({
        clientId: "25"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.clientId).toBe(25);
      }
    });

    it("should reject an invalid client ID", () => {
      const result = advertisementQuerySchema.safeParse({
        clientId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should trim search text", () => {
      const result = advertisementQuerySchema.safeParse({
        search: "  homepage banner  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.search).toBe("homepage banner");
      }
    });
  });
});