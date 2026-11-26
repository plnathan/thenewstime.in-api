import { pool } from "../../../../shared/config/db.js";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import {
  dailyQuantity,
  batchInput,
  rateInput
} from "./inventory.validation.js";
import type { z } from "zod";
import type { PoolClient } from "pg";
export async function transaction<T>(
  work: (c: PoolClient) => Promise<T>
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(73422,1)");
    const result = await work(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export function createBatch(input: z.output<typeof batchInput>, actor: number) {
  return transaction(async (c) => {
    const capacity = await validateCapacity(c, input.capacity);
    const existing = await c.query(
      "SELECT 1 FROM advertisement_feed_batches WHERE code=$1 OR batch_order=$2",
      [input.code, input.batchOrder]
    );
    if (existing.rowCount)
      throw new ApiError(409, "Batch code or order already exists.");
    const p = await c.query(
      `INSERT INTO advertisement_placements(code,display_name,page_type,placement_type,is_enabled,created_by,updated_by) VALUES ($1,$2,'NEWS_DETAIL','NEWS_DETAIL_SPONSORED_FEED',false,$3,$3) RETURNING id`,
      ["SPONSORED_FEED_" + input.code, input.displayName, actor]
    );
    return (
      await c.query(
        `INSERT INTO advertisement_feed_batches(code,display_name,batch_order,pricing_placement_id,is_enabled,created_by,updated_by,capacity) VALUES ($1,$2,$3,$4,true,$5,$5,$6) RETURNING *`,
        [
          input.code,
          input.displayName,
          input.batchOrder,
          p.rows[0].id,
          actor,
          capacity
        ]
      )
    ).rows[0];
  });
}
export function createRate(
  id: number,
  input: z.output<typeof rateInput>,
  actor: number
) {
  return transaction(async (c) => {
    const b = (
      await c.query("SELECT * FROM advertisement_feed_batches WHERE id=$1", [
        id
      ])
    ).rows[0];
    if (!b) throw new ApiError(404, "Batch not found.");
    if (!b.is_enabled) throw new ApiError(409, "Select an enabled batch.");
    const conflict = await c.query(
      `SELECT 1 FROM advertisement_rate_cards WHERE placement_id=$1 AND pricing_unit='DAY' AND status='ACTIVE'`,
      [b.pricing_placement_id]
    );
    if (conflict.rowCount)
      throw new ApiError(
        409,
        "This batch already has an active daily rate. Disable it before creating another."
      );
    return (
      await c.query(
        `INSERT INTO advertisement_rate_cards(placement_id,pricing_unit,rate_amount,currency_code,effective_from,effective_to,created_by,updated_by) VALUES($1,'DAY',$2,'INR',$3,$4,$5,$5) RETURNING *`,
        [
          b.pricing_placement_id,
          input.rateAmount,
          input.effectiveFrom,
          input.effectiveTo,
          actor
        ]
      )
    ).rows[0];
  });
}
export async function listRates(id: number) {
  return (
    await pool.query(
      `SELECT r.* FROM advertisement_rate_cards r JOIN advertisement_feed_batches b ON b.pricing_placement_id=r.placement_id WHERE b.id=$1 AND r.pricing_unit='DAY' ORDER BY r.effective_from DESC,r.id DESC`,
      [id]
    )
  ).rows;
}
export function assign(id: number, batchId: number, actor: number) {
  return transaction(async (c) => {
    const a = (
      await c.query("SELECT * FROM advertisements WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!a) throw new ApiError(404, "Advertisement not found.");
    if (
      a.advertisement_type !== "NATIVE" ||
      a.is_house_ad ||
      !["DRAFT", "REJECTED"].includes(a.workflow_status) ||
      a.status !== "DRAFT"
    )
      throw new ApiError(409, "Only paid native drafts can reserve inventory.");
    const current = (
      await c.query(
        "SELECT * FROM advertisement_feed_assignments WHERE advertisement_id=$1",
        [id]
      )
    ).rows[0];
    if (current) {
      if (String(current.batch_id) === String(batchId)) return current;
      if (
        current.activated_at ||
        a.workflow_status !== "DRAFT" ||
        Number(a.discount_percentage) ||
        Number(a.advance_percentage) ||
        Number(a.adjustment_amount)
      )
        throw new ApiError(
          409,
          "Batch changes require an uncommitted draft without commercial adjustments."
        );
      const dependencies = await c.query(
        `SELECT 1 FROM advertisement_payments WHERE advertisement_id=$1 UNION ALL SELECT 1 FROM advertisement_financial_approvals WHERE advertisement_id=$1 UNION ALL SELECT 1 FROM advertisement_feed_upgrades WHERE advertisement_id=$1`,
        [id]
      );
      if (dependencies.rowCount)
        throw new ApiError(
          409,
          "Existing financial or upgrade records prevent direct reassignment."
        );
    }
    if (!a.start_at || !a.end_at || new Date(a.end_at) <= new Date())
      throw new ApiError(
        409,
        "A valid future-ending campaign window is required."
      );
    if (
      !current &&
      (a.pricing_placement_id !== null || a.advertisement_amount !== null)
    )
      throw new ApiError(409, "Reserve before configuring commercial pricing.");
    if (
      !(
        await c.query(
          "SELECT 1 FROM advertisement_card_contents WHERE advertisement_id=$1",
          [id]
        )
      ).rowCount
    )
      throw new ApiError(409, "Save card content first.");
    if (
      (
        await c.query(
          "SELECT 1 FROM advertisement_schedules WHERE advertisement_id=$1 UNION ALL SELECT 1 FROM advertisement_placement_rules WHERE advertisement_id=$1",
          [id]
        )
      ).rowCount
    )
      throw new ApiError(
        409,
        "Existing runtime placements are not supported by this reservation API."
      );
    const b = (
      await c.query(
        "SELECT * FROM advertisement_feed_batches WHERE id=$1 AND is_enabled",
        [batchId]
      )
    ).rows[0];
    if (!b) throw new ApiError(409, "Batch is not enabled.");
    const rates = (
      await c.query(
        `SELECT * FROM advertisement_rate_cards WHERE placement_id=$1 AND pricing_unit='DAY' AND status='ACTIVE' AND effective_from <= $2 AND (effective_to IS NULL OR effective_to > $2) FOR SHARE`,
        [b.pricing_placement_id, a.start_at]
      )
    ).rows;
    if (rates.length !== 1)
      throw new ApiError(
        409,
        "Exactly one active daily rate must cover the campaign start."
      );
    const r = rates[0];
    const quantity = dailyQuantity(new Date(a.start_at), new Date(a.end_at));
    // Peak simultaneous occupancy, not merely number of intersecting reservations.
    const peak = (
      await c.query(
        `WITH booked AS (SELECT reserved_start_at AS s,reserved_end_at AS e FROM advertisement_feed_assignments WHERE batch_id=$1 AND reserved_start_at < $3 AND reserved_end_at > $2 UNION ALL SELECT reserved_start_at,reserved_end_at FROM advertisement_feed_upgrades WHERE target_batch_id=$1 AND status='PENDING' AND reserved_start_at < $3 AND reserved_end_at > $2), points AS (SELECT $2::timestamptz AS t UNION SELECT s FROM booked WHERE s >= $2) SELECT COALESCE(MAX((SELECT count(*) FROM booked WHERE s<=t AND e>t)),0)::int AS peak FROM points`,
        [batchId, a.start_at, a.end_at]
      )
    ).rows[0].peak;
    if (peak >= b.capacity)
      throw new ApiError(
        409,
        "Batch has no capacity for the full campaign window."
      );
    await c.query(
      `UPDATE advertisements SET pricing_placement_id=$2,pricing_unit='DAY',pricing_quantity=$3,standard_amount=ROUND($3::numeric*$4::numeric,2),advertisement_amount=ROUND($3::numeric*$4::numeric,2),currency_code=$5,updated_by=$6,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
      [
        id,
        b.pricing_placement_id,
        quantity,
        r.rate_amount,
        r.currency_code,
        actor
      ]
    );
    await c.query(
      `INSERT INTO advertisement_pricing_snapshots(advertisement_id,placement_id,rate_card_id,pricing_unit,rate_amount,currency_code,rate_effective_from,rate_effective_to,quantity,standard_amount,created_by) VALUES($1,$2,$3,'DAY',$4,$5,$6,$7,$8,ROUND($4::numeric*$8::numeric,2),$9)`,
      [
        id,
        b.pricing_placement_id,
        r.id,
        r.rate_amount,
        r.currency_code,
        r.effective_from,
        r.effective_to,
        quantity,
        actor
      ]
    );
    return (
      await c.query(
        `INSERT INTO advertisement_feed_assignments(advertisement_id,batch_id,rate_card_id,reserved_start_at,reserved_end_at,assigned_by,created_by,updated_by,assigned_rate_amount) VALUES($1,$2,$3,$4,$5,$6,$6,$6,$7) ON CONFLICT (advertisement_id) DO UPDATE SET batch_id=EXCLUDED.batch_id,rate_card_id=EXCLUDED.rate_card_id,reserved_start_at=EXCLUDED.reserved_start_at,reserved_end_at=EXCLUDED.reserved_end_at,assigned_by=EXCLUDED.assigned_by,updated_by=EXCLUDED.updated_by,assigned_rate_amount=EXCLUDED.assigned_rate_amount,batch_assigned_at=clock_timestamp(),updated_at=CURRENT_TIMESTAMP RETURNING *`,
        [id, batchId, r.id, a.start_at, a.end_at, actor, r.rate_amount]
      )
    ).rows[0];
  });
}
export async function readAssignment(id: number) {
  return (
    (
      await pool.query(
        "SELECT * FROM advertisement_feed_assignments WHERE advertisement_id=$1",
        [id]
      )
    ).rows[0] ?? null
  );
}

export async function validateCapacity(
  c: PoolClient,
  requested?: number
): Promise<number> {
  const {
    rows: [limits]
  } = await c.query(
    "SELECT * FROM advertisement_feed_capacity_settings WHERE id=1 FOR SHARE"
  );
  const capacity = requested ?? limits.default_capacity;
  if (
    !Number.isInteger(capacity) ||
    capacity < limits.min_capacity ||
    capacity > limits.max_capacity
  )
    throw new ApiError(
      400,
      `Capacity must be between ${limits.min_capacity} and ${limits.max_capacity}.`
    );
  return capacity;
}
export function updateCapacity(id: number, requested: number, actor: number) {
  return transaction(async (c) => {
    const capacity = await validateCapacity(c, requested);
    const peak = (
      await c.query(
        `WITH booked AS (SELECT reserved_start_at s,reserved_end_at e FROM advertisement_feed_assignments WHERE batch_id=$1 AND reserved_end_at>now() UNION ALL SELECT reserved_start_at,reserved_end_at FROM advertisement_feed_upgrades WHERE target_batch_id=$1 AND status='PENDING' AND reserved_end_at>now()), points AS (SELECT now() t UNION SELECT s FROM booked WHERE s>now()) SELECT COALESCE(MAX((SELECT count(*) FROM booked WHERE s<=t AND e>t)),0)::int peak FROM points`,
        [id]
      )
    ).rows[0].peak;
    if (peak > capacity)
      throw new ApiError(
        409,
        `At least ${peak} positions are reserved concurrently.`
      );
    const result = await c.query(
      "UPDATE advertisement_feed_batches SET capacity=$2,updated_by=$3,updated_at=now() WHERE id=$1 RETURNING id,capacity",
      [id, capacity, actor]
    );
    if (!result.rowCount) throw new ApiError(404, "Batch not found.");
    return result.rows[0];
  });
}
