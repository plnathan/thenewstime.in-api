import { describe, expect, it } from "vitest";

import {
  createPlacementRuleSchema,
  placementRuleIdSchema,
  placementRuleQuerySchema,
  updatePlacementRuleSchema
} from "../placement-rule.validation.js";

describe("Placement Rule Validation", () => {
  describe("placementRuleIdSchema", () => {
    it("should accept a valid positive numeric ID", () => {
      const result = placementRuleIdSchema.safeParse({
        id: 123
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(123);
      }
    });

    it("should coerce a numeric string to a number", () => {
      const result = placementRuleIdSchema.safeParse({
        id: "123"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(123);
      }
    });

    it("should reject zero", () => {
      const result = placementRuleIdSchema.safeParse({
        id: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative ID", () => {
      const result = placementRuleIdSchema.safeParse({
        id: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject a non-numeric ID", () => {
      const result = placementRuleIdSchema.safeParse({
        id: "abc"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("createPlacementRuleSchema", () => {
    it("should accept a valid FIXED placement rule", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        displayOrder: 1,
        insertionType: "FIXED",
        maxImpressions: 1000,
        status: "ACTIVE"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(10);
        expect(result.data.placementId).toBe(20);
        expect(result.data.displayOrder).toBe(1);
        expect(result.data.insertionType).toBe("FIXED");
        expect(result.data.maxImpressions).toBe(1000);
        expect(result.data.status).toBe("ACTIVE");
      }
    });

    it("should apply the default values", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.displayOrder).toBe(0);
        expect(result.data.insertionType).toBe("FIXED");
        expect(result.data.status).toBe("ACTIVE");
      }
    });

    it("should accept AFTER_N_ITEMS with a positive insertion position", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: 5
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.insertionType).toBe("AFTER_N_ITEMS");
        expect(result.data.insertionPosition).toBe(5);
      }
    });

    it("should accept BETWEEN_SECTIONS with a positive insertion position", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        insertionType: "BETWEEN_SECTIONS",
        insertionPosition: 2
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.insertionType).toBe("BETWEEN_SECTIONS");
        expect(result.data.insertionPosition).toBe(2);
      }
    });

    it("should coerce numeric string values", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: "10",
        placementId: "20",
        displayOrder: "3",
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: "5",
        maxImpressions: "100"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(10);
        expect(result.data.placementId).toBe(20);
        expect(result.data.displayOrder).toBe(3);
        expect(result.data.insertionPosition).toBe(5);
        expect(result.data.maxImpressions).toBe(100);
      }
    });

    it("should reject a missing advertisement ID", () => {
      const result = createPlacementRuleSchema.safeParse({
        placementId: 20
      });

      expect(result.success).toBe(false);
    });

    it("should reject a missing placement ID", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10
      });

      expect(result.success).toBe(false);
    });

    it("should reject zero advertisement ID", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 0,
        placementId: 20
      });

      expect(result.success).toBe(false);
    });

    it("should reject zero placement ID", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid insertion type", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        insertionType: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an insertion position for FIXED rules", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        insertionType: "FIXED",
        insertionPosition: 1
      });

      expect(result.success).toBe(false);
    });

    it("should reject a missing insertion position for AFTER_N_ITEMS", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        insertionType: "AFTER_N_ITEMS"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a missing insertion position for BETWEEN_SECTIONS", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        insertionType: "BETWEEN_SECTIONS"
      });

      expect(result.success).toBe(false);
    });

    it("should reject zero insertion position", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative insertion position", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject zero max impressions", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        maxImpressions: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative max impressions", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        maxImpressions: -1
      });

      expect(result.success).toBe(false);
    });

    it("should allow null max impressions", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        maxImpressions: null
      });

      expect(result.success).toBe(true);
    });

    it("should reject an invalid status", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        status: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should accept INACTIVE status", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        status: "INACTIVE"
      });

      expect(result.success).toBe(true);
    });

    it("should reject a negative display order", () => {
      const result = createPlacementRuleSchema.safeParse({
        advertisementId: 10,
        placementId: 20,
        displayOrder: -1
      });

      expect(result.success).toBe(false);
    });
  });

  describe("updatePlacementRuleSchema", () => {
    it("should accept an empty update object", () => {
      const result = updatePlacementRuleSchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it("should accept a valid partial update", () => {
      const result = updatePlacementRuleSchema.safeParse({
        displayOrder: "5",
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: "10",
        maxImpressions: "500",
        status: "ACTIVE"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.displayOrder).toBe(5);
        expect(result.data.insertionType).toBe("AFTER_N_ITEMS");
        expect(result.data.insertionPosition).toBe(10);
        expect(result.data.maxImpressions).toBe(500);
        expect(result.data.status).toBe("ACTIVE");
      }
    });

    it("should reject an invalid insertion type", () => {
      const result = updatePlacementRuleSchema.safeParse({
        insertionType: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid status", () => {
      const result = updatePlacementRuleSchema.safeParse({
        status: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative display order", () => {
      const result = updatePlacementRuleSchema.safeParse({
        displayOrder: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject zero insertion position", () => {
      const result = updatePlacementRuleSchema.safeParse({
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative insertion position", () => {
      const result = updatePlacementRuleSchema.safeParse({
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject zero max impressions", () => {
      const result = updatePlacementRuleSchema.safeParse({
        maxImpressions: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative max impressions", () => {
      const result = updatePlacementRuleSchema.safeParse({
        maxImpressions: -1
      });

      expect(result.success).toBe(false);
    });

    it("should allow null insertion position", () => {
      const result = updatePlacementRuleSchema.safeParse({
        insertionType: "FIXED",
        insertionPosition: null
      });

      expect(result.success).toBe(true);
    });

    it("should allow null max impressions", () => {
      const result = updatePlacementRuleSchema.safeParse({
        maxImpressions: null
      });

      expect(result.success).toBe(true);
    });
  });

  describe("placementRuleQuerySchema", () => {
    it("should accept an empty query", () => {
      const result = placementRuleQuerySchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it("should coerce advertisement ID from a string", () => {
      const result = placementRuleQuerySchema.safeParse({
        advertisementId: "10"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(10);
      }
    });

    it("should coerce placement ID from a string", () => {
      const result = placementRuleQuerySchema.safeParse({
        placementId: "20"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBe(20);
      }
    });

    it("should accept ACTIVE status", () => {
      const result = placementRuleQuerySchema.safeParse({
        status: "ACTIVE"
      });

      expect(result.success).toBe(true);
    });

    it("should accept INACTIVE status", () => {
      const result = placementRuleQuerySchema.safeParse({
        status: "INACTIVE"
      });

      expect(result.success).toBe(true);
    });

    it("should reject an invalid status", () => {
      const result = placementRuleQuerySchema.safeParse({
        status: "INVALID"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a zero advertisement ID", () => {
      const result = placementRuleQuerySchema.safeParse({
        advertisementId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject a zero placement ID", () => {
      const result = placementRuleQuerySchema.safeParse({
        placementId: 0
      });

      expect(result.success).toBe(false);
    });
  });
});
