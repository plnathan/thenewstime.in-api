import { z } from "zod";

const advertisementTypes = [
  "DISPLAY",
  "BANNER",
  "VIDEO",
  "NATIVE",
  "POPUP",
  "OVERLAY"
] as const;

const advertisementWorkflowStatuses = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "ON_HOLD",
  "ARCHIVED"
] as const;

const advertisementStatuses = [
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED"
] as const;

const advertisementPricingUnits = [
  "DAY",
  "WEEK",
  "MONTH",
  "IMPRESSION",
  "CAMPAIGN",
  "FIXED"
] as const;

const optionalTrimmedString = z.string().trim().optional();

const optionalUrl = z.string().trim().url().optional();

const optionalDateTime = z
  .union([
    z.string().datetime({
      offset: true
    }),
    z.coerce.date()
  ])
  .optional();

const optionalPercentage = z.coerce.number().min(0).max(100);

const pricingSchema = z.object({
  placementId: z.coerce.number().int().positive(),

  pricingUnit: z.enum(advertisementPricingUnits),

  quantity: z.coerce.number().finite().positive()
});

const validateFinancialInputs = (
  value: {
    agreedAmount?: number | null | undefined;
    advertisementAmount?: number | null | undefined;
    discountPercentage?: number | undefined;
    advancePercentage?: number | undefined;
  },
  context: z.RefinementCtx
): void => {
  const agreedAmount = value.agreedAmount ?? value.advertisementAmount ?? null;

  const discountPercentage = value.discountPercentage ?? 0;

  const advancePercentage = value.advancePercentage ?? 0;

  if (
    agreedAmount === null &&
    (discountPercentage > 0 || advancePercentage > 0)
  ) {
    if (discountPercentage > 0) {
      context.addIssue({
        code: "custom",
        path: ["discountPercentage"],
        message:
          "Agreed amount is required when discount percentage is greater than zero."
      });
    }

    if (advancePercentage > 0) {
      context.addIssue({
        code: "custom",
        path: ["advancePercentage"],
        message:
          "Agreed amount is required when advance percentage is greater than zero."
      });
    }

    return;
  }

  if (agreedAmount === null) {
    return;
  }

  const discountAmount = Number(
    ((agreedAmount * discountPercentage) / 100).toFixed(2)
  );

  const advanceAmount = Number(
    ((agreedAmount * advancePercentage) / 100).toFixed(2)
  );

  const netAgreedAmount = Number((agreedAmount - discountAmount).toFixed(2));

  if (advanceAmount > netAgreedAmount) {
    context.addIssue({
      code: "custom",
      path: ["advancePercentage"],
      message:
        "Calculated advance amount cannot be greater than the net agreed amount after discount."
    });
  }
};

export const advertisementIdSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const createAdvertisementSchema = z
  .object({
    clientId: z.coerce.number().int().positive().nullable().optional(),

    isHouseAd: z.boolean().default(false),

    name: z.string().trim().min(1).max(250),

    internalName: z.string().trim().max(250).optional(),

    advertisementType: z.enum(advertisementTypes).default("DISPLAY"),

    destinationUrl: optionalUrl,

    priority: z.coerce.number().int().min(0).default(0),

    startAt: optionalDateTime,

    endAt: optionalDateTime,

    isClickable: z.boolean().default(true),

    openInNewTab: z.boolean().default(true),

    notes: optionalTrimmedString,

    advertisementAmount: z.coerce.number().finite().min(0).optional(),

    agreedAmount: z.coerce.number().finite().min(0).optional(),

    discountPercentage: optionalPercentage.default(0),

    advancePercentage: optionalPercentage.default(0),

    currencyCode: z
      .string()
      .trim()
      .length(3)
      .regex(
        /^[A-Za-z]{3}$/,
        "Currency code must contain exactly three letters."
      )
      .transform((value) => value.toUpperCase())
      .default("INR"),

    campaignId: z.coerce.number().int().positive().optional(),

    /*
     * Pricing is optional at advertisement creation.
     *
     * When supplied, all pricing fields are mandatory
     * and validated by pricingSchema.
     *
     * The rate itself is never accepted from the client.
     * It is resolved from the active system Rate Card
     * by the advertisement service.
     */
    pricing: pricingSchema.optional()
  })
  .superRefine((value, context) => {
    if (value.isHouseAd) {
      if (value.clientId !== undefined && value.clientId !== null) {
        context.addIssue({
          code: "custom",
          path: ["clientId"],
          message: "House advertisements cannot have a client."
        });
      }

      if (value.campaignId !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["campaignId"],
          message: "House advertisements cannot have a campaign."
        });
      }
    } else if (value.clientId === undefined || value.clientId === null) {
      context.addIssue({
        code: "custom",
        path: ["clientId"],
        message: "Client is required for paid advertisements."
      });
    }

    if (value.startAt && value.endAt) {
      const start =
        value.startAt instanceof Date ? value.startAt : new Date(value.startAt);

      const end =
        value.endAt instanceof Date ? value.endAt : new Date(value.endAt);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return;
      }

      if (end <= start) {
        context.addIssue({
          code: "custom",
          path: ["endAt"],
          message: "End date/time must be after start date/time."
        });
      }
    }

    if (value.isClickable && !value.destinationUrl) {
      context.addIssue({
        code: "custom",
        path: ["destinationUrl"],
        message:
          "Destination URL is required when the advertisement is clickable."
      });
    }

    validateFinancialInputs(value, context);
  });

