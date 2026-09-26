import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import {
  mapAdvertisementListRow,
  mapAdvertisementRow,
  mapClientRow
} from "./advertisement.db.mapper.js";

import type {
  Advertisement,
  AdvertisementCalculatedFinancialFields,
  AdvertisementCalculatedPricingFields,
  AdvertisementClient,
  AdvertisementListItem,
  AdvertisementSearchFilters,
  AdvertisementWorkflowHistory,
  AdvertisementWorkflowStatus,
  CreateAdvertisementInput,
  UpdateAdvertisementInput
} from "./advertisement.types.js";

interface AdvertisementRow {
  id: number | string;
  client_id: number | string | null;
  campaign_id: number | string | null;

  name: string;
  internal_name: string | null;

  advertisement_type:
    "DISPLAY" | "BANNER" | "VIDEO" | "NATIVE" | "POPUP" | "OVERLAY";

  destination_url: string | null;

  priority: number;

  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

  start_at: Date | null;
  end_at: Date | null;

  is_clickable: boolean;
  open_in_new_tab: boolean;

  notes: string | null;

  workflow_status:
    "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ON_HOLD" | "ARCHIVED";

  submitted_at: Date | null;
  submitted_by: number | string | null;

  approved_at: Date | null;
  approved_by: number | string | null;

  rejected_at: Date | null;
  rejected_by: number | string | null;
  rejection_reason: string | null;

  on_hold_at: Date | null;
  on_hold_by: number | string | null;
  on_hold_reason: string | null;

  /*
   * Legacy / compatibility negotiated amount column.
   *
   * Existing repository/service/payment code still refers to
   * advertisements.advertisement_amount.
   */
  advertisement_amount: string | number | null;

  /*
   * FIX:
   * Current advertisement.db.mapper.ts expects agreed_amount.
   *
   * The database contains agreed_amount as the canonical
   * negotiated/agreed commercial amount.
   */
  agreed_amount: string | number | null;

  standard_amount: string | number | null;

  pricing_placement_id: number | string | null;

  pricing_unit:
    "DAY" | "WEEK" | "MONTH" | "IMPRESSION" | "CAMPAIGN" | "FIXED" | null;

  pricing_quantity: string | number | null;

  discount_percentage: string | number | null;
  discount_amount: string | number | null;

  advance_percentage: string | number | null;
  advance_amount: string | number | null;

  adjustment_amount: string | number | null;
  adjustment_reason: string | null;
  adjustment_by: number | string | null;
  adjustment_at: Date | null;

  currency_code: string;

  created_by: number | string | null;
  updated_by: number | string | null;

  created_at: Date;
  updated_at: Date;

  client_id_join: number | string | null;
  client_code: string | null;
  client_name: string | null;

  is_house_ad: boolean;
}

interface AdvertisementClientRow {
  id: number | string;
  client_code: string;
  name: string;
  display_name: string | null;
  business_name: string | null;
  business_type_id: number | string | null;

  business_type_code: string | null;
  business_type_display_name: string | null;
  business_type_description: string | null;
  business_type_display_order: number | null;
  business_type_status: "ACTIVE" | "INACTIVE" | null;

  website: string | null;
  primary_address: string | null;
  communication_address: string | null;
  contact_person: string | null;
  contact_no: string | null;
  alternate_mobile: string | null;
  email: string | null;
  alternate_email: string | null;
  website_url: string | null;

  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  notes: string | null;

  ad_creation_hold: boolean;
  ad_creation_hold_type: "AUTOMATIC" | "MANUAL" | null;
  ad_creation_hold_reason: string | null;
  ad_creation_hold_remarks: string | null;
  ad_creation_hold_at: Date | null;
  ad_creation_hold_by: number | string | null;
  ad_creation_unhold_at: Date | null;
  ad_creation_unhold_by: number | string | null;
  ad_creation_unhold_reason: string | null;

  payment_attention_required: boolean;

  created_by: number | string | null;
  updated_by: number | string | null;
  created_at: Date;
  updated_at: Date;
}

interface AdvertisementWorkflowHistoryRow {
  id: number | string;
  advertisement_id: number | string;
  from_status: AdvertisementWorkflowStatus | null;
  to_status: AdvertisementWorkflowStatus;
  remarks: string | null;
  performed_by: number | string | null;
  performed_at: Date;
}

