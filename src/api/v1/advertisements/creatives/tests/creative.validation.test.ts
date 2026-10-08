import { describe, expect, it } from "vitest";

import {
  advertisementIdSchema,
  createAdvertisementCreativeSchema,
  creativeIdSchema,
  updateAdvertisementCreativeSchema
} from "../creative.validation.js";

describe("Advertisement Creative Validation", () => {
  describe("advertisementIdSchema", () => {
    it("should accept a positive integer advertisement id", () => {
      const result = advertisementIdSchema.safeParse({
        advertisementId: "10"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(10);
      }
    });

    it("should reject zero", () => {
      const result = advertisementIdSchema.safeParse({
        advertisementId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative ids", () => {
      const result = advertisementIdSchema.safeParse({
        advertisementId: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject a non-numeric id", () => {
      const result = advertisementIdSchema.safeParse({
        advertisementId: "abc"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("creativeIdSchema", () => {
    it("should accept valid advertisement and creative ids", () => {
      const result = creativeIdSchema.safeParse({
        advertisementId: "10",
        creativeId: "25"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(10);
        expect(result.data.creativeId).toBe(25);
      }
    });

    it("should reject an invalid creative id", () => {
      const result = creativeIdSchema.safeParse({
        advertisementId: 10,
        creativeId: 0
      });

      expect(result.success).toBe(false);
    });
  });

  describe("createAdvertisementCreativeSchema", () => {
    const validImageCreative = {
      creativeType: "IMAGE",
      variant: "DESKTOP",
      title: "Homepage Banner",
      altText: "Advertisement banner",
      mediaUrl: "https://cdn.example.com/banner.jpg",
      thumbnailUrl: "https://cdn.example.com/banner-thumb.jpg",
      widthPx: 728,
      heightPx: 90,
      displayOrder: 1,
      isPrimary: true,
      status: "ACTIVE"
    };

    it("should accept a valid IMAGE creative", () => {
      const result =
        createAdvertisementCreativeSchema.safeParse(validImageCreative);

      expect(result.success).toBe(true);
    });

    it("should accept a valid VIDEO creative", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        creativeType: "VIDEO",
        mediaUrl: "https://cdn.example.com/banner.mp4"
      });

      expect(result.success).toBe(true);
    });

    it("should accept a valid HTML creative", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        creativeType: "HTML",
        mediaUrl: "<div>Advertisement</div>",
        widthPx: null,
        heightPx: null
      });

      expect(result.success).toBe(true);
    });

    it("should accept a valid TEXT creative", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        creativeType: "TEXT",
        mediaUrl: "Special offer available today",
        widthPx: null,
        heightPx: null
      });

      expect(result.success).toBe(true);
    });

    it("should accept MOBILE variant", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        variant: "MOBILE",
        widthPx: 320,
        heightPx: 100
      });

      expect(result.success).toBe(true);
    });

    it("should reject an unsupported creative type", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        creativeType: "AUDIO"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an unsupported variant", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        variant: "TABLET"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an unsupported status", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        status: "DELETED"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an empty media URL", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        mediaUrl: "   "
      });

      expect(result.success).toBe(false);
    });

    it("should reject width without height", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        heightPx: undefined
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path[0] === "heightPx" &&
              issue.message ===
                "heightPx should be provided when widthPx is provided."
          )
        ).toBe(true);
      }
    });

    it("should reject height without width", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        widthPx: undefined
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path[0] === "widthPx" &&
              issue.message ===
                "widthPx should be provided when heightPx is provided."
          )
        ).toBe(true);
      }
    });

    it("should reject zero width", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        widthPx: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative height", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        heightPx: -10
      });

      expect(result.success).toBe(false);
    });

    it("should accept null dimensions", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        widthPx: null,
        heightPx: null
      });

      expect(result.success).toBe(true);
    });

    it("should accept a nullable format id", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        formatId: null
      });

      expect(result.success).toBe(true);
    });

    it("should reject a non-positive format id", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        formatId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject a title longer than 1000 characters", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        title: "A".repeat(1001)
      });

      expect(result.success).toBe(false);
    });

    it("should reject alt text longer than 500 characters", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        altText: "A".repeat(501)
      });

      expect(result.success).toBe(false);
    });

    it("should reject media URL longer than 5000 characters", () => {
      const result = createAdvertisementCreativeSchema.safeParse({
        ...validImageCreative,
        mediaUrl: "A".repeat(5001)
      });

      expect(result.success).toBe(false);
    });
  });

  describe("updateAdvertisementCreativeSchema", () => {
    it("should accept a partial update", () => {
      const result = updateAdvertisementCreativeSchema.safeParse({
        title: "Updated title",
        isPrimary: true
      });

      expect(result.success).toBe(true);
    });

    it("should accept an empty update object", () => {
      const result = updateAdvertisementCreativeSchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it("should accept a variant change", () => {
      const result = updateAdvertisementCreativeSchema.safeParse({
        variant: "MOBILE"
      });

      expect(result.success).toBe(true);
    });

    it("should accept an inactive status", () => {
      const result = updateAdvertisementCreativeSchema.safeParse({
        status: "INACTIVE"
      });

      expect(result.success).toBe(true);
    });

    it("should reject width without height", () => {
      const result = updateAdvertisementCreativeSchema.safeParse({
        widthPx: 320
      });

      expect(result.success).toBe(false);
    });

    it("should reject height without width", () => {
      const result = updateAdvertisementCreativeSchema.safeParse({
        heightPx: 100
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative display order", () => {
      const result = updateAdvertisementCreativeSchema.safeParse({
        displayOrder: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid creative type", () => {
      const result = updateAdvertisementCreativeSchema.safeParse({
        creativeType: "AUDIO"
      });

      expect(result.success).toBe(false);
    });
  });
});
