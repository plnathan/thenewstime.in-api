import { z } from "zod";

export const pageTypeSchema = z.enum(["HOME", "NEWS_LIST", "NEWS_DETAIL"]);
export const advertisementTypeSchema = z.enum([
  "DISPLAY",
  "SIDEBAR",
  "MODAL",
  "OTHER"
]);
export const sourceSchema = z.enum(["HOUSE_AD", "FOOTER"]);
export const statusSchema = z.enum([
  "PENDING",
  "RESPONDED",
  "REJECTED",
  "BOOKED"
]);

const placementTypesByPage = {
  HOME: [
    "HOME_TOP",
    "HOME_BANNER",
    "HOME_BETWEEN_SECTIONS",
    "HOME_SIDEBAR",
    "HOME_BOTTOM",
    "HOME_MODAL"
  ],
  NEWS_LIST: [
    "NEWS_LIST_TOP",
    "NEWS_LIST_BETWEEN",
    "NEWS_LIST_SIDEBAR",
    "NEWS_LIST_BOTTOM",
    "NEWS_LIST_MODAL"
  ],
  NEWS_DETAIL: [
    "NEWS_DETAIL_TOP",
    "NEWS_DETAIL_BETWEEN",
    "NEWS_DETAIL_SIDEBAR",
    "NEWS_DETAIL_BOTTOM",
    "NEWS_DETAIL_MODAL"
  ]
} as const;

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine(
    (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
    "Invalid date"
  );
export const createAdvertisementEnquirySchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    companyName: z.string().trim().max(160).nullish(),
    mobileNumber: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s-]{7,18}$/, "Invalid mobile number"),
    email: z.string().email().max(254).nullish(),
    advertisementType: advertisementTypeSchema.optional(),
    pageTypes: z.array(pageTypeSchema).max(3).optional(),
    placementTypes: z
      .array(z.string().trim().min(1).max(60))
      .max(16)
      .optional(),
    preferredStartDate: dateSchema.nullish(),
    preferredEndDate: dateSchema.nullish(),
    additionalRequirements: z.string().trim().max(2000).nullish(),
    source: sourceSchema,
    sourceAdvertisementId: z.number().int().positive().nullish(),
    sourcePlacementId: z.number().int().positive().nullish(),
    website: z.string().max(200).optional(), // Honeypot: reject silently in public middleware.
    captchaToken: z.string().max(4096).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    const allowed: ReadonlySet<string> = new Set<string>(
      (value.pageTypes ?? []).flatMap((page) => placementTypesByPage[page])
    );
    if (
      (value.placementTypes ?? []).some(
        (placement) => placement !== "ANY" && !allowed.has(placement)
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["placementTypes"],
        message: "Selected slots must belong to the selected pages"
      });
    }
    if (
      value.preferredStartDate &&
      value.preferredEndDate &&
      value.preferredEndDate < value.preferredStartDate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["preferredEndDate"],
        message: "End date must not precede start date"
      });
    }
    if (
      value.source === "FOOTER" &&
      (value.sourceAdvertisementId != null || value.sourcePlacementId != null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["source"],
        message:
          "Footer enquiries cannot specify advertisement or placement IDs"
      });
    }
  });

export type CreateAdvertisementEnquiryInput = z.infer<
  typeof createAdvertisementEnquirySchema
>;
