import { z } from "zod";

export const advertisementTargetTypes = [
  "SITE",
  "NEWS",
  "CATEGORY",
  "STATE",
  "DISTRICT",
  "COUNTRY"
] as const;

export const targetIdParamsSchema = z.object({
  advertisementId: z.coerce.number().int().positive(),
  targetId: z.coerce.number().int().positive()
});

export const advertisementIdParamsSchema = z.object({
  advertisementId: z.coerce.number().int().positive()
});

export const createAdvertisementTargetSchema = z.object({
  targetType: z.enum(advertisementTargetTypes),
  targetValue: z.string().trim().min(1).max(255),
  isInclude: z.boolean().optional().default(true)
});

export const updateAdvertisementTargetSchema = z
  .object({
    targetType: z.enum(advertisementTargetTypes).optional(),
    targetValue: z.string().trim().min(1).max(255).optional(),
    isInclude: z.boolean().optional()
  })
  .refine(
    (value) =>
      value.targetType !== undefined ||
      value.targetValue !== undefined ||
      value.isInclude !== undefined,
    {
      message: "At least one field must be supplied for an update."
    }
  );

export const replaceAdvertisementTargetsSchema = z.object({
  targets: z
    .array(createAdvertisementTargetSchema)
    .max(100, "A maximum of 100 targeting rules is allowed.")
});

export type CreateAdvertisementTargetBody = z.infer<
  typeof createAdvertisementTargetSchema
>;

export type UpdateAdvertisementTargetBody = z.infer<
  typeof updateAdvertisementTargetSchema
>;

export type ReplaceAdvertisementTargetsBody = z.infer<
  typeof replaceAdvertisementTargetsSchema
>;
