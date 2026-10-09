import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementTarget,
  AdvertisementTargetType,
  CreateAdvertisementTargetRecordInput,
  UpdateAdvertisementTargetInput
} from "./target.types.js";

interface AdvertisementTargetRow {
  id: string | number;
  advertisement_id: string | number;
  target_type: AdvertisementTargetType;
  target_value: string;
  is_include: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

const selectColumns = `
  id,
  advertisement_id,
  target_type,
  target_value,
  is_include,
  created_at,
  updated_at
`;

function mapTargetRow(row: AdvertisementTargetRow): AdvertisementTarget {
  return {
    id: Number(row.id),
    advertisementId: Number(row.advertisement_id),
    targetType: row.target_type,
    targetValue: row.target_value,
    isInclude: row.is_include,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at
        : new Date(row.created_at),
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at)
  };
}

function normalizeTargetValue(value: string): string {
  return value.trim();
}

export async function findById(
  id: number,
  client?: PoolClient
): Promise<AdvertisementTarget | null> {
  const db = client ?? pool;

  const result = await db.query<AdvertisementTargetRow>(
    `
      SELECT ${selectColumns}
      FROM advertisement_targets
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapTargetRow(row);
}

export async function findByAdvertisementId(
  advertisementId: number,
  client?: PoolClient
): Promise<AdvertisementTarget[]> {
  const db = client ?? pool;

  const result = await db.query<AdvertisementTargetRow>(
    `
      SELECT ${selectColumns}
      FROM advertisement_targets
      WHERE advertisement_id = $1
      ORDER BY
        is_include DESC,
        target_type ASC,
        target_value ASC,
        id ASC
    `,
    [advertisementId]
  );

  return result.rows.map(mapTargetRow);
}

export async function findByAdvertisementIdAndType(
  advertisementId: number,
  targetType: AdvertisementTargetType,
  client?: PoolClient
): Promise<AdvertisementTarget[]> {
  const db = client ?? pool;

  const result = await db.query<AdvertisementTargetRow>(
    `
      SELECT ${selectColumns}
      FROM advertisement_targets
      WHERE advertisement_id = $1
        AND target_type = $2
      ORDER BY
        is_include DESC,
        target_value ASC,
        id ASC
    `,
    [advertisementId, targetType]
  );

  return result.rows.map(mapTargetRow);
}

export async function create(
  input: CreateAdvertisementTargetRecordInput,
  client?: PoolClient
): Promise<AdvertisementTarget> {
  const db = client ?? pool;
  const targetValue = normalizeTargetValue(input.targetValue);

  const result = await db.query<AdvertisementTargetRow>(
    `
      INSERT INTO advertisement_targets (
        advertisement_id,
        target_type,
        target_value,
        is_include
      )
      VALUES ($1, $2, $3, $4)
      RETURNING ${selectColumns}
    `,
    [
      input.advertisementId,
      input.targetType,
      targetValue,
      input.isInclude ?? true
    ]
  );

  const row = result.rows[0];

  if (row === undefined) {
    throw new Error("Failed to create advertisement targeting rule.");
  }

  return mapTargetRow(row);
}

export async function update(
  id: number,
  input: UpdateAdvertisementTargetInput,
  client?: PoolClient
): Promise<AdvertisementTarget | null> {
  const db = client ?? pool;

  const assignments: string[] = [];
  const values: unknown[] = [];

  if (input.targetType !== undefined) {
    values.push(input.targetType);
    assignments.push(`target_type = $${values.length}`);
  }

  if (input.targetValue !== undefined) {
    values.push(normalizeTargetValue(input.targetValue));
    assignments.push(`target_value = $${values.length}`);
  }

  if (input.isInclude !== undefined) {
    values.push(input.isInclude);
    assignments.push(`is_include = $${values.length}`);
  }

  if (assignments.length === 0) {
    return findById(id, client);
  }

  values.push(id);

  const result = await db.query<AdvertisementTargetRow>(
    `
      UPDATE advertisement_targets
      SET ${assignments.join(", ")}
      WHERE id = $${values.length}
      RETURNING ${selectColumns}
    `,
    values
  );

  const row = result.rows[0];

  return row === undefined ? null : mapTargetRow(row);
}

export async function deleteById(
  id: number,
  client?: PoolClient
): Promise<boolean> {
  const db = client ?? pool;

  const result = await db.query(
    `
      DELETE FROM advertisement_targets
      WHERE id = $1
    `,
    [id]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function deleteByAdvertisementId(
  advertisementId: number,
  client?: PoolClient
): Promise<number> {
  const db = client ?? pool;

  const result = await db.query(
    `
      DELETE FROM advertisement_targets
      WHERE advertisement_id = $1
    `,
    [advertisementId]
  );

  return result.rowCount ?? 0;
}
