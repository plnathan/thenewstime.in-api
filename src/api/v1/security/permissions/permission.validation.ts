import { z } from "zod";

export const createPermissionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(
      /^[A-Z0-9_:-]+$/,
      "Permission code must contain only uppercase letters, numbers, underscores, colons or hyphens."
    ),

  displayName: z.string().trim().min(2).max(150),

  description: z.string().trim().max(300).optional(),

  module: z.string().trim().max(50).optional(),

  resource: z.string().trim().max(50).optional(),

  action: z.string().trim().max(50).optional(),

  displayOrder: z.number().int().min(0).optional(),

  isSystemPermission: z.boolean().optional()
});

export const updatePermissionSchema = z.object({
  displayName: z.string().trim().min(2).max(150).optional(),

  description: z.string().trim().max(300).optional(),

  module: z.string().trim().max(50).optional(),

  resource: z.string().trim().max(50).optional(),

  action: z.string().trim().max(50).optional(),

  displayOrder: z.number().int().min(0).optional(),

  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
});

export const permissionIdSchema = z.object({
  id: z.coerce.number().int().positive()
});