export const updateAdvertisementSchema = z
  .object({
    name: z.string().trim().min(1).max(250).optional(),

    internalName: z.string().trim().max(250).optional(),

    advertisementType: z.enum(advertisementTypes).optional(),

    destinationUrl: optionalUrl,

    priority: z.coerce.number().int().min(0).optional(),

    startAt: optionalDateTime,

    endAt: optionalDateTime,

    isClickable: z.boolean().optional(),

    openInNewTab: z.boolean().optional(),

    notes: optionalTrimmedString,

    /*
     * advertisementAmount is retained for backward
     * compatibility with the existing Advertisement API.
     *
     * agreedAmount is the preferred financial terminology
     * for the negotiated/agreed advertisement amount.
     *
     * The service/repository resolve both fields to the
     * advertisements.advertisement_amount column.
     */
    advertisementAmount: z.coerce.number().finite().min(0).optional(),

    agreedAmount: z.coerce.number().finite().min(0).optional(),

    discountPercentage: optionalPercentage.optional(),

    advancePercentage: optionalPercentage.optional(),

    currencyCode: z
      .string()
      .trim()
      .length(3)
      .regex(
        /^[A-Za-z]{3}$/,
        "Currency code must contain exactly three letters."
      )
      .transform((value) => value.toUpperCase())
      .optional(),

    campaignId: z.coerce.number().int().positive().optional(),

    pricing: pricingSchema.optional()
  })
  .superRefine((value, context) => {
    if (value.startAt && value.endAt) {
      const start =
        value.startAt instanceof Date ? value.startAt : new Date(value.startAt);

      const end =
        value.endAt instanceof Date ? value.endAt : new Date(value.endAt);

      if (
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        end <= start
      ) {
        context.addIssue({
          code: "custom",
          path: ["endAt"],
          message: "End date/time must be after start date/time."
        });
      }
    }

    if (
      value.agreedAmount !== undefined ||
      value.advertisementAmount !== undefined
    ) {
      validateFinancialInputs(value, context);
    }
  });

export const advertisementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  pageSize: z.coerce.number().int().min(1).max(100).default(20),

  search: z.string().trim().optional(),

  clientId: z.coerce.number().int().positive().optional(),

  workflowStatus: z.enum(advertisementWorkflowStatuses).optional(),

  status: z.enum(advertisementStatuses).optional()
});

export const advertisementWorkflowSchema = z
  .object({
    remarks: z.string().trim().max(2000).optional()
  })
  .default({});

export const advertisementRejectSchema = z.object({
  reason: z.string().trim().min(1).max(2000),

  remarks: z.string().trim().max(2000).optional()
});

export const advertisementHoldSchema = z.object({
  reason: z.string().trim().min(1).max(2000),

  remarks: z.string().trim().min(1).max(2000).optional()
});
