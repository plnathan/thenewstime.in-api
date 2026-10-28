import { z } from "zod";
const dimension = z.number().int().min(1).max(10000).nullable().optional();
export const formatInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[A-Z0-9_]+$/),
    displayName: z.string().trim().min(2).max(150),
    description: z.string().trim().max(1000).nullable().optional(),
    widthPx: dimension,
    heightPx: dimension,
    mobileWidthPx: dimension,
    mobileHeightPx: dimension,
    isResponsive: z.boolean().default(false),
    displayOrder: z.number().int().min(0).max(100000).default(0)
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.widthPx == null) !== (value.heightPx == null))
      ctx.addIssue({
        code: "custom",
        path: ["widthPx"],
        message: "Desktop width and height must both be set or both empty."
      });
    if ((value.mobileWidthPx == null) !== (value.mobileHeightPx == null))
      ctx.addIssue({
        code: "custom",
        path: ["mobileWidthPx"],
        message: "Mobile width and height must both be set or both empty."
      });
    if (!value.isResponsive && value.widthPx == null)
      ctx.addIssue({
        code: "custom",
        path: ["widthPx"],
        message: "Fixed formats require desktop dimensions."
      });
  });
export const formatIdSchema = z.object({
  id: z.coerce.number().int().positive()
});
