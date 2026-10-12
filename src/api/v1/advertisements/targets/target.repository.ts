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
  created_by: string | number | null;
  updated_by: string | number | null;
  created_by_name: string | null;
  updated_by_name: string | null;
}

const selectColumns = `
  target.id,
  target.advertisement_id,
  target.target_type,
  target.target_value,
  target.is_include,
  target.created_at,
  target.updated_at,
  target.created_by,
  target.updated_by,
  COALESCE(
    NULLIF(created_user.display_name, ''),
    NULLIF(created_user.full_name, ''),
    NULLIF(created_user.username, '')
  ) AS created_by_name,
  COALESCE(
    NULLIF(updated_user.display_name, ''),
    NULLIF(updated_user.full_name, ''),
    NULLIF(updated_user.username, '')
  ) AS updated_by_name
`;

const targetJoins = `
  LEFT JOIN users AS created_user
    ON created_user.id = target.created_by
  LEFT JOIN users AS updated_user
    ON updated_user.id = target.updated_by
`;

function mapNullableId(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

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
      row.updated_at instanceof Date
        ? row.updated_at
        : new Date(row.updated_at),
    createdBy: mapNullableId(row.created_by),
    updatedBy: mapNullableId(row.updated_by),
    createdByName: row.created_by_name ?? null,
    updatedByName: row.updated_by_name ?? null
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
      FROM advertisement_targets AS target
      ${targetJoins}
      WHERE target.id = $1
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
      FROM advertisement_targets AS target
      ${targetJoins}
      WHERE target.advertisement_id = $1
      ORDER BY
        target.is_include DESC,
        target.target_type ASC,
        target.target_value ASC,
        target.id ASC
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
      FROM advertisement_targets AS target
      ${targetJoins}
      WHERE target.advertisement_id = $1
        AND target.target_type = $2
      ORDER BY
        target.is_include DESC,
        target.target_value ASC,
        target.id ASC
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
        is_include,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        advertisement_id,
        target_type,
        target_value,
        is_include,
        created_at,
        updated_at,
        created_by,
        updated_by,
        NULL::text AS created_by_name,
        NULL::text AS updated_by_name
    `,
    [
      input.advertisementId,
      input.targetType,
      targetValue,
      input.isInclude ?? true,
      input.createdBy,
      input.updatedBy
    ]
  );

  const row = result.rows[0];

  if (row === undefined) {
    throw new Error("Failed to create advertisement targeting rule.");
  }

  /*
   * Resolve the user names after inserting. The INSERT ... RETURNING clause
   * intentionally avoids relying on the database to return joined columns.
   */
  const savedTarget = await findById(Number(row.id), client);

  if (!savedTarget) {
    throw new Error(
      "Advertisement targeting rule was created but could not be retrieved."
    );
  }

  return savedTarget;
}

export async function update(
  id: number,
  input: UpdateAdvertisementTargetInput,
  updatedBy: number,
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

  /*
   * An empty update must not generate an UPDATE statement or change updated_by.
   * Return the existing record using the same database connection supplied
   * by the caller, if any.
   */
  if (assignments.length === 0) {
    return findById(id, client);
  }

  /*
   * Always update updated_by for a genuine edit, even if the supplied values
   * happen to match the existing rule.
   */
  values.push(updatedBy);
  assignments.push(`updated_by = $${values.length}`);

  values.push(id);

  const result = await db.query<AdvertisementTargetRow>(
    `
      UPDATE advertisement_targets
      SET ${assignments.join(", ")}
      WHERE id = $${values.length}
      RETURNING
        id,
        advertisement_id,
        target_type,
        target_value,
        is_include,
        created_at,
        updated_at,
        created_by,
        updated_by,
        NULL::text AS created_by_name,
        NULL::text AS updated_by_name
    `,
    values
  );

  const row = result.rows[0];

  if (row === undefined) {
    return null;
  }

  return findById(Number(row.id), client);
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
