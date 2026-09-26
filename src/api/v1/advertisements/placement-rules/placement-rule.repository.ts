import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementPlacementRule,
  CreatePlacementRuleInput,
  PlacementRuleQuery,
  UpdatePlacementRuleInput
} from "./placement-rule.types.js";

const mapPlacementRule = (row: any): AdvertisementPlacementRule => ({
  id: Number(row.id),
  advertisementId: Number(row.advertisement_id),
  placementId: Number(row.placement_id),
  displayOrder: Number(row.display_order),
  insertionType: row.insertion_type,
  insertionPosition:
    row.insertion_position === null ? null : Number(row.insertion_position),
  maxImpressions:
    row.max_impressions === null ? null : Number(row.max_impressions),
  status: row.status,
  createdBy: row.created_by === null ? null : Number(row.created_by),
  updatedBy: row.updated_by === null ? null : Number(row.updated_by),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const selectColumns = `  id,
  advertisement_id,
  placement_id,
  display_order,
  insertion_type,
  insertion_position,
  max_impressions,
  status,
  created_by,
  updated_by,
  created_at,
  updated_at`;

export const findAll = async (
  query: PlacementRuleQuery = {},
  client?: PoolClient
): Promise<AdvertisementPlacementRule[]> => {
  const db = client ?? pool;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.advertisementId !== undefined) {
    values.push(query.advertisementId);
    conditions.push(`advertisement_id = $${values.length}`);
  }

  if (query.placementId !== undefined) {
    values.push(query.placementId);
    conditions.push(`placement_id = $${values.length}`);
  }

  if (query.status !== undefined) {
    values.push(query.status);
    conditions.push(`status = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await db.query(
    `       SELECT ${selectColumns}
      FROM advertisement_placement_rules
      ${whereClause}
      ORDER BY display_order ASC, id ASC
    `,
    values
  );

  return result.rows.map(mapPlacementRule);
};

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<AdvertisementPlacementRule | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `       SELECT ${selectColumns}
      FROM advertisement_placement_rules
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ? mapPlacementRule(result.rows[0]) : null;
};

export const findByAdvertisementAndPlacement = async (
  advertisementId: number,
  placementId: number,
  client?: PoolClient
): Promise<AdvertisementPlacementRule | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `       SELECT ${selectColumns}
      FROM advertisement_placement_rules
      WHERE advertisement_id = $1
        AND placement_id = $2
      LIMIT 1
    `,
    [advertisementId, placementId]
  );

  return result.rows[0] ? mapPlacementRule(result.rows[0]) : null;
};

export const create = async (
  input: CreatePlacementRuleInput,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementPlacementRule> => {
  const db = client ?? pool;

  const result = await db.query(
    `       INSERT INTO advertisement_placement_rules
      (
        advertisement_id,
        placement_id,
        display_order,
        insertion_type,
        insertion_position,
        max_impressions,
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
        $8
      )
      RETURNING ${selectColumns}
    `,
    [
      input.advertisementId,
      input.placementId,
      input.displayOrder ?? 0,
      input.insertionType ?? "FIXED",
      input.insertionPosition ?? null,
      input.maxImpressions ?? null,
      input.status ?? "ACTIVE",
      userId
    ]
  );

  return mapPlacementRule(result.rows[0]);
};

export const update = async (
  id: number,
  input: UpdatePlacementRuleInput,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementPlacementRule | null> => {
  const db = client ?? pool;

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (column: string, value: unknown): void => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (input.displayOrder !== undefined) {
    add("display_order", input.displayOrder);
  }

  if (input.insertionType !== undefined) {
    add("insertion_type", input.insertionType);
  }

  if (input.insertionPosition !== undefined) {
    add("insertion_position", input.insertionPosition);
  }

  if (input.maxImpressions !== undefined) {
    add("max_impressions", input.maxImpressions);
  }

  if (input.status !== undefined) {
    add("status", input.status);
  }

  if (fields.length === 0) {
    return findById(id, client);
  }

  values.push(userId);
  values.push(id);

  const result = await db.query(
    `       UPDATE advertisement_placement_rules
      SET
        ${fields.join(",\n        ")},
        updated_by = $${values.length - 1},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING ${selectColumns}
    `,
    values
  );

  return result.rows[0] ? mapPlacementRule(result.rows[0]) : null;
};

export const deactivate = async (
  id: number,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementPlacementRule | null> => {
  return update(
    id,
    {
      status: "INACTIVE"
    },
    userId,
    client
  );
};
