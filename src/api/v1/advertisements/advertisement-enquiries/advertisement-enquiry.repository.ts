import { createHmac } from "node:crypto";
import {
  consumeEnquiryQuota,
  enquiryLimit
} from "./advertisement-enquiry.rate-limit.js";
import type { Pool } from "pg";
import type { CreateAdvertisementEnquiryInput } from "./advertisement-enquiry.validation.js";

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
        await client.query("BEGIN");
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
