import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementCreative,
  AdvertisementCreativeStatus,
  AdvertisementCreativeType
} from "./creative.types.js";

interface AdvertisementCreativeRow {
  id: string | number;
  advertisement_id: string | number;
  format_id: string | number | null;
  creative_type: AdvertisementCreativeType;
  title: string | null;
  alt_text: string | null;
  media_url: string;
  thumbnail_url: string | null;
  width_px: number | null;
  height_px: number | null;
  display_order: number;
  is_primary: boolean;
  status: AdvertisementCreativeStatus;
  created_by: string | number | null;
  updated_by: string | number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const selectColumns = `  id,
  advertisement_id,
  format_id,
  creative_type,
  title,
  alt_text,
  media_url,
  thumbnail_url,
  width_px,
  height_px,
  display_order,
  is_primary,
  status,
  created_by,
  updated_by,
  created_at,
  updated_at`;

function mapCreativeRow(row: AdvertisementCreativeRow): AdvertisementCreative {
  return {
    id: Number(row.id),
    advertisementId: Number(row.advertisement_id),
    formatId: row.format_id === null ? null : Number(row.format_id),
    creativeType: row.creative_type,
    title: row.title,
    altText: row.alt_text,
    mediaUrl: row.media_url,
    thumbnailUrl: row.thumbnail_url,
    widthPx: row.width_px,
    heightPx: row.height_px,
    displayOrder: row.display_order,
    isPrimary: row.is_primary,
    status: row.status,
    createdBy: row.created_by === null ? null : Number(row.created_by),
    updatedBy: row.updated_by === null ? null : Number(row.updated_by),
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
): Promise<AdvertisementCreative | null> {
  const db = client ?? pool;

  const result = await db.query<AdvertisementCreativeRow>(
    `       SELECT
        ${selectColumns}
      FROM advertisement_creatives
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  const row = result.rows[0];

  return row === undefined ? null : mapCreativeRow(row);
}

export async function findByAdvertisementId(
  advertisementId: number,
  client?: PoolClient
): Promise<AdvertisementCreative[]> {
  const db = client ?? pool;

  const result = await db.query<AdvertisementCreativeRow>(
    `       SELECT
        ${selectColumns}
      FROM advertisement_creatives
      WHERE advertisement_id = $1
      ORDER BY
        is_primary DESC,
        display_order ASC,
        id ASC
    `,
    [advertisementId]
  );

  return result.rows.map(mapCreativeRow);
}

export async function findActiveByAdvertisementId(
  advertisementId: number,
  client?: PoolClient
): Promise<AdvertisementCreative[]> {
  const db = client ?? pool;

  const result = await db.query<AdvertisementCreativeRow>(
    `       SELECT
        ${selectColumns}
      FROM advertisement_creatives
      WHERE advertisement_id = $1
        AND status = 'ACTIVE'
      ORDER BY
        is_primary DESC,
        display_order ASC,
        id ASC
    `,
    [advertisementId]
  );

  return result.rows.map(mapCreativeRow);
}
