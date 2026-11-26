import * as finance from "./upgrade-finance.controller.js";
import * as upgrade from "./upgrade.controller.js";
import { Router } from "express";
import { authorize } from "../../security/middleware/authorize.middleware.js";
import * as controller from "./sponsored-feed.controller.js";
import * as inventory from "./inventory.controller.js";
import { z } from "zod";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import { sendSuccess } from "../../../../shared/utils/response.js";
import { metrics } from "./public-feed.repository.js";
import { pool } from "../../../../shared/config/db.js";
import {
  transaction,
  updateCapacity,
  validateCapacity
} from "./inventory.repository.js";
import { dailyQuantity } from "./inventory.validation.js";
import { idSchema } from "./sponsored-feed.validation.js";
const router = Router();

// Edit only the client and campaign window of an unsubmitted Sponsored Ad draft.
router.patch(
  "/drafts/:advertisementId",
  authorize("ADVERTISEMENT", "advertisements", "update"),
  async (req, res, next) => {
    try {
      const id = idSchema.safeParse(req.params.advertisementId);
      const body = z
        .object({
          clientId: z.number().int().positive().optional(),
          startAt: z.string().datetime({ offset: true }).optional(),
          endAt: z.string().datetime({ offset: true }).optional()
        })
        .strict()
        .refine(
          (v) => Object.keys(v).length > 0,
          "Provide a client or schedule change."
        )
        .safeParse(req.body);
      if (!id.success || !body.success)
        throw new ApiError(400, "Invalid Sponsored Ad draft update.");
      const actor = req.user?.id;
      if (
        typeof actor !== "number" ||
        !Number.isSafeInteger(actor) ||
        actor <= 0
      )
        throw new ApiError(401, "Authentication required.");
      const result = await transaction(async (c) => {
        const a = (
          await c.query(`SELECT * FROM advertisements WHERE id=$1 FOR UPDATE`, [
            id.data
          ])
        ).rows[0];
        if (!a) throw new ApiError(404, "Sponsored Ad not found.");
        if (a.advertisement_type !== "NATIVE" || a.is_house_ad)
          throw new ApiError(
            409,
            "This edit action is only available for paid Sponsored Ads."
          );
        if (a.workflow_status !== "DRAFT" || a.status !== "DRAFT")
          throw new ApiError(
            409,
            "Client and campaign changes are allowed only before the advertisement is submitted."
          );
        if (body.data.clientId !== undefined) {
          const client = (
            await c.query(
              "SELECT id FROM advertisement_clients WHERE id=$1 AND status='ACTIVE'",
              [body.data.clientId]
            )
          ).rows[0];
          if (!client)
            throw new ApiError(409, "Select an active advertisement client.");
        }
        const scheduleChanged =
          body.data.startAt !== undefined || body.data.endAt !== undefined;
        let start = a.start_at,
          end = a.end_at;
        if (scheduleChanged) {
          if (body.data.startAt === undefined || body.data.endAt === undefined)
            throw new ApiError(
              400,
              "Both campaign start and end are required when changing the schedule."
            );
          start = new Date(body.data.startAt);
          end = new Date(body.data.endAt);
          if (
            !Number.isFinite(start.getTime()) ||
            !Number.isFinite(end.getTime()) ||
            end <= start
          )
            throw new ApiError(
              400,
              "Campaign end must be later than campaign start."
            );
        }
        const assignment = (
          await c.query(
            "SELECT * FROM advertisement_feed_assignments WHERE advertisement_id=$1 FOR UPDATE",
            [id.data]
          )
        ).rows[0];
        if (scheduleChanged && !assignment)
          throw new ApiError(
            409,
            "Reserve a batch before changing the Sponsored Ad campaign schedule."
          );
        // Client attribution is immutable once money has been received for the
        // original client. Pending-only payment requests do not count as money received.
        if (body.data.clientId !== undefined) {
          const received = await c.query(
            `
          SELECT EXISTS (
            SELECT 1 FROM advertisement_payments
            WHERE advertisement_id = $1
              AND payment_status IN ('RECEIVED', 'VERIFIED')
          ) AS has_received_payment
        `,
            [id.data]
          );
          if (received.rows[0]?.has_received_payment) {
            throw new ApiError(
              409,
              "The client cannot be changed because payment has already been received against the current client."
            );
          }
        }

        // Schedule changes may proceed with existing payment history. Received
        // payments remain untouched; the updated advertisement amount becomes
        // the basis for the revised outstanding balance in the Payments section.
        const deps = await c.query(
          `
        SELECT
          EXISTS (
            SELECT 1 FROM advertisement_financial_approvals
            WHERE advertisement_id = $1
              AND status IN ('SUBMITTED', 'HOLD', 'APPROVED')
          ) AS has_live_approval,
          EXISTS (
            SELECT 1 FROM advertisement_feed_upgrades
            WHERE advertisement_id = $1
              AND status IN ('PENDING', 'APPLIED')
          ) AS has_live_upgrade
      `,
          [id.data]
        );
        const blockers = deps.rows[0] ?? {};
        const hasCommercialCommitment =
          Number(a.discount_percentage || 0) !== 0 ||
          Number(a.discount_amount || 0) !== 0 ||
          Number(a.advance_percentage || 0) !== 0 ||
          Number(a.advance_amount || 0) !== 0 ||
          Number(a.adjustment_amount || 0) !== 0;
        if (
          blockers.has_live_approval ||
          blockers.has_live_upgrade ||
          hasCommercialCommitment
        ) {
          const reasons: string[] = [];
          if (blockers.has_live_approval)
            reasons.push("a pending or approved financial request");
          if (blockers.has_live_upgrade)
            reasons.push("a pending or applied batch upgrade");
          if (hasCommercialCommitment)
            reasons.push("existing discount, advance or adjustment terms");
          throw new ApiError(
            409,
            `The campaign schedule cannot be changed while ${reasons.join(", ")} exists. Please resolve the financial commitment first.`
          );
        }
        if (assignment && assignment.activated_at)
          throw new ApiError(
            409,
            "An activated Sponsored Ad cannot be reassigned or rescheduled."
          );
        let rate: any = null,
          quantity = 0,
          amount = Number(a.advertisement_amount || 0),
          standard = Number(a.standard_amount || 0);
        if (scheduleChanged) {
          const batch = (
            await c.query(
              "SELECT b.* FROM advertisement_feed_batches b WHERE b.id=$1 AND b.is_enabled",
              [assignment.batch_id]
            )
          ).rows[0];
          if (!batch)
            throw new ApiError(
              409,
              "The reserved batch is no longer enabled. Reassign an enabled batch first."
            );
          const rates = (
            await c.query(
              `SELECT * FROM advertisement_rate_cards WHERE placement_id=$1 AND pricing_unit='DAY' AND status='ACTIVE' AND effective_from <= $2 AND (effective_to IS NULL OR effective_to > $2)`,
              [batch.pricing_placement_id, start]
            )
          ).rows;
          if (rates.length === 0)
            throw new ApiError(
              409,
              "No active daily rate covers the new campaign start date for the assigned Sponsored Ad batch. Configure an effective daily rate in Sponsored Ad Configuration, then save the schedule again. No amounts or reservations were changed."
            );
          if (rates.length > 1)
            throw new ApiError(
              409,
              "Multiple active daily rates cover the selected start date. Resolve overlapping batch rate periods before rescheduling."
            );
          rate = rates[0];
          quantity = dailyQuantity(new Date(start), new Date(end));
          const peak = (
            await c.query(
              `WITH booked AS (SELECT reserved_start_at s,reserved_end_at e FROM advertisement_feed_assignments WHERE batch_id=$1 AND advertisement_id<>$2 AND reserved_start_at<$4 AND reserved_end_at>$3 UNION ALL SELECT reserved_start_at,reserved_end_at FROM advertisement_feed_upgrades WHERE target_batch_id=$1 AND status='PENDING' AND reserved_start_at<$4 AND reserved_end_at>$3), points AS (SELECT $3::timestamptz t UNION SELECT s FROM booked WHERE s >= $3) SELECT COALESCE(MAX((SELECT count(*) FROM booked WHERE s<=t AND e>t)),0)::int peak FROM points`,
              [assignment.batch_id, id.data, start, end]
            )
          ).rows[0].peak;
          if (peak >= batch.capacity)
            throw new ApiError(
              409,
              "The reserved batch does not have capacity for the complete new campaign window."
            );
          standard = Number((quantity * Number(rate.rate_amount)).toFixed(2));
          amount = Number(
            (
              standard -
              (standard * Number(a.discount_percentage || 0)) / 100
            ).toFixed(2)
          );
        }
        const sets: string[] = [];
        const vals: any[] = [];
        if (body.data.clientId !== undefined) {
          vals.push(body.data.clientId);
          sets.push(`client_id=$${vals.length}`);
        }
        if (scheduleChanged) {
          vals.push(start);
          sets.push(`start_at=$${vals.length}`);
          vals.push(end);
          sets.push(`end_at=$${vals.length}`);
          vals.push(standard);
          sets.push(`standard_amount=$${vals.length}`);
          vals.push(amount);
          sets.push(`advertisement_amount=$${vals.length}`);
          vals.push(quantity);
          sets.push(`pricing_quantity=$${vals.length}`);
        }
        vals.push(actor);
        sets.push(`updated_by=$${vals.length}`, `updated_at=CURRENT_TIMESTAMP`);
        vals.push(id.data);
        const updated = (
          await c.query(
            `UPDATE advertisements SET ${sets.join(",")} WHERE id=$${vals.length} RETURNING id,client_id,start_at,end_at,standard_amount,advertisement_amount`,
            vals
          )
        ).rows[0];
        if (scheduleChanged) {
          await c.query(
            `UPDATE advertisement_feed_assignments SET rate_card_id=$2,reserved_start_at=$3,reserved_end_at=$4,assigned_rate_amount=$5,updated_by=$6,updated_at=CURRENT_TIMESTAMP WHERE advertisement_id=$1`,
            [id.data, rate.id, start, end, rate.rate_amount, actor]
          );
          await c.query(
            `INSERT INTO advertisement_pricing_snapshots(advertisement_id,placement_id,rate_card_id,pricing_unit,rate_amount,currency_code,rate_effective_from,rate_effective_to,quantity,standard_amount,created_by) SELECT $1,pricing_placement_id,$2,'DAY',$3,$4,$5,$6,$7,$8,$9 FROM advertisement_feed_batches WHERE id=$10`,
            [
              id.data,
              rate.id,
              rate.rate_amount,
              rate.currency_code,
              rate.effective_from,
              rate.effective_to,
              quantity,
              standard,
              actor,
              assignment.batch_id
            ]
          );
        }
        return updated;
      });
      sendSuccess(res, "Sponsored Ad draft updated successfully.", result);
    } catch (e) {
      next(e);
    }
  }
);
router.get(
  "/admin-list",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  async (req, res, next) => {
    try {
      const input = z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          search: z.string().trim().max(250).default("")
        })
        .safeParse(req.query);
      if (!input.success) throw new ApiError(400, "Invalid search parameters.");
      const { page, search } = input.data;
      const result = await pool.query(
        `SELECT a.id::text id,a.name,a.workflow_status AS "workflowStatus",a.status,c.name AS "clientName" FROM advertisements a LEFT JOIN advertisement_clients c ON c.id=a.client_id WHERE a.advertisement_type='NATIVE' AND NOT a.is_house_ad AND ($1='' OR a.name ILIKE '%'||$1||'%' OR c.name ILIKE '%'||$1||'%') ORDER BY a.created_at DESC,a.id DESC LIMIT 20 OFFSET $2`,
        [search, (page - 1) * 20]
      );
      const count = await pool.query(
        `SELECT count(*)::int total FROM advertisements a LEFT JOIN advertisement_clients c ON c.id=a.client_id WHERE a.advertisement_type='NATIVE' AND NOT a.is_house_ad AND ($1='' OR a.name ILIKE '%'||$1||'%' OR c.name ILIKE '%'||$1||'%')`,
        [search]
      );
      sendSuccess(res, "Sponsored advertisements retrieved.", {
        items: result.rows.map((row) => ({ ...row, id: Number(row.id) })),
        total: count.rows[0]?.total ?? 0
      });
    } catch (e) {
      next(e);
    }
  }
);
// Configuration endpoints consumed by SponsoredFeedAdminPage.
router.get(
  "/capacity-settings",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  async (_req, res, next) => {
    try {
      const {
        rows: [limits]
      } = await pool.query(
        'SELECT min_capacity AS min, max_capacity AS max, default_capacity AS "default" FROM advertisement_feed_capacity_settings WHERE id=1'
      );
      if (!limits)
        throw new ApiError(409, "Batch capacity settings are not configured.");
      sendSuccess(res, "Capacity settings retrieved.", limits);
    } catch (e) {
      next(e);
    }
  }
);
router.get(
  "/dashboard",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  async (_req, res, next) => {
    try {
      const {
        rows: [summary]
      } = await pool.query(`SELECT
      (SELECT count(*)::int FROM advertisements WHERE advertisement_type='NATIVE' AND NOT is_house_ad) AS ads,
      (SELECT count(*)::int FROM advertisements a JOIN advertisement_feed_assignments f ON f.advertisement_id=a.id JOIN advertisement_feed_batches b ON b.id=f.batch_id WHERE a.advertisement_type='NATIVE' AND NOT a.is_house_ad AND a.status='ACTIVE' AND b.is_enabled AND f.activated_at IS NOT NULL AND f.reserved_start_at<=now() AND f.reserved_end_at>now()) AS active,
      (SELECT count(*)::int FROM advertisement_feed_batches) AS batches,
      (SELECT count(*)::int FROM advertisement_feed_upgrades WHERE status='PENDING') AS upgrades,
      (SELECT count(*)::int FROM advertisement_impressions WHERE feed_batch_id IS NOT NULL) AS impressions`);
      sendSuccess(res, "Dashboard retrieved.", summary);
    } catch (e) {
      next(e);
    }
  }
);
router.put(
  "/batches/:batchId",
  authorize("ADVERTISEMENT", "advertisements.placements", "update"),
  async (req, res, next) => {
    try {
      const id = idSchema.safeParse(req.params.batchId);
      const body = z
        .object({
          displayName: z.string().trim().min(1).max(150),
          batchOrder: z.number().int().min(1).max(1000),
          capacity: z.number().int().min(1).max(32767),
          isEnabled: z.boolean()
        })
        .strict()
        .safeParse(req.body);
      if (!id.success || !body.success)
        throw new ApiError(400, "Invalid batch details.");
      const actor = req.user?.id;
      if (
        typeof actor !== "number" ||
        !Number.isSafeInteger(actor) ||
        actor <= 0
      )
        throw new ApiError(401, "Authentication required.");
      const batchId = id.data;
      const input = body.data;
      const result = await transaction(async (c) => {
        const current = (
          await c.query(
            "SELECT * FROM advertisement_feed_batches WHERE id=$1 FOR UPDATE",
            [batchId]
          )
        ).rows[0];
        if (!current) throw new ApiError(404, "Batch not found.");
        const capacity = await validateCapacity(c, input.capacity);
        if (
          (
            await c.query(
              "SELECT 1 FROM advertisement_feed_batches WHERE batch_order=$1 AND id<>$2",
              [input.batchOrder, batchId]
            )
          ).rowCount
        )
          throw new ApiError(409, "Display order already exists.");
        const peak = (
          await c.query(
            `WITH booked AS (SELECT reserved_start_at s,reserved_end_at e FROM advertisement_feed_assignments WHERE batch_id=$1 AND reserved_end_at>now() UNION ALL SELECT reserved_start_at,reserved_end_at FROM advertisement_feed_upgrades WHERE target_batch_id=$1 AND status='PENDING' AND reserved_end_at>now()), points AS (SELECT now() t UNION SELECT s FROM booked WHERE s>now()) SELECT COALESCE(MAX((SELECT count(*) FROM booked WHERE s<=t AND e>t)),0)::int peak FROM points`,
            [batchId]
          )
        ).rows[0].peak;
        if (peak > capacity)
          throw new ApiError(
            409,
            `At least ${peak} positions are reserved concurrently.`
          );
        if (!input.isEnabled && current.is_enabled && peak > 0)
          throw new ApiError(
            409,
            "Batch has current or future reservations; disabling is not allowed."
          );
        await c.query(
          "UPDATE advertisement_placements SET display_name=$2,updated_by=$3,updated_at=now() WHERE id=$1",
          [current.pricing_placement_id, input.displayName, actor]
        );
        return (
          await c.query(
            "UPDATE advertisement_feed_batches SET display_name=$2,batch_order=$3,capacity=$4,is_enabled=$5,updated_by=$6,updated_at=now() WHERE id=$1 RETURNING *",
            [
              batchId,
              input.displayName,
              input.batchOrder,
              capacity,
              input.isEnabled,
              actor
            ]
          )
        ).rows[0];
      });
      sendSuccess(res, "Batch updated successfully.", result);
    } catch (e) {
      next(e);
    }
  }
);
router.put(
  "/batches/:batchId/capacity",
  authorize("ADVERTISEMENT", "advertisements.placements", "update"),
  async (req, res, next) => {
    try {
      const id = idSchema.safeParse(req.params.batchId);
      const body = z
        .object({ capacity: z.number().int().min(1).max(32767) })
        .strict()
        .safeParse(req.body);
      if (!id.success || !body.success)
        throw new ApiError(400, "Invalid batch capacity request.");
      const actor = req.user?.id;
      if (
        typeof actor !== "number" ||
        !Number.isSafeInteger(actor) ||
        actor <= 0
      )
        throw new ApiError(401, "Authentication required.");
      sendSuccess(
        res,
        "Batch capacity updated.",
        await updateCapacity(id.data, body.data.capacity, actor)
      );
    } catch (e) {
      next(e);
    }
  }
);
router.put(
  "/batches/:batchId/enabled",
  authorize("ADVERTISEMENT", "advertisements.placements", "update"),
  async (req, res, next) => {
    try {
      const id = idSchema.safeParse(req.params.batchId);
      const body = z
        .object({ isEnabled: z.boolean() })
        .strict()
        .safeParse(req.body);
      if (!id.success || !body.success)
        throw new ApiError(400, "Invalid batch status request.");
      const actor = req.user?.id;
      if (
        typeof actor !== "number" ||
        !Number.isSafeInteger(actor) ||
        actor <= 0
      )
        throw new ApiError(401, "Authentication required.");
      const result = await transaction(async (c) => {
        if (
          !body.data.isEnabled &&
          (
            await c.query(
              "SELECT 1 FROM advertisement_feed_assignments WHERE batch_id=$1 AND reserved_end_at>now() UNION ALL SELECT 1 FROM advertisement_feed_upgrades WHERE target_batch_id=$1 AND status='PENDING' AND reserved_end_at>now()",
              [id.data]
            )
          ).rowCount
        )
          throw new ApiError(
            409,
            "Batch has current or future reservations; disabling is not allowed."
          );
        const r = await c.query(
          "UPDATE advertisement_feed_batches SET is_enabled=$2,updated_by=$3,updated_at=now() WHERE id=$1 RETURNING id",
          [id.data, body.data.isEnabled, actor]
        );
        if (!r.rowCount) throw new ApiError(404, "Batch not found.");
        return r.rows[0];
      });
      sendSuccess(res, "Batch status updated.", result);
    } catch (e) {
      next(e);
    }
  }
);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return (
      Number.isFinite(d.getTime()) &&
      d.toISOString().slice(0, 10) === v &&
      !v.startsWith("0000")
    );
  });
