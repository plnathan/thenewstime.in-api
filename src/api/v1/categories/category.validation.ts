import { z } from "zod";

export const categoryIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

const code = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[A-Z][A-Z0-9_]*$/);
const urlName = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const createCategorySchema = z
  .object({ code, displayName: z.string().trim().min(2).max(150), urlName })
  .strict();
export const updateCategorySchema = createCategorySchema
  .partial()
  .extend({ status: z.enum(["ACTIVE", "INACTIVE"]).optional() })
  .refine((v) => Object.keys(v).length > 0);
