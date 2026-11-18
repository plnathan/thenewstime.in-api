import type { Pool, PoolClient } from "pg";

export function enquiryLimit(name: string): number {
  const raw = process.env[name];
  if (raw === undefined) return 10;
  const value = Number(raw);
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 10000
  ) {
    throw new Error(`Invalid enquiry rate limit configuration: ${name}`);
  }
  return value;
}

export class EnquiryRateLimitError extends Error {
  constructor(
    public readonly retryAfter: number,
    public readonly scope: "phone" | "ip"
  ) {
    const minutes = Math.max(1, Math.ceil(retryAfter / 60));
    super(
      `Too many enquiries for this ${scope === "phone" ? "mobile number" : "connection"}. Please try again after ${minutes} minute(s).`
    );
    this.name = "EnquiryRateLimitError";
  }
}

/** Atomic bucket update. A transaction caller must roll back on rejection. */
export async function consumeEnquiryQuota(
  db: Pool | PoolClient,
  key: string,
  max: number,
  seconds: number
): Promise<void> {
  const result = await db.query<{ requests: number; retry_after: number }>(
    `
    INSERT INTO advertisement_enquiry_rate_limits(bucket_key, requests, expires_at)
    VALUES ($1, 1, now() + ($2::int * interval '1 second'))
    ON CONFLICT (bucket_key) DO UPDATE SET
      requests = CASE WHEN advertisement_enquiry_rate_limits.expires_at <= now()
        THEN 1 ELSE LEAST(advertisement_enquiry_rate_limits.requests::bigint + 1, 2147483647)::int END,
      expires_at = CASE WHEN advertisement_enquiry_rate_limits.expires_at <= now()
        THEN now() + ($2::int * interval '1 second') ELSE advertisement_enquiry_rate_limits.expires_at END
    RETURNING requests, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - now()))))::int AS retry_after`,
    [key, seconds]
  );
  const row = result.rows[0];
  if (!row) throw new Error("Enquiry quota update failed");
  if (row.requests > max)
    throw new EnquiryRateLimitError(
      row.retry_after,
      key.startsWith("success:phone:") ? "phone" : "ip"
    );
}
