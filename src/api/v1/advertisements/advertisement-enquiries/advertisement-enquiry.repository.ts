import { createHmac } from "node:crypto";
import {
  consumeEnquiryQuota,
  enquiryLimit
} from "./advertisement-enquiry.rate-limit.js";
import type { Pool } from "pg";
import type { CreateAdvertisementEnquiryInput } from "./advertisement-enquiry.validation.js";

export class DuplicateEnquiryError extends Error {
  constructor() {
    super(
      "You have already submitted an enquiry with the same details. Our advertising team will contact you shortly."
    );
    this.name = "DuplicateEnquiryError";
  }
}

function duplicateWindowHours(): number {
  const raw = process.env.ENQUIRY_DUPLICATE_WINDOW_HOURS ?? "24";
  const hours = Number(raw);
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(hours) ||
    hours < 1 ||
    hours > 8760
  ) {
    throw new Error("Invalid ENQUIRY_DUPLICATE_WINDOW_HOURS configuration");
  }
  return hours;
}

export interface AdvertisementEnquiryRepository {
  create(
    input: CreateAdvertisementEnquiryInput,
    fingerprint: string
  ): Promise<{ id: string; createdAt: string }>;
}

export function createAdvertisementEnquiryRepository(
  pool: Pool
): AdvertisementEnquiryRepository {
  return {
    async create(input, fingerprint) {
      if (!fingerprint) throw new Error("Missing enquiry security context");
      const phoneHash = createHmac(
        "sha256",
        process.env.ENQUIRY_RATE_LIMIT_SECRET || "local-development-only"
      )
        .update(input.mobileNumber.replace(/\D/g, ""))
        .digest("hex");
      const client = await pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
        // Serialize submissions for the same normalized mobile, across IPs and instances.
        const mobile = input.mobileNumber.replace(/\D/g, "");
        await client.query(
          "SELECT pg_advisory_xact_lock(174823910, hashtext($1::text))",
          [mobile]
        );
        const duplicate = await client.query<{ found: boolean }>(
          `SELECT EXISTS (
           SELECT 1 FROM advertisement_enquiries
           WHERE regexp_replace(mobile_number, '[^0-9]', '', 'g') = $1
             AND created_at > clock_timestamp() - ($2::int * interval '1 hour')
             AND lower(btrim(full_name)) = lower(btrim($3::text))
             AND lower(btrim(coalesce(company_name, ''))) = lower(btrim($4::text))
             AND lower(btrim(coalesce(email, ''))) = lower(btrim($5::text))
             AND advertisement_type IS NOT DISTINCT FROM $6::text
             AND page_types @> $7::text[] AND page_types <@ $7::text[]
             AND placement_types @> $8::text[] AND placement_types <@ $8::text[]
             AND preferred_start_date IS NOT DISTINCT FROM $9::date
             AND preferred_end_date IS NOT DISTINCT FROM $10::date
             AND lower(btrim(coalesce(additional_requirements, ''))) = lower(btrim($11::text))
         ) AS found`,
          [
            mobile,
            duplicateWindowHours(),
            input.fullName,
            input.companyName ?? "",
            input.email ?? "",
            input.advertisementType ?? null,
            input.pageTypes ?? [],
            input.placementTypes ?? [],
            input.preferredStartDate ?? null,
            input.preferredEndDate ?? null,
            input.additionalRequirements ?? ""
          ]
        );
        if (duplicate.rows[0]?.found) throw new DuplicateEnquiryError();
        await consumeEnquiryQuota(
          client,
          `success:ip:hour:${fingerprint}`,
          enquiryLimit("ENQUIRY_SUCCESS_IP_HOUR_LIMIT"),
          3600
        );
        await consumeEnquiryQuota(
          client,
          `success:ip:day:${fingerprint}`,
          enquiryLimit("ENQUIRY_SUCCESS_IP_DAY_LIMIT"),
          86400
        );
        await consumeEnquiryQuota(
          client,
          `success:phone:day:${phoneHash}`,
          enquiryLimit("ENQUIRY_SUCCESS_PHONE_DAY_LIMIT"),
          86400
        );
        const result = await client.query<{ id: string; created_at: Date }>(
          `INSERT INTO advertisement_enquiries (
           full_name, company_name, mobile_number, email, advertisement_type,
           page_types, placement_types, preferred_start_date, preferred_end_date,
           additional_requirements, source, source_advertisement_id, source_placement_id, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'PENDING')
         RETURNING id::text AS id, created_at`,
          [
            input.fullName,
            input.companyName || null,
            input.mobileNumber,
            input.email || null,
            input.advertisementType ?? null,
            [...new Set(input.pageTypes ?? [])],
            [...new Set(input.placementTypes ?? [])],
            input.preferredStartDate ?? null,
            input.preferredEndDate ?? null,
            input.additionalRequirements || null,
            input.source,
            input.source === "HOUSE_AD"
              ? (input.sourceAdvertisementId ?? null)
              : null,
            input.source === "HOUSE_AD"
              ? (input.sourcePlacementId ?? null)
              : null
          ]
        );
        const row = result.rows[0];
        if (!row) throw new Error("Failed to create advertisement enquiry");
        const created = { id: row.id, createdAt: row.created_at.toISOString() };
        await client.query("COMMIT");
        return created;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  };
}
