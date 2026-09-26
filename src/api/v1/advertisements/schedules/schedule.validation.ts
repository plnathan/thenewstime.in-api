import { z } from "zod";

const scheduleStatusSchema = z.enum([
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED"
]);

const positiveInt = z.coerce.number().int().positive();

const dateTimeSchema = z.coerce
  .date()
  .refine((value) => !Number.isNaN(value.getTime()), {
    message: "Invalid date/time."
  });

const notesSchema = z.string().trim().max(2000).optional();

export const scheduleIdSchema = z.object({
  id: positiveInt
});

export const scheduleQuerySchema = z.object({
  advertisementId: positiveInt.optional(),
  placementId: positiveInt.optional(),
  placementRuleId: positiveInt.optional(),
  status: scheduleStatusSchema.optional()
});

export const createScheduleSchema = z
  .object({
    advertisementId: positiveInt,

    placementId: positiveInt,

    placementRuleId: positiveInt.nullable().optional(),

    startAt: dateTimeSchema,

    endAt: dateTimeSchema,

    status: scheduleStatusSchema.default("SCHEDULED"),

    priority: z.coerce.number().int().min(0).default(0),

    rescheduledFromId: positiveInt.nullable().optional(),

    notes: notesSchema
  })
  .superRefine((value, context) => {
    if (value.endAt <= value.startAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "End date/time must be after start date/time."
      });
    }

    if (value.status !== "SCHEDULED") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "A new schedule must be created with SCHEDULED status."
      });
    }
  });

export const updateScheduleSchema = z
  .object({
    placementRuleId: positiveInt.nullable().optional(),

    startAt: dateTimeSchema.optional(),

    endAt: dateTimeSchema.optional(),

    status: scheduleStatusSchema.optional(),

    priority: z.coerce.number().int().min(0).optional(),

    rescheduledFromId: positiveInt.nullable().optional(),

    notes: z.string().trim().max(2000).nullable().optional()
  })
  .superRefine((value, context) => {
    if (
      value.startAt !== undefined &&
      value.endAt !== undefined &&
      value.endAt <= value.startAt
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "End date/time must be after start date/time."
      });
    }
  });
