import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementFinancialApproval,
  AdvertisementFinancialApprovalHistory,
  AdvertisementFinancialApprovalListFilters,
  AdvertisementFinancialApprovalListResult,
  AdvertisementFinancialApprovalStatus,
  AdvertisementFinancialApprovalType,
  ApproveAdvertisementFinancialApprovalInput,
  CreateAdvertisementFinancialApprovalInput,
  HoldAdvertisementFinancialApprovalInput,
  RejectAdvertisementFinancialApprovalInput
} from "./financial-approval.types.js";

type DbExecutor = typeof pool | PoolClient;

interface AdvertisementFinancialApprovalRow {
  id: number | string;
  advertisement_id: number | string;
  client_id: number | string;
  payment_id: number | string | null;
  approval_type: AdvertisementFinancialApprovalType;
  requested_amount: number | string | null;
  requested_percentage: number | string | null;
  approved_amount: number | string | null;
  approved_percentage: number | string | null;
  status: AdvertisementFinancialApprovalStatus;
  requested_by: number | string;
  requested_at: Date;
  reviewed_by: number | string | null;
  reviewed_at: Date | null;
  hold_reason: string | null;
  rejection_reason: string | null;
  approval_remarks: string | null;
  credit_exception_reason?: string | null;
  expected_payment_due_date?: string | Date | null;
  overdue_at?: Date | null;
  revoked_by?: number | string | null;
  revoked_at?: Date | null;
  revocation_reason?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AdvertisementFinancialApprovalHistoryRow {
  id: number | string;
  approval_id: number | string;
  from_status: AdvertisementFinancialApprovalStatus | null;
  to_status: AdvertisementFinancialApprovalStatus;
  action_by: number | string;
  action_at: Date;
  remarks: string | null;
  hold_reason: string | null;
  rejection_reason: string | null;
  credit_exception_reason?: string | null;
  expected_payment_due_date?: string | Date | null;
  approved_amount?: number | string | null;
  overdue_at?: Date | null;
  revoked_by?: number | string | null;
  revoked_at?: Date | null;
  revocation_reason?: string | null;
}

function nullableNumber(
  value: number | string | null | undefined
): number | null {
  return value == null ? null : Number(value);
}

/**
 * Convert a database date or timestamp to YYYY-MM-DD.
 *
 * Undefined is preserved for compatibility with rows or test fixtures
 * that do not include newer optional date columns.
 */
function dateOnly(
  value: string | Date | null | undefined
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function mapApproval(
  row: AdvertisementFinancialApprovalRow
): AdvertisementFinancialApproval {
  const expectedPaymentDueDate = dateOnly(
    row.expected_payment_due_date
  );

  return {
    id: Number(row.id),
    advertisementId: Number(row.advertisement_id),
    clientId: Number(row.client_id),
    paymentId: nullableNumber(row.payment_id),
    approvalType: row.approval_type,
    requestedAmount: nullableNumber(row.requested_amount),
    requestedPercentage: nullableNumber(row.requested_percentage),
    approvedAmount: nullableNumber(row.approved_amount),
    approvedPercentage: nullableNumber(row.approved_percentage),
    status: row.status,
    requestedBy: Number(row.requested_by),
    requestedAt: row.requested_at,
    reviewedBy: nullableNumber(row.reviewed_by),
    reviewedAt: row.reviewed_at,
    holdReason: row.hold_reason,
    rejectionReason: row.rejection_reason,
    approvalRemarks: row.approval_remarks,
    ...(row.credit_exception_reason !== undefined
      ? { creditExceptionReason: row.credit_exception_reason }
      : {}),
    ...(expectedPaymentDueDate !== undefined
      ? { expectedPaymentDueDate }
      : {}),
    ...(row.overdue_at !== undefined ? { overdueAt: row.overdue_at } : {}),
    ...(row.revoked_by !== undefined
      ? { revokedBy: nullableNumber(row.revoked_by) }
      : {}),
    ...(row.revoked_at !== undefined ? { revokedAt: row.revoked_at } : {}),
    ...(row.revocation_reason !== undefined
      ? { revocationReason: row.revocation_reason }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapHistory(
  row: AdvertisementFinancialApprovalHistoryRow
): AdvertisementFinancialApprovalHistory {
  const expectedPaymentDueDate = dateOnly(
    row.expected_payment_due_date
  );

  return {
    id: Number(row.id),
    approvalId: Number(row.approval_id),
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actionBy: Number(row.action_by),
    actionAt: row.action_at,
    remarks: row.remarks,
    holdReason: row.hold_reason,
    rejectionReason: row.rejection_reason,
    ...(row.credit_exception_reason !== undefined
      ? { creditExceptionReason: row.credit_exception_reason }
      : {}),
    ...(expectedPaymentDueDate !== undefined
      ? { expectedPaymentDueDate }
      : {}),
    ...(row.approved_amount !== undefined
      ? { approvedAmount: nullableNumber(row.approved_amount) }
      : {}),
    ...(row.overdue_at !== undefined ? { overdueAt: row.overdue_at } : {}),
    ...(row.revoked_by !== undefined
      ? { revokedBy: nullableNumber(row.revoked_by) }
      : {}),
    ...(row.revoked_at !== undefined ? { revokedAt: row.revoked_at } : {}),
    ...(row.revocation_reason !== undefined
      ? { revocationReason: row.revocation_reason }
      : {})
  };
}

function buildApprovalSelect(): string {
  return `
    SELECT
      id,
      advertisement_id,
      client_id,
      payment_id,
      approval_type,
      requested_amount,
      requested_percentage,
      approved_amount,
      approved_percentage,
      status,
      requested_by,
      requested_at,
      reviewed_by,
      reviewed_at,
      hold_reason,
      rejection_reason,
      approval_remarks,
      credit_exception_reason,
      expected_payment_due_date,
      overdue_at,
      revoked_by,
      revoked_at,
      revocation_reason,
      created_at,
      updated_at
    FROM public.advertisement_financial_approvals
  `;
}

function buildHistorySelect(): string {
  return `
    SELECT
      id,
      approval_id,
      from_status,
      to_status,
      action_by,
      action_at,
      remarks,
      hold_reason,
      rejection_reason,
      credit_exception_reason,
      expected_payment_due_date,
      approved_amount,
      overdue_at,
      revoked_by,
      revoked_at,
      revocation_reason
    FROM public.advertisement_financial_approval_history
  `;
}

/**
 * Get one financial approval request.
 */
export async function findById(
  id: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      ${buildApprovalSelect()}
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

/**
 * Create a new financial approval request.
 *
 * Credit-exception fields are persisted independently from payment data.
 * Normal approvals retain the original eight-parameter SQL contract.
 */
export async function create(
  data: CreateAdvertisementFinancialApprovalInput,
  requestedBy: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval> {
  const isCreditException = data.approvalType === "CREDIT_EXCEPTION";

  const creditExceptionReason = isCreditException
    ? (data.creditExceptionReason?.trim() ?? null)
    : null;

  const expectedPaymentDueDate = isCreditException
    ? (data.expectedPaymentDueDate ?? null)
    : null;

  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      INSERT INTO public.advertisement_financial_approvals
      (
        advertisement_id,
        client_id,
        payment_id,
        approval_type,
        requested_amount,
        requested_percentage,
        status,
        requested_by,
        requested_at,
        approval_remarks,
        credit_exception_reason,
        expected_payment_due_date,
        created_at,
        updated_at
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'SUBMITTED',
        $7,
        NOW(),
        $8,
        ${isCreditException ? "$9" : "NULL"},
        ${isCreditException ? "$10" : "NULL"},
        NOW(),
        NOW()
      )
      RETURNING
        id,
        advertisement_id,
        client_id,
        payment_id,
        approval_type,
        requested_amount,
        requested_percentage,
        approved_amount,
        approved_percentage,
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        hold_reason,
        rejection_reason,
        approval_remarks,
        credit_exception_reason,
        expected_payment_due_date,
        overdue_at,
        revoked_by,
        revoked_at,
        revocation_reason,
        created_at,
        updated_at
    `,
    [
      data.advertisementId,
      data.clientId,
      data.paymentId ?? null,
      data.approvalType,
      data.requestedAmount ?? null,
      data.requestedPercentage ?? null,
      requestedBy,
      data.approvalRemarks ?? null,
      ...(isCreditException
        ? [creditExceptionReason, expectedPaymentDueDate]
        : [])
    ]
  );

  const row = result.rows[0];

  if (row === undefined) {
    throw new Error("Failed to create financial approval.");
  }

  return mapApproval(row);
}

/**
 * Update remarks without changing the approval decision.
 */
export async function updateApprovalRemarks(
  id: number,
  approvalRemarks: string | null,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      UPDATE public.advertisement_financial_approvals
      SET
        approval_remarks = $2,
        updated_at = NOW()
      WHERE id = $1
        AND status IN ('SUBMITTED', 'HOLD')
      RETURNING
        id,
        advertisement_id,
        client_id,
        payment_id,
        approval_type,
        requested_amount,
        requested_percentage,
        approved_amount,
        approved_percentage,
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        hold_reason,
        rejection_reason,
        approval_remarks,
        credit_exception_reason,
        expected_payment_due_date,
        overdue_at,
        revoked_by,
        revoked_at,
        revocation_reason,
        created_at,
        updated_at
    `,
    [id, approvalRemarks]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

/**
 * Place a submitted approval on hold.
 */
export async function hold(
  id: number,
  data: HoldAdvertisementFinancialApprovalInput,
  reviewedBy: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      UPDATE public.advertisement_financial_approvals
      SET
        status = 'HOLD',
        reviewed_by = $2,
        reviewed_at = NOW(),
        hold_reason = $3,
        rejection_reason = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND status = 'SUBMITTED'
      RETURNING
        id,
        advertisement_id,
        client_id,
        payment_id,
        approval_type,
        requested_amount,
        requested_percentage,
        approved_amount,
        approved_percentage,
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        hold_reason,
        rejection_reason,
        approval_remarks,
        credit_exception_reason,
        expected_payment_due_date,
        overdue_at,
        revoked_by,
        revoked_at,
        revocation_reason,
        created_at,
        updated_at
    `,
    [id, reviewedBy, data.holdReason]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

/**
 * Reject a submitted or held approval.
 */
export async function reject(
  id: number,
  data: RejectAdvertisementFinancialApprovalInput,
  reviewedBy: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      UPDATE public.advertisement_financial_approvals
      SET
        status = 'REJECTED',
        reviewed_by = $2,
        reviewed_at = NOW(),
        rejection_reason = $3,
        hold_reason = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND status IN ('SUBMITTED', 'HOLD')
      RETURNING
        id,
        advertisement_id,
        client_id,
        payment_id,
        approval_type,
        requested_amount,
        requested_percentage,
        approved_amount,
        approved_percentage,
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        hold_reason,
        rejection_reason,
        approval_remarks,
        credit_exception_reason,
        expected_payment_due_date,
        overdue_at,
        revoked_by,
        revoked_at,
        revocation_reason,
        created_at,
        updated_at
    `,
    [id, reviewedBy, data.rejectionReason]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

/**
 * Approve a financial approval request.
 *
 * Only SUBMITTED or HOLD requests can be approved.
 * Approved amounts and percentages must not exceed their requested values.
 * An amount and percentage cannot both be approved in the same request.
 * CREDIT_EXCEPTION requires a positive approved amount not exceeding the
 * requested amount.
 *
 * For CREDIT_EXCEPTION, this records the approved amount on the approval
 * record only. It does not create a payment or reduce the debt.
 */
export async function approve(
  id: number,
  data: ApproveAdvertisementFinancialApprovalInput,
  reviewedBy: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      UPDATE public.advertisement_financial_approvals
      SET
        status = 'APPROVED',
        reviewed_by = $2,
        reviewed_at = NOW(),
        approval_remarks = COALESCE($3, approval_remarks),
        approved_amount = $4,
        approved_percentage = $5,
        hold_reason = NULL,
        rejection_reason = NULL,
        updated_at = NOW()
      WHERE id = $1
        AND status IN ('SUBMITTED', 'HOLD')
        AND NOT (
          $4::numeric IS NOT NULL
          AND $5::numeric IS NOT NULL
        )
        AND (
          (
            $4::numeric IS NULL
            AND requested_amount IS NULL
          )
          OR (
            $4::numeric IS NOT NULL
            AND requested_amount IS NOT NULL
            AND $4::numeric > 0
            AND $4::numeric <= requested_amount
          )
        )
        AND (
          (
            $5::numeric IS NULL
            AND requested_percentage IS NULL
          )
          OR (
            $5::numeric IS NOT NULL
            AND requested_percentage IS NOT NULL
            AND $5::numeric >= 0
            AND $5::numeric <= requested_percentage
          )
        )
        AND (
          approval_type <> 'CREDIT_EXCEPTION'
          OR (
            $4::numeric IS NOT NULL
            AND $4::numeric > 0
            AND requested_amount IS NOT NULL
            AND $4::numeric <= requested_amount
            AND $5::numeric IS NULL
          )
        )
      RETURNING
        id,
        advertisement_id,
        client_id,
        payment_id,
        approval_type,
        requested_amount,
        requested_percentage,
        approved_amount,
        approved_percentage,
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        hold_reason,
        rejection_reason,
        approval_remarks,
        credit_exception_reason,
        expected_payment_due_date,
        overdue_at,
        revoked_by,
        revoked_at,
        revocation_reason,
        created_at,
        updated_at
    `,
    [
      id,
      reviewedBy,
      data.approvalRemarks ?? null,
      data.approvedAmount ?? null,
      data.approvedPercentage ?? null
    ]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

/**
 * Resubmit an approval that was held or rejected.
 */
export async function resubmit(
  id: number,
  approvalRemarks: string | null,
  requestedBy: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      UPDATE public.advertisement_financial_approvals
      SET
        status = 'SUBMITTED',
        requested_by = $2,
        requested_at = NOW(),
        reviewed_by = NULL,
        reviewed_at = NULL,
        hold_reason = NULL,
        rejection_reason = NULL,
        approved_amount = NULL,
        approved_percentage = NULL,
        approval_remarks = $3,
        updated_at = NOW()
      WHERE id = $1
        AND status IN ('HOLD', 'REJECTED')
      RETURNING
        id,
        advertisement_id,
        client_id,
        payment_id,
        approval_type,
        requested_amount,
        requested_percentage,
        approved_amount,
        approved_percentage,
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        hold_reason,
        rejection_reason,
        approval_remarks,
        credit_exception_reason,
        expected_payment_due_date,
        overdue_at,
        revoked_by,
        revoked_at,
        revocation_reason,
        created_at,
        updated_at
    `,
    [id, requestedBy, approvalRemarks]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

/**
 * Write an audit-history entry.
 */
export async function createHistory(
  approvalId: number,
  fromStatus: AdvertisementFinancialApprovalStatus | null,
  toStatus: AdvertisementFinancialApprovalStatus,
  actionBy: number,
  remarks: string | null = null,
  holdReason: string | null = null,
  rejectionReason: string | null = null,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApprovalHistory> {
  const result = await executor.query<AdvertisementFinancialApprovalHistoryRow>(
    `
      INSERT INTO public.advertisement_financial_approval_history
      (
        approval_id,
        from_status,
        to_status,
        action_by,
        action_at,
        remarks,
        hold_reason,
        rejection_reason,
        credit_exception_reason,
        expected_payment_due_date,
        approved_amount,
        overdue_at,
        revoked_by,
        revoked_at,
        revocation_reason
      )
      SELECT
        a.id,
        $2,
        $3,
        $4,
        NOW(),
        $5,
        $6,
        $7,
        a.credit_exception_reason,
        a.expected_payment_due_date,
        a.approved_amount,
        a.overdue_at,
        a.revoked_by,
        a.revoked_at,
        a.revocation_reason
      FROM public.advertisement_financial_approvals a
      WHERE a.id = $1
      RETURNING
        id,
        approval_id,
        from_status,
        to_status,
        action_by,
        action_at,
        remarks,
        hold_reason,
        rejection_reason,
        credit_exception_reason,
        expected_payment_due_date,
        approved_amount,
        overdue_at,
        revoked_by,
        revoked_at,
        revocation_reason
    `,
    [
      approvalId,
      fromStatus,
      toStatus,
      actionBy,
      remarks,
      holdReason,
      rejectionReason
    ]
  );

  const row = result.rows[0];

  if (row === undefined) {
    throw new Error(
      "Failed to create financial approval history. The approval may not exist."
    );
  }

  return mapHistory(row);
}

/**
 * Read the complete audit history for an approval.
 */
export async function findHistoryByApprovalId(
  approvalId: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApprovalHistory[]> {
  const result = await executor.query<AdvertisementFinancialApprovalHistoryRow>(
    `
      ${buildHistorySelect()}
      WHERE approval_id = $1
      ORDER BY action_at ASC, id ASC
    `,
    [approvalId]
  );

  return result.rows.map(mapHistory);
}

export async function exists(
  id: number,
  executor: DbExecutor = pool
): Promise<boolean> {
  const result = await executor.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM public.advertisement_financial_approvals
        WHERE id = $1
      ) AS exists
    `,
    [id]
  );

  return result.rows[0]?.exists === true;
}

export async function existsForAdvertisement(
  advertisementId: number,
  executor: DbExecutor = pool
): Promise<boolean> {
  const result = await executor.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM public.advertisement_financial_approvals
        WHERE advertisement_id = $1
      ) AS exists
    `,
    [advertisementId]
  );

  return result.rows[0]?.exists === true;
}

export async function findLatestByAdvertisementId(
  advertisementId: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      ${buildApprovalSelect()}
      WHERE advertisement_id = $1
      ORDER BY requested_at DESC, id DESC
      LIMIT 1
    `,
    [advertisementId]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

/**
 * Paginated approval listing.
 *
 * The existing result contract is retained: { items, total }.
 */
export async function list(
  filters: AdvertisementFinancialApprovalListFilters,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApprovalListResult> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let parameterIndex = 1;

  if (filters.advertisementId !== undefined) {
    conditions.push(`advertisement_id = $${parameterIndex++}`);
    values.push(filters.advertisementId);
  }

  if (filters.clientId !== undefined) {
    conditions.push(`client_id = $${parameterIndex++}`);
    values.push(filters.clientId);
  }

  if (filters.paymentId !== undefined) {
    conditions.push(`payment_id = $${parameterIndex++}`);
    values.push(filters.paymentId);
  }

  if (filters.approvalType !== undefined) {
    conditions.push(`approval_type = $${parameterIndex++}`);
    values.push(filters.approvalType);
  }

  if (filters.status !== undefined) {
    conditions.push(`status = $${parameterIndex++}`);
    values.push(filters.status);
  }

  if (filters.requestedBy !== undefined) {
    conditions.push(`requested_by = $${parameterIndex++}`);
    values.push(filters.requestedBy);
  }

  if (filters.reviewedBy !== undefined) {
    conditions.push(`reviewed_by = $${parameterIndex++}`);
    values.push(filters.reviewedBy);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join("\n AND ")}` : "";

  const countResult = await executor.query<{ count: string }>(
    `
      SELECT COUNT(*)::bigint AS count
      FROM public.advertisement_financial_approvals
      ${whereClause}
    `,
    values
  );

  const total = Number(countResult.rows[0]?.count ?? 0);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const dataValues = [...values, pageSize, offset];

  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      ${buildApprovalSelect()}
      ${whereClause}
      ORDER BY requested_at DESC, id DESC
      LIMIT $${parameterIndex}
      OFFSET $${parameterIndex + 1}
    `,
    dataValues
  );

  return {
    items: result.rows.map(mapApproval),
    total
  };
}

/**
 * Finds the most recent pending approval for an advertisement, regardless
 * of approval type.
 *
 * Retained for existing callers that need to know whether any approval
 * is pending for the advertisement.
 */
export async function findPendingByAdvertisementId(
  advertisementId: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      ${buildApprovalSelect()}
      WHERE advertisement_id = $1
        AND status IN ('SUBMITTED', 'HOLD')
      ORDER BY requested_at DESC, id DESC
      LIMIT 1
    `,
    [advertisementId]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

/**
 * Finds the most recent pending approval of a specific type for an
 * advertisement.
 *
 * Use this when enforcing duplicate-request rules: a pending request of a
 * different approval type will not be considered a duplicate.
 */
export async function findPendingByAdvertisementIdAndType(
  advertisementId: number,
  approvalType: AdvertisementFinancialApprovalType,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      ${buildApprovalSelect()}
      WHERE advertisement_id = $1
        AND approval_type = $2
        AND status IN ('SUBMITTED', 'HOLD')
      ORDER BY requested_at DESC, id DESC
      LIMIT 1
    `,
    [advertisementId, approvalType]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

export async function findPendingByPaymentId(
  paymentId: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      ${buildApprovalSelect()}
      WHERE payment_id = $1
        AND status IN ('SUBMITTED', 'HOLD')
      ORDER BY requested_at DESC, id DESC
      LIMIT 1
    `,
    [paymentId]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}