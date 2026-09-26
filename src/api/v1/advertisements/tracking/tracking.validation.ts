import { z } from "zod";

const pageTypes = ["HOME", "NEWS_LIST", "NEWS_DETAIL"] as const;

const placementTypes = [
  "HOME_BANNER",
  "HOME_TOP",
  "HOME_BETWEEN_SECTIONS",
  "HOME_SIDEBAR",
  "NEWS_LIST_TOP",
  "NEWS_LIST_BETWEEN",
  "NEWS_LIST_SIDEBAR",
  "NEWS_LIST_BOTTOM",
  "NEWS_LIST_MODAL",
  "NEWS_DETAIL_TOP",
  "NEWS_DETAIL_BETWEEN",
  "NEWS_DETAIL_SIDEBAR",
  "NEWS_DETAIL_BOTTOM",
  "NEWS_DETAIL_MODAL"
] as const;

const contextSchema = z
  .object({
    site: z.string().trim().min(1).max(150).optional(),
    newsId: z.coerce.number().int().positive().optional(),
    category: z.string().trim().min(1).max(150).optional(),
    state: z.string().trim().min(1).max(150).optional(),
    district: z.string().trim().min(1).max(150).optional(),
    country: z.string().trim().min(1).max(150).optional()
  })
  .optional();

export const advertisementTrackingSchema = z.object({
  advertisementId: z.coerce.number().int().positive(),

  placementId: z.coerce.number().int().positive(),

  placementRuleId: z.coerce.number().int().positive(),

  scheduleId: z.coerce.number().int().positive(),

  creativeId: z.coerce.number().int().positive(),

  pageType: z.enum(pageTypes),

  placementType: z.enum(placementTypes),

  sessionId: z.string().trim().min(1).max(200).optional(),

  visitorId: z.string().uuid().optional(),

  browser: z.string().trim().min(1).max(150).optional(),

  operatingSystem: z.string().trim().min(1).max(150).optional(),

  deviceType: z.string().trim().min(1).max(50).optional(),

  pageUrl: z.string().trim().url().max(2048).optional(),

  referrerUrl: z.string().trim().url().max(2048).optional(),

  context: contextSchema
});

export type AdvertisementTrackingInput = z.infer<
  typeof advertisementTrackingSchema
>;

export const advertisementMetricsParamsSchema = z.object({
  advertisementId: z.coerce.number().int().positive()
});

export type AdvertisementMetricsParamsInput = z.infer<
  typeof advertisementMetricsParamsSchema
>;

export const advertisementMetricsQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional()
  })
  .refine(
    (value) => {
      if (value.from === undefined || value.to === undefined) {
        return true;
      }

      return value.from <= value.to;
    },
    {
      message: "'from' must be earlier than or equal to 'to'.",
      path: ["from"]
    }
  );

export type AdvertisementMetricsQueryInput = z.infer<
  typeof advertisementMetricsQuerySchema
>;
