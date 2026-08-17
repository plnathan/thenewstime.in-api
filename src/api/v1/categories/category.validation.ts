import { z } from "zod";

export const categoryIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});
