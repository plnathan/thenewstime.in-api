import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(100, "Password must not exceed 100 characters.");

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(200),

  displayName: z.string().trim().min(2).max(200),

  username: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "Username can contain only letters, numbers, dots, underscores and hyphens."
    ),

  email: z.string().trim().email().max(200).optional(),

  mobile: z.string().trim().min(7).max(20).optional(),

  password: passwordSchema,

  roleId: z.coerce.number().int().positive(),

  profileImageUrl: z.string().trim().url().optional(),

  mustChangePassword: z.boolean().optional(),

  passwordExpiresAt: z.string().datetime().optional()
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(200).optional(),

  displayName: z.string().trim().min(2).max(200).optional(),

  email: z.string().trim().email().max(200).optional(),

  mobile: z.string().trim().min(7).max(20).optional(),

  profileImageUrl: z.string().trim().url().optional(),

  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"]).optional(),

  mustChangePassword: z.boolean().optional(),

  password: passwordSchema.optional(),

  passwordExpiresAt: z.string().datetime().optional()
});

export const userIdSchema = z.object({
  id: z.coerce.number().int().positive()
});
