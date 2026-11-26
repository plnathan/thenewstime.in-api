import { z } from "zod";
import { idSchema } from "./sponsored-feed.validation.js";
export const upgradeInput = z
  .object({
    requestId: z.string().uuid(),
    moves: z
      .array(
        z
          .object({
            advertisementId: idSchema,
            targetBatchId: idSchema,
            sourceBatchId: idSchema
          })
          .strict()
      )
      .min(1)
      .max(50)
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.moves.map((m) => m.advertisementId)).size === v.moves.length,
    "Duplicate advertisement"
  );
export function additionalAmount(
  source: string,
  target: string,
  days: number
): number {
  const a = Math.round(Number(source) * 100),
    b = Math.round(Number(target) * 100);
  const cents = (b - a) * days;
  if (
    !Number.isSafeInteger(cents) ||
    !Number.isSafeInteger(days) ||
    days < 1 ||
    a < 0 ||
    cents <= 0
  )
    throw new Error("Upgrade requires a positive price difference");
  return cents / 100;
}
