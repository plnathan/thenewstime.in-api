import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementPlacement,
  CreateAdvertisementPlacementInput,
  UpdateAdvertisementPlacementInput
} from "./placement.types.js";

const mapPlacement = (row: any): AdvertisementPlacement => ({
  id: Number(row.id),
  code: row.code,
  displayName: row.display_name,
  description: row.description,
  pageType: row.page_type,
  placementType: row.placement_type,
  insertionType: row.insertion_type,
  displayOrder: Number(row.display_order),
  isEnabled: row.is_enabled,

  formatId:
    row.format_id === null || row.format_id === undefined
      ? null
      : Number(row.format_id),

  format:
    row.format_id === null || row.format_id === undefined
      ? null
      : {
          id: Number(row.format_id),
          code: row.format_code ?? "",
          displayName: row.format_display_name ?? "",
          description: row.format_description ?? null,
          widthPx:
            row.format_width_px === null || row.format_width_px === undefined
              ? null
              : Number(row.format_width_px),
          heightPx:
            row.format_height_px === null || row.format_height_px === undefined
              ? null
              : Number(row.format_height_px),
          isResponsive: row.format_is_responsive ?? false
        },

  collapseWhenEmpty: row.collapse_when_empty,
  fallbackBehavior: row.fallback_behavior,
  displayFrequency: row.display_frequency,
  frequencyValue:
    row.frequency_value === null || row.frequency_value === undefined
      ? null
      : Number(row.frequency_value),
  autoCloseEnabled: row.auto_close_enabled,
  autoCloseSeconds:
    row.auto_close_seconds === null || row.auto_close_seconds === undefined
      ? null
      : Number(row.auto_close_seconds),
  closeButtonEnabled: row.close_button_enabled,
  closeOnOverlayClick: row.close_on_overlay_click,
  status: row.status,
  createdBy:
    row.created_by === null || row.created_by === undefined
      ? null
      : Number(row.created_by),
  updatedBy:
    row.updated_by === null || row.updated_by === undefined
      ? null
      : Number(row.updated_by),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const selectColumns = `
  p.id,
  p.code,
  p.display_name,
  p.description,
  p.page_type,
  p.placement_type,
  p.insertion_type,
  p.display_order,
  p.is_enabled,
  p.format_id,

  f.code AS format_code,
  f.display_name AS format_display_name,
  f.description AS format_description,
  f.width_px AS format_width_px,
  f.height_px AS format_height_px,
  f.is_responsive AS format_is_responsive,

  p.collapse_when_empty,
  p.fallback_behavior,
  p.display_frequency,
  p.frequency_value,
  p.auto_close_enabled,
  p.auto_close_seconds,
  p.close_button_enabled,
  p.close_on_overlay_click,
  p.status,
  p.created_by,
  p.created_at,
  p.updated_by,
  p.updated_at
`;

const returningColumns = `
  id,
  code,
  display_name,
  description,
  page_type,
  placement_type,
  insertion_type,
  display_order,
  is_enabled,
  collapse_when_empty,
  fallback_behavior,
  display_frequency,
  frequency_value,
  auto_close_enabled,
  auto_close_seconds,
  close_button_enabled,
  close_on_overlay_click,
  status,
  format_id,
  created_by,
  created_at,
  updated_by,
  updated_at
`;

export const findAll = async (
  client?: PoolClient
): Promise<AdvertisementPlacement[]> => {
  const db = client ?? pool;

  const result = await db.query(
    `SELECT ${selectColumns}
     FROM advertisement_placements p
     LEFT JOIN advertisement_formats f
       ON f.id = p.format_id
      AND f.status = 'ACTIVE'
     ORDER BY p.page_type ASC, p.display_order ASC, p.id ASC`
  );

  return result.rows.map(mapPlacement);
};

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<AdvertisementPlacement | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `SELECT ${selectColumns}
     FROM advertisement_placements p
     LEFT JOIN advertisement_formats f
       ON f.id = p.format_id
      AND f.status = 'ACTIVE'
     WHERE p.id = $1
     LIMIT 1`,
    [id]
  );

  return result.rows[0] ? mapPlacement(result.rows[0]) : null;
};

export const findByCode = async (
  code: string,
  client?: PoolClient
): Promise<AdvertisementPlacement | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `SELECT ${selectColumns}
     FROM advertisement_placements p
     LEFT JOIN advertisement_formats f
       ON f.id = p.format_id
      AND f.status = 'ACTIVE'
     WHERE LOWER(p.code) = LOWER($1)
     LIMIT 1`,
    [code]
  );

  return result.rows[0] ? mapPlacement(result.rows[0]) : null;
};

