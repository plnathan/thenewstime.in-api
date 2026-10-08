import { describe, expect, it } from "vitest";

import {
  createRotationMemberSchema,
  memberIdSchema,
  placementIdSchema,
  rotationMemberStatusSchema,
  rotationModeSchema,
  rotationStrategySchema,
  updateRotationConfigSchema,
  updateRotationMemberSchema
} from "../rotation.validation.js";

describe("Advertisement Rotation Validation", () => {
  describe("rotationModeSchema", () => {
    it("should accept TIME_BASED", () => {
      const result = rotationModeSchema.safeParse("TIME_BASED");

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toBe("TIME_BASED");
      }
    });

    it("should reject unsupported rotation modes", () => {
      const result = rotationModeSchema.safeParse("EVENT_BASED");

      expect(result.success).toBe(false);
    });

    it("should reject empty values", () => {
      const result = rotationModeSchema.safeParse("");

      expect(result.success).toBe(false);
    });
  });

  describe("rotationStrategySchema", () => {
    it("should accept ROUND_ROBIN", () => {
      const result = rotationStrategySchema.safeParse("ROUND_ROBIN");

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toBe("ROUND_ROBIN");
      }
    });

    it("should reject unsupported rotation strategies", () => {
      const result = rotationStrategySchema.safeParse("RANDOM");

      expect(result.success).toBe(false);
    });

    it("should reject PRIORITY_WEIGHTED", () => {
      const result = rotationStrategySchema.safeParse("PRIORITY_WEIGHTED");

      expect(result.success).toBe(false);
    });
  });

  describe("rotationMemberStatusSchema", () => {
    it("should accept ACTIVE", () => {
      const result = rotationMemberStatusSchema.safeParse("ACTIVE");

      expect(result.success).toBe(true);
    });

    it("should accept INACTIVE", () => {
      const result = rotationMemberStatusSchema.safeParse("INACTIVE");

      expect(result.success).toBe(true);
    });

    it("should reject unsupported statuses", () => {
      const result = rotationMemberStatusSchema.safeParse("ARCHIVED");

      expect(result.success).toBe(false);
    });
  });

  describe("placementIdSchema", () => {
    it("should accept a positive numeric placement id", () => {
      const result = placementIdSchema.safeParse({
        placementId: 12
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBe(12);
      }
    });

    it("should coerce a numeric string to a number", () => {
      const result = placementIdSchema.safeParse({
        placementId: "12"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBe(12);
      }
    });

    it("should reject zero", () => {
      const result = placementIdSchema.safeParse({
        placementId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative values", () => {
      const result = placementIdSchema.safeParse({
        placementId: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject decimal values", () => {
      const result = placementIdSchema.safeParse({
        placementId: 1.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric strings", () => {
      const result = placementIdSchema.safeParse({
        placementId: "abc"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a missing placement id", () => {
      const result = placementIdSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });

  describe("memberIdSchema", () => {
    it("should accept valid placement and member ids", () => {
      const result = memberIdSchema.safeParse({
        placementId: 12,
        memberId: 21
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBe(12);
        expect(result.data.memberId).toBe(21);
      }
    });

    it("should coerce numeric string parameters", () => {
      const result = memberIdSchema.safeParse({
        placementId: "12",
        memberId: "21"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.placementId).toBe(12);
        expect(result.data.memberId).toBe(21);
      }
    });

    it("should reject an invalid placement id", () => {
      const result = memberIdSchema.safeParse({
        placementId: 0,
        memberId: 21
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid member id", () => {
      const result = memberIdSchema.safeParse({
        placementId: 12,
        memberId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject missing member id", () => {
      const result = memberIdSchema.safeParse({
        placementId: 12
      });

      expect(result.success).toBe(false);
    });
  });

  describe("updateRotationConfigSchema", () => {
    it("should accept a complete valid configuration", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationEnabled: true,
        rotationMode: "TIME_BASED",
        rotationIntervalSeconds: 10,
        rotationStrategy: "ROUND_ROBIN"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          rotationEnabled: true,
          rotationMode: "TIME_BASED",
          rotationIntervalSeconds: 10,
          rotationStrategy: "ROUND_ROBIN"
        });
      }
    });

    it("should accept an empty update object", () => {
      const result = updateRotationConfigSchema.safeParse({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({});
      }
    });

    it("should accept only rotationEnabled", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationEnabled: false
      });

      expect(result.success).toBe(true);
    });

    it("should accept only rotationMode", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationMode: "TIME_BASED"
      });

      expect(result.success).toBe(true);
    });

    it("should accept only rotationIntervalSeconds", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationIntervalSeconds: 60
      });

      expect(result.success).toBe(true);
    });

    it("should accept only rotationStrategy", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationStrategy: "ROUND_ROBIN"
      });

      expect(result.success).toBe(true);
    });

    it("should accept the minimum interval of one second", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationIntervalSeconds: 1
      });

      expect(result.success).toBe(true);
    });

    it("should accept the maximum interval of 86400 seconds", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationIntervalSeconds: 86400
      });

      expect(result.success).toBe(true);
    });

    it("should reject zero interval", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationIntervalSeconds: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject negative interval", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationIntervalSeconds: -10
      });

      expect(result.success).toBe(false);
    });

    it("should reject an interval greater than 86400 seconds", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationIntervalSeconds: 86401
      });

      expect(result.success).toBe(false);
    });

    it("should reject decimal intervals", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationIntervalSeconds: 10.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject an unsupported rotation mode", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationMode: "EVENT_BASED"
      });

      expect(result.success).toBe(false);
    });

    it("should reject an unsupported rotation strategy", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationStrategy: "RANDOM"
      });

      expect(result.success).toBe(false);
    });

    it("should reject a non-boolean rotationEnabled value", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationEnabled: "true"
      });

      expect(result.success).toBe(false);
    });

    it("should reject unknown fields because the schema is strict", () => {
      const result = updateRotationConfigSchema.safeParse({
        rotationEnabled: true,
        unknownField: "unexpected"
      });

      expect(result.success).toBe(false);
    });
  });

  describe("createRotationMemberSchema", () => {
    it("should accept advertisementId only", () => {
      const result = createRotationMemberSchema.safeParse({
        advertisementId: 45
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          advertisementId: 45
        });
      }
    });

    it("should accept a complete valid member", () => {
      const result = createRotationMemberSchema.safeParse({
        advertisementId: 45,
        priority: 100,
        status: "ACTIVE"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          advertisementId: 45,
          priority: 100,
          status: "ACTIVE"
        });
      }
    });

    it("should coerce advertisementId from a numeric string", () => {
      const result = createRotationMemberSchema.safeParse({
        advertisementId: "45"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.advertisementId).toBe(45);
      }
    });

    it("should accept priority zero", () => {
      const result = createRotationMemberSchema.safeParse({
        advertisementId: 45,
        priority: 0
      });

      expect(result.success).toBe(true);
    });

    it("should accept the maximum priority", () => {
      const result = createRotationMemberSchema.safeParse({
        advertisementId: 45,
        priority: 2147483647
      });

      expect(result.success).toBe(true);
    });

    it("should reject a negative priority", () => {
      const result = createRotationMemberSchema.safeParse({
        advertisementId: 45,
        priority: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject a priority greater than the maximum", () => {
      const result = createRotationMemberSchema.safeParse({
        advertisementId: 45,
        priority: 2147483648
      });

      expect(result.success).toBe(false);
    });

    it("should reject a decimal priority", () => {
      const result = createRotationMemberSchema.safeParse({
        advertisementId: 45,
        priority: 10.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject zero advertisementId", () => {
      const result = createRotationMemberSchema.safeParse({
        advertisementId: 0
      });

      expect(result.success).toBe(false);
    });

    it("should reject a negative advertisementId", () => {
      const result = createRotationMemberSchema.safeParse({
        advertisementId: -5
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid member status", () => {
      const result = createRotationMemberSchema.safeParse({
        advertisementId: 45,
        status: "ARCHIVED"
      });

      expect(result.success).toBe(false);
    });

    it("should reject unknown fields because the schema is strict", () => {
      const result = createRotationMemberSchema.safeParse({
        advertisementId: 45,
        unexpectedField: true
      });

      expect(result.success).toBe(false);
    });
  });

  describe("updateRotationMemberSchema", () => {
    it("should accept a priority-only update", () => {
      const result = updateRotationMemberSchema.safeParse({
        priority: 250
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          priority: 250
        });
      }
    });

    it("should accept a status-only update", () => {
      const result = updateRotationMemberSchema.safeParse({
        status: "INACTIVE"
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual({
          status: "INACTIVE"
        });
      }
    });

    it("should accept a combined update", () => {
      const result = updateRotationMemberSchema.safeParse({
        priority: 500,
        status: "ACTIVE"
      });

      expect(result.success).toBe(true);
    });

    it("should reject an empty update object", () => {
      const result = updateRotationMemberSchema.safeParse({});

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.message ===
              "At least one rotation member field must be supplied."
          )
        ).toBe(true);
      }
    });

    it("should accept priority zero", () => {
      const result = updateRotationMemberSchema.safeParse({
        priority: 0
      });

      expect(result.success).toBe(true);
    });

    it("should accept the maximum priority", () => {
      const result = updateRotationMemberSchema.safeParse({
        priority: 2147483647
      });

      expect(result.success).toBe(true);
    });

    it("should reject negative priority", () => {
      const result = updateRotationMemberSchema.safeParse({
        priority: -1
      });

      expect(result.success).toBe(false);
    });

    it("should reject priority above the maximum", () => {
      const result = updateRotationMemberSchema.safeParse({
        priority: 2147483648
      });

      expect(result.success).toBe(false);
    });

    it("should reject decimal priority", () => {
      const result = updateRotationMemberSchema.safeParse({
        priority: 10.5
      });

      expect(result.success).toBe(false);
    });

    it("should reject an invalid status", () => {
      const result = updateRotationMemberSchema.safeParse({
        status: "ARCHIVED"
      });

      expect(result.success).toBe(false);
    });

    it("should reject unknown fields because the schema is strict", () => {
      const result = updateRotationMemberSchema.safeParse({
        priority: 100,
        unexpectedField: true
      });

      expect(result.success).toBe(false);
    });
  });
});
