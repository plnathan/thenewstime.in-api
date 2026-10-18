import { z } from "zod";

const pageTypeSchema = z.enum(["HOME", "NEWS_LIST", "NEWS_DETAIL"]);

const placementTypeSchema = z.enum([
  "HOME_BANNER",
  "HOME_TOP",
  "HOME_BETWEEN_SECTIONS",
  "HOME_SIDEBAR",

  "NEWS_LIST_TOP",
  "NEWS_LIST_BETWEEN",
  "NEWS_LIST_BOTTOM",
  "NEWS_LIST_SIDEBAR",
  "NEWS_LIST_MODAL",

  "NEWS_DETAIL_TOP",
  "NEWS_DETAIL_BETWEEN",
  "NEWS_DETAIL_SIDEBAR",
  "NEWS_DETAIL_BOTTOM",
  "NEWS_DETAIL_MODAL"
]);

const insertionTypeSchema = z.enum([
  "FIXED",
  "AFTER_N_ITEMS",
  "BETWEEN_SECTIONS"
]);

const fallbackBehaviorSchema = z.enum(["HIDE", "HOUSE_AD"]);

const displayFrequencySchema = z.enum([
  "EVERY_VISIT",
  "ONCE_PER_SESSION",
  "ONCE_PER_DAY",
  "ONCE_PER_PERIOD"
]);

const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const positiveInt = z.coerce.number().int().positive();

const nullablePositiveInt = positiveInt.nullable();

const commonConfigurationSchema = {
  displayOrder: z.coerce.number().int().min(0).optional(),

  isEnabled: z.boolean().optional(),

  /**
   * null = placement intentionally has no format.
   * number = format must subsequently resolve to an ACTIVE format.
   */
  formatId: nullablePositiveInt.optional(),

  collapseWhenEmpty: z.boolean().optional(),

  fallbackBehavior: fallbackBehaviorSchema.optional(),

  displayFrequency: displayFrequencySchema.nullable().optional(),

  frequencyValue: positiveInt.nullable().optional(),

  autoCloseEnabled: z.boolean().optional(),

  autoCloseSeconds: positiveInt.nullable().optional(),

  closeButtonEnabled: z.boolean().optional(),

  closeOnOverlayClick: z.boolean().optional(),

  status: statusSchema.optional()
};

const pagePlacementPairs: Record<string, readonly string[]> = {
  HOME: ["HOME_BANNER", "HOME_TOP", "HOME_BETWEEN_SECTIONS", "HOME_SIDEBAR"],
  NEWS_LIST: [
    "NEWS_LIST_TOP",
    "NEWS_LIST_BETWEEN",
    "NEWS_LIST_BOTTOM",
    "NEWS_LIST_SIDEBAR",
    "NEWS_LIST_MODAL"
  ],
  NEWS_DETAIL: [
    "NEWS_DETAIL_TOP",
    "NEWS_DETAIL_BETWEEN",
    "NEWS_DETAIL_SIDEBAR",
    "NEWS_DETAIL_BOTTOM",
    "NEWS_DETAIL_MODAL"
  ]
};

const addPagePlacementIssue = (
  value: {
    pageType?: string | undefined;
    placementType?: string | undefined;
  },
  ctx: z.RefinementCtx
) => {
  if (
    value.pageType &&
    value.placementType &&
    !pagePlacementPairs[value.pageType]?.includes(value.placementType)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["placementType"],
      message: `Placement type ${value.placementType} is not valid for page type ${value.pageType}.`
    });
  }
};

const addFrequencyAndAutoCloseIssues = (
  value: {
    displayFrequency?: string | null | undefined;
    frequencyValue?: number | null | undefined;
    autoCloseEnabled?: boolean | undefined;
    autoCloseSeconds?: number | null | undefined;
  },
  ctx: z.RefinementCtx
) => {
  if (
    value.displayFrequency === "ONCE_PER_PERIOD" &&
    (value.frequencyValue === undefined ||
      value.frequencyValue === null ||
      value.frequencyValue <= 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["frequencyValue"],
      message: "frequencyValue is required for ONCE_PER_PERIOD."
    });
  }

  if (
    value.autoCloseEnabled === true &&
    (value.autoCloseSeconds === undefined ||
      value.autoCloseSeconds === null ||
      value.autoCloseSeconds <= 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["autoCloseSeconds"],
      message: "autoCloseSeconds is required when autoCloseEnabled is true."
    });
  }

  if (
    value.autoCloseEnabled === false &&
    value.autoCloseSeconds !== undefined &&
    value.autoCloseSeconds !== null
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["autoCloseSeconds"],
      message:
        "autoCloseSeconds must be null or omitted when autoCloseEnabled is false."
    });
  }
};

export const createPlacementSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[A-Za-z0-9_.:-]+$/),

    displayName: z.string().trim().min(2).max(150),

    description: z.string().trim().max(1000).optional(),

    pageType: pageTypeSchema,

    placementType: placementTypeSchema,

    insertionType: insertionTypeSchema.optional(),

    ...commonConfigurationSchema
  })
  .superRefine((value, ctx) => {
    addPagePlacementIssue(value, ctx);
    addFrequencyAndAutoCloseIssues(value, ctx);
  });

export const updatePlacementSchema = z
  .object({
    displayName: z.string().trim().min(2).max(150).optional(),

    description: z.string().trim().max(1000).optional(),

    pageType: pageTypeSchema.optional(),

    placementType: placementTypeSchema.optional(),

    insertionType: insertionTypeSchema.optional(),

    ...commonConfigurationSchema
  })
  .superRefine((value, ctx) => {
    addPagePlacementIssue(value, ctx);
    addFrequencyAndAutoCloseIssues(value, ctx);
  });

export const placementIdSchema = z.object({
  id: z.coerce.number().int().positive()
});
