import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementTarget,
  AdvertisementTargetType
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

const selectColumns = `  id,
  advertisement_id,
  target_type,
  target_value,
  is_include,
  created_at,
  updated_at`;

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

export async function findById(
  id: number,
  client?: PoolClient
): Promise<AdvertisementTarget | null> {
  const db = client ?? pool;

  const result = await db.query<AdvertisementTargetRow>(
    `       SELECT
        ${selectColumns}
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
    `       SELECT
        ${selectColumns}
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
    `       SELECT
        ${selectColumns}
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