export const create = async (
  input: CreateAdvertisementPlacementInput,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementPlacement> => {
  const db = client ?? pool;

  const columns = [
    "code",
    "display_name",
    "description",
    "page_type",
    "placement_type",
    "insertion_type",
    "display_order",
    "is_enabled",
    "collapse_when_empty",
    "fallback_behavior",
    "display_frequency",
    "frequency_value",
    "auto_close_enabled",
    "auto_close_seconds",
    "close_button_enabled",
    "close_on_overlay_click",
    "status",
    "created_by",
    "updated_by"
  ];

  const values: unknown[] = [
    input.code.trim(),
    input.displayName.trim(),
    input.description?.trim() || null,
    input.pageType,
    input.placementType,
    input.insertionType ?? "FIXED",
    input.displayOrder ?? 0,
    input.isEnabled ?? true,
    input.collapseWhenEmpty ?? true,
    input.fallbackBehavior ?? "HIDE",
    input.displayFrequency ?? null,
    input.frequencyValue ?? null,
    input.autoCloseEnabled ?? false,
    input.autoCloseSeconds ?? null,
    input.closeButtonEnabled ?? true,
    input.closeOnOverlayClick ?? true,
    input.status ?? "ACTIVE",
    userId
  ];

  const placeholders = [
    "$1",
    "$2",
    "$3",
    "$4",
    "$5",
    "$6",
    "$7",
    "$8",
    "$9",
    "$10",
    "$11",
    "$12",
    "$13",
    "$14",
    "$15",
    "$16",
    "$17",
    "$18",
    "$18"
  ];

  if (input.formatId !== undefined) {
    columns.push("format_id");
    values.push(input.formatId);
    placeholders.push(`$${values.length}`);
  }

  const result = await db.query(
    `WITH inserted AS (
      INSERT INTO advertisement_placements
      (
        ${columns.join(",\n        ")}
      )
      VALUES
      (
        ${placeholders.join(",\n        ")}
      )
      RETURNING ${returningColumns}
    )
    SELECT ${selectColumns}
    FROM inserted p
    LEFT JOIN advertisement_formats f
      ON f.id = p.format_id
     AND f.status = 'ACTIVE'`,
    values
  );

  return mapPlacement(result.rows[0]);
};

export const update = async (
  id: number,
  input: UpdateAdvertisementPlacementInput,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementPlacement | null> => {
  const db = client ?? pool;

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (column: string, value: unknown): void => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (input.displayName !== undefined) {
    add("display_name", input.displayName.trim());
  }

  if (input.description !== undefined) {
    add("description", input.description.trim() || null);
  }

  if (input.pageType !== undefined) {
    add("page_type", input.pageType);
  }

  if (input.placementType !== undefined) {
    add("placement_type", input.placementType);
  }

  if (input.insertionType !== undefined) {
    add("insertion_type", input.insertionType);
  }

  if (input.displayOrder !== undefined) {
    add("display_order", input.displayOrder);
  }

  if (input.isEnabled !== undefined) {
    add("is_enabled", input.isEnabled);
  }

  if (input.formatId !== undefined) {
    add("format_id", input.formatId);
  }

  if (input.collapseWhenEmpty !== undefined) {
    add("collapse_when_empty", input.collapseWhenEmpty);
  }

  if (input.fallbackBehavior !== undefined) {
    add("fallback_behavior", input.fallbackBehavior);
  }

  if (input.displayFrequency !== undefined) {
    add("display_frequency", input.displayFrequency);
  }

  if (input.frequencyValue !== undefined) {
    add("frequency_value", input.frequencyValue);
  }

  if (input.autoCloseEnabled !== undefined) {
    add("auto_close_enabled", input.autoCloseEnabled);
  }

  if (input.autoCloseSeconds !== undefined) {
    add("auto_close_seconds", input.autoCloseSeconds);
  }

  if (input.closeButtonEnabled !== undefined) {
    add("close_button_enabled", input.closeButtonEnabled);
  }

  if (input.closeOnOverlayClick !== undefined) {
    add("close_on_overlay_click", input.closeOnOverlayClick);
  }

  if (input.status !== undefined) {
    add("status", input.status);
  }

  if (fields.length === 0) {
    return findById(id, client);
  }

  values.push(userId, id);

  const updatedByParameter = values.length - 1;
  const idParameter = values.length;

  const result = await db.query(
    `WITH updated AS (
      UPDATE advertisement_placements
      SET
        ${fields.join(",\n        ")},
        updated_by = $${updatedByParameter},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idParameter}
      RETURNING ${returningColumns}
    )
    SELECT ${selectColumns}
    FROM updated p
    LEFT JOIN advertisement_formats f
      ON f.id = p.format_id
     AND f.status = 'ACTIVE'`,
    values
  );

  return result.rows[0] ? mapPlacement(result.rows[0]) : null;
};

export interface AdvertisementPlacementFormatLookup {
  id: number;
  code: string;
  displayName: string;
  description: string | null;
  widthPx: number | null;
  heightPx: number | null;
  isResponsive: boolean;
}

export const findActiveFormatById = async (
  id: number,
  client?: PoolClient
): Promise<AdvertisementPlacementFormatLookup | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT
      id,
      code,
      display_name,
      description,
      width_px,
      height_px,
      is_responsive
    FROM advertisement_formats
    WHERE id = $1
      AND status = 'ACTIVE'
    LIMIT 1
    `,
    [id]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    code: row.code,
    displayName: row.display_name,
    description: row.description,
    widthPx:
      row.width_px === null || row.width_px === undefined
        ? null
        : Number(row.width_px),
    heightPx:
      row.height_px === null || row.height_px === undefined
        ? null
        : Number(row.height_px),
    isResponsive: row.is_responsive
  };
};
