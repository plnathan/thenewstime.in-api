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
        mediaId: z.number().int().positive(),

        displayOrder: z.number().int().positive()
      })
    )
    .min(1)
});

export const mediaUploadBodySchema = z.object({
  uploadedBy: z.coerce.number().int().positive(),

  metadata: z.string().optional()
});
