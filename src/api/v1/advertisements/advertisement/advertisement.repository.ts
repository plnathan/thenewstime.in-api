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

  advertisement_amount: string | number | null;

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

/* ------------------------------------------------------------
 * Persisted runtime Placement
 * ------------------------------------------------------------ */

export interface AdvertisementRuntimePlacementFormat {
  id: number;
  code: string;
  displayName: string;
  description: string | null;

  widthPx: number | null;
  heightPx: number | null;

  mobileWidthPx: number | null;
  mobileHeightPx: number | null;

  isResponsive: boolean;
}

export interface AdvertisementRuntimePlacement {
  id: number;
  code: string;
  displayName: string;
  description: string | null;

  pageType: "HOME" | "NEWS_LIST" | "NEWS_DETAIL";

  placementType: string;

  insertionType: "FIXED" | "AFTER_N_ITEMS" | "BETWEEN_SECTIONS";

  displayOrder: number;

  isEnabled: boolean;
  collapseWhenEmpty: boolean;

  fallbackBehavior: "HIDE";

  displayFrequency:
    | "EVERY_VISIT"
    | "ONCE_PER_SESSION"
    | "ONCE_PER_DAY"
    | "ONCE_PER_PERIOD"
    | null;

  frequencyValue: number | null;

  autoCloseEnabled: boolean;
  autoCloseSeconds: number | null;

  closeButtonEnabled: boolean;
  closeOnOverlayClick: boolean;

  status: "ACTIVE" | "INACTIVE";

  formatId: number | null;
  format: AdvertisementRuntimePlacementFormat | null;

  createdBy: number | null;
  updatedBy: number | null;

  createdAt: Date;
  updatedAt: Date;
}

type AdvertisementWithPlacement = Advertisement & {
  placement: AdvertisementRuntimePlacement | null;
};

const advertisementSelect = `
    SELECT
        a.*,
        c.id AS client_id_join,
        c.client_code,
        c.name AS client_name
    FROM advertisements a
    LEFT JOIN advertisement_clients c
        ON c.id = a.client_id
`;

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
        ON bt.id = c.business_type_id
