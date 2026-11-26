import { transaction } from "./inventory.repository.js";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import { fullApproval } from "./upgrade-finance.rules.js";
import { pool } from "../../../../shared/config/db.js";
import type { PoolClient } from "pg";
import { getSummary } from "../payments/payment.repository.js";
async function locked(c: PoolClient, id: number) {
  const u = (
    await c.query(
      "SELECT * FROM advertisement_feed_upgrades WHERE id=$1 FOR UPDATE",
      [id]
    )
  ).rows[0];
  if (!u) throw new ApiError(404, "Upgrade not found.");
  const a = (
    await c.query("SELECT * FROM advertisements WHERE id=$1 FOR UPDATE", [
      u.advertisement_id
    ])
  ).rows[0];
  const f = (
    await c.query(
      "SELECT * FROM advertisement_feed_assignments WHERE advertisement_id=$1 FOR UPDATE",
      [u.advertisement_id]
    )
  ).rows[0];
  if (!a || !f) throw new ApiError(409, "Reservation missing.");
  return { u, a, f };
}
function check(u: any, a: any, f: any) {
  if (
    u.status !== "PENDING" ||
    !["DRAFT", "REJECTED", "APPROVED"].includes(a.workflow_status) ||
    String(f.batch_id) !== String(u.source_batch_id) ||
    String(f.rate_card_id) !== String(u.source_rate_card_id) ||
    !u.reserved_end_at ||
    new Date(u.reserved_end_at) <= new Date() ||
    String(f.reserved_end_at) !== String(u.reserved_end_at)
  )
    throw new ApiError(409, "Upgrade is no longer eligible.");
}
export async function listUpgrades(adId: number) {
  return (
    await pool.query(
      `SELECT u.*,fa.status AS approval_status FROM advertisement_feed_upgrades u LEFT JOIN advertisement_financial_approvals fa ON fa.id=u.financial_approval_id WHERE u.advertisement_id=$1 ORDER BY u.id DESC`,
      [adId]
    )
  ).rows;
}
export function submitFinance(id: number, actor: number) {
  return transaction(async (c) => {
    const { u, a, f } = await locked(c, id);
    check(u, a, f);
    if (u.financial_approval_id) return u;
    if (
      (
        await c.query(
          `SELECT 1 FROM advertisement_financial_approvals WHERE advertisement_id=$1 AND approval_type='ADJUSTMENT' AND status IN ('SUBMITTED','HOLD')`,
          [a.id]
        )
      ).rowCount
    )
      throw new ApiError(409, "Another adjustment is pending.");
    const approval = (
      await c.query(
        `INSERT INTO advertisement_financial_approvals(advertisement_id,client_id,approval_type,requested_amount,requested_by,approval_remarks) VALUES($1,$2,'ADJUSTMENT',$3,$4,$5) RETURNING id`,
        [
          a.id,
          a.client_id,
          u.additional_amount,
          actor,
          `Sponsored feed upgrade ${id}`
        ]
      )
    ).rows[0];
    await c.query(
      `INSERT INTO advertisement_financial_approval_history(approval_id,to_status,action_by,remarks) VALUES($1,'SUBMITTED',$2,$3)`,
      [approval.id, actor, `Sponsored feed upgrade ${id}`]
    );
    return (
      await c.query(
        "UPDATE advertisement_feed_upgrades SET financial_approval_id=$2,updated_by=$3,updated_at=now() WHERE id=$1 RETURNING *",
        [id, approval.id, actor]
      )
    ).rows[0];
  });
}
async function approval(c: PoolClient, u: any) {
  const r = (
    await c.query(
      "SELECT * FROM advertisement_financial_approvals WHERE id=$1 FOR UPDATE",
      [u.financial_approval_id]
    )
  ).rows[0];
  if (
    !r ||
    String(r.advertisement_id) !== String(u.advertisement_id) ||
    r.approval_type !== "ADJUSTMENT" ||
    !fullApproval(
      r.status,
      r.revoked_at,
      r.requested_amount,
      r.approved_amount,
      u.additional_amount
    )
  )
    throw new ApiError(409, "Full financial approval required.");
}
export function charge(id: number, actor: number) {
  return transaction(async (c) => {
    const { u, a, f } = await locked(c, id);
    check(u, a, f);
    await approval(c, u);
    if (u.charged_at) return u;
    if (a.advertisement_amount == null || Number(a.advertisement_amount) <= 0)
      throw new ApiError(409, "Original commercial amount missing.");
    const row = (
      await c.query(
        "UPDATE advertisement_feed_upgrades SET charged_at=now(),charged_by=$2,amount_before_charge=$3,updated_by=$2,updated_at=now() WHERE id=$1 RETURNING *",
        [id, actor, a.advertisement_amount]
      )
    ).rows[0];
    await c.query(
      "UPDATE advertisements SET advertisement_amount=advertisement_amount+$2::numeric,updated_by=$3,updated_at=now() WHERE id=$1",
      [a.id, u.additional_amount, actor]
    );
    return row;
  });
}
export function complete(id: number, actor: number) {
  return transaction(async (c) => {
    const { u, a, f } = await locked(c, id);
    if (u.status === "APPLIED") return u;
    check(u, a, f);
    await approval(c, u);
    if (!u.charged_at) throw new ApiError(409, "Apply approved charge first.");
    const summary = await getSummary(Number(a.id), c);
    if (
      !summary ||
      summary.outstandingAmount == null ||
      summary.outstandingAmount > 0
    )
      throw new ApiError(409, "Full verified payment required.");
    const b = (
      await c.query(
        "SELECT * FROM advertisement_feed_batches WHERE id=$1 AND is_enabled FOR SHARE",
        [u.target_batch_id]
      )
    ).rows[0];
    if (!b) throw new ApiError(409, "Destination disabled.");
    // Pending destination reservation is converted atomically under the shared inventory lock.
    await c.query(
      `UPDATE advertisement_feed_assignments SET batch_id=$2,rate_card_id=$3,assigned_rate_amount=$4,batch_assigned_at=clock_timestamp(),reserved_start_at=GREATEST(reserved_start_at,$5::timestamptz),assigned_by=$6,updated_by=$6,updated_at=now() WHERE advertisement_id=$1`,
      [
        a.id,
        u.target_batch_id,
        u.target_rate_card_id,
        u.target_rate_amount,
        u.reserved_start_at,
        actor
      ]
    );
    return (
      await c.query(
        `UPDATE advertisement_feed_upgrades SET status='APPLIED',applied_at=now(),applied_by=$2,updated_by=$2,updated_at=now() WHERE id=$1 RETURNING *`,
        [id, actor]
      )
    ).rows[0];
  });
}
export function rejectUncharged(id: number, actor: number) {
  return transaction(async (c) => {
    const { u } = await locked(c, id);
    if (u.status !== "PENDING" || u.charged_at || !u.financial_approval_id)
      throw new ApiError(
        409,
        "Only uncharged rejected upgrades can be released."
      );
    const r = (
      await c.query(
        "SELECT status FROM advertisement_financial_approvals WHERE id=$1 FOR UPDATE",
        [u.financial_approval_id]
      )
    ).rows[0];
    if (r?.status !== "REJECTED")
      throw new ApiError(409, "Financial approval is not rejected.");
    return (
      await c.query(
        `UPDATE advertisement_feed_upgrades SET status='REJECTED',updated_by=$2,updated_at=now() WHERE id=$1 RETURNING *`,
        [id, actor]
      )
    ).rows[0];
  });
}
