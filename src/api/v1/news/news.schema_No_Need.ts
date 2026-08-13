import { z } from "zod";

const nullableString = z.string().trim().nullable().optional();
const nullableNumber = z.number().int().nullable().optional();
const nullableDateString = z.iso.date().nullable().optional();

export const createNewsSchema = z.object({
  title: z.string().trim().max(1000).nullable().optional(),
  news_content: nullableString,
  content_order: nullableNumber,
  drafted_by: nullableNumber,
  drafted_date: nullableDateString,
  approved_by: nullableNumber,
  approved_date: nullableDateString,
  thumbnail_path_id: nullableNumber,
  is_active: nullableNumber
});

export const updateNewsSchema = z.object({
  title: z.string().trim().max(1000).nullable().optional(),
  news_content: nullableString,
  content_order: nullableNumber,
  drafted_by: nullableNumber,
  drafted_date: nullableDateString,
  approved_by: nullableNumber,
  approved_date: nullableDateString,
  thumbnail_path_id: nullableNumber,
  is_active: nullableNumber
});

export const newsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional()
});

export type CreateNewsSchemaType = z.infer<typeof createNewsSchema>;
export type UpdateNewsSchemaType = z.infer<typeof updateNewsSchema>;
export type NewsListQuerySchemaType = z.infer<typeof newsListQuerySchema>;
