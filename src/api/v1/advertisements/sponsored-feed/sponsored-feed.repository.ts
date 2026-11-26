import { pool } from "../../../../shared/config/db.js";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import type { CardInput } from "./sponsored-feed.validation.js";

const columns = `advertisement_id AS "advertisementId", headline, description, sponsor_display_name AS "sponsorDisplayName", cta_label AS "ctaLabel", image_url AS "imageUrl", headline_url AS "headlineUrl", description_url AS "descriptionUrl", sponsor_url AS "sponsorUrl", cta_url AS "ctaUrl", created_by AS "createdBy", updated_by AS "updatedBy", created_at AS "createdAt", updated_at AS "updatedAt"`;
export async function readCard(id: number) {
  const result = await pool.query(
    `SELECT ${columns} FROM advertisement_card_contents WHERE advertisement_id=$1`,
    [id]
  );
  return result.rows[0] ?? null;
}
export async function saveCard(id: number, input: CardInput, actor: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ad = (
      await client.query(
        "SELECT advertisement_type, workflow_status, is_house_ad FROM advertisements WHERE id=$1 FOR UPDATE",
        [id]
      )
    ).rows[0];
    if (!ad) throw new ApiError(404, "Advertisement not found.");
    if (ad.advertisement_type !== "NATIVE" || ad.is_house_ad)
      throw new ApiError(409, "A paid NATIVE advertisement is required.");
    if (!["DRAFT", "REJECTED"].includes(ad.workflow_status))
      throw new ApiError(
        409,
        "Card content is editable only in draft or rejected workflow."
      );
    const result = await client.query(
      `INSERT INTO advertisement_card_contents (advertisement_id,headline,description,sponsor_display_name,cta_label,image_url,headline_url,description_url,sponsor_url,cta_url,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) ON CONFLICT (advertisement_id) DO UPDATE SET headline=EXCLUDED.headline,description=EXCLUDED.description,sponsor_display_name=EXCLUDED.sponsor_display_name,cta_label=EXCLUDED.cta_label,image_url=EXCLUDED.image_url,headline_url=EXCLUDED.headline_url,description_url=EXCLUDED.description_url,sponsor_url=EXCLUDED.sponsor_url,cta_url=EXCLUDED.cta_url,updated_by=EXCLUDED.updated_by,updated_at=CURRENT_TIMESTAMP RETURNING ${columns}`,
      [
        id,
        input.headline,
        input.description,
        input.sponsorDisplayName,
        input.ctaLabel,
        input.imageUrl,
        input.headlineUrl,
        input.descriptionUrl,
        input.sponsorUrl,
        input.ctaUrl,
        actor
      ]
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function listBatches() {
  const result = await pool.query(
    `SELECT id,code,capacity,display_name AS "displayName",batch_order AS "batchOrder",pricing_placement_id AS "pricingPlacementId",is_enabled AS "isEnabled",created_by AS "createdBy",updated_by AS "updatedBy",created_at AS "createdAt",updated_at AS "updatedAt" FROM advertisement_feed_batches ORDER BY batch_order`
  );
  return result.rows;
}
