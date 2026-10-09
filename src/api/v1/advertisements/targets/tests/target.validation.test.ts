import { describe, expect, it } from "vitest";

import {
  advertisementIdParamsSchema,
  advertisementTargetTypes,
  createAdvertisementTargetSchema,
  replaceAdvertisementTargetsSchema,
  targetIdParamsSchema,
  updateAdvertisementTargetSchema
} from "../target.validation.js";

describe("target.validation", () => {
  describe("advertisementTargetTypes", () => {
    it("contains all supported targeting types", () => {
      expect(advertisementTargetTypes).toEqual([
        "SITE",
        "NEWS",
        "CATEGORY",
        "STATE",
        "DISTRICT",
        "COUNTRY"
      ]);
    });
  });

  describe("advertisementIdParamsSchema", () => {
    it("accepts a positive integer ID supplied as a string", () => {
      expect(
        advertisementIdParamsSchema.safeParse({
          advertisementId: "202"
        })
      ).toMatchObject({
        success: true,
        data: {
          advertisementId: 202
        }
      });
    });

    it("accepts a positive integer ID supplied as a number", () => {
      expect(
        advertisementIdParamsSchema.safeParse({
          advertisementId: 202
        }).success
      ).toBe(true);
    });

    it.each(["0", "-1", "invalid", "1.5", ""])(
      "rejects invalid advertisement ID %s",
      (advertisementId) => {
        expect(
          advertisementIdParamsSchema.safeParse({
            advertisementId
          }).success
        ).toBe(false);
      }
    );

    it("rejects a missing advertisement ID", () => {
      expect(advertisementIdParamsSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("targetIdParamsSchema", () => {
    it("coerces both route IDs to numbers", () => {
      expect(
        targetIdParamsSchema.safeParse({
          advertisementId: "202",
          targetId: "101"
        })
      ).toMatchObject({
        success: true,
        data: {
          advertisementId: 202,
          targetId: 101
        }
      });
    });

    it("rejects a non-positive advertisement ID", () => {
      expect(
        targetIdParamsSchema.safeParse({
          advertisementId: "0",
          targetId: "101"
        }).success
      ).toBe(false);
    });

    it("rejects a non-positive target ID", () => {
      expect(
        targetIdParamsSchema.safeParse({
          advertisementId: "202",
          targetId: "-1"
        }).success
      ).toBe(false);
    });

    it("rejects missing route IDs", () => {
      expect(targetIdParamsSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("createAdvertisementTargetSchema", () => {
    it.each(advertisementTargetTypes)(
      "accepts target type %s",
      (targetType) => {
        const result = createAdvertisementTargetSchema.safeParse({
          targetType,
          targetValue: "example-value"
        });

        expect(result.success).toBe(true);

        if (result.success) {
          expect(result.data.targetType).toBe(targetType);
          expect(result.data.targetValue).toBe("example-value");
          expect(result.data.isInclude).toBe(true);
        }
      }
    );

    it("accepts an explicit include flag", () => {
      const result = createAdvertisementTargetSchema.safeParse({
        targetType: "STATE",
        targetValue: "tamil-nadu",
        isInclude: false
      });

      expect(result).toMatchObject({
        success: true,
        data: {
          targetType: "STATE",
          targetValue: "tamil-nadu",
          isInclude: false
        }
      });
    });

    it("trims surrounding whitespace from the target value", () => {
      const result = createAdvertisementTargetSchema.safeParse({
        targetType: "STATE",
        targetValue: "  tamil-nadu  "
      });

      expect(result).toMatchObject({
        success: true,
        data: {
          targetValue: "tamil-nadu",
          isInclude: true
        }
      });
    });

    it("rejects an unsupported target type", () => {
      expect(
        createAdvertisementTargetSchema.safeParse({
          targetType: "CITY",
          targetValue: "chennai"
        }).success
      ).toBe(false);
    });

    it("rejects a missing target type", () => {
      expect(
        createAdvertisementTargetSchema.safeParse({
          targetValue: "tamil-nadu"
        }).success
      ).toBe(false);
    });

    it.each(["", " ", "   "])(
      "rejects a blank target value %j",
      (targetValue) => {
        expect(
          createAdvertisementTargetSchema.safeParse({
            targetType: "STATE",
            targetValue
          }).success
        ).toBe(false);
      }
    );

    it("rejects a target value longer than 255 characters", () => {
      expect(
        createAdvertisementTargetSchema.safeParse({
          targetType: "SITE",
          targetValue: "a".repeat(256)
        }).success
      ).toBe(false);
    });

    it("accepts a target value of exactly 255 characters", () => {
      expect(
        createAdvertisementTargetSchema.safeParse({
          targetType: "SITE",
          targetValue: "a".repeat(255)
        }).success
      ).toBe(true);
    });

    it("rejects a non-boolean isInclude value", () => {
      expect(
        createAdvertisementTargetSchema.safeParse({
          targetType: "STATE",
          targetValue: "tamil-nadu",
          isInclude: "true"
        }).success
      ).toBe(false);
    });
  });

  describe("updateAdvertisementTargetSchema", () => {
    it("accepts an update containing only targetType", () => {
      expect(
        updateAdvertisementTargetSchema.safeParse({
          targetType: "COUNTRY"
        }).success
      ).toBe(true);
    });

    it("accepts an update containing only targetValue", () => {
      expect(
        updateAdvertisementTargetSchema.safeParse({
          targetValue: "india"
        }).success
      ).toBe(true);
    });

    it("accepts an update containing only isInclude", () => {
      expect(
        updateAdvertisementTargetSchema.safeParse({
          isInclude: false
        }).success
      ).toBe(true);
    });

    it("accepts an update containing multiple fields", () => {
      expect(
        updateAdvertisementTargetSchema.safeParse({
          targetType: "DISTRICT",
          targetValue: "chennai",
          isInclude: true
        }).success
      ).toBe(true);
    });

    it("rejects an empty update object", () => {
      const result = updateAdvertisementTargetSchema.safeParse({});

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "At least one field must be supplied for an update."
        );
      }
    });

    it("rejects an invalid target type", () => {
      expect(
        updateAdvertisementTargetSchema.safeParse({
          targetType: "CITY"
        }).success
      ).toBe(false);
    });

    it("trims targetValue", () => {
      const result = updateAdvertisementTargetSchema.safeParse({
        targetValue: "  kerala  "
      });

      expect(result).toMatchObject({
        success: true,
        data: {
          targetValue: "kerala"
        }
      });
    });

    it("rejects an empty target value", () => {
      expect(
        updateAdvertisementTargetSchema.safeParse({
          targetValue: "  "
        }).success
      ).toBe(false);
    });

    it("rejects a target value longer than 255 characters", () => {
      expect(
        updateAdvertisementTargetSchema.safeParse({
          targetValue: "x".repeat(256)
        }).success
      ).toBe(false);
    });

    it("rejects a non-boolean isInclude value", () => {
      expect(
        updateAdvertisementTargetSchema.safeParse({
          isInclude: "false"
        }).success
      ).toBe(false);
    });
  });

  describe("replaceAdvertisementTargetsSchema", () => {
    it("accepts an empty array to clear existing targeting rules", () => {
      expect(
        replaceAdvertisementTargetsSchema.safeParse({
          targets: []
        }).success
      ).toBe(true);
    });

    it("accepts multiple valid targeting rules", () => {
      const result = replaceAdvertisementTargetsSchema.safeParse({
        targets: [
          {
            targetType: "STATE",
            targetValue: "tamil-nadu"
          },
          {
            targetType: "DISTRICT",
            targetValue: "chennai",
            isInclude: false
          },
          {
            targetType: "SITE",
            targetValue: "thenewstime.in"
          }
        ]
      });

      expect(result).toMatchObject({
        success: true,
        data: {
          targets: [
            {
              targetType: "STATE",
              targetValue: "tamil-nadu",
              isInclude: true
            },
            {
              targetType: "DISTRICT",
              targetValue: "chennai",
              isInclude: false
            },
            {
              targetType: "SITE",
              targetValue: "thenewstime.in",
              isInclude: true
            }
          ]
        }
      });
    });

    it("rejects a missing targets property", () => {
      expect(replaceAdvertisementTargetsSchema.safeParse({}).success).toBe(
        false
      );
    });

    it("rejects a non-array targets value", () => {
      expect(
        replaceAdvertisementTargetsSchema.safeParse({
          targets: "tamil-nadu"
        }).success
      ).toBe(false);
    });

    it("rejects an invalid rule in the replacement list", () => {
      expect(
        replaceAdvertisementTargetsSchema.safeParse({
          targets: [
            {
              targetType: "CITY",
              targetValue: "chennai"
            }
          ]
        }).success
      ).toBe(false);
    });

    it("rejects more than 100 targeting rules", () => {
      const targets = Array.from({ length: 101 }, (_, index) => ({
        targetType: "STATE" as const,
        targetValue: `state-${index + 1}`
      }));

      const result = replaceAdvertisementTargetsSchema.safeParse({
        targets
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.message === "A maximum of 100 targeting rules is allowed."
          )
        ).toBe(true);
      }
    });

    it("accepts exactly 100 valid targeting rules", () => {
      const targets = Array.from({ length: 100 }, (_, index) => ({
        targetType: "STATE" as const,
        targetValue: `state-${index + 1}`
      }));

      expect(
        replaceAdvertisementTargetsSchema.safeParse({
          targets
        }).success
      ).toBe(true);
    });
  });
});
