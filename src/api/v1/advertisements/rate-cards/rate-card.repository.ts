import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementRateCard,
  AdvertisementRateCardSearchFilters,
  CreateAdvertisementRateCardInput,
  UpdateAdvertisementRateCardInput
} from "./rate-card.types.js";

const mapRateCard = (row: any): AdvertisementRateCard => ({
  id: Number(row.id),
  placementId: Number(row.placement_id),
  pricingUnit: row.pricing_unit,
  rateAmount: Number(row.rate_amount),
  currencyCode: row.currency_code,
  effectiveFrom: row.effective_from,
  effectiveTo: row.effective_to,
  status: row.status,
  createdBy: Number(row.created_by),
  updatedBy: row.updated_by === null ? null : Number(row.updated_by),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const selectColumns = `
  id,
  placement_id,
  pricing_unit,
  rate_amount,
  currency_code,
  effective_from,
  effective_to,
  status,
  created_by,
  updated_by,
  created_at,
  updated_at
`;

export const findAll = async (
  filters: AdvertisementRateCardSearchFilters = {},
  client?: PoolClient
): Promise<AdvertisementRateCard[]> => {
  const db = client ?? pool;

  const conditions: string[] = [];
  const values: unknown[] = [];

  const addCondition = (condition: string, value: unknown): void => {
    values.push(value);
    conditions.push(condition.replace("$VALUE", `$${values.length}`));
  };

  if (filters.placementId !== undefined) {
    addCondition("placement_id = $VALUE", filters.placementId);
  }

  if (filters.pricingUnit !== undefined) {
    addCondition("pricing_unit = $VALUE", filters.pricingUnit);
  }

  if (filters.status !== undefined) {
    addCondition("status = $VALUE", filters.status);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join("\n      AND ")}` : "";

  const result = await db.query(
    `
    SELECT ${selectColumns}
    FROM advertisement_rate_cards
    ${whereClause}
    ORDER BY
      placement_id ASC,
      effective_from DESC,
      id DESC
    `,
    values
  );

  return result.rows.map(mapRateCard);
};

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<AdvertisementRateCard | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT ${selectColumns}
    FROM advertisement_rate_cards
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ? mapRateCard(result.rows[0]) : null;
};

export const findByPlacementId = async (
  placementId: number,
  client?: PoolClient
): Promise<AdvertisementRateCard[]> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT ${selectColumns}
    FROM advertisement_rate_cards
    WHERE placement_id = $1
    ORDER BY
      effective_from DESC,
      id DESC
    `,
    [placementId]
  );

  return result.rows.map(mapRateCard);
};

export const findEffectiveRate = async (
  placementId: number,
  pricingUnit: AdvertisementRateCard["pricingUnit"],
  effectiveAt: Date | string,
  client?: PoolClient
): Promise<AdvertisementRateCard | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT ${selectColumns}
    FROM advertisement_rate_cards
    WHERE placement_id = $1
      AND pricing_unit = $2
      AND status = 'ACTIVE'
      AND effective_from <= $3
      AND (
        effective_to IS NULL
        OR effective_to > $3
      )
    ORDER BY
      effective_from DESC,
      id DESC
    LIMIT 1
    `,
    [placementId, pricingUnit, effectiveAt]
  );

  return result.rows[0] ? mapRateCard(result.rows[0]) : null;
};

export const create = async (
  input: CreateAdvertisementRateCardInput,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementRateCard> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    INSERT INTO advertisement_rate_cards
    (
      placement_id,
      pricing_unit,
      rate_amount,
      currency_code,
      effective_from,
      effective_to,
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
      input.placementId,
      input.pricingUnit,
      input.rateAmount,
      input.currencyCode?.trim().toUpperCase() ?? "INR",
      input.effectiveFrom,
      input.effectiveTo ?? null,
      input.status ?? "ACTIVE",
      userId
    ]
  );

  return mapRateCard(result.rows[0]);
};

export const update = async (
  id: number,
  input: UpdateAdvertisementRateCardInput,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementRateCard | null> => {
  const db = client ?? pool;

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (column: string, value: unknown): void => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (input.placementId !== undefined) {
    add("placement_id", input.placementId);
  }

  if (input.pricingUnit !== undefined) {
    add("pricing_unit", input.pricingUnit);
  }

  if (input.rateAmount !== undefined) {
    add("rate_amount", input.rateAmount);
  }

  if (input.currencyCode !== undefined) {
    add("currency_code", input.currencyCode.trim().toUpperCase());
  }

  if (input.effectiveFrom !== undefined) {
    add("effective_from", input.effectiveFrom);
  }

  if (input.effectiveTo !== undefined) {
    add("effective_to", input.effectiveTo);
  }

  if (input.status !== undefined) {
    add("status", input.status);
  }

  if (fields.length === 0) {
    return findById(id, client);
  }

  values.push(userId);
  const updatedByParameter = values.length;

  values.push(id);
  const idParameter = values.length;

  const result = await db.query(
    `
    UPDATE advertisement_rate_cards
    SET
      ${fields.join(",\n      ")},
      updated_by = $${updatedByParameter},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $${idParameter}
    RETURNING ${selectColumns}
    `,
    values
  );

  return result.rows[0] ? mapRateCard(result.rows[0]) : null;
};
