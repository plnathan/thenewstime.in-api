import { z } from "zod";

export const statesQuerySchema = z.object({
  countryId: z.coerce.number().int().positive().optional()
});

export const districtsQuerySchema = z.object({
  stateId: z.coerce.number().int().positive().optional()
});
