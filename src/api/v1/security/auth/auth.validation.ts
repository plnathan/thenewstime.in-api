import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(200),

  displayName: z.string().trim().min(2).max(200),

  username: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[A-Za-z0-9._-]+$/, "Username contains invalid characters."),

  password: z.string().min(8).max(128),

  email: z.string().trim().email().max(200).optional(),

  mobile: z.string().trim().min(7).max(20).optional()
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),

  password: z.string().min(1).max(128)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});
