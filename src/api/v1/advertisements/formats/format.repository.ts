import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementFormat,
  AdvertisementFormatStatus
} from "./format.types.js";

interface AdvertisementFormatRow {
  id: string | number;
  code: string;
  display_name: string;
  description: string | null;
  width_px: number | null;
  height_px: number | null;
  is_responsive: boolean;
  is_system_format: boolean;
  status: AdvertisementFormatStatus;
  display_order: number;
  created_at: Date | string;
  updated_at: Date | string;
}

const selectColumns = `  id,
  code,
  display_name,
  description,
  width_px,
  height_px,
  is_responsive,
  is_system_format,
  status,
  display_order,
  created_at,
  updated_at`;

function mapFormatRow(row: AdvertisementFormatRow): AdvertisementFormat {
  return {
    id: Number(row.id),
    code: row.code,
    displayName: row.display_name,
    description: row.description,
    widthPx: row.width_px,
    heightPx: row.height_px,
    isResponsive: row.is_responsive,
    isSystemFormat: row.is_system_format,
    status: row.status,
    displayOrder: row.display_order,
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
): Promise<AdvertisementFormat | null> {
  const db = client ?? pool;

  const result = await db.query<AdvertisementFormatRow>(
    `       SELECT
        ${selectColumns}
      FROM advertisement_formats
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapFormatRow(row);
}

export async function findByCode(
  code: string,
  client?: PoolClient
): Promise<AdvertisementFormat | null> {
  const db = client ?? pool;

  const result = await db.query<AdvertisementFormatRow>(
    `       SELECT
        ${selectColumns}
      FROM advertisement_formats
      WHERE code = $1
      LIMIT 1
    `,
    [code]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapFormatRow(row);
}

export async function findAll(
  status?: AdvertisementFormatStatus,
  client?: PoolClient
): Promise<AdvertisementFormat[]> {
  const db = client ?? pool;

  const values: AdvertisementFormatStatus[] = [];
  let whereClause = "";

  if (status !== undefined) {
    values.push(status);
    whereClause = "WHERE status = $1";
  }

  const result = await db.query<AdvertisementFormatRow>(
    `       SELECT
        ${selectColumns}
      FROM advertisement_formats
      ${whereClause}
      ORDER BY
        display_order ASC,
        id ASC
    `,
    values
  );

  return result.rows.map(mapFormatRow);
}

export async function findActiveById(
  id: number,
  client?: PoolClient
): Promise<AdvertisementFormat | null> {
  const db = client ?? pool;

  const result = await db.query<AdvertisementFormatRow>(
    `       SELECT
        ${selectColumns}
      FROM advertisement_formats
      WHERE id = $1
        AND status = 'ACTIVE'
      LIMIT 1
    `,
    [id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapFormatRow(row);
}
