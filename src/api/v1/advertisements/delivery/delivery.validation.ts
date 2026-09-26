import { z } from "zod";

const pageTypes = ["HOME", "NEWS_LIST", "NEWS_DETAIL"] as const;

const placementTypes = [
  "HOME_BANNER",
  "HOME_TOP",
  "HOME_BETWEEN_SECTIONS",
  "HOME_SIDEBAR",
  "NEWS_LIST_TOP",
  "NEWS_LIST_BETWEEN",
  "NEWS_LIST_BOTTOM",
  "NEWS_DETAIL_TOP",
  "NEWS_DETAIL_BETWEEN",
  "NEWS_DETAIL_SIDEBAR",
  "NEWS_DETAIL_BOTTOM",
  "NEWS_DETAIL_MODAL"
] as const;

export const advertisementDeliveryQuerySchema = z.object({
  pageType: z.enum(pageTypes),
  placementType: z.enum(placementTypes),
  placementId: z.coerce.number().int().positive().optional(),
  site: z.string().trim().min(1).optional(),
  newsId: z.coerce.number().int().positive().optional(),
  category: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  district: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional()
});

export type AdvertisementDeliveryQueryInput = z.infer<
  typeof advertisementDeliveryQuerySchema
>;
