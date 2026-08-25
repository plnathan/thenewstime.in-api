import { z } from "zod";

export const createNewsReadSchema = z.object({
  newsId: z.number().int().positive(),

  sessionId: z.string().trim().min(1).max(200),

  visitorId: z.string().uuid().nullable().optional(),

  ipHash: z.string().trim().max(255).nullable().optional(),

  browser: z.string().trim().max(150).nullable().optional(),

  operatingSystem: z.string().trim().max(150).nullable().optional(),

  deviceType: z.string().trim().max(50).nullable().optional(),

  userAgent: z.string().max(1000).nullable().optional()
});

export const newsReadIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const popularNewsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),

  days: z.coerce.number().int().positive().max(365).optional()
});

/**
 * News ID route parameter.
 *
 * Used by:
 *
 * GET /api/news-reads/news/:id/count
 */
export const newsIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});
