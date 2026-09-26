import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementPricingSnapshot,
  CreateAdvertisementPricingSnapshotInput
} from "./pricing-snapshot.types.js";

const mapPricingSnapshot = (
  row: Record<string, unknown>
): AdvertisementPricingSnapshot => ({
  id: Number(row.id),

  advertisementId: Number(row.advertisement_id),

  placementId: Number(row.placement_id),

  rateCardId: Number(row.rate_card_id),

  pricingUnit: row.pricing_unit as AdvertisementPricingSnapshot["pricingUnit"],

  rateAmount: Number(row.rate_amount),

  currencyCode: String(row.currency_code),

  rateEffectiveFrom: row.rate_effective_from as Date,

  rateEffectiveTo:
    row.rate_effective_to === null ? null : (row.rate_effective_to as Date),

  quantity:
    row.quantity === null || row.quantity === undefined
      ? null
      : Number(row.quantity),

  standardAmount:
    row.standard_amount === null || row.standard_amount === undefined
      ? null
      : Number(row.standard_amount),

  snapshotAt: row.snapshot_at as Date,

  createdBy: Number(row.created_by),

  createdAt: row.created_at as Date
});

const selectColumns = `
  id,
  advertisement_id,
  placement_id,
  rate_card_id,
  pricing_unit,
  rate_amount,
  currency_code,
  rate_effective_from,
  rate_effective_to,
  quantity,
  standard_amount,
  snapshot_at,
  created_by,
  created_at
`;

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<AdvertisementPricingSnapshot | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT ${selectColumns}
    FROM advertisement_pricing_snapshots
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  const row = result.rows[0];

  return row ? mapPricingSnapshot(row as Record<string, unknown>) : null;
};

export const findByAdvertisementId = async (
  advertisementId: number,
  client?: PoolClient
): Promise<AdvertisementPricingSnapshot[]> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT ${selectColumns}
    FROM advertisement_pricing_snapshots
    WHERE advertisement_id = $1
    ORDER BY snapshot_at DESC, id DESC
    `,
    [advertisementId]
  );

  return result.rows.map((row) =>
    mapPricingSnapshot(row as Record<string, unknown>)
  );
};

export const findLatestByAdvertisementId = async (
  advertisementId: number,
  client?: PoolClient
): Promise<AdvertisementPricingSnapshot | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT ${selectColumns}
    FROM advertisement_pricing_snapshots
    WHERE advertisement_id = $1
    ORDER BY snapshot_at DESC, id DESC
    LIMIT 1
    `,
    [advertisementId]
  );

  const row = result.rows[0];

  return row ? mapPricingSnapshot(row as Record<string, unknown>) : null;
};

export const findLatestByAdvertisementAndPlacement = async (
  advertisementId: number,
  placementId: number,
  client?: PoolClient
): Promise<AdvertisementPricingSnapshot | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT ${selectColumns}
    FROM advertisement_pricing_snapshots
    WHERE advertisement_id = $1
      AND placement_id = $2
    ORDER BY snapshot_at DESC, id DESC
    LIMIT 1
    `,
    [advertisementId, placementId]
  );

  const row = result.rows[0];

  return row ? mapPricingSnapshot(row as Record<string, unknown>) : null;
};

export const create = async (
  input: CreateAdvertisementPricingSnapshotInput,
  createdBy: number,
  client?: PoolClient
): Promise<AdvertisementPricingSnapshot> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    INSERT INTO advertisement_pricing_snapshots
    (
      advertisement_id,
      placement_id,
      rate_card_id,
      pricing_unit,
      rate_amount,
      currency_code,
      rate_effective_from,
      rate_effective_to,
      quantity,
      standard_amount,
      snapshot_at,
      created_by
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
      COALESCE($11, CURRENT_TIMESTAMP),
      $12
    )
    RETURNING ${selectColumns}
    `,
    [
      input.advertisementId,
      input.placementId,
      input.rateCardId,
      input.pricingUnit,
      input.rateAmount,
      input.currencyCode?.trim().toUpperCase() ?? "INR",
      input.rateEffectiveFrom,
      input.rateEffectiveTo ?? null,
      input.quantity,
      input.standardAmount,
      input.snapshotAt ?? null,
      createdBy
    ]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Advertisement pricing snapshot was not created.");
  }

  return mapPricingSnapshot(row as Record<string, unknown>);
};
