import { z } from "zod";
export const positiveId = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const batchInput = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z][A-Z0-9_]{0,39}$/),
    displayName: z.string().trim().min(1).max(150),
    batchOrder: z.number().int().min(1).max(1000),
    capacity: z.number().int().min(1).max(32767).optional()
  })
  .strict();
export const rateInput = z
  .object({
    rateAmount: z
      .number()
      .positive()
      .max(999999999999)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.001),
    effectiveFrom: z.string().datetime({ offset: true }),
    effectiveTo: z.string().datetime({ offset: true }).nullable().default(null)
  })
  .strict()
  .refine(
    (v) =>
      !v.effectiveTo || Date.parse(v.effectiveTo) > Date.parse(v.effectiveFrom)
  );
export const assignmentInput = z.object({ batchId: positiveId }).strict();
export function dailyQuantity(start: Date, end: Date): number {
  const duration = end.getTime() - start.getTime();
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error("Invalid reservation window");
  return Math.ceil(duration / 86400000);
}
