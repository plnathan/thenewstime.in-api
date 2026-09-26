import { z } from "zod";

/**
 * --------------------------------------------------------------------------
 * Advertisement Agreed Amount Calculation Validation
 * --------------------------------------------------------------------------
 *
 * This schema validates the commercial comparison between:
 *
 *   standardAmount
 *   agreedAmount
 *   currencyCode
 *
 * The calculation itself remains in the service layer.
 *
 * No database data is modified by this validation/schema.
 */

export const calculateAdvertisementAgreedAmountSchema = z.object({
  standardAmount: z.coerce.number().finite().min(0),

  agreedAmount: z.coerce.number().finite().min(0),

  currencyCode: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Za-z]{3}$/, "Currency code must contain exactly three letters.")
    .transform((value) => value.toUpperCase())
});
