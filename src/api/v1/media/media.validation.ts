import { z } from "zod";

export const mediaNewsParamsSchema = z.object({
  newsId: z.coerce.number().int().positive()
});

export const mediaDeleteParamsSchema = z.object({
  newsId: z.coerce.number().int().positive(),

  mediaId: z.coerce.number().int().positive()
});

export const mediaOrderSchema = z.object({
  items: z
    .array(
      z.object({
        mediaId: z.coerce.number().int().positive(),

        displayOrder: z.coerce.number().int().positive()
      })
    )
    .min(1)
});

export const mediaUploadBodySchema = z.object({
  uploadedBy: z.coerce.number().int().positive(),

  metadata: z.string().optional(),
  compress: z.enum(["true", "false"]).optional(),
  watermark: z.enum(["true", "false"]).optional(),
  watermarkText: z.string().trim().min(1).max(120).optional(),
  watermarkFontSize: z.coerce.number().int().min(8).max(120).optional(),
  watermarkColor: z.enum(["BLACK", "WHITE"]).optional(),
  watermarkPosition: z
    .enum(["TOP", "BOTTOM", "LEFT", "RIGHT", "CENTER"])
    .optional()
});
