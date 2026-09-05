import { z } from "zod";

export const createRoleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(
      /^[A-Z0-9_]+$/,
      "Role code must contain only uppercase letters, numbers and underscores."
    ),

  displayName: z.string().trim().min(2).max(100),

  description: z.string().trim().max(300).optional(),

  displayOrder: z.number().int().min(0).optional()
});

export const updateRoleSchema = z.object({
  displayName: z.string().trim().min(2).max(100).optional(),

  description: z.string().trim().max(300).optional(),

  displayOrder: z.number().int().min(0).optional(),

  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional()
});

export const roleIdSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const userIdParamSchema = z.object({
  userId: z.coerce.number().int().positive()
});

export const assignRoleSchema = z.object({
  userId: z.coerce.number().int().positive()
});

export const userRoleParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
  roleId: z.coerce.number().int().positive()
});