router.get(
  "/metrics",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  async (req, res, next) => {
    try {
      const p = z.object({ from: date, to: date }).safeParse(req.query);
      if (!p.success || p.data.from > p.data.to)
        throw new ApiError(400, "Valid from and to dates are required.");
      sendSuccess(
        res,
        "Sponsored feed metrics retrieved.",
        await metrics(p.data.from, p.data.to)
      );
    } catch (e) {
      next(e);
    }
  }
);
router.get(
  "/batches",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  controller.listBatches
);
router.get(
  "/cards/:advertisementId",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  controller.getCard
);
router.put(
  "/cards/:advertisementId",
  authorize("ADVERTISEMENT", "advertisements", "update"),
  controller.putCard
);
router.post(
  "/batches",
  authorize("ADVERTISEMENT", "advertisements.placements", "create"),
  inventory.createBatch
);
router.post(
  "/batches/:batchId/rates",
  authorize("ADVERTISEMENT", "advertisements", "create"),
  inventory.createRate
);
router.get(
  "/batches/:batchId/rates",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  inventory.listRates
);
// Batch-scoped daily rate updates. Keep booked pricing snapshots immutable.
const rateUpdateInput = z
  .object({
    rateAmount: z
      .number()
      .positive()
      .max(999999999999)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.001),
    effectiveFrom: z.string().datetime({ offset: true }),
    effectiveTo: z.string().datetime({ offset: true }).nullable(),
    isEnabled: z.boolean()
  })
  .strict()
  .refine(
    (v) =>
      !v.effectiveTo || Date.parse(v.effectiveTo) > Date.parse(v.effectiveFrom)
  );
