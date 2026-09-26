import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementFinancialApproval,
  AdvertisementFinancialApprovalHistory,
  AdvertisementFinancialApprovalListFilter,
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
  requested_amount: string | number | null;
  requested_percentage: string | number | null;
  status: AdvertisementFinancialApprovalStatus;
  requested_by: number | string;
  requested_at: Date;
  reviewed_by: number | string | null;
  reviewed_at: Date | null;
  hold_reason: string | null;
  rejection_reason: string | null;
  approval_remarks: string | null;
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
}

function mapApproval(
  row: AdvertisementFinancialApprovalRow
): AdvertisementFinancialApproval {
  return {
    id: Number(row.id),
    advertisementId: Number(row.advertisement_id),
    clientId: Number(row.client_id),
    paymentId: row.payment_id === null ? null : Number(row.payment_id),
    approvalType: row.approval_type,
    requestedAmount:
      row.requested_amount === null ? null : Number(row.requested_amount),
    requestedPercentage:
      row.requested_percentage === null
        ? null
        : Number(row.requested_percentage),
    status: row.status,
    requestedBy: Number(row.requested_by),
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by === null ? null : Number(row.reviewed_by),
    reviewedAt: row.reviewed_at,
    holdReason: row.hold_reason,
    rejectionReason: row.rejection_reason,
    approvalRemarks: row.approval_remarks,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapHistory(
  row: AdvertisementFinancialApprovalHistoryRow
): AdvertisementFinancialApprovalHistory {
  return {
    id: Number(row.id),
    approvalId: Number(row.approval_id),
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actionBy: Number(row.action_by),
    actionAt: row.action_at,
    remarks: row.remarks,
    holdReason: row.hold_reason,
    rejectionReason: row.rejection_reason
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
      status,
      requested_by,
      requested_at,
      reviewed_by,
      reviewed_at,
      hold_reason,
      rejection_reason,
      approval_remarks,
      created_at,
      updated_at
    FROM advertisement_financial_approvals
  `;
}

export async function findById(
  id: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      ${buildApprovalSelect()}
      WHERE id = $1
      `,
    [id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

export async function create(
  data: CreateAdvertisementFinancialApprovalInput,
  requestedBy: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      INSERT INTO advertisement_financial_approvals
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
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        hold_reason,
        rejection_reason,
        approval_remarks,
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
      data.approvalRemarks ?? null
    ]
  );

  const row = result.rows[0];

  if (row === undefined) {
    throw new Error("Failed to create financial approval.");
  }

  return mapApproval(row);
}

export async function updateApprovalRemarks(
  id: number,
  approvalRemarks: string | null,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      UPDATE advertisement_financial_approvals
      SET
        approval_remarks = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        advertisement_id,
        client_id,
        payment_id,
        approval_type,
        requested_amount,
        requested_percentage,
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        hold_reason,
        rejection_reason,
        approval_remarks,
        created_at,
        updated_at
      `,
    [id, approvalRemarks]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

export async function hold(
  id: number,
  data: HoldAdvertisementFinancialApprovalInput,
  reviewedBy: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      UPDATE advertisement_financial_approvals
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
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        hold_reason,
        rejection_reason,
        approval_remarks,
        created_at,
        updated_at
      `,
    [id, reviewedBy, data.holdReason]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

export async function reject(
  id: number,
  data: RejectAdvertisementFinancialApprovalInput,
  reviewedBy: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      UPDATE advertisement_financial_approvals
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
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        hold_reason,
        rejection_reason,
        approval_remarks,
        created_at,
        updated_at
      `,
    [id, reviewedBy, data.rejectionReason]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

export async function approve(
  id: number,
  data: ApproveAdvertisementFinancialApprovalInput,
  reviewedBy: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      UPDATE advertisement_financial_approvals
      SET
        status = 'APPROVED',
        reviewed_by = $2,
        reviewed_at = NOW(),
        approval_remarks = $3,
        hold_reason = NULL,
        rejection_reason = NULL,
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
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        hold_reason,
        rejection_reason,
        approval_remarks,
        created_at,
        updated_at
      `,
    [id, reviewedBy, data.approvalRemarks ?? null]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

export async function resubmit(
  id: number,
  approvalRemarks: string | null,
  requestedBy: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      UPDATE advertisement_financial_approvals
      SET
        status = 'SUBMITTED',
        requested_by = $2,
        requested_at = NOW(),
        reviewed_by = NULL,
        reviewed_at = NULL,
        hold_reason = NULL,
        rejection_reason = NULL,
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
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        hold_reason,
        rejection_reason,
        approval_remarks,
        created_at,
        updated_at
      `,
    [id, requestedBy, approvalRemarks]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

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
      INSERT INTO advertisement_financial_approval_history
      (
        approval_id,
        from_status,
        to_status,
        action_by,
        action_at,
        remarks,
        hold_reason,
        rejection_reason
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        NOW(),
        $5,
        $6,
        $7
      )
      RETURNING
        id,
        approval_id,
        from_status,
        to_status,
        action_by,
        action_at,
        remarks,
        hold_reason,
        rejection_reason
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
    throw new Error("Failed to create financial approval history.");
  }

  return mapHistory(row);
}

export async function findHistoryByApprovalId(
  approvalId: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApprovalHistory[]> {
  const result = await executor.query<AdvertisementFinancialApprovalHistoryRow>(
    `
      SELECT
        id,
        approval_id,
        from_status,
        to_status,
        action_by,
        action_at,
        remarks,
        hold_reason,
        rejection_reason
      FROM advertisement_financial_approval_history
      WHERE approval_id = $1
      ORDER BY
        action_at ASC,
        id ASC
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
        FROM advertisement_financial_approvals
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
        FROM advertisement_financial_approvals
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
      ORDER BY
        requested_at DESC,
        id DESC
      LIMIT 1
      `,
    [advertisementId]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}

export async function list(
  filters: AdvertisementFinancialApprovalListFilter,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApprovalListResult> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  let parameterIndex = 1;

  if (filters.advertisementId !== undefined) {
    conditions.push(`advertisement_id = $${parameterIndex}`);
    values.push(filters.advertisementId);
    parameterIndex += 1;
  }

  if (filters.clientId !== undefined) {
    conditions.push(`client_id = $${parameterIndex}`);
    values.push(filters.clientId);
    parameterIndex += 1;
  }

  if (filters.paymentId !== undefined) {
    conditions.push(`payment_id = $${parameterIndex}`);
    values.push(filters.paymentId);
    parameterIndex += 1;
  }

  if (filters.approvalType !== undefined) {
    conditions.push(`approval_type = $${parameterIndex}`);
    values.push(filters.approvalType);
    parameterIndex += 1;
  }

  if (filters.status !== undefined) {
    conditions.push(`status = $${parameterIndex}`);
    values.push(filters.status);
    parameterIndex += 1;
  }

  if (filters.requestedBy !== undefined) {
    conditions.push(`requested_by = $${parameterIndex}`);
    values.push(filters.requestedBy);
    parameterIndex += 1;
  }

  if (filters.reviewedBy !== undefined) {
    conditions.push(`reviewed_by = $${parameterIndex}`);
    values.push(filters.reviewedBy);
    parameterIndex += 1;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join("\n      AND ")}` : "";

  const countResult = await executor.query<{ count: string }>(
    `
      SELECT COUNT(*)::bigint AS count
      FROM advertisement_financial_approvals
      ${whereClause}
      `,
    values
  );

  const total = Number(countResult.rows[0]?.count ?? 0);

  const offset = (filters.page - 1) * filters.pageSize;

  const dataValues = [...values, filters.pageSize, offset];

  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      ${buildApprovalSelect()}
      ${whereClause}
      ORDER BY
        requested_at DESC,
        id DESC
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

export async function findPendingByAdvertisementId(
  advertisementId: number,
  executor: DbExecutor = pool
): Promise<AdvertisementFinancialApproval | null> {
  const result = await executor.query<AdvertisementFinancialApprovalRow>(
    `
      ${buildApprovalSelect()}
      WHERE advertisement_id = $1
        AND status IN ('SUBMITTED', 'HOLD')
      ORDER BY
        requested_at DESC,
        id DESC
      LIMIT 1
      `,
    [advertisementId]
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
      ORDER BY
        requested_at DESC,
        id DESC
      LIMIT 1
      `,
    [paymentId]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapApproval(row);
}
