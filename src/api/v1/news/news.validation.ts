import { z } from "zod";

export const newsStatusSchema = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "ARCHIVED",
  "REJECTED"
]);

/**
 * News geographical scope.
 *
 * WORLD    -> International / உலகம்
 * INDIA    -> National / இந்தியா
 * STATE    -> State / மாநிலம்
 * DISTRICT -> District / மாவட்டம்
 */
export const newsScopeSchema = z.enum(["WORLD", "INDIA", "STATE", "DISTRICT"]);

/**
 * Slug format:
 *
 * - lowercase English letters
 * - numbers
 * - words separated by single hyphens
 *
 * Examples:
 *   chennai-metro-project
 *   india-budget-2026
 *   sports-news
 */
export const newsSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(300)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase letters, numbers, and single hyphens"
  );

export const createNewsSchema = z.object({
  title: z.string().trim().min(3).max(1000),

  slug: newsSlugSchema,

  summary: z.string().trim().max(5000).optional(),

  content: z.string().trim().min(10),

  newsScope: newsScopeSchema,

  countryId: z.number().int().positive().optional(),

  stateId: z.number().int().positive().optional(),

  districtId: z.number().int().positive().optional(),

  categoryId: z.number().int().positive(),

  draftedBy: z.number().int().positive(),

  createdBy: z.number().int().positive()
});

export const updateNewsSchema = z.object({
  title: z.string().trim().min(3).max(1000).optional(),

  slug: newsSlugSchema.optional(),

  summary: z.string().trim().max(5000).optional(),

  content: z.string().trim().min(10).optional(),

  newsScope: newsScopeSchema.optional(),

  countryId: z.number().int().positive().nullable().optional(),

  stateId: z.number().int().positive().nullable().optional(),

  districtId: z.number().int().positive().nullable().optional(),

  categoryId: z.number().int().positive().optional(),

  updatedBy: z.number().int().positive()
});

export const changeStatusSchema = z.object({
  status: newsStatusSchema,

  userId: z.number().int().positive()
});

export const activateNewsSchema = z.object({
  activatedBy: z.number().int().positive()
});

export const promoteNewsSchema = z.object({
  promotedBy: z.number().int().positive(),

  /**
   * Promotion is intentionally restricted to 3 days
   * for the first version of the feature.
   */
  durationDays: z.literal(3).default(3)
});

export const removePromotionSchema = z.object({
  updatedBy: z.number().int().positive()
});

export const newsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  pageSize: z.coerce.number().int().min(1).max(100).default(20),

  search: z.string().trim().optional(),

  status: newsStatusSchema.optional(),

  categoryId: z.coerce.number().int().positive().optional(),

  countryId: z.coerce.number().int().positive().optional(),

  scope: newsScopeSchema.optional(),

  stateId: z.coerce.number().int().positive().optional(),

  districtId: z.coerce.number().int().positive().optional(),

  sortBy: z
    .enum([
      "title",
      "status",
      "news_number",
      "drafted_at",
      "published_at",
      "created_at",
      "updated_at"
    ])
    .optional(),

  sortOrder: z.enum(["ASC", "DESC"]).optional()
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const newsSlugParamsSchema = z.object({
  slug: newsSlugSchema
  // z
  //   .string()
  //   .regex(
  //     /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  //     "Slug must contain only lowercase letters, numbers, and single hyphens"
  //   )
});

export type CreateNewsRequest = z.infer<typeof createNewsSchema>;

export type UpdateNewsRequest = z.infer<typeof updateNewsSchema>;

export type NewsSearchRequest = z.infer<typeof newsSearchSchema>;

export type ChangeStatusRequest = z.infer<typeof changeStatusSchema>;

export type ActivateNewsRequest = z.infer<typeof activateNewsSchema>;
