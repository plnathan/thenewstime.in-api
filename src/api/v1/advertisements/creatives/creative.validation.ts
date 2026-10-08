import { z } from "zod";

const creativeTypeSchema = z.enum(["IMAGE", "VIDEO", "HTML", "TEXT"]);

const creativeVariantSchema = z.enum(["DESKTOP", "MOBILE"]);

const creativeStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

const positiveInteger = z.number().int().positive();

const nullablePositiveInteger = z.union([positiveInteger, z.null()]).optional();

const nullableText = z
  .union([z.string().trim().max(1000), z.null()])
  .optional();

export const advertisementIdSchema = z.object({
  advertisementId: z.coerce.number().int().positive()
});

export const creativeIdSchema = z.object({
  advertisementId: z.coerce.number().int().positive(),
  creativeId: z.coerce.number().int().positive()
});

export const createAdvertisementCreativeSchema = z
  .object({
    formatId: z.union([z.number().int().positive(), z.null()]).optional(),

    creativeType: creativeTypeSchema,

    variant: creativeVariantSchema.optional(),

    title: nullableText,

    altText: z.union([z.string().trim().max(500), z.null()]).optional(),

    mediaUrl: z.string().trim().min(1).max(5000),

    thumbnailUrl: z.union([z.string().trim().max(5000), z.null()]).optional(),

    widthPx: nullablePositiveInteger,

    heightPx: nullablePositiveInteger,

    displayOrder: z.number().int().min(0).optional(),

    isPrimary: z.boolean().optional(),

    status: creativeStatusSchema.optional()
  })
  .superRefine((value, ctx) => {
    if (value.creativeType === "IMAGE" && value.mediaUrl.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaUrl"],
        message: "Image mediaUrl is required."
      });
    }

    if (value.creativeType === "VIDEO" && value.mediaUrl.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaUrl"],
        message: "Video mediaUrl is required."
      });
    }

    if (value.widthPx !== undefined && value.heightPx === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["heightPx"],
        message: "heightPx should be provided when widthPx is provided."
      });
    }

    if (value.heightPx !== undefined && value.widthPx === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["widthPx"],
        message: "widthPx should be provided when heightPx is provided."
      });
    }
  });

export const updateAdvertisementCreativeSchema = z
  .object({
    formatId: z.union([z.number().int().positive(), z.null()]).optional(),

    creativeType: creativeTypeSchema.optional(),

    variant: creativeVariantSchema.optional(),

    title: nullableText,

    altText: z.union([z.string().trim().max(500), z.null()]).optional(),

    mediaUrl: z.string().trim().min(1).max(5000).optional(),

    thumbnailUrl: z.union([z.string().trim().max(5000), z.null()]).optional(),

    widthPx: nullablePositiveInteger,

    heightPx: nullablePositiveInteger,

    displayOrder: z.number().int().min(0).optional(),

    isPrimary: z.boolean().optional(),

    status: creativeStatusSchema.optional()
  })
  .superRefine((value, ctx) => {
    if (value.widthPx !== undefined && value.heightPx === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["heightPx"],
        message: "heightPx should be provided when widthPx is provided."
      });
    }

    if (value.heightPx !== undefined && value.widthPx === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["widthPx"],
        message: "widthPx should be provided when heightPx is provided."
      });
    }
  });
