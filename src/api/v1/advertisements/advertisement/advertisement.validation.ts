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

/**
 * Validates financial input relationships.
 *
 * advertisementAmount is the final commercial amount.
 * standardAmount is system-derived and is intentionally not
 * part of the API input contract here.
 *
 * The advertisement service remains responsible for calculating
 * discountAmount and advanceAmount.
 *
 * The explicit `undefined` in the optional property type is
 * intentional because the project uses
 * `exactOptionalPropertyTypes: true`.
 */
const validateFinancialInputs = (
  value: {
    advertisementAmount?: number | null | undefined;
    discountPercentage?: number | undefined;
    advancePercentage?: number | undefined;
  },
  context: z.RefinementCtx
): void => {
  const advertisementAmount = value.advertisementAmount ?? null;

  const discountPercentage = value.discountPercentage ?? 0;

  const advancePercentage = value.advancePercentage ?? 0;

  if (
    advertisementAmount === null &&
    (discountPercentage > 0 || advancePercentage > 0)
  ) {
    if (discountPercentage > 0) {
      context.addIssue({
        code: "custom",
        path: ["discountPercentage"],
        message:
          "Advertisement amount is required when discount percentage is greater than zero."
      });
    }

    if (advancePercentage > 0) {
      context.addIssue({
        code: "custom",
        path: ["advancePercentage"],
        message:
          "Advertisement amount is required when advance percentage is greater than zero."
      });
    }

    return;
  }

  if (advertisementAmount === null) {
    return;
  }

  /*
   * At validation level, advertisementAmount is the commercial
   * amount supplied to the API.
   *
   * The service performs the authoritative financial calculation
   * and persists discountAmount/advanceAmount.
   */
  const discountAmount = Number(
    ((advertisementAmount * discountPercentage) / 100).toFixed(2)
  );

  const advanceAmount = Number(
    ((advertisementAmount * advancePercentage) / 100).toFixed(2)
  );

  const netAdvertisementAmount = Number(
    (advertisementAmount - discountAmount).toFixed(2)
  );

  if (advanceAmount > netAdvertisementAmount) {
    context.addIssue({
      code: "custom",
      path: ["advancePercentage"],
      message:
        "Calculated advance amount cannot be greater than the net advertisement amount after discount."
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

    /*
     * Final commercial advertisement amount.
     */
    advertisementAmount: z.coerce.number().finite().min(0).optional(),

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
     * Configured advertisement placement.
     *
     * The Advertisement API contract uses placementId at the
     * top level. This is also the field consumed by the current
     * Advertisement Create workflow and API types.
     *
     * Do not replace this with a free-text placement value.
     * The value must reference a configured advertisement
     * placement.
     */
    placementId: z.coerce.number().int().positive().optional(),

    /*
     * Pricing remains supported for callers that provide the
     * pricing snapshot inputs explicitly.
     *
     * placementId inside pricing is retained for backward
     * compatibility with the earlier pricing contract.
     */
    pricing: pricingSchema.optional()
  })
  .superRefine((value, context) => {
    /*
     * If both placement representations are supplied, they must
     * refer to the same configured placement.
     *
     * This prevents an ambiguous request such as:
     *
     * placementId: 10
     * pricing.placementId: 11
     */
    if (
      value.placementId !== undefined &&
      value.pricing?.placementId !== undefined &&
      value.placementId !== value.pricing.placementId
    ) {
      context.addIssue({
        code: "custom",
        path: ["pricing", "placementId"],
        message:
          "placementId and pricing.placementId must reference the same advertisement placement."
      });
    }

    /*
     * A configured advertisement must have a placement.
     *
     * The top-level placementId is the current API contract.
     *
     * pricing.placementId is accepted as a compatibility path
     * for existing callers using the older nested pricing model.
     */
    if (
      value.placementId === undefined &&
      value.pricing?.placementId === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["placementId"],
        message: "Advertisement placement is required."
      });
    }

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
     * Final commercial advertisement amount.
     *
     * This maps directly to
     * advertisements.advertisement_amount.
     */
    advertisementAmount: z.coerce.number().finite().min(0).optional(),

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

    /*
     * Configured advertisement placement.
     *
     * The Advertisement Create / Draft workflow uses the
     * top-level placementId field.
     */
    placementId: z.coerce.number().int().positive().optional(),

    /*
     * Pricing is retained for compatibility with the existing
     * pricing input contract.
     *
     * The service/repository must continue to protect the
     * system-derived standardAmount and pricing snapshot.
     */
    pricing: pricingSchema.optional()
  })
  .superRefine((value, context) => {
    /*
     * If both placement representations are supplied, they must
     * refer to the same placement.
     */
    if (
      value.placementId !== undefined &&
      value.pricing?.placementId !== undefined &&
      value.placementId !== value.pricing.placementId
    ) {
      context.addIssue({
        code: "custom",
        path: ["pricing", "placementId"],
        message:
          "placementId and pricing.placementId must reference the same advertisement placement."
      });
    }

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

    /*
     * Validate the financial relationship whenever any
     * financial value is supplied.
     *
     * The service merges omitted values with the current
     * advertisement before performing the authoritative
     * calculation.
     */
    if (
      value.advertisementAmount !== undefined ||
      value.discountPercentage !== undefined ||
      value.advancePercentage !== undefined
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