const rateStatusInput = z.object({ isEnabled: z.boolean() }).strict();
async function changeBatchRate(
  batchId: number,
  rateId: number,
  actor: number,
  input: z.infer<typeof rateUpdateInput> | z.infer<typeof rateStatusInput>
) {
  return transaction(async (c) => {
    const current = (
      await c.query(
        `SELECT r.*, b.is_enabled FROM advertisement_rate_cards r JOIN advertisement_feed_batches b ON b.pricing_placement_id=r.placement_id WHERE b.id=$1 AND r.id=$2 AND r.pricing_unit='DAY' FOR UPDATE OF r`,
        [batchId, rateId]
      )
    ).rows[0];
    if (!current)
      throw new ApiError(404, "Daily rate not found for this batch.");
    if (!current.is_enabled || current.status === "ARCHIVED")
      throw new ApiError(
        409,
        "Only rates of enabled batches that are not archived can be edited."
      );
    const amount =
      "rateAmount" in input ? input.rateAmount : current.rate_amount;
    const from =
      "effectiveFrom" in input ? input.effectiveFrom : current.effective_from;
    const to =
      "effectiveTo" in input ? input.effectiveTo : current.effective_to;
    const status = input.isEnabled ? "ACTIVE" : "INACTIVE";
    if (
      input.isEnabled &&
      (
        await c.query(
          `SELECT 1 FROM advertisement_rate_cards WHERE placement_id=$1 AND id<>$2 AND pricing_unit='DAY' AND status='ACTIVE'`,
          [current.placement_id, rateId]
        )
      ).rowCount
    )
      throw new ApiError(
        409,
        "This batch already has another active daily rate. Disable it first."
      );
    return (
      await c.query(
        `UPDATE advertisement_rate_cards SET rate_amount=$2,effective_from=$3,effective_to=$4,status=$5,updated_by=$6,updated_at=now() WHERE id=$1 RETURNING *`,
        [rateId, amount, from, to, status, actor]
      )
    ).rows[0];
  });
}
router.put(
  "/batches/:batchId/rates/:rateId",
  authorize("ADVERTISEMENT", "advertisements", "update"),
  async (req, res, next) => {
    try {
      const b = idSchema.safeParse(req.params.batchId),
        r = idSchema.safeParse(req.params.rateId),
        body = rateUpdateInput.safeParse(req.body);
      if (!b.success || !r.success || !body.success)
        throw new ApiError(400, "Invalid daily rate or effective period.");
      const actor = req.user?.id;
      if (
        typeof actor !== "number" ||
        !Number.isSafeInteger(actor) ||
        actor <= 0
      )
        throw new ApiError(401, "Authentication required.");
      sendSuccess(
        res,
        "Rate updated successfully.",
        await changeBatchRate(b.data, r.data, actor, body.data)
      );
    } catch (e) {
      next(e);
    }
  }
);
router.put(
  "/batches/:batchId/rates/:rateId/status",
  authorize("ADVERTISEMENT", "advertisements", "update"),
  async (req, res, next) => {
    try {
      const b = idSchema.safeParse(req.params.batchId),
        r = idSchema.safeParse(req.params.rateId),
        body = rateStatusInput.safeParse(req.body);
      if (!b.success || !r.success || !body.success)
        throw new ApiError(400, "Invalid rate status request.");
      const actor = req.user?.id;
      if (
        typeof actor !== "number" ||
        !Number.isSafeInteger(actor) ||
        actor <= 0
      )
        throw new ApiError(401, "Authentication required.");
      sendSuccess(
        res,
        "Rate status updated.",
        await changeBatchRate(b.data, r.data, actor, body.data)
      );
    } catch (e) {
      next(e);
    }
  }
);
router.put(
  "/assignments/:advertisementId",
  authorize("ADVERTISEMENT", "advertisements", "update"),
  inventory.assign
);
router.get(
  "/assignments/:advertisementId",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  inventory.readAssignment
);
router.post(
  "/upgrades",
  authorize("ADVERTISEMENT", "advertisements", "update"),
  upgrade.save
);
router.post(
  "/upgrades/:id/cancel",
  authorize("ADVERTISEMENT", "advertisements", "update"),
  upgrade.cancel
);
// Paginated, read-only upgrade history across all Sponsored Ads.
router.get(
  "/upgrades/history",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  async (req, res, next) => {
    try {
      const input = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(10),
          status: z
            .enum(["PENDING", "APPLIED", "CANCELLED", "REJECTED"])
            .optional(),
          search: z.string().trim().max(100).optional()
        })
        .safeParse(req.query);
      if (!input.success)
        throw new ApiError(400, "Invalid upgrade history filters.");
      const { page, pageSize, status, search } = input.data;
      const where = ["1=1"];
      const values: unknown[] = [];
      if (status) {
        values.push(status);
        where.push(`u.status=$${values.length}`);
      }
      if (search) {
        values.push(`%${search}%`);
        where.push(
          `(a.id::text ILIKE $${values.length} OR a.name ILIKE $${values.length} OR cl.name ILIKE $${values.length})`
        );
      }
      const from = `FROM advertisement_feed_upgrades u
        JOIN advertisements a ON a.id=u.advertisement_id
        LEFT JOIN advertisement_clients cl ON cl.id=a.client_id
        JOIN advertisement_feed_batches sb ON sb.id=u.source_batch_id
        JOIN advertisement_feed_batches tb ON tb.id=u.target_batch_id
        LEFT JOIN advertisement_financial_approvals fa ON fa.id=u.financial_approval_id
        WHERE ${where.join(" AND ")}`;
      const count = await pool.query(
        `SELECT count(*)::int AS total ${from}`,
        values
      );
      const data = await pool.query(
        `SELECT u.*, a.name AS advertisement_name,
          cl.name AS client_name, sb.display_name AS source_batch_name,
          tb.display_name AS target_batch_name, fa.status AS approval_status
          ${from} ORDER BY u.created_at DESC, u.id DESC
          LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, pageSize, (page - 1) * pageSize]
      );
      sendSuccess(res, "Upgrade history retrieved.", {
        items: data.rows,
        total: count.rows[0]?.total ?? 0,
        page,
        pageSize
      });
    } catch (error) {
      next(error);
    }
  }
);
router.get(
  "/upgrades/advertisement/:id",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  finance.list
);
router.post(
  "/upgrades/:id/submit-finance",
  authorize("ADVERTISEMENT", "advertisements", "submit"),
  finance.submit
);
router.post(
  "/upgrades/:id/charge",
  authorize("ADVERTISEMENT", "advertisements.financial_approvals", "approve"),
  finance.charge
);
router.post(
  "/upgrades/:id/complete",
  authorize("ADVERTISEMENT", "advertisements.financial_approvals", "approve"),
  finance.complete
);
router.post(
  "/upgrades/:id/release-rejected",
  authorize("ADVERTISEMENT", "advertisements.financial_approvals", "reject"),
  finance.reject
);
export default router;
