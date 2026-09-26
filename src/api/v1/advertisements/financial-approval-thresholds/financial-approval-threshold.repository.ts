import { pool } from "../../../../shared/config/db.js";

import type {
  CreateFinancialApprovalThresholdInput,
  FinancialApprovalThreshold,
  FinancialApprovalThresholdApprovalType,
  FinancialApprovalThresholdListFilters,
  FinancialApprovalThresholdRow,
  UpdateFinancialApprovalThresholdInput
} from "./financial-approval-threshold.types.js";

const mapThreshold = (
  row: FinancialApprovalThresholdRow
): FinancialApprovalThreshold => ({
  id: Number(row.id),

  approvalType: row.approval_type,

  amountThreshold:
    row.amount_threshold === null ? null : Number(row.amount_threshold),

  percentageThreshold:
    row.percentage_threshold === null ? null : Number(row.percentage_threshold),

  status: row.status,

  createdBy: row.created_by === null ? null : Number(row.created_by),

  updatedBy: row.updated_by === null ? null : Number(row.updated_by),

  createdAt: row.created_at,

  updatedAt: row.updated_at
});

export const findAll = async (
  filters: FinancialApprovalThresholdListFilters = {}
): Promise<FinancialApprovalThreshold[]> => {
  const conditions: string[] = [];
  const values: Array<string> = [];

  if (filters.approvalType !== undefined) {
    values.push(filters.approvalType);

    conditions.push(`approval_type = $${values.length}`);
  }

  if (filters.status !== undefined) {
    values.push(filters.status);

    conditions.push(`status = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query<FinancialApprovalThresholdRow>(
    `
      SELECT
        id,
        approval_type,
        amount_threshold,
        percentage_threshold,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      FROM advertisement_financial_approval_thresholds
      ${whereClause}
      ORDER BY
        approval_type ASC,
        id ASC
      `,
    values
  );

  return result.rows.map(mapThreshold);
};

export const findById = async (
  id: number
): Promise<FinancialApprovalThreshold | null> => {
  const result = await pool.query<FinancialApprovalThresholdRow>(
    `
      SELECT
        id,
        approval_type,
        amount_threshold,
        percentage_threshold,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      FROM advertisement_financial_approval_thresholds
      WHERE id = $1
      LIMIT 1
      `,
    [id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapThreshold(row);
};

export const findActiveByApprovalType = async (
  approvalType: FinancialApprovalThresholdApprovalType
): Promise<FinancialApprovalThreshold | null> => {
  const result = await pool.query<FinancialApprovalThresholdRow>(
    `
        SELECT
          id,
          approval_type,
          amount_threshold,
          percentage_threshold,
          status,
          created_by,
          updated_by,
          created_at,
          updated_at
        FROM advertisement_financial_approval_thresholds
        WHERE approval_type = $1
          AND status = 'ACTIVE'
        ORDER BY
          id DESC
        LIMIT 1
        `,
    [approvalType]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapThreshold(row);
};

export const findActiveByApprovalTypeForUpdate = async (
  approvalType: FinancialApprovalThresholdApprovalType
): Promise<FinancialApprovalThreshold | null> => {
  const result = await pool.query<FinancialApprovalThresholdRow>(
    `
        SELECT
          id,
          approval_type,
          amount_threshold,
          percentage_threshold,
          status,
          created_by,
          updated_by,
          created_at,
          updated_at
        FROM advertisement_financial_approval_thresholds
        WHERE approval_type = $1
          AND status = 'ACTIVE'
        ORDER BY
          id DESC
        LIMIT 1
        FOR UPDATE
        `,
    [approvalType]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapThreshold(row);
};

export const create = async (
  input: CreateFinancialApprovalThresholdInput,
  createdBy: number
): Promise<FinancialApprovalThreshold> => {
  const result = await pool.query<FinancialApprovalThresholdRow>(
    `
      INSERT INTO advertisement_financial_approval_thresholds
      (
        approval_type,
        amount_threshold,
        percentage_threshold,
        status,
        created_by,
        updated_by
      )
      VALUES
      (
        $1,
        $2,
        $3,
        'ACTIVE',
        $4,
        $4
      )
      RETURNING
        id,
        approval_type,
        amount_threshold,
        percentage_threshold,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      `,
    [
      input.approvalType,
      input.amountThreshold ?? null,
      input.percentageThreshold ?? null,
      createdBy
    ]
  );

  const row = result.rows[0];

  if (row === undefined) {
    throw new Error("Failed to create financial approval threshold.");
  }

  return mapThreshold(row);
};

export const update = async (
  id: number,
  input: UpdateFinancialApprovalThresholdInput,
  updatedBy: number
): Promise<FinancialApprovalThreshold | null> => {
  const current = await findById(id);

  if (!current) {
    return null;
  }

  const approvalType = input.approvalType ?? current.approvalType;

  const amountThreshold =
    input.amountThreshold !== undefined
      ? input.amountThreshold
      : current.amountThreshold;

  const percentageThreshold =
    input.percentageThreshold !== undefined
      ? input.percentageThreshold
      : current.percentageThreshold;

  const result = await pool.query<FinancialApprovalThresholdRow>(
    `
      UPDATE advertisement_financial_approval_thresholds
      SET
        approval_type = $1,
        amount_threshold = $2,
        percentage_threshold = $3,
        updated_by = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING
        id,
        approval_type,
        amount_threshold,
        percentage_threshold,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      `,
    [approvalType, amountThreshold, percentageThreshold, updatedBy, id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapThreshold(row);
};

export const activate = async (
  id: number,
  updatedBy: number
): Promise<FinancialApprovalThreshold | null> => {
  const result = await pool.query<FinancialApprovalThresholdRow>(
    `
      UPDATE advertisement_financial_approval_thresholds
      SET
        status = 'ACTIVE',
        updated_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        approval_type,
        amount_threshold,
        percentage_threshold,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      `,
    [updatedBy, id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapThreshold(row);
};

export const deactivate = async (
  id: number,
  updatedBy: number
): Promise<FinancialApprovalThreshold | null> => {
  const result = await pool.query<FinancialApprovalThresholdRow>(
    `
      UPDATE advertisement_financial_approval_thresholds
      SET
        status = 'INACTIVE',
        updated_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        approval_type,
        amount_threshold,
        percentage_threshold,
        status,
        created_by,
        updated_by,
        created_at,
        updated_at
      `,
    [updatedBy, id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapThreshold(row);
};

export const deactivateActiveForApprovalType = async (
  approvalType: FinancialApprovalThresholdApprovalType,
  updatedBy: number,
  excludeId?: number
): Promise<void> => {
  const values: Array<string | number> = [updatedBy, approvalType];

  let excludeClause = "";

  if (excludeId !== undefined) {
    values.push(excludeId);

    excludeClause = `AND id <> $${values.length}`;
  }

  await pool.query(
    `
      UPDATE advertisement_financial_approval_thresholds
      SET
        status = 'INACTIVE',
        updated_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE approval_type = $2
        AND status = 'ACTIVE'
        ${excludeClause}
      `,
    values
  );
};

export const countActiveByApprovalType = async (
  approvalType: FinancialApprovalThresholdApprovalType,
  excludeId?: number
): Promise<number> => {
  const values: Array<string | number> = [approvalType];

  let excludeClause = "";

  if (excludeId !== undefined) {
    values.push(excludeId);

    excludeClause = `AND id <> $${values.length}`;
  }

  const result = await pool.query<{
    count: string;
  }>(
    `
        SELECT COUNT(*)::text AS count
        FROM advertisement_financial_approval_thresholds
        WHERE approval_type = $1
          AND status = 'ACTIVE'
          ${excludeClause}
        `,
    values
  );

  return Number(result.rows[0]?.count ?? 0);
};
