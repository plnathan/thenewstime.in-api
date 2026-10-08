import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementCreative,
  CreateAdvertisementCreativeInput,
  UpdateAdvertisementCreativeInput
} from "./creative.types.js";

interface AdvertisementCreativeDbRow {
  id: string | number;
  advertisement_id: string | number;
  format_id: string | number | null;
  creative_type: AdvertisementCreative["creativeType"];
  variant: AdvertisementCreative["variant"];
  title: string | null;
  alt_text: string | null;
  media_url: string;
  thumbnail_url: string | null;
  width_px: number | null;
  height_px: number | null;
  display_order: number;
  is_primary: boolean;
  status: AdvertisementCreative["status"];
  created_by: string | number | null;
  updated_by: string | number | null;
  created_at: Date;
  updated_at: Date;
}

const SELECT_COLUMNS = `
  id,
  advertisement_id,
  format_id,
  creative_type,
  variant,
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
  updated_at
`;

const mapCreative = (
  row: AdvertisementCreativeDbRow
): AdvertisementCreative => ({
  id: Number(row.id),
  advertisementId: Number(row.advertisement_id),
  formatId: row.format_id === null ? null : Number(row.format_id),
  creativeType: row.creative_type,
  variant: row.variant,
  title: row.title,
  altText: row.alt_text,
  mediaUrl: row.media_url,
  thumbnailUrl: row.thumbnail_url,
  widthPx: row.width_px === null ? null : Number(row.width_px),
  heightPx: row.height_px === null ? null : Number(row.height_px),
  displayOrder: Number(row.display_order),
  isPrimary: row.is_primary,
  status: row.status,
  createdBy: row.created_by === null ? null : Number(row.created_by),
  updatedBy: row.updated_by === null ? null : Number(row.updated_by),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<AdvertisementCreative | null> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementCreativeDbRow>(
    `
    SELECT ${SELECT_COLUMNS}
    FROM advertisement_creatives
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ? mapCreative(result.rows[0]) : null;
};

export const findByAdvertisementId = async (
  advertisementId: number,
  client?: PoolClient
): Promise<AdvertisementCreative[]> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementCreativeDbRow>(
    `
    SELECT ${SELECT_COLUMNS}
    FROM advertisement_creatives
    WHERE advertisement_id = $1
    ORDER BY
      variant ASC,
      is_primary DESC,
      display_order ASC,
      id ASC
    `,
    [advertisementId]
  );

  return result.rows.map(mapCreative);
};

export const findActiveByAdvertisementId = async (
  advertisementId: number,
  client?: PoolClient
): Promise<AdvertisementCreative[]> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementCreativeDbRow>(
    `
    SELECT ${SELECT_COLUMNS}
    FROM advertisement_creatives
    WHERE advertisement_id = $1
      AND status = 'ACTIVE'
    ORDER BY
      variant ASC,
      is_primary DESC,
      display_order ASC,
      id ASC
    `,
    [advertisementId]
  );

  return result.rows.map(mapCreative);
};

export const findActiveByAdvertisementAndVariant = async (
  advertisementId: number,
  variant: AdvertisementCreative["variant"],
  client?: PoolClient
): Promise<AdvertisementCreative | null> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementCreativeDbRow>(
    `
    SELECT ${SELECT_COLUMNS}
    FROM advertisement_creatives
    WHERE advertisement_id = $1
      AND variant = $2
      AND status = 'ACTIVE'
    ORDER BY
      is_primary DESC,
      display_order ASC,
      id ASC
    LIMIT 1
    `,
    [advertisementId, variant]
  );

  return result.rows[0] ? mapCreative(result.rows[0]) : null;
};

export const findByAdvertisementAndVariant = async (
  advertisementId: number,
  variant: AdvertisementCreative["variant"],
  client?: PoolClient
): Promise<AdvertisementCreative[]> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementCreativeDbRow>(
    `
    SELECT ${SELECT_COLUMNS}
    FROM advertisement_creatives
    WHERE advertisement_id = $1
      AND variant = $2
    ORDER BY
      is_primary DESC,
      display_order ASC,
      id ASC
    `,
    [advertisementId, variant]
  );

  return result.rows.map(mapCreative);
};

export const create = async (
  advertisementId: number,
  input: CreateAdvertisementCreativeInput,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementCreative> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementCreativeDbRow>(
    `
    INSERT INTO advertisement_creatives
    (
      advertisement_id,
      format_id,
      creative_type,
      variant,
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
      updated_by
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13,
      $14,
      $14
    )
    RETURNING ${SELECT_COLUMNS}
    `,
    [
      advertisementId,
      input.formatId ?? null,
      input.creativeType,
      input.variant ?? "DESKTOP",
      input.title?.trim() || null,
      input.altText?.trim() || null,
      input.mediaUrl.trim(),
      input.thumbnailUrl?.trim() || null,
      input.widthPx ?? null,
      input.heightPx ?? null,
      input.displayOrder ?? 0,
      input.isPrimary ?? false,
      input.status ?? "ACTIVE",
      userId
    ]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Advertisement creative creation returned no row.");
  }

  return mapCreative(row);
};

export const update = async (
  id: number,
  input: UpdateAdvertisementCreativeInput,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementCreative | null> => {
  const db = client ?? pool;

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (column: string, value: unknown): void => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (input.formatId !== undefined) {
    add("format_id", input.formatId);
  }

  if (input.creativeType !== undefined) {
    add("creative_type", input.creativeType);
  }

  if (input.variant !== undefined) {
    add("variant", input.variant);
  }

  if (input.title !== undefined) {
    add("title", input.title?.trim() || null);
  }

  if (input.altText !== undefined) {
    add("alt_text", input.altText?.trim() || null);
  }

  if (input.mediaUrl !== undefined) {
    add("media_url", input.mediaUrl.trim());
  }

  if (input.thumbnailUrl !== undefined) {
    add("thumbnail_url", input.thumbnailUrl?.trim() || null);
  }

  if (input.widthPx !== undefined) {
    add("width_px", input.widthPx);
  }

  if (input.heightPx !== undefined) {
    add("height_px", input.heightPx);
  }

  if (input.displayOrder !== undefined) {
    add("display_order", input.displayOrder);
  }

  if (input.isPrimary !== undefined) {
    add("is_primary", input.isPrimary);
  }

  if (input.status !== undefined) {
    add("status", input.status);
  }

  if (fields.length === 0) {
    return findById(id, client);
  }

  values.push(userId);
  values.push(id);

  const result = await db.query<AdvertisementCreativeDbRow>(
    `
    UPDATE advertisement_creatives
    SET
      ${fields.join(",\n      ")},
      updated_by = $${values.length - 1},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $${values.length}
    RETURNING ${SELECT_COLUMNS}
    `,
    values
  );

  return result.rows[0] ? mapCreative(result.rows[0]) : null;
};

export const clearPrimaryForVariant = async (
  advertisementId: number,
  variant: AdvertisementCreative["variant"],
  excludeCreativeId?: number,
  client?: PoolClient
): Promise<void> => {
  const db = client ?? pool;

  if (excludeCreativeId !== undefined) {
    await db.query(
      `
      UPDATE advertisement_creatives
      SET
        is_primary = FALSE,
        updated_at = CURRENT_TIMESTAMP
      WHERE advertisement_id = $1
        AND variant = $2
        AND id <> $3
        AND is_primary = TRUE
      `,
      [advertisementId, variant, excludeCreativeId]
    );

    return;
  }

  await db.query(
    `
    UPDATE advertisement_creatives
    SET
      is_primary = FALSE,
      updated_at = CURRENT_TIMESTAMP
    WHERE advertisement_id = $1
      AND variant = $2
      AND is_primary = TRUE
    `,
    [advertisementId, variant]
  );
};

export const remove = async (
  id: number,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementCreative | null> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementCreativeDbRow>(
    `
    UPDATE advertisement_creatives
    SET
      status = 'INACTIVE',
      updated_by = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING ${SELECT_COLUMNS}
    `,
    [userId, id]
  );

  return result.rows[0] ? mapCreative(result.rows[0]) : null;
};

export const findAdvertisement = async (
  advertisementId: number,
  client?: PoolClient
): Promise<{
  id: number;
  workflowStatus: string;
  status: string;
} | null> => {
  const db = client ?? pool;

  const result = await db.query<{
    id: string | number;
    workflow_status: string;
    status: string;
  }>(
    `
    SELECT
      id,
      workflow_status,
      status
    FROM advertisements
    WHERE id = $1
    LIMIT 1
    `,
    [advertisementId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    workflowStatus: row.workflow_status,
    status: row.status
  };
};

export const findFormat = async (
  formatId: number,
  client?: PoolClient
): Promise<{
  id: number;
  widthPx: number | null;
  heightPx: number | null;
  mobileWidthPx: number | null;
  mobileHeightPx: number | null;
  status: string;
} | null> => {
  const db = client ?? pool;

  const result = await db.query<{
    id: string | number;
    width_px: number | null;
    height_px: number | null;
    mobile_width_px: number | null;
    mobile_height_px: number | null;
    status: string;
  }>(
    `
    SELECT
      id,
      width_px,
      height_px,
      mobile_width_px,
      mobile_height_px,
      status
    FROM advertisement_formats
    WHERE id = $1
    LIMIT 1
    `,
    [formatId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    widthPx: row.width_px === null ? null : Number(row.width_px),
    heightPx: row.height_px === null ? null : Number(row.height_px),
    mobileWidthPx:
      row.mobile_width_px === null ? null : Number(row.mobile_width_px),
    mobileHeightPx:
      row.mobile_height_px === null ? null : Number(row.mobile_height_px),
    status: row.status
  };
};
