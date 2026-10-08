import { z } from "zod";

export const rotationModeSchema = z.enum(["TIME_BASED"]);

export const rotationStrategySchema = z.enum(["ROUND_ROBIN"]);

export const rotationMemberStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const placementIdSchema = z.object({
  placementId: z.coerce.number().int().positive()
});

export const memberIdSchema = z.object({
  placementId: z.coerce.number().int().positive(),
  memberId: z.coerce.number().int().positive()
});

export const updateRotationConfigSchema = z
  .object({
    rotationEnabled: z.boolean().optional(),

    rotationMode: rotationModeSchema.optional(),

    rotationIntervalSeconds: z.number().int().positive().max(86400).optional(),

    rotationStrategy: rotationStrategySchema.optional()
  })
  .strict();

export const createRotationMemberSchema = z
  .object({
    advertisementId: z.coerce.number().int().positive(),

    priority: z.number().int().min(0).max(2147483647).optional(),

    status: rotationMemberStatusSchema.optional()
  })
  .strict();

export const updateRotationMemberSchema = z
  .object({
    priority: z.number().int().min(0).max(2147483647).optional(),

    status: rotationMemberStatusSchema.optional()
  })
  .strict()
  .refine(
    (value) => value.priority !== undefined || value.status !== undefined,
    {
      message: "At least one rotation member field must be supplied."
    }
  );