`;

/* ------------------------------------------------------------
 * Placement loader
 * ------------------------------------------------------------ */

const findRuntimePlacement = async (
  advertisementId: number,
  client?: PoolClient
): Promise<AdvertisementRuntimePlacement | null> => {
  const db = client ?? pool;

  const result = await db.query<{
    id: number | string;
    code: string;
    display_name: string;
    description: string | null;

    page_type: string;
    placement_type: string;

    insertion_type: string;
    display_order: number;

    is_enabled: boolean;
    collapse_when_empty: boolean;

    fallback_behavior: string;

    display_frequency: string | null;
    frequency_value: number | string | null;

    auto_close_enabled: boolean;
    auto_close_seconds: number | string | null;

    close_button_enabled: boolean;
    close_on_overlay_click: boolean;

    status: string;

    format_id: number | string | null;

    format_code: string | null;
    format_display_name: string | null;
    format_description: string | null;

    format_width_px: number | string | null;

    format_height_px: number | string | null;

    format_mobile_width_px: number | string | null;

    format_mobile_height_px: number | string | null;

    format_is_responsive: boolean | null;

    created_by: number | string | null;

    updated_by: number | string | null;

    created_at: Date;
    updated_at: Date;
  }>(
    `
            SELECT
                p.id,
                p.code,
                p.display_name,
                p.description,

                p.page_type,
                p.placement_type,

                p.insertion_type,
                p.display_order,

                p.is_enabled,
                p.collapse_when_empty,

                p.fallback_behavior,

                p.display_frequency,
                p.frequency_value,

                p.auto_close_enabled,
                p.auto_close_seconds,

                p.close_button_enabled,
                p.close_on_overlay_click,

                p.status,

                p.format_id,

                f.code AS format_code,
                f.display_name AS format_display_name,
                f.description AS format_description,

                f.width_px AS format_width_px,
                f.height_px AS format_height_px,

                f.mobile_width_px AS format_mobile_width_px,
                f.mobile_height_px AS format_mobile_height_px,

                f.is_responsive AS format_is_responsive,

                p.created_by,
                p.updated_by,

                p.created_at,
                p.updated_at

            FROM advertisement_placement_rules pr

            INNER JOIN advertisement_placements p
                ON p.id = pr.placement_id

            LEFT JOIN advertisement_formats f
                ON f.id = p.format_id

            WHERE pr.advertisement_id = $1
              AND pr.status = 'ACTIVE'

            ORDER BY
                pr.id DESC

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
    code: row.code,
    displayName: row.display_name,
    description: row.description,

    pageType: row.page_type as "HOME" | "NEWS_LIST" | "NEWS_DETAIL",

    placementType: row.placement_type,

    insertionType: row.insertion_type as
      "FIXED" | "AFTER_N_ITEMS" | "BETWEEN_SECTIONS",

    displayOrder: Number(row.display_order),

    isEnabled: Boolean(row.is_enabled),

    collapseWhenEmpty: Boolean(row.collapse_when_empty),

    fallbackBehavior: row.fallback_behavior as "HIDE",

    displayFrequency: row.display_frequency as
      | "EVERY_VISIT"
      | "ONCE_PER_SESSION"
      | "ONCE_PER_DAY"
      | "ONCE_PER_PERIOD"
      | null,

    frequencyValue:
      row.frequency_value === null ? null : Number(row.frequency_value),

    autoCloseEnabled: Boolean(row.auto_close_enabled),

    autoCloseSeconds:
      row.auto_close_seconds === null ? null : Number(row.auto_close_seconds),

    closeButtonEnabled: Boolean(row.close_button_enabled),

    closeOnOverlayClick: Boolean(row.close_on_overlay_click),

    status: row.status as "ACTIVE" | "INACTIVE",

    formatId: row.format_id === null ? null : Number(row.format_id),

    format:
      row.format_id === null
        ? null
        : {
            id: Number(row.format_id),
            code: row.format_code ?? "",
            displayName: row.format_display_name ?? "",
            description: row.format_description,

            widthPx:
              row.format_width_px === null ? null : Number(row.format_width_px),

            heightPx:
              row.format_height_px === null
                ? null
                : Number(row.format_height_px),

            mobileWidthPx:
              row.format_mobile_width_px === null
                ? null
                : Number(row.format_mobile_width_px),

            mobileHeightPx:
              row.format_mobile_height_px === null
                ? null
                : Number(row.format_mobile_height_px),

            isResponsive: row.format_is_responsive ?? true
          },

    createdBy: row.created_by === null ? null : Number(row.created_by),

    updatedBy: row.updated_by === null ? null : Number(row.updated_by),

    createdAt: row.created_at,

    updatedAt: row.updated_at
  };
};

const attachRuntimePlacement = async (
  advertisement: Advertisement,
  client?: PoolClient
): Promise<AdvertisementWithPlacement> => {
  const placement = await findRuntimePlacement(advertisement.id, client);

  return {
    ...advertisement,
    placement
  };
};

/* ------------------------------------------------------------
 * Runtime Placement Rule persistence
 * ------------------------------------------------------------ */

async function saveRuntimePlacementRule(
  advertisementId: number,
  placementId: number,
  userId: number,
  client: PoolClient
): Promise<void> {
  const placementResult = await client.query<{
    id: number;
    insertion_type: string;
    display_order: number;
    status: string;
    is_enabled: boolean;
  }>(
    `
        SELECT
            id,
            insertion_type,
            display_order,
            status,
            is_enabled
        FROM advertisement_placements
        WHERE id = $1
        LIMIT 1
        `,
    [placementId]
  );

  const placement = placementResult.rows[0];

  if (!placement) {
    throw new Error(`Advertisement placement ${placementId} does not exist.`);
  }

  if (placement.status !== "ACTIVE" || placement.is_enabled !== true) {
    throw new Error(
      `Advertisement placement ${placementId} is not active or enabled.`
    );
  }

  // Deactivate the currently active rule(s) for this advertisement.
  // Do not delete existing rows: (advertisement_id, placement_id)
  // is protected by the uq_advertisement_placement_rules constraint.
  await client.query(
    `
        UPDATE advertisement_placement_rules
        SET status = 'INACTIVE'
        WHERE advertisement_id = $1
          AND status = 'ACTIVE'
        `,
    [advertisementId]
  );

  // Reuse an existing rule for the same placement when one exists.
  // Otherwise, create a new rule.
  await client.query(
    `
        INSERT INTO advertisement_placement_rules (
            advertisement_id,
            placement_id,
            display_order,
            insertion_type,
            insertion_position,
            max_impressions,
            status,
            created_by
        )
        VALUES ($1, $2, $3, $4, NULL, NULL, 'ACTIVE', $5)
        ON CONFLICT (advertisement_id, placement_id)
        DO UPDATE SET
            display_order = EXCLUDED.display_order,
            insertion_type = EXCLUDED.insertion_type,
            insertion_position = EXCLUDED.insertion_position,
            max_impressions = EXCLUDED.max_impressions,
            status = 'ACTIVE'
        `,
    [
      advertisementId,
      placementId,
      placement.display_order,
      placement.insertion_type,
      userId
    ]
  );
}

