import { z } from "zod";

const clientStatusSchema = z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]);

const optionalText = (maxLength: number) =>
  z.string().trim().max(maxLength).optional();

const optionalEmail = z.string().trim().email().max(255).optional();

export const createClientSchema = z.object({
  clientCode: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[A-Za-z0-9_.:-]+$/, "clientCode contains invalid characters."),

  name: z.string().trim().min(2).max(200),

  displayName: optionalText(200),

  businessName: optionalText(250),

  businessTypeId: z.coerce.number().int().positive().optional(),

  website: optionalText(500),

  primaryAddress: optionalText(1000),

  communicationAddress: optionalText(1000),

  contactPerson: optionalText(200),

  contactNo: optionalText(50),

  alternateMobile: optionalText(50),

  email: optionalEmail,

  alternateEmail: optionalEmail,

  websiteUrl: optionalText(500),

  status: clientStatusSchema.optional(),

  notes: optionalText(2000)
});

export const updateClientSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),

  displayName: optionalText(200),

  businessName: optionalText(250),

  businessTypeId: z.coerce.number().int().positive().optional(),

  website: optionalText(500),

  primaryAddress: optionalText(1000),

  communicationAddress: optionalText(1000),

  contactPerson: optionalText(200),

  contactNo: optionalText(50),

  alternateMobile: optionalText(50),

  email: optionalEmail,

  alternateEmail: optionalEmail,

  websiteUrl: optionalText(500),

  status: clientStatusSchema.optional(),

  notes: optionalText(2000)
});

export const clientIdSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const clientQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce.number().int().positive().max(100).default(20),

  search: z.string().trim().max(200).optional(),

  status: clientStatusSchema.optional(),

  businessTypeId: z.coerce.number().int().positive().optional()
});
