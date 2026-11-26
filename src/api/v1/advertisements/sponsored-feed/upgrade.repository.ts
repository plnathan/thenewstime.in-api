import { transaction } from "./inventory.repository.js";
import { dailyQuantity } from "./inventory.validation.js";
import { additionalAmount, upgradeInput } from "./upgrade.validation.js";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import type { z } from "zod";
export function requestUpgrades(
  input: z.output<typeof upgradeInput>,
  actor: number
) {
  return transaction(async (c) => {
    const old = (
      await c.query(
        "SELECT * FROM advertisement_feed_upgrades WHERE request_id=$1 ORDER BY advertisement_id",
        [input.requestId]
      )
    ).rows;
    if (old.length) {
      if (
        old.length !== input.moves.length ||
        old.some(
          (r) =>
            Number(r.requested_by) !== actor ||
            !input.moves.some(
              (m) =>
                m.advertisementId === Number(r.advertisement_id) &&
                m.targetBatchId === Number(r.target_batch_id) &&
                m.sourceBatchId === Number(r.source_batch_id)
            )
        )
      )
        throw new ApiError(409, "Request ID already used.");
      return old;
    }
    const result = [];
    for (const m of [...input.moves].sort(
      (a, b) => a.advertisementId - b.advertisementId
    )) {
      const a = (
        await c.query(
          `SELECT f.*, b.batch_order, f.assigned_rate_amount AS rate_amount,r.currency_code,a.workflow_status,a.status FROM advertisement_feed_assignments f JOIN advertisements a ON a.id=f.advertisement_id JOIN advertisement_feed_batches b ON b.id=f.batch_id JOIN advertisement_rate_cards r ON r.id=f.rate_card_id WHERE f.advertisement_id=$1 FOR UPDATE OF f,a`,
          [m.advertisementId]
        )
      ).rows[0];
      if (
        !a ||
        a.rate_amount == null ||
        Number(a.batch_id) !== m.sourceBatchId ||
        !a.reserved_end_at
      )
        throw new ApiError(409, "Source reservation changed.");
      if (!["DRAFT", "REJECTED", "APPROVED"].includes(a.workflow_status))
        throw new ApiError(
          409,
          "Advertisement workflow does not permit upgrade."
        );
      if (
        (
          await c.query(
            `SELECT 1 FROM advertisement_feed_upgrades WHERE advertisement_id=$1 AND status='PENDING'`,
            [m.advertisementId]
          )
        ).rowCount
      )
        throw new ApiError(409, "Pending upgrade exists.");
      const start = new Date(
          Math.max(Date.now(), new Date(a.reserved_start_at).getTime())
        ),
        end = new Date(a.reserved_end_at);
      if (end <= start) throw new ApiError(409, "Reservation expired.");
      const b = (
        await c.query(
          "SELECT * FROM advertisement_feed_batches WHERE id=$1 AND is_enabled",
          [m.targetBatchId]
        )
      ).rows[0];
      if (!b || b.batch_order >= a.batch_order)
        throw new ApiError(409, "Only upward upgrades are permitted.");
      const rates = (
        await c.query(
          `SELECT * FROM advertisement_rate_cards WHERE placement_id=$1 AND pricing_unit='DAY' AND status='ACTIVE' AND effective_from <= $2 AND (effective_to IS NULL OR effective_to > $2) FOR SHARE`,
          [b.pricing_placement_id, start]
        )
      ).rows;
      if (rates.length !== 1 || rates[0].currency_code !== a.currency_code)
        throw new ApiError(409, "Compatible target rate required.");
      const r = rates[0];
      let amount: number;
      try {
        amount = additionalAmount(
          a.rate_amount,
          r.rate_amount,
          dailyQuantity(start, end)
        );
      } catch {
        throw new ApiError(409, "Target price must exceed source price.");
      }
      const peak = (
        await c.query(
          `WITH booked AS (SELECT reserved_start_at s,reserved_end_at e FROM advertisement_feed_assignments WHERE batch_id=$1 UNION ALL SELECT reserved_start_at,reserved_end_at FROM advertisement_feed_upgrades WHERE target_batch_id=$1 AND status='PENDING'), points AS (SELECT $2::timestamptz t UNION SELECT s FROM booked WHERE s >= $2 AND s < $3) SELECT COALESCE(MAX((SELECT count(*) FROM booked WHERE s<=t AND e>t)),0)::int peak FROM points`,
          [m.targetBatchId, start, end]
        )
      ).rows[0].peak;
      if (peak >= b.capacity)
        throw new ApiError(409, "Destination batch capacity exceeded.");
      result.push(
        (
          await c.query(
            `INSERT INTO advertisement_feed_upgrades(request_id,advertisement_id,source_batch_id,target_batch_id,source_rate_card_id,target_rate_card_id,source_rate_amount,target_rate_amount,additional_amount,currency_code,reserved_start_at,reserved_end_at,requested_by,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$13) RETURNING *`,
            [
              input.requestId,
              m.advertisementId,
              m.sourceBatchId,
              m.targetBatchId,
              a.rate_card_id,
              r.id,
              a.rate_amount,
              r.rate_amount,
              amount,
              a.currency_code,
              start,
              end,
              actor
            ]
          )
        ).rows[0]
      );
    }
    return result;
  });
}
export function cancelRequest(id: number, actor: number) {
  return transaction(async (c) => {
    const r = await c.query(
      `UPDATE advertisement_feed_upgrades SET status='CANCELLED',updated_by=$2,updated_at=now() WHERE id=$1 AND status='PENDING' AND financial_approval_id IS NULL RETURNING *`,
      [id, actor]
    );
    if (!r.rowCount) throw new ApiError(409, "Request cannot be cancelled.");
    return r.rows[0];
  });
}