/* ------------------------------------------------------------
 * Advertisement Schedule persistence
 * ------------------------------------------------------------ */

/**
 * Synchronize the advertisement's current schedule with
 * public.advertisement_schedules.
 *
 * The advertisement's start_at/end_at columns remain the
 * source of truth for the currently configured schedule.
 *
 * Repeated Save Draft operations update the existing SCHEDULED
 * row instead of creating a duplicate schedule record.
 *
 * This function must be called inside the same database
 * transaction as the advertisement create/update operation.
 */
async function syncAdvertisementSchedule(
  advertisementId: number,
  userId: number,
  client: PoolClient
): Promise<void> {
  const advertisementResult = await client.query<{
    start_at: Date | string | null;
    end_at: Date | string | null;
    priority: number;
    notes: string | null;
    placement_rule_id: number | string | null;
    placement_id: number | string | null;
  }>(
    `
    SELECT
      a.start_at,
      a.end_at,
      a.priority,
      a.notes,
      active_rule.id AS placement_rule_id,
      active_rule.placement_id
    FROM advertisements a
    LEFT JOIN LATERAL (
      SELECT
        pr.id,
        pr.placement_id
      FROM advertisement_placement_rules pr
      WHERE pr.advertisement_id = a.id
        AND pr.status = 'ACTIVE'
      ORDER BY pr.id DESC
      LIMIT 1
    ) active_rule ON TRUE
    WHERE a.id = $1
    FOR UPDATE OF a
    `,
    [advertisementId]
  );

  const advertisement = advertisementResult.rows[0];

  if (!advertisement) {
    throw new Error(
      `Cannot save the schedule: advertisement ${advertisementId} was not found.`
    );
  }

  const startAt = advertisement.start_at
    ? new Date(advertisement.start_at)
    : null;

  const endAt = advertisement.end_at ? new Date(advertisement.end_at) : null;

  /*
   * The schedule table requires both timestamps.
   *
   * If the advertisement has no complete schedule, do not
   * insert an invalid row. Cancel any existing scheduled
   * row so the schedule table does not retain stale dates.
   */
  if (!startAt || !endAt) {
    await client.query(
      `
      UPDATE advertisement_schedules
      SET
        status = 'CANCELLED',
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE advertisement_id = $1
        AND status = 'SCHEDULED'
      `,
      [advertisementId, userId]
    );

    return;
  }

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new Error(
      "Advertisement schedule contains an invalid start or end date/time."
    );
  }

  if (endAt.getTime() <= startAt.getTime()) {
    throw new Error(
      "Advertisement schedule end date/time must be after its start date/time."
    );
  }

  /*
   * A schedule should follow the currently selected runtime
   * placement and its active placement rule.
   */
  const placementId =
    advertisement.placement_id === null
      ? null
      : Number(advertisement.placement_id);

  const placementRuleId =
    advertisement.placement_rule_id === null
      ? null
      : Number(advertisement.placement_rule_id);

  /*
   * Reuse the latest scheduled row when one exists.
   * Lock it to avoid concurrent saves creating duplicates.
   */
  const existingScheduleResult = await client.query<{
    id: number | string;
  }>(
    `
    SELECT id
    FROM advertisement_schedules
    WHERE advertisement_id = $1
      AND status = 'SCHEDULED'
    ORDER BY id DESC
    LIMIT 1
    FOR UPDATE
    `,
    [advertisementId]
  );

  const existingSchedule = existingScheduleResult.rows[0];

  if (existingSchedule) {
    const scheduleId = Number(existingSchedule.id);

    /*
     * If old duplicate scheduled rows already exist, cancel
     * all except the row that will be reused.
     */
    await client.query(
      `
      UPDATE advertisement_schedules
      SET
        status = 'CANCELLED',
        updated_by = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE advertisement_id = $1
        AND status = 'SCHEDULED'
        AND id <> $2
      `,
      [advertisementId, scheduleId, userId]
    );

    await client.query(
      `
      UPDATE advertisement_schedules
      SET
        placement_id = $2,
        placement_rule_id = $3,
        start_at = $4,
        end_at = $5,
        status = 'SCHEDULED',
        priority = $6,
        notes = $7,
        updated_by = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [
        scheduleId,
        placementId,
        placementRuleId,
        startAt,
        endAt,
        advertisement.priority,
        advertisement.notes,
        userId
      ]
    );

    return;
  }

  /*
   * First schedule for this advertisement.
   */
  await client.query(
    `
    INSERT INTO advertisement_schedules (
      advertisement_id,
      placement_id,
      placement_rule_id,
      start_at,
      end_at,
      status,
      priority,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      'SCHEDULED',
      $6,
      $7,
      $8,
      $8
    )
    `,
    [
      advertisementId,
      placementId,
      placementRuleId,
      startAt,
      endAt,
      advertisement.priority,
      advertisement.notes,
      userId
    ]
  );
}

/* ------------------------------------------------------------
 * Client
 * ------------------------------------------------------------ */

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

/* ------------------------------------------------------------
 * Find by ID
 * ------------------------------------------------------------ */

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<AdvertisementWithPlacement | null> => {
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

  if (!row) {
    return null;
  }

  const advertisement = mapAdvertisementRow(row);

  if (advertisement.clientId !== null) {
    advertisement.client = await findClientById(advertisement.clientId, client);
  } else {
    advertisement.client = null;
  }

  return attachRuntimePlacement(advertisement, client);
};

/* ------------------------------------------------------------
 * Create
 * ------------------------------------------------------------ */

export const create = async (
  input: CreateAdvertisementInput &
    AdvertisementCalculatedFinancialFields &
    AdvertisementCalculatedPricingFields & {
      placementId?: number;
    },
  createdBy: number,
  client?: PoolClient
): Promise<AdvertisementWithPlacement> => {
  const ownsTransaction = client === undefined;

  const db = client ?? (await pool.connect());

  try {
    if (ownsTransaction) {
      await db.query("BEGIN");
    }

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

    const hasCalculatedPricing =
      input.standardAmount !== undefined ||
      input.pricingPlacementId !== undefined ||
      input.pricingUnit !== undefined ||
      input.pricingQuantity !== undefined;

    let advertisementId: number;

    if (!hasCalculatedPricing) {
      const result = await db.query<{
        id: number | string;
      }>(
        `
                    INSERT INTO advertisements
                    (
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
        throw new Error(
          "Advertisement was created but its ID was not returned."
        );
      }

      advertisementId = Number(row.id);
    } else {
      const result = await db.query<{
        id: number | string;
      }>(
        `
                    INSERT INTO advertisements
                    (
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
        throw new Error(
          "Advertisement was created but its ID was not returned."
        );
      }

      advertisementId = Number(row.id);
    }

    /*
     * Persist the runtime Placement Rule.
     *
     * The top-level placementId is the authoritative
     * runtime Placement selection.
     *
     * For backwards compatibility with the pricing flow,
     * pricingPlacementId is used only when placementId was
     * not supplied.
     */
    const runtimePlacementId =
      input.placementId ?? input.pricingPlacementId ?? null;

    if (runtimePlacementId === null) {
      throw new Error("Advertisement placement is required.");
    }

    await saveRuntimePlacementRule(
      advertisementId,
      runtimePlacementId,
      createdBy,
      db
    );

    await syncAdvertisementSchedule(advertisementId, createdBy, db);

    const advertisement = await findById(advertisementId, db);

    if (!advertisement) {
      throw new Error("Advertisement was created but could not be loaded.");
    }

    if (ownsTransaction) {
      await db.query("COMMIT");
    }

    return advertisement;
  } catch (error) {
    if (ownsTransaction) {
      await db.query("ROLLBACK");
    }

    throw error;
  } finally {
    if (ownsTransaction) {
      db.release();
    }
  }
};

/* ------------------------------------------------------------
 * Update
 * ------------------------------------------------------------ */

/* ------------------------------------------------------------
 * Update
 * ------------------------------------------------------------ */

export const update = async (
  id: number,
  input: UpdateAdvertisementInput &
    AdvertisementCalculatedFinancialFields &
    AdvertisementCalculatedPricingFields & {
      placementId?: number;
    },
  updatedBy: number,
  client?: PoolClient
): Promise<AdvertisementWithPlacement | null> => {
  const ownsTransaction = client === undefined;

  const db = client ?? (await pool.connect());

  try {
    if (ownsTransaction) {
      await db.query("BEGIN");
    }

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

    if (input.advertisementAmount !== undefined) {
      addField("advertisement_amount", input.advertisementAmount);
    }

    if (input.standardAmount !== undefined) {
      addField("standard_amount", input.standardAmount);
    }

    if (input.pricingPlacementId !== undefined) {
      addField("pricing_placement_id", input.pricingPlacementId);
    }

    if (input.pricingUnit !== undefined) {
      addField("pricing_unit", input.pricingUnit);
    }

    if (input.pricingQuantity !== undefined) {
      addField("pricing_quantity", input.pricingQuantity);
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
     * A placement-only update is valid.
     *
     * When advertisement fields are supplied, require the
     * UPDATE query to return an ID before continuing with
     * placement or schedule synchronization.
     */
    if (fields.length > 0) {
      values.push(updatedBy);

      const updatedByIndex = values.length;

      values.push(id);

      const idIndex = values.length;

      const result = await db.query<{
        id: number | string;
      }>(
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

      /*
       * Check both rowCount and the returned row.
       *
       * Some database mocks or drivers can report a
       * non-zero rowCount while returning no rows.
       * Do not attempt schedule synchronization in that case.
       */
      const updatedRow = result.rows[0];

      if (result.rowCount === 0 || !updatedRow) {
        if (ownsTransaction) {
          await db.query("ROLLBACK");
        }

        return null;
      }
    }

    /*
     * Persist a newly selected runtime placement.
     */
    if (input.placementId !== undefined) {
      await saveRuntimePlacementRule(id, input.placementId, updatedBy, db);
    }

    /*
     * Keep the schedule table synchronized with the
     * advertisement's current dates and active placement.
     */
    await syncAdvertisementSchedule(id, updatedBy, db);

    /*
     * Reload the persisted advertisement, including client
     * and runtime placement information.
     */
    const advertisement = await findById(id, db);

    if (ownsTransaction) {
      await db.query("COMMIT");
    }

    return advertisement;
  } catch (error) {
    if (ownsTransaction) {
      await db.query("ROLLBACK");
    }

    throw error;
  } finally {
    if (ownsTransaction) {
      db.release();
    }
  }
};

/* ------------------------------------------------------------
 * List
 * ------------------------------------------------------------ */

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

  const countResult = await db.query<{
    count: string;
  }>(
    `
            SELECT
                COUNT(*)::text AS count
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

/* ------------------------------------------------------------
 * Exists
 * ------------------------------------------------------------ */

export const existsById = async (
  id: number,
  client?: PoolClient
): Promise<boolean> => {
  const db = client ?? pool;

  const result = await db.query<{
    exists: boolean;
  }>(
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

  const result = await db.query<{
    exists: boolean;
  }>(
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

/* ------------------------------------------------------------
 * Find for workflow update
 * ------------------------------------------------------------ */

export const findByIdForUpdate = async (
  id: number,
  client: PoolClient
): Promise<AdvertisementWithPlacement | null> => {
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

  if (!row) {
    return null;
  }

  const advertisement = mapAdvertisementRow(row);

  if (advertisement.clientId !== null) {
    advertisement.client = await findClientById(advertisement.clientId, client);
  } else {
    advertisement.client = null;
  }

  return attachRuntimePlacement(advertisement, client);
};

/* ------------------------------------------------------------
 * Workflow
 * ------------------------------------------------------------ */

export const changeWorkflowStatus = async (
  id: number,
  fromStatus: AdvertisementWorkflowStatus,
  toStatus: AdvertisementWorkflowStatus,
  performedBy: number,
  reason: string | null,
  client: PoolClient
): Promise<AdvertisementWithPlacement | null> => {
  const result = await client.query<{
    id: number | string;
  }>(
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

/* ------------------------------------------------------------
 * Workflow history
 * ------------------------------------------------------------ */

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
            ORDER BY
                performed_at ASC,
                id ASC
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
