import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementPaymentFilters,
  AdvertisementPaymentListItem,
  AdvertisementPaymentRefund,
  AdvertisementPaymentSummary,
  CreateAdvertisementPaymentInput,
  CreateAdvertisementPaymentRefundInput,
  UpdateAdvertisementPaymentInput
} from "./payment.types.js";

import type {
  AdvertisementPaymentListRow,
  AdvertisementPaymentRefundRow,
  AdvertisementPaymentRow,
  AdvertisementPaymentSummaryRow
} from "./payment.schema.js";

type DbExecutor = typeof pool | PoolClient;

function mapPayment(row: AdvertisementPaymentRow): {
  id: number;
  advertisementId: number;
  amount: number;
  paymentType: AdvertisementPaymentRow["payment_type"];
  paymentDate: Date;
  paymentMethod: AdvertisementPaymentRow["payment_method"];
  paymentStatus: AdvertisementPaymentRow["payment_status"];
  transactionReference: string | null;
  notes: string | null;
  recordedBy: number | null;
  recordedAt: Date;
  verifiedBy: number | null;
  verifiedAt: Date | null;
  cancelledBy: number | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  refundedBy: number | null;
  refundedAt: Date | null;
  refundReference: string | null;
  refundReason: string | null;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: Number(row.id),
    advertisementId: Number(row.advertisement_id),
    amount: Number(row.amount),
    paymentType: row.payment_type,
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    transactionReference: row.transaction_reference,
    notes: row.notes,
    recordedBy: row.recorded_by === null ? null : Number(row.recorded_by),
    recordedAt: row.recorded_at,
    verifiedBy: row.verified_by === null ? null : Number(row.verified_by),
    verifiedAt: row.verified_at,
    cancelledBy: row.cancelled_by === null ? null : Number(row.cancelled_by),
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    refundedBy: row.refunded_by === null ? null : Number(row.refunded_by),
    refundedAt: row.refunded_at,
    refundReference: row.refund_reference,
    refundReason: row.refund_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPaymentListItem(
  row: AdvertisementPaymentListRow
): AdvertisementPaymentListItem {
  return {
    ...mapPayment(row),
    advertisementName: row.advertisement_name,
    clientId: row.client_id === null ? null : Number(row.client_id),
    clientName: row.client_name,
    clientCode: row.client_code,
    totalRefundedAmount: Number(row.total_refunded_amount),
    netPaidAmount: Number(row.net_paid_amount)
  };
}

function mapRefund(
  row: AdvertisementPaymentRefundRow
): AdvertisementPaymentRefund {
  return {
    id: Number(row.id),
    paymentId: Number(row.payment_id),
    amount: Number(row.amount),
    refundDate: row.refund_date,
    refundReference: row.refund_reference,
    refundReason: row.refund_reason,
    refundedBy: row.refunded_by === null ? null : Number(row.refunded_by),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSummary(
  row: AdvertisementPaymentSummaryRow
): AdvertisementPaymentSummary {
  const advertisementAmount =
    row.advertisement_amount === null ? null : Number(row.advertisement_amount);

  const discountAmount = Number(row.discount_amount);
  const adjustmentAmount = Number(row.adjustment_amount);
  const verifiedPaymentAmount = Number(row.verified_payment_amount);
  const refundedAmount = Number(row.refunded_amount);
  const netPaidAmount = Number(row.net_paid_amount);

  const advanceRequiredAmount = Number(row.advance_required_amount);
  const advanceReceivedAmount = Number(row.advance_received_amount);
  const advancePendingAmount = Number(row.advance_pending_amount);

  /*
   * advertisement_amount is the agreed amount after commercial discount.
   * Do not subtract discount_amount a second time. Advance is a collection
   * requirement, not an additional charge; the net payment ledger already
   * accounts for payments and refunds.
   */
  const outstandingAmount =
    advertisementAmount === null
      ? null
      : Math.max(0, advertisementAmount - adjustmentAmount - netPaidAmount);

  return {
    advertisementId: Number(row.advertisement_id),
    advertisementAmount,
    discountAmount,
    adjustmentAmount,
    verifiedPaymentAmount,
    refundedAmount,
    netPaidAmount,
    advanceRequiredAmount,
    advanceReceivedAmount,
    advancePendingAmount,
    outstandingAmount
  };
}

/**
 * Runs payment validation and insertion while holding a row lock on the
 * advertisement. All payment-creation paths should use this helper so
 * concurrent requests cannot overbook the same balance.
 */
export async function withAdvertisementLock<T>(
  advertisementId: number,
  operation: (executor: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<{ id: number }>(
      "SELECT id FROM advertisements WHERE id = $1 FOR UPDATE",
      [advertisementId]
    );

    if (result.rows[0] === undefined) {
      throw new Error("Advertisement not found.");
    }

    const value = await operation(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Amounts already recorded but not verified. These reserve the balance so
 * additional payment entries cannot collectively exceed the advertisement
 * amount. Advance reservations are also returned separately.
 */
export async function getUnsettledPaymentAmounts(
  advertisementId: number,
  executor: DbExecutor = pool
): Promise<{ total: number; advance: number }> {
  const result = await executor.query<{ total: string; advance: string }>(
    `
      SELECT
        COALESCE(SUM(amount), 0)::numeric AS total,
        COALESCE(
          SUM(CASE WHEN payment_type = 'ADVANCE' THEN amount ELSE 0 END),
          0
        )::numeric AS advance
      FROM advertisement_payments
      WHERE advertisement_id = $1
        AND payment_status IN ('PENDING', 'RECEIVED')
    `,
    [advertisementId]
  );

  return {
    total: Number(result.rows[0]?.total ?? 0),
    advance: Number(result.rows[0]?.advance ?? 0)
  };
}

export async function findById(
  id: number,
  executor: DbExecutor = pool
): Promise<ReturnType<typeof mapPayment> | null> {
  const result = await executor.query<AdvertisementPaymentRow>(
    `
    SELECT
      id,
      advertisement_id,
      amount,
      payment_type,
      payment_date,
      payment_method,
      payment_status,
      transaction_reference,
      notes,
      recorded_by,
      recorded_at,
      verified_by,
      verified_at,
      cancelled_by,
      cancelled_at,
      cancellation_reason,
      refunded_by,
      refunded_at,
      refund_reference,
      refund_reason,
      created_at,
      updated_at
    FROM advertisement_payments
    WHERE id = $1
    `,
    [id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapPayment(row);
}

export async function findRawById(
  id: number,
  executor: DbExecutor = pool
): Promise<AdvertisementPaymentRow | null> {
  const result = await executor.query<AdvertisementPaymentRow>(
    `
    SELECT
      id,
      advertisement_id,
      amount,
      payment_type,
      payment_date,
      payment_method,
      payment_status,
      transaction_reference,
      notes,
      recorded_by,
      recorded_at,
      verified_by,
      verified_at,
      cancelled_by,
      cancelled_at,
      cancellation_reason,
      refunded_by,
      refunded_at,
      refund_reference,
      refund_reason,
      created_at,
      updated_at
    FROM advertisement_payments
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function create(
  data: CreateAdvertisementPaymentInput,
  recordedBy: number | null,
  executor: DbExecutor = pool
): Promise<ReturnType<typeof mapPayment>> {
  const result = await executor.query<AdvertisementPaymentRow>(
    `
    INSERT INTO advertisement_payments
    (
      advertisement_id,
      amount,
      payment_type,
      payment_date,
      payment_method,
      payment_status,
      transaction_reference,
      notes,
      recorded_by,
      recorded_at,
      created_at,
      updated_at
    )
    VALUES
    (
      $1,
      $2,
      $3,
      COALESCE($4, NOW()),
      $5,
      'RECEIVED',
      $6,
      $7,
      $8,
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING
      id,
      advertisement_id,
      amount,
      payment_type,
      payment_date,
      payment_method,
      payment_status,
      transaction_reference,
      notes,
      recorded_by,
      recorded_at,
      verified_by,
      verified_at,
      cancelled_by,
      cancelled_at,
      cancellation_reason,
      refunded_by,
      refunded_at,
      refund_reference,
      refund_reason,
      created_at,
      updated_at
    `,
    [
      data.advertisementId,
      data.amount,
      data.paymentType,
      data.paymentDate ?? null,
      data.paymentMethod ?? null,
      data.transactionReference ?? null,
      data.notes ?? null,
      recordedBy
    ]
  );

  const row = result.rows[0];

  if (row === undefined) {
    throw new Error("Failed to create advertisement payment.");
  }

  return mapPayment(row);
}

export async function update(
  id: number,
  data: UpdateAdvertisementPaymentInput,
  executor: DbExecutor = pool
): Promise<ReturnType<typeof mapPayment> | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let parameterIndex = 1;

  if (data.amount !== undefined) {
    fields.push(`amount = $${parameterIndex}`);
    values.push(data.amount);
    parameterIndex += 1;
  }

  if (data.paymentType !== undefined) {
    fields.push(`payment_type = $${parameterIndex}`);
    values.push(data.paymentType);
    parameterIndex += 1;
  }

  if (data.paymentDate !== undefined) {
    fields.push(`payment_date = $${parameterIndex}`);
    values.push(data.paymentDate);
    parameterIndex += 1;
  }

  if (data.paymentMethod !== undefined) {
    fields.push(`payment_method = $${parameterIndex}`);
    values.push(data.paymentMethod);
    parameterIndex += 1;
  }

  if (data.transactionReference !== undefined) {
    fields.push(`transaction_reference = $${parameterIndex}`);
    values.push(data.transactionReference);
    parameterIndex += 1;
  }

  if (data.notes !== undefined) {
    fields.push(`notes = $${parameterIndex}`);
    values.push(data.notes);
    parameterIndex += 1;
  }

  if (fields.length === 0) {
    return findById(id, executor);
  }

  fields.push("updated_at = NOW()");

  values.push(id);

  const result = await executor.query<AdvertisementPaymentRow>(
    `
    UPDATE advertisement_payments
    SET
      ${fields.join(",\n      ")}
    WHERE id = $${parameterIndex}
    RETURNING
      id,
      advertisement_id,
      amount,
      payment_type,
      payment_date,
      payment_method,
      payment_status,
      transaction_reference,
      notes,
      recorded_by,
      recorded_at,
      verified_by,
      verified_at,
      cancelled_by,
      cancelled_at,
      cancellation_reason,
      refunded_by,
      refunded_at,
      refund_reference,
      refund_reason,
      created_at,
      updated_at
    `,
    values
  );

  const row = result.rows[0];

  return row === undefined ? null : mapPayment(row);
}

export async function verify(
  id: number,
  verifiedBy: number,
  executor: DbExecutor = pool
): Promise<ReturnType<typeof mapPayment> | null> {
  const result = await executor.query<AdvertisementPaymentRow>(
    `
    UPDATE advertisement_payments
    SET
      payment_status = 'VERIFIED',
      verified_by = $1,
      verified_at = NOW(),
      updated_at = NOW()
    WHERE id = $2
      AND payment_status IN ('RECEIVED', 'PENDING')
    RETURNING
      id,
      advertisement_id,
      amount,
      payment_type,
      payment_date,
      payment_method,
      payment_status,
      transaction_reference,
      notes,
      recorded_by,
      recorded_at,
      verified_by,
      verified_at,
      cancelled_by,
      cancelled_at,
      cancellation_reason,
      refunded_by,
      refunded_at,
      refund_reference,
      refund_reason,
      created_at,
      updated_at
    `,
    [verifiedBy, id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapPayment(row);
}

export async function cancel(
  id: number,
  cancelledBy: number,
  cancellationReason: string | null,
  executor: DbExecutor = pool
): Promise<ReturnType<typeof mapPayment> | null> {
  const result = await executor.query<AdvertisementPaymentRow>(
    `
    UPDATE advertisement_payments
    SET
      payment_status = 'CANCELLED',
      cancelled_by = $2,
      cancelled_at = NOW(),
      cancellation_reason = $3,
      updated_at = NOW()
    WHERE id = $1
      AND payment_status IN ('PENDING', 'RECEIVED')
    RETURNING
      id,
      advertisement_id,
      amount,
      payment_type,
      payment_date,
      payment_method,
      payment_status,
      transaction_reference,
      notes,
      recorded_by,
      recorded_at,
      verified_by,
      verified_at,
      cancelled_by,
      cancelled_at,
      cancellation_reason,
      refunded_by,
      refunded_at,
      refund_reference,
      refund_reason,
      created_at,
      updated_at
    `,
    [id, cancelledBy, cancellationReason]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapPayment(row);
}

export async function markRefunded(
  id: number,
  refundedBy: number,
  refundReference: string | null,
  refundReason: string | null,
  executor: DbExecutor = pool
): Promise<ReturnType<typeof mapPayment> | null> {
  const result = await executor.query<AdvertisementPaymentRow>(
    `
    UPDATE advertisement_payments
    SET
      payment_status = 'REFUNDED',
      refunded_by = $1,
      refunded_at = NOW(),
      refund_reference = $3,
      refund_reason = $4,
      updated_at = NOW()
    WHERE id = $2
      AND payment_status = 'VERIFIED'
    RETURNING
      id,
      advertisement_id,
      amount,
      payment_type,
      payment_date,
      payment_method,
      payment_status,
      transaction_reference,
      notes,
      recorded_by,
      recorded_at,
      verified_by,
      verified_at,
      cancelled_by,
      cancelled_at,
      cancellation_reason,
      refunded_by,
      refunded_at,
      refund_reference,
      refund_reason,
      created_at,
      updated_at
    `,
    [refundedBy, id, refundReference, refundReason]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapPayment(row);
}

export async function createRefund(
  data: CreateAdvertisementPaymentRefundInput,
  refundedBy: number | null,
  executor: DbExecutor = pool
): Promise<AdvertisementPaymentRefund> {
  const result = await executor.query<AdvertisementPaymentRefundRow>(
    `
    INSERT INTO advertisement_payment_refunds
    (
      payment_id,
      amount,
      refund_date,
      refund_reference,
      refund_reason,
      refunded_by,
      created_at,
      updated_at
    )
    VALUES
    (
      $1,
      $2,
      COALESCE($3, NOW()),
      $4,
      $5,
      $6,
      NOW(),
      NOW()
    )
    RETURNING
      id,
      payment_id,
      amount,
      refund_date,
      refund_reference,
      refund_reason,
      refunded_by,
      created_at,
      updated_at
    `,
    [
      data.paymentId,
      data.amount,
      data.refundDate ?? null,
      data.refundReference ?? null,
      data.refundReason ?? null,
      refundedBy
    ]
  );

  const row = result.rows[0];

  if (row === undefined) {
    throw new Error("Failed to create payment refund.");
  }

  return mapRefund(row);
}

export async function findRefundById(
  id: number,
  executor: DbExecutor = pool
): Promise<AdvertisementPaymentRefund | null> {
  const result = await executor.query<AdvertisementPaymentRefundRow>(
    `
    SELECT
      id,
      payment_id,
      amount,
      refund_date,
      refund_reference,
      refund_reason,
      refunded_by,
      created_at,
      updated_at
    FROM advertisement_payment_refunds
    WHERE id = $1
    `,
    [id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapRefund(row);
}

export async function findRefundsByPaymentId(
  paymentId: number,
  executor: DbExecutor = pool
): Promise<AdvertisementPaymentRefund[]> {
  const result = await executor.query<AdvertisementPaymentRefundRow>(
    `
    SELECT
      id,
      payment_id,
      amount,
      refund_date,
      refund_reference,
      refund_reason,
      refunded_by,
      created_at,
      updated_at
    FROM advertisement_payment_refunds
    WHERE payment_id = $1
    ORDER BY refund_date DESC, id DESC
    `,
    [paymentId]
  );

  return result.rows.map(mapRefund);
}

export async function getTotalRefundedAmount(
  paymentId: number,
  executor: DbExecutor = pool
): Promise<number> {
  const result = await executor.query<{ total: string }>(
    `
    SELECT
      COALESCE(SUM(amount), 0)::numeric AS total
    FROM advertisement_payment_refunds
    WHERE payment_id = $1
    `,
    [paymentId]
  );

  return Number(result.rows[0]?.total ?? 0);
}

export async function getList(
  filters: AdvertisementPaymentFilters,
  page: number,
  pageSize: number,
  executor: DbExecutor = pool
): Promise<{
  items: AdvertisementPaymentListItem[];
  total: number;
}> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let parameterIndex = 1;

  if (filters.advertisementId !== undefined) {
    conditions.push(`p.advertisement_id = $${parameterIndex}`);
    values.push(filters.advertisementId);
    parameterIndex += 1;
  }

  if (filters.paymentType !== undefined) {
    conditions.push(`p.payment_type = $${parameterIndex}`);
    values.push(filters.paymentType);
    parameterIndex += 1;
  }

  if (filters.paymentStatus !== undefined) {
    conditions.push(`p.payment_status = $${parameterIndex}`);
    values.push(filters.paymentStatus);
    parameterIndex += 1;
  }

  if (filters.paymentMethod !== undefined) {
    conditions.push(`p.payment_method = $${parameterIndex}`);
    values.push(filters.paymentMethod);
    parameterIndex += 1;
  }

  if (filters.fromDate !== undefined) {
    conditions.push(`p.payment_date >= $${parameterIndex}`);
    values.push(filters.fromDate);
    parameterIndex += 1;
  }

  if (filters.toDate !== undefined) {
    conditions.push(`p.payment_date <= $${parameterIndex}`);
    values.push(filters.toDate);
    parameterIndex += 1;
  }

  if (filters.search !== undefined && filters.search.trim() !== "") {
    conditions.push(`
      (
        CAST(p.id AS TEXT) ILIKE $${parameterIndex}
        OR p.transaction_reference ILIKE $${parameterIndex}
        OR a.name ILIKE $${parameterIndex}
        OR ac.name ILIKE $${parameterIndex}
        OR ac.display_name ILIKE $${parameterIndex}
        OR ac.client_code ILIKE $${parameterIndex}
      )
    `);

    values.push(`%${filters.search.trim()}%`);
    parameterIndex += 1;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join("\n      AND ")}` : "";

  const countResult = await executor.query<{ count: string }>(
    `
    SELECT COUNT(*)::bigint AS count
    FROM advertisement_payments p
    INNER JOIN advertisements a
      ON a.id = p.advertisement_id
    LEFT JOIN advertisement_clients ac
      ON ac.id = a.client_id
    ${whereClause}
    `,
    values
  );

  const total = Number(countResult.rows[0]?.count ?? 0);

  const offset = (page - 1) * pageSize;

  const dataValues = [...values, pageSize, offset];

  const result = await executor.query<AdvertisementPaymentListRow>(
    `
    SELECT
      p.id,
      p.advertisement_id,
      p.amount,
      p.payment_type,
      p.payment_date,
      p.payment_method,
      p.payment_status,
      p.transaction_reference,
      p.notes,
      p.recorded_by,
      p.recorded_at,
      p.verified_by,
      p.verified_at,
      p.cancelled_by,
      p.cancelled_at,
      p.cancellation_reason,
      p.refunded_by,
      p.refunded_at,
      p.refund_reference,
      p.refund_reason,
      p.created_at,
      p.updated_at,

      a.name AS advertisement_name,

      a.client_id,

      ac.name AS client_name,

      ac.client_code,

      COALESCE(
        (
          SELECT SUM(pr.amount)
          FROM advertisement_payment_refunds pr
          WHERE pr.payment_id = p.id
        ),
        0
      )::numeric AS total_refunded_amount,

      GREATEST(
        p.amount -
        COALESCE(
          (
            SELECT SUM(pr.amount)
            FROM advertisement_payment_refunds pr
            WHERE pr.payment_id = p.id
          ),
          0
        ),
        0
      )::numeric AS net_paid_amount

    FROM advertisement_payments p

    INNER JOIN advertisements a
      ON a.id = p.advertisement_id

    LEFT JOIN advertisement_clients ac
      ON ac.id = a.client_id

    ${whereClause}

    ORDER BY
      p.payment_date DESC,
      p.id DESC

    LIMIT $${parameterIndex}
    OFFSET $${parameterIndex + 1}
    `,
    dataValues
  );

  return {
    items: result.rows.map(mapPaymentListItem),
    total
  };
}

export async function getSummary(
  advertisementId: number,
  executor: DbExecutor = pool
): Promise<AdvertisementPaymentSummary | null> {
  const result = await executor.query<AdvertisementPaymentSummaryRow>(
    `
    SELECT
      a.id AS advertisement_id,

      /*
       * Prefer the persisted negotiated advertisement amount.
       *
       * If it is NULL, derive the amount from the system-calculated
       * standard amount and discount percentage, matching the pricing
       * formula:
       *
       * Advertisement Amount =
       *   Standard Amount - (Standard Amount * Discount Percentage / 100)
       *
       * If neither amount source is available, preserve NULL so that
       * the API does not report a fabricated outstanding balance.
       */
      CASE
        WHEN a.advertisement_amount IS NOT NULL THEN
          a.advertisement_amount
        WHEN a.standard_amount IS NOT NULL THEN
          GREATEST(
            a.standard_amount
            - ROUND(
                a.standard_amount
                * COALESCE(a.discount_percentage, 0)
                / 100.0,
                2
              ),
            0
          )
        ELSE
          NULL
      END AS advertisement_amount,

      COALESCE(a.discount_amount, 0)::numeric
        AS discount_amount,

      COALESCE(a.adjustment_amount, 0)::numeric
        AS adjustment_amount,

      /*
       * Gross verified payments include fully refunded payments.
       * Refunds are reported separately and subtracted when calculating
       * net payments.
       */
      COALESCE(
        (
          SELECT SUM(p.amount)
          FROM advertisement_payments p
          WHERE p.advertisement_id = a.id
            AND p.payment_status IN ('VERIFIED', 'REFUNDED')
        ),
        0
      )::numeric AS verified_payment_amount,

      /*
       * Total refunds recorded against this advertisement.
       */
      COALESCE(
        (
          SELECT SUM(pr.amount)
          FROM advertisement_payment_refunds pr
          INNER JOIN advertisement_payments p
            ON p.id = pr.payment_id
          WHERE p.advertisement_id = a.id
        ),
        0
      )::numeric AS refunded_amount,

      /*
       * Net payments = gross verified payments - refunds.
       *
       * A Credit Exception is not a payment and is intentionally
       * excluded from this calculation.
       */
      GREATEST(
        COALESCE(
          (
            SELECT SUM(p.amount)
            FROM advertisement_payments p
            WHERE p.advertisement_id = a.id
              AND p.payment_status IN ('VERIFIED', 'REFUNDED')
          ),
          0
        )
        -
        COALESCE(
          (
            SELECT SUM(pr.amount)
            FROM advertisement_payment_refunds pr
            INNER JOIN advertisement_payments p
              ON p.id = pr.payment_id
            WHERE p.advertisement_id = a.id
          ),
          0
        ),
        0
      )::numeric AS net_paid_amount,

      /*
       * Advance Required is a commercial collection target,
       * not an additional charge.
       */
      COALESCE(a.advance_amount, 0)::numeric
        AS advance_required_amount,

      /*
       * Advance Received includes verified advance payments,
       * less refunds associated with those advance payments.
       */
      GREATEST(
        COALESCE(
          (
            SELECT SUM(p.amount)
            FROM advertisement_payments p
            WHERE p.advertisement_id = a.id
              AND p.payment_type = 'ADVANCE'
              AND p.payment_status IN ('VERIFIED', 'REFUNDED')
          ),
          0
        )
        -
        COALESCE(
          (
            SELECT SUM(pr.amount)
            FROM advertisement_payment_refunds pr
            INNER JOIN advertisement_payments p
              ON p.id = pr.payment_id
            WHERE p.advertisement_id = a.id
              AND p.payment_type = 'ADVANCE'
              AND p.payment_status IN ('VERIFIED', 'REFUNDED')
          ),
          0
        ),
        0
      )::numeric AS advance_received_amount,

      /*
       * Advance Pending cannot be negative.
       */
      GREATEST(
        COALESCE(a.advance_amount, 0)
        -
        GREATEST(
          COALESCE(
            (
              SELECT SUM(p.amount)
              FROM advertisement_payments p
              WHERE p.advertisement_id = a.id
                AND p.payment_type = 'ADVANCE'
                AND p.payment_status IN ('VERIFIED', 'REFUNDED')
            ),
            0
          )
          -
          COALESCE(
            (
              SELECT SUM(pr.amount)
              FROM advertisement_payment_refunds pr
              INNER JOIN advertisement_payments p
                ON p.id = pr.payment_id
              WHERE p.advertisement_id = a.id
                AND p.payment_type = 'ADVANCE'
                AND p.payment_status IN ('VERIFIED', 'REFUNDED')
            ),
            0
          ),
          0
        ),
        0
      )::numeric AS advance_pending_amount

    FROM advertisements a
    WHERE a.id = $1
    `,
    [advertisementId]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapSummary(row);
}

export async function advertisementExists(
  advertisementId: number,
  executor: DbExecutor = pool
): Promise<boolean> {
  const result = await executor.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM advertisements
      WHERE id = $1
    ) AS exists
    `,
    [advertisementId]
  );

  return result.rows[0]?.exists === true;
}

export async function hasTransactionReference(
  transactionReference: string,
  excludePaymentId?: number,
  executor: DbExecutor = pool
): Promise<boolean> {
  const values: unknown[] = [transactionReference];

  let exclusion = "";

  if (excludePaymentId !== undefined) {
    exclusion = "AND id <> $2";
    values.push(excludePaymentId);
  }

  const result = await executor.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM advertisement_payments
      WHERE transaction_reference = $1
      ${exclusion}
    ) AS exists
    `,
    values
  );

  return result.rows[0]?.exists === true;
}

export async function getVerifiedPaymentAmount(
  advertisementId: number,
  executor: DbExecutor = pool
): Promise<number> {
  const result = await executor.query<{ total: string }>(
    `
    SELECT
      COALESCE(SUM(amount), 0)::numeric AS total
    FROM advertisement_payments
    WHERE advertisement_id = $1
      AND payment_status = 'VERIFIED'
    `,
    [advertisementId]
  );

  return Number(result.rows[0]?.total ?? 0);
}

export async function getRefundedAmountForPayment(
  paymentId: number,
  executor: DbExecutor = pool
): Promise<number> {
  const result = await executor.query<{ total: string }>(
    `
    SELECT
      COALESCE(SUM(amount), 0)::numeric AS total
    FROM advertisement_payment_refunds
    WHERE payment_id = $1
    `,
    [paymentId]
  );

  return Number(result.rows[0]?.total ?? 0);
}