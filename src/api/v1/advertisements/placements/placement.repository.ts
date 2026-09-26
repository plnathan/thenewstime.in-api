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
  collapseWhenEmpty: row.collapse_when_empty,
  fallbackBehavior: row.fallback_behavior,
  displayFrequency: row.display_frequency,
  frequencyValue:
    row.frequency_value === null ? null : Number(row.frequency_value),
  autoCloseEnabled: row.auto_close_enabled,
  autoCloseSeconds:
    row.auto_close_seconds === null ? null : Number(row.auto_close_seconds),
  closeButtonEnabled: row.close_button_enabled,
  closeOnOverlayClick: row.close_on_overlay_click,
  status: row.status,
  createdBy: row.created_by === null ? null : Number(row.created_by),
  updatedBy: row.updated_by === null ? null : Number(row.updated_by),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const selectColumns = `  id,
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
  created_by,
  created_at,
  updated_by,
  updated_at`;

export const findAll = async (
  client?: PoolClient
): Promise<AdvertisementPlacement[]> => {
  const db = client ?? pool;

  const result = await db.query(
    `     SELECT ${selectColumns}
    FROM advertisement_placements
    ORDER BY page_type ASC, display_order ASC, id ASC
    `
  );

  return result.rows.map(mapPlacement);
};

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<AdvertisementPlacement | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `     SELECT ${selectColumns}
    FROM advertisement_placements
    WHERE id = $1
    LIMIT 1
    `,
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
    `     SELECT ${selectColumns}
    FROM advertisement_placements
    WHERE LOWER(code) = LOWER($1)
    LIMIT 1
    `,
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

  const result = await db.query(
    `     INSERT INTO advertisement_placements
    (
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
      $15,
      $16,
      $17,
      $18,
      $18
    )
    RETURNING ${selectColumns}
    `,
    [
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
    ]
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

  const result = await db.query(
    `     UPDATE advertisement_placements
    SET
      ${fields.join(",\n      ")},
      updated_by = $${values.length - 1},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $${values.length}
    RETURNING ${selectColumns}
    `,
    values
  );

  return result.rows[0] ? mapPlacement(result.rows[0]) : null;
};