const advertisementSelect = `
  SELECT
    a.*,

    /*
     * FIX:
     * Explicitly expose agreed_amount for the current
     * advertisement.db.mapper.ts contract.
     *
     * a.* is retained so all existing advertisement columns
     * continue to be returned unchanged.
     */
    a.advertisement_amount AS agreed_amount,

    c.id AS client_id_join,
    c.client_code,
    c.name AS client_name
  FROM advertisements a
  LEFT JOIN advertisement_clients c
    ON c.id = a.client_id`;

const clientSelect = `
  SELECT
    c.*,
    bt.code AS business_type_code,
    bt.display_name AS business_type_display_name,
    bt.description AS business_type_description,
    bt.display_order AS business_type_display_order,
    bt.status AS business_type_status
  FROM advertisement_clients c
  LEFT JOIN advertisement_business_types bt
    ON bt.id = c.business_type_id`;

export const findClientById = async (
  id: number,
  client?: PoolClient
): Promise<AdvertisementClient | null> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementClientRow>(
    `
    ${clientSelect}
    WHERE c.id = $1
    LIMIT 1
    `,
    [id]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  return row ? mapClientRow(row) : null;
};

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<Advertisement | null> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementRow>(
    `
    ${advertisementSelect}
    WHERE a.id = $1
    LIMIT 1
    `,
    [id]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  return row ? mapAdvertisementRow(row) : null;
};

export const create = async (
  input: CreateAdvertisementInput &
    AdvertisementCalculatedFinancialFields &
    AdvertisementCalculatedPricingFields,
  createdBy: number,
  client?: PoolClient
): Promise<Advertisement> => {
  const db = client ?? pool;

  const startAt =
    input.startAt instanceof Date
      ? input.startAt
      : input.startAt
        ? new Date(input.startAt)
        : null;

  const endAt =
    input.endAt instanceof Date
      ? input.endAt
      : input.endAt
        ? new Date(input.endAt)
        : null;

  /*
   * ------------------------------------------------------------
   * Existing non-priced advertisement creation
   * ------------------------------------------------------------
   *
   * If pricing is not supplied, preserve the existing repository
   * creation contract.
   *
   * The pricing database columns are nullable and therefore remain
   * NULL when no system pricing is requested.
   */
  const hasCalculatedPricing =
    input.standardAmount !== undefined ||
    input.pricingPlacementId !== undefined ||
    input.pricingUnit !== undefined ||
    input.pricingQuantity !== undefined;

  if (!hasCalculatedPricing) {
    const result = await db.query<{ id: number | string }>(
      `
      INSERT INTO advertisements (
        client_id,
        campaign_id,
        name,
        internal_name,
        advertisement_type,
        destination_url,
        priority,
        status,
        start_at,
        end_at,
        is_clickable,
        open_in_new_tab,
        notes,
        workflow_status,
        advertisement_amount,
        discount_percentage,
        discount_amount,
        advance_percentage,
        advance_amount,
        currency_code,
        is_house_ad,
        created_by,
        updated_by
      )
      SELECT
        c.id,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        'DRAFT',
        $8,
        $9,
        $10,
        $11,
        $12,
        'DRAFT',
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        $20
      FROM advertisement_clients c
      WHERE c.id = $1
      RETURNING id
      `,
      [
        input.clientId ?? null,
        input.campaignId ?? null,
        input.name,
        input.internalName ?? null,
        input.advertisementType ?? "DISPLAY",
        input.destinationUrl ?? null,
        input.priority ?? 0,
        startAt,
        endAt,
        input.isClickable ?? true,
        input.openInNewTab ?? true,
        input.notes ?? null,
        input.advertisementAmount ?? null,
        input.discountPercentage ?? 0,
        input.discountAmount ?? 0,
        input.advancePercentage ?? 0,
        input.advanceAmount ?? 0,
        input.currencyCode ?? "INR",
        input.isHouseAd ?? false,
        createdBy
      ]
    );

    if (result.rowCount === 0) {
      throw new Error("Advertisement client was not found.");
    }

    const row = result.rows[0];

    if (!row) {
      throw new Error("Advertisement was created but its ID was not returned.");
    }

    const advertisement = await findById(Number(row.id), client);

    if (!advertisement) {
      throw new Error("Advertisement was created but could not be loaded.");
    }

    return advertisement;
  }

  /*
   * ------------------------------------------------------------
   * System-priced advertisement creation
   * ------------------------------------------------------------
   *
   * The four pricing columns are persisted only when the service
   * has obtained them from the effective system rate card.
   */
  const result = await db.query<{ id: number | string }>(
    `
    INSERT INTO advertisements (
      client_id,
      campaign_id,
      name,
      internal_name,
      advertisement_type,
      destination_url,
      priority,
      status,
      start_at,
      end_at,
      is_clickable,
      open_in_new_tab,
      notes,
      workflow_status,
      advertisement_amount,
      standard_amount,
      pricing_placement_id,
      pricing_unit,
      pricing_quantity,
      discount_percentage,
      discount_amount,
      advance_percentage,
      advance_amount,
      currency_code,
      is_house_ad,
      created_by,
      updated_by
    )
    SELECT
      c.id,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      'DRAFT',
      $8,
      $9,
      $10,
      $11,
      $12,
      'DRAFT',
      $13,
      $14,
      $15,
      $16,
      $17,
      $18,
      $19,
      $20,
      $21,
      $22,
      $23,
      $24,
      $24
    FROM advertisement_clients c
    WHERE c.id = $1
    RETURNING id
    `,
    [
      input.clientId ?? null,
      input.campaignId ?? null,
      input.name,
      input.internalName ?? null,
      input.advertisementType ?? "DISPLAY",
      input.destinationUrl ?? null,
      input.priority ?? 0,
      startAt,
      endAt,
      input.isClickable ?? true,
      input.openInNewTab ?? true,
      input.notes ?? null,
      input.advertisementAmount ?? null,
      input.standardAmount ?? null,
      input.pricingPlacementId ?? null,
      input.pricingUnit ?? null,
      input.pricingQuantity ?? null,
      input.discountPercentage ?? 0,
      input.discountAmount ?? 0,
      input.advancePercentage ?? 0,
      input.advanceAmount ?? 0,
      input.currencyCode ?? "INR",
      input.isHouseAd ?? false,
      createdBy
    ]
  );

  if (result.rowCount === 0) {
    throw new Error("Advertisement client was not found.");
  }

  const row = result.rows[0];

  if (!row) {
    throw new Error("Advertisement was created but its ID was not returned.");
  }

  const advertisement = await findById(Number(row.id), client);

  if (!advertisement) {
    throw new Error("Advertisement was created but could not be loaded.");
  }

  return advertisement;
};

