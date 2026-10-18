import { describe, expect, it } from "vitest";

import {
  createPlacementSchema,
  placementIdSchema,
  updatePlacementSchema
} from "../placement.validation.js";

describe("Advertisement Placement Validation", () => {
  const validCreateInput = {
    code: "HOME_TOP",
    displayName: "Homepage Top",
    pageType: "HOME",
    placementType: "HOME_TOP"
  };

  describe("createPlacementSchema", () => {
    it("should accept a valid minimal create payload", () => {
      const result = createPlacementSchema.safeParse(validCreateInput);

      expect(result.success).toBe(true);
    });

    it("should accept a complete valid configuration", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        description: "Homepage top advertisement",
        insertionType: "AFTER_N_ITEMS",
        displayOrder: 2,
        isEnabled: true,
        collapseWhenEmpty: true,
        fallbackBehavior: "HIDE",
        displayFrequency: "ONCE_PER_PERIOD",
        frequencyValue: 5,
        autoCloseEnabled: true,
        autoCloseSeconds: 10,
        closeButtonEnabled: true,
        closeOnOverlayClick: true,
        status: "ACTIVE"
      });

      expect(result.success).toBe(true);
    });

    it("should trim code and displayName", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        code: "  HOME_TOP  ",
        displayName: "  Homepage Top  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.code).toBe("HOME_TOP");
        expect(result.data.displayName).toBe("Homepage Top");
      }
    });

    it("should reject an invalid code", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        code: "HOME TOP!"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a code shorter than two characters", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        code: "A"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an unsupported page type", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        pageType: "SEARCH"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a placement type that belongs to a different page type", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        pageType: "HOME",
        placementType: "NEWS_LIST_TOP"
      });
      expect(result.success).toBe(false);
    });

    it("should reject null frequencyValue for ONCE_PER_PERIOD", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        displayFrequency: "ONCE_PER_PERIOD",
        frequencyValue: null
      });
      expect(result.success).toBe(false);
    });

    it("should reject an unsupported placement type", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        placementType: "SEARCH_TOP"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an unsupported insertion type", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        insertionType: "RANDOM"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an unsupported fallback behavior", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        fallbackBehavior: "SHOW_DEFAULT"
      });

      expect(result.success).toBe(false);
    });

    it("should reject ONCE_PER_PERIOD without frequencyValue", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        displayFrequency: "ONCE_PER_PERIOD"
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path[0] === "frequencyValue" &&
              issue.message ===
                "frequencyValue is required for ONCE_PER_PERIOD."
          )
        ).toBe(true);
      }
    });

    it("should accept ONCE_PER_PERIOD with frequencyValue", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        displayFrequency: "ONCE_PER_PERIOD",
        frequencyValue: 3
      });

      expect(result.success).toBe(true);
    });

    it("should reject auto-close enabled without autoCloseSeconds", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        autoCloseEnabled: true
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path[0] === "autoCloseSeconds" &&
              issue.message ===
                "autoCloseSeconds is required when autoCloseEnabled is true."
          )
        ).toBe(true);
      }
    });

    it("should accept auto-close enabled with autoCloseSeconds", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        autoCloseEnabled: true,
        autoCloseSeconds: 15
      });

      expect(result.success).toBe(true);
    });

    it("should reject negative displayOrder", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        displayOrder: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject zero frequencyValue", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        displayFrequency: "ONCE_PER_PERIOD",
        frequencyValue: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject zero autoCloseSeconds", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        autoCloseEnabled: true,
        autoCloseSeconds: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject an unsupported status", () => {
      const result = createPlacementSchema.safeParse({
        ...validCreateInput,
        status: "DELETED"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("updatePlacementSchema", () => {
    it("should accept a valid partial update", () => {
      const result = updatePlacementSchema.safeParse({
        displayName: "Updated Homepage Top",
        displayOrder: 3
      });

      expect(result.success).toBe(true);
    });

    it("should accept an empty update object", () => {
      const result = updatePlacementSchema.safeParse({});

      expect(result.success).toBe(true);
    });

    it("should trim description", () => {
      const result = updatePlacementSchema.safeParse({
        description: "  Updated description  "
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.description).toBe("Updated description");
      }
    });

    it("should reject ONCE_PER_PERIOD without frequencyValue", () => {
      const result = updatePlacementSchema.safeParse({
        displayFrequency: "ONCE_PER_PERIOD"
      });

      expect(result.success).toBe(false);
    });

    it("should accept ONCE_PER_PERIOD with frequencyValue", () => {
      const result = updatePlacementSchema.safeParse({
        displayFrequency: "ONCE_PER_PERIOD",
        frequencyValue: 2
      });

      expect(result.success).toBe(true);
    });

    it("should reject auto-close enabled without autoCloseSeconds", () => {
      const result = updatePlacementSchema.safeParse({
        autoCloseEnabled: true
      });

      expect(result.success).toBe(false);
    });

    it("should accept auto-close enabled with autoCloseSeconds", () => {
      const result = updatePlacementSchema.safeParse({
        autoCloseEnabled: true,
        autoCloseSeconds: 10
      });

      expect(result.success).toBe(true);
    });

    it("should accept disabling a placement through update fields", () => {
      const result = updatePlacementSchema.safeParse({
        status: "INACTIVE",
        isEnabled: false
      });

      expect(result.success).toBe(true);
    });

    it("should accept enabling a placement through update fields", () => {
      const result = updatePlacementSchema.safeParse({
        status: "ACTIVE",
        isEnabled: true
      });

      expect(result.success).toBe(true);
    });
  });

  describe("placementIdSchema", () => {
    it("should accept a positive integer id", () => {
      const result = placementIdSchema.safeParse({
        id: 10
      });

      expect(result.success).toBe(true);
    });

    it("should coerce a numeric string to a number", () => {
      const result = placementIdSchema.safeParse({
        id: "10"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(10);
      }
    });

    it("should accept a valid id for enable endpoint", () => {
      const result = placementIdSchema.safeParse({
        id: "25"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(25);
      }
    });

    it("should accept a valid id for disable endpoint", () => {
      const result = placementIdSchema.safeParse({
        id: 25
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBe(25);
      }
    });

    it("should reject zero", () => {
      const result = placementIdSchema.safeParse({
        id: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative ids", () => {
      const result = placementIdSchema.safeParse({
        id: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject a non-numeric id", () => {
      const result = placementIdSchema.safeParse({
        id: "abc"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a decimal id", () => {
      const result = placementIdSchema.safeParse({
        id: 1.5
      });

      expect(result.success).toBe(false);
    });
  });
});
