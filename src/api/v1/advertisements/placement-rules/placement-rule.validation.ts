import { z } from "zod";

const insertionTypeSchema = z.enum([
  "FIXED",
  "AFTER_N_ITEMS",
  "BETWEEN_SECTIONS"
]);

const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const positiveInt = z.coerce.number().int().positive();

export const placementRuleIdSchema = z.object({
  id: positiveInt
});

export const placementRuleQuerySchema = z.object({
  advertisementId: positiveInt.optional(),
  placementId: positiveInt.optional(),
  status: statusSchema.optional()
});

export const createPlacementRuleSchema = z
  .object({
    advertisementId: positiveInt,

    placementId: positiveInt,

    displayOrder: z.coerce.number().int().min(0).default(0),

    insertionType: insertionTypeSchema.default("FIXED"),

    insertionPosition: positiveInt.nullable().optional(),

    maxImpressions: positiveInt.nullable().optional(),

    status: statusSchema.default("ACTIVE")
  })
  .superRefine((value, ctx) => {
    const insertionType = value.insertionType;
    const insertionPosition = value.insertionPosition;

    if (
      (insertionType === "AFTER_N_ITEMS" ||
        insertionType === "BETWEEN_SECTIONS") &&
      (insertionPosition === undefined || insertionPosition === null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["insertionPosition"],
        message:
          "insertionPosition is required for AFTER_N_ITEMS and BETWEEN_SECTIONS."
      });
    }

    if (
      insertionType === "FIXED" &&
      insertionPosition !== undefined &&
      insertionPosition !== null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["insertionPosition"],
        message: "insertionPosition must be null for FIXED insertion."
      });
    }
  });

export const updatePlacementRuleSchema = z
  .object({
    displayOrder: z.coerce.number().int().min(0).optional(),

    insertionType: insertionTypeSchema.nullable().optional(),

    insertionPosition: positiveInt.nullable().optional(),

    maxImpressions: positiveInt.nullable().optional(),

    status: statusSchema.optional()
  })
  .refine(
    (value) =>
      value.insertionType !== undefined ||
      value.insertionPosition === undefined,
    {
      message: "insertionType is required when insertionPosition is supplied.",
      path: ["insertionType"]
    }
  );
