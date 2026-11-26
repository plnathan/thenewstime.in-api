import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
const id = z.string().regex(/^[1-9]\d{0,18}$/);
const schema = z
  .object({
    newsId: id,
    batchId: id,
    advertisementId: id,
    position: z.number().int().min(1).max(32767),
    batchViewId: z.string().uuid(),
    eventId: z.string().uuid(),
    expiresAt: z.number().int()
  })
  .strict();
export type FeedReceipt = z.infer<typeof schema>;
function signature(body: string) {
  const secret = process.env.SPONSORED_FEED_TRACKING_SECRET;
  if (!secret || secret.length < 32)
    throw new ApiError(503, "Sponsored feed tracking is not configured.");
  return createHmac("sha256", secret).update(body).digest();
}
export function signReceipt(receipt: FeedReceipt) {
  const body = Buffer.from(JSON.stringify(schema.parse(receipt))).toString(
    "base64url"
  );
  return `${body}.${signature(body).toString("base64url")}`;
}
export function verifyReceipt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1])
    throw new ApiError(400, "Invalid sponsored feed token.");
  const expected = signature(parts[0]);
  const supplied = Buffer.from(parts[1], "base64url");
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new ApiError(400, "Invalid sponsored feed token.");
  try {
    const data = schema.parse(
      JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"))
    );
    if (data.expiresAt <= Date.now()) throw new Error("expired");
    return data;
  } catch {
    throw new ApiError(400, "Invalid or expired sponsored feed token.");
  }
}