export const update = async (
  id: number,
  input: UpdateAdvertisementInput & AdvertisementCalculatedFinancialFields,
  updatedBy: number,
  client?: PoolClient
): Promise<Advertisement | null> => {
  const db = client ?? pool;

  const fields: string[] = [];
  const values: unknown[] = [];

  const addField = (column: string, value: unknown): void => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (input.name !== undefined) {
    addField("name", input.name);
  }

  if (input.internalName !== undefined) {
    addField("internal_name", input.internalName);
  }

  if (input.advertisementType !== undefined) {
    addField("advertisement_type", input.advertisementType);
  }

  if (input.destinationUrl !== undefined) {
    addField("destination_url", input.destinationUrl);
  }

  if (input.priority !== undefined) {
    addField("priority", input.priority);
  }

  if (input.startAt !== undefined) {
    addField(
      "start_at",
      input.startAt instanceof Date ? input.startAt : new Date(input.startAt)
    );
  }

  if (input.endAt !== undefined) {
    addField(
      "end_at",
      input.endAt instanceof Date ? input.endAt : new Date(input.endAt)
    );
  }

  if (input.isClickable !== undefined) {
    addField("is_clickable", input.isClickable);
  }

  if (input.openInNewTab !== undefined) {
    addField("open_in_new_tab", input.openInNewTab);
  }

  if (input.notes !== undefined) {
    addField("notes", input.notes);
  }

  /*
   * `agreedAmount` is the API/domain update name for the negotiated
   * commercial amount.
   *
   * `advertisementAmount` is retained as a compatibility field for
   * existing direct repository callers.
   *
   * When both are supplied, agreedAmount is authoritative.
   */
  if (input.agreedAmount !== undefined) {
    addField("advertisement_amount", input.agreedAmount);
  } else if (input.advertisementAmount !== undefined) {
    addField("advertisement_amount", input.advertisementAmount);
  }

  if (input.discountPercentage !== undefined) {
    addField("discount_percentage", input.discountPercentage);
  }

  if (input.discountAmount !== undefined) {
    addField("discount_amount", input.discountAmount);
  }

  if (input.advancePercentage !== undefined) {
    addField("advance_percentage", input.advancePercentage);
  }

  if (input.advanceAmount !== undefined) {
    addField("advance_amount", input.advanceAmount);
  }

  if (input.currencyCode !== undefined) {
    addField("currency_code", input.currencyCode);
  }

  if (input.campaignId !== undefined) {
    addField("campaign_id", input.campaignId);
  }

  /*
   * Pricing fields are intentionally NOT updated here.
   *
   * standard_amount
   * pricing_placement_id
   * pricing_unit
   * pricing_quantity
   *
   * remain immutable after the pricing snapshot is created.
   * A future pricing change must use a dedicated pricing flow.
   */

  if (fields.length === 0) {
    return findById(id, client);
  }

  values.push(updatedBy);
  const updatedByIndex = values.length;

  values.push(id);
  const idIndex = values.length;

  const result = await db.query<{ id: number | string }>(
    `
    UPDATE advertisements
    SET
      ${fields.join(", ")},
      updated_by = $${updatedByIndex},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $${idIndex}
    RETURNING id
    `,
    values
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return findById(Number(row.id), client);
};

export const list = async (
  filters: AdvertisementSearchFilters,
  client?: PoolClient
): Promise<{
  items: AdvertisementListItem[];
  total: number;
}> => {
  const db = client ?? pool;

  const values: unknown[] = [];
  const conditions: string[] = [];

  if (filters.search) {
    values.push(filters.search);

    const searchIndex = values.length;

    conditions.push(`
      (
        a.name ILIKE '%' || $${searchIndex} || '%'
        OR a.internal_name ILIKE '%' || $${searchIndex} || '%'
        OR c.name ILIKE '%' || $${searchIndex} || '%'
        OR c.client_code ILIKE '%' || $${searchIndex} || '%'
      )
    `);
  }

  if (filters.clientId) {
    values.push(filters.clientId);

    conditions.push(`a.client_id = $${values.length}`);
  }

  if (filters.workflowStatus) {
    values.push(filters.workflowStatus);

    conditions.push(`a.workflow_status = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);

    conditions.push(`a.status = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM advertisements a
    LEFT JOIN advertisement_clients c
      ON c.id = a.client_id
    ${whereClause}
    `,
    values
  );

  const total = Number(countResult.rows[0]?.count ?? 0);

  const offset = (filters.page - 1) * filters.pageSize;

  const dataValues = [...values];

  dataValues.push(filters.pageSize);
  const limitIndex = dataValues.length;

  dataValues.push(offset);
  const offsetIndex = dataValues.length;

  const result = await db.query<AdvertisementRow>(
    `
    ${advertisementSelect}
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
    `,
    dataValues
  );

  return {
    items: result.rows.map(mapAdvertisementListRow),
    total
  };
};

export const existsById = async (
  id: number,
  client?: PoolClient
): Promise<boolean> => {
  const db = client ?? pool;

  const result = await db.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM advertisements
      WHERE id = $1
    ) AS exists
    `,
    [id]
  );

  return Boolean(result.rows[0]?.exists);
};

export const existsCampaignById = async (
  id: number,
  client?: PoolClient
): Promise<boolean> => {
  const db = client ?? pool;

  const result = await db.query<{ exists: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1
      FROM advertisement_campaigns
      WHERE id = $1
    ) AS exists
    `,
    [id]
  );

  return Boolean(result.rows[0]?.exists);
};

export const findByIdForUpdate = async (
  id: number,
  client: PoolClient
): Promise<Advertisement | null> => {
  const result = await client.query<AdvertisementRow>(
    `
    ${advertisementSelect}
    WHERE a.id = $1
    LIMIT 1
    FOR UPDATE OF a
    `,
    [id]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  return row ? mapAdvertisementRow(row) : null;
};

export const changeWorkflowStatus = async (
  id: number,
  fromStatus: AdvertisementWorkflowStatus,
  toStatus: AdvertisementWorkflowStatus,
  performedBy: number,
  reason: string | null,
  client: PoolClient
): Promise<Advertisement | null> => {
  const result = await client.query<{ id: number | string }>(
    `
    UPDATE advertisements
    SET
      workflow_status = $1::varchar(20),

      submitted_at =
        CASE
          WHEN $1::varchar(20) = 'SUBMITTED'
            THEN CURRENT_TIMESTAMP
          ELSE submitted_at
        END,

      submitted_by =
        CASE
          WHEN $1::varchar(20) = 'SUBMITTED'
            THEN $2
          ELSE submitted_by
        END,

      approved_at =
        CASE
          WHEN $1::varchar(20) = 'APPROVED'
            THEN CURRENT_TIMESTAMP
          ELSE approved_at
        END,

      approved_by =
        CASE
          WHEN $1::varchar(20) = 'APPROVED'
            THEN $2
          ELSE approved_by
        END,

      rejected_at =
        CASE
          WHEN $1::varchar(20) = 'REJECTED'
            THEN CURRENT_TIMESTAMP
          WHEN $1::varchar(20) = 'SUBMITTED'
            THEN NULL
          ELSE rejected_at
        END,

      rejected_by =
        CASE
          WHEN $1::varchar(20) = 'REJECTED'
            THEN $2
          WHEN $1::varchar(20) = 'SUBMITTED'
            THEN NULL
          ELSE rejected_by
        END,

      rejection_reason =
        CASE
          WHEN $1::varchar(20) = 'REJECTED'
            THEN $3
          WHEN $1::varchar(20) = 'SUBMITTED'
            THEN NULL
          ELSE rejection_reason
        END,

      on_hold_at =
        CASE
          WHEN $1::varchar(20) = 'ON_HOLD'
            THEN CURRENT_TIMESTAMP
          ELSE on_hold_at
        END,

      on_hold_by =
        CASE
          WHEN $1::varchar(20) = 'ON_HOLD'
            THEN $2
          ELSE on_hold_by
        END,

      on_hold_reason =
        CASE
          WHEN $1::varchar(20) = 'ON_HOLD'
            THEN $3
          ELSE on_hold_reason
        END,

      status =
        CASE
          WHEN $1::varchar(20) = 'ARCHIVED'
            THEN 'ARCHIVED'
          WHEN $1::varchar(20) = 'DRAFT'
            AND $5::varchar(20) = 'ARCHIVED'
            THEN 'DRAFT'
          ELSE status
        END,

      updated_by = $2,
      updated_at = CURRENT_TIMESTAMP

    WHERE
      id = $4
      AND workflow_status = $5::varchar(20)

    RETURNING id
    `,
    [toStatus, performedBy, reason, id, fromStatus]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return findById(Number(row.id), client);
};

export const createWorkflowHistory = async (
  advertisementId: number,
  fromStatus: AdvertisementWorkflowStatus | null,
  toStatus: AdvertisementWorkflowStatus,
  remarks: string | null,
  performedBy: number,
  client: PoolClient
): Promise<AdvertisementWorkflowHistory> => {
  const result = await client.query<AdvertisementWorkflowHistoryRow>(
    `
    INSERT INTO advertisement_workflow_history
    (
      advertisement_id,
      from_status,
      to_status,
      remarks,
      performed_by
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5
    )
    RETURNING
      id,
      advertisement_id,
      from_status,
      to_status,
      remarks,
      performed_by,
      performed_at
    `,
    [advertisementId, fromStatus, toStatus, remarks, performedBy]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Advertisement workflow history was not created.");
  }

  return {
    id: Number(row.id),
    advertisementId: Number(row.advertisement_id),
    fromStatus: row.from_status,
    toStatus: row.to_status,
    remarks: row.remarks,
    performedBy: row.performed_by === null ? null : Number(row.performed_by),
    performedAt: row.performed_at
  };
};

export const findWorkflowHistory = async (
  advertisementId: number,
  client?: PoolClient
): Promise<AdvertisementWorkflowHistory[]> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementWorkflowHistoryRow>(
    `
    SELECT
      id,
      advertisement_id,
      from_status,
      to_status,
      remarks,
      performed_by,
      performed_at
    FROM advertisement_workflow_history
    WHERE advertisement_id = $1
    ORDER BY performed_at ASC, id ASC
    `,
    [advertisementId]
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    advertisementId: Number(row.advertisement_id),
    fromStatus: row.from_status,
    toStatus: row.to_status,
    remarks: row.remarks,
    performedBy: row.performed_by === null ? null : Number(row.performed_by),
    performedAt: row.performed_at
  }));
};
