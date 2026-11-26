import { z } from "zod";
import { normalizeCardUrl } from "./card-url.js";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .default(null);
const url = z
  .string()
  .max(2048)
  .nullable()
  .default(null)
  .transform((v, ctx) => {
    try {
      return normalizeCardUrl(v);
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid HTTP or HTTPS website URL."
      });
      return z.NEVER;
    }
  });
export const idSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const cardSchema = z
  .object({
    headline: text(250),
    description: text(1000),
    sponsorDisplayName: text(200),
    ctaLabel: text(80),
    imageUrl: url,
    headlineUrl: url,
    descriptionUrl: url,
    sponsorUrl: url,
    ctaUrl: url
  })
  .strict();
export type CardInput = z.output<typeof cardSchema>;
