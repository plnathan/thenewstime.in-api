import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementDeliveryContext,
  AdvertisementDeliveryPlacementType,
  AdvertisementDeliveryPageType
} from "./delivery.types.js";

export interface AdvertisementDeliveryTargetRow {
  id: number;
  targetType: "SITE" | "NEWS" | "CATEGORY" | "STATE" | "DISTRICT" | "COUNTRY";
  targetValue: string;
  isInclude: boolean;
}

export interface AdvertisementDeliveryCandidate {
  advertisementId: number;
  advertisementName: string;
  advertisementType: string;
  destinationUrl: string | null;
  priority: number;
  openInNewTab: boolean;
  isClickable: boolean;
  isHouseAd: boolean;

  placementId: number;
  placementCode: string;
  placementDisplayName: string;
  placementDescription: string | null;
  pageType: AdvertisementDeliveryPageType;
  placementType: AdvertisementDeliveryPlacementType;
  placementInsertionType: string;
  placementDisplayOrder: number;
  collapseWhenEmpty: boolean;
  fallbackBehavior: "HIDE" | "HOUSE_AD";
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

  placementRuleId: number;
  placementRuleDisplayOrder: number;
  placementRuleInsertionType: string | null;
  insertionPosition: number | null;
  maxImpressions: number | null;

  scheduleId: number;
  schedulePriority: number;

  creative: {
    id: number;
    creativeType: "IMAGE" | "HTML" | "TEXT";
    title: string | null;
    altText: string | null;
    mediaUrl: string;
    thumbnailUrl: string | null;
    widthPx: number | null;
    heightPx: number | null;
    displayOrder: number;
    isPrimary: boolean;
  } | null;

  format: {
    id: number;
    code: string;
    displayName: string;
    description: string | null;
    widthPx: number | null;
    heightPx: number | null;
    isResponsive: boolean;
  } | null;

  targets: AdvertisementDeliveryTargetRow[];
}

interface AdvertisementDeliveryCandidateDbRow {
  advertisement_id: string | number;
  advertisement_name: string;
  advertisement_type: string;
  destination_url: string | null;
  priority: number;
  open_in_new_tab: boolean;
  is_clickable: boolean;
  is_house_ad: boolean;

  placement_id: string | number;
  placement_code: string;
  placement_display_name: string;
  placement_description: string | null;
  page_type: AdvertisementDeliveryPageType;
  placement_type: AdvertisementDeliveryPlacementType;
  placement_insertion_type: string;
  placement_display_order: number;
  collapse_when_empty: boolean;
  fallback_behavior: "HIDE" | "HOUSE_AD";
  display_frequency:
    | "EVERY_VISIT"
    | "ONCE_PER_SESSION"
    | "ONCE_PER_DAY"
    | "ONCE_PER_PERIOD"
    | null;
  frequency_value: number | null;
  auto_close_enabled: boolean;
  auto_close_seconds: number | null;
  close_button_enabled: boolean;
  close_on_overlay_click: boolean;

  placement_rule_id: string | number;
  placement_rule_display_order: number;
  placement_rule_insertion_type: string | null;
  insertion_position: number | null;
  max_impressions: number | null;

  schedule_id: string | number;
  schedule_priority: number;

  creative_id: string | number | null;
  creative_type: "IMAGE" | "HTML" | "TEXT" | null;
  creative_title: string | null;
  creative_alt_text: string | null;
  creative_media_url: string | null;
  creative_thumbnail_url: string | null;
  creative_width_px: number | null;
  creative_height_px: number | null;
  creative_display_order: number | null;
  creative_is_primary: boolean | null;

  format_id: string | number | null;
  format_code: string | null;
  format_display_name: string | null;
  format_description: string | null;
  format_width_px: number | null;
  format_height_px: number | null;
  format_is_responsive: boolean | null;

  targets: AdvertisementDeliveryTargetRow[] | null;
}

function mapTargetRows(
  targets: AdvertisementDeliveryTargetRow[] | null
): AdvertisementDeliveryTargetRow[] {
  if (!targets) {
    return [];
  }

  return targets.map((target) => ({
    id: Number(target.id),
    targetType: target.targetType,
    targetValue: target.targetValue,
    isInclude: target.isInclude
  }));
}

function mapCandidate(
  row: AdvertisementDeliveryCandidateDbRow
): AdvertisementDeliveryCandidate {
  return {
    advertisementId: Number(row.advertisement_id),
    advertisementName: row.advertisement_name,
    advertisementType: row.advertisement_type,
    destinationUrl: row.destination_url,
    priority: row.priority,
    openInNewTab: row.open_in_new_tab,
    isClickable: row.is_clickable,
    isHouseAd: row.is_house_ad,

    placementId: Number(row.placement_id),
    placementCode: row.placement_code,
    placementDisplayName: row.placement_display_name,
    placementDescription: row.placement_description,
    pageType: row.page_type,
    placementType: row.placement_type,
    placementInsertionType: row.placement_insertion_type,
    placementDisplayOrder: row.placement_display_order,
    collapseWhenEmpty: row.collapse_when_empty,
    fallbackBehavior: row.fallback_behavior,
    displayFrequency: row.display_frequency,
    frequencyValue: row.frequency_value,
    autoCloseEnabled: row.auto_close_enabled,
    autoCloseSeconds: row.auto_close_seconds,
    closeButtonEnabled: row.close_button_enabled,
    closeOnOverlayClick: row.close_on_overlay_click,

    placementRuleId: Number(row.placement_rule_id),
    placementRuleDisplayOrder: row.placement_rule_display_order,
    placementRuleInsertionType: row.placement_rule_insertion_type,
    insertionPosition: row.insertion_position,
    maxImpressions: row.max_impressions,

    scheduleId: Number(row.schedule_id),
    schedulePriority: row.schedule_priority,

    creative:
      row.creative_id === null || row.creative_media_url === null
        ? null
        : {
            id: Number(row.creative_id),
            creativeType: row.creative_type as "IMAGE" | "HTML" | "TEXT",
            title: row.creative_title,
            altText: row.creative_alt_text,
            mediaUrl: row.creative_media_url,
            thumbnailUrl: row.creative_thumbnail_url,
            widthPx: row.creative_width_px,
            heightPx: row.creative_height_px,
            displayOrder: row.creative_display_order ?? 0,
            isPrimary: row.creative_is_primary ?? false
          },

    format:
      row.format_id === null
        ? null
        : {
            id: Number(row.format_id),
            code: row.format_code ?? "",
            displayName: row.format_display_name ?? "",
            description: row.format_description,
            widthPx: row.format_width_px,
            heightPx: row.format_height_px,
            isResponsive: row.format_is_responsive ?? true
          },

    targets: mapTargetRows(row.targets)
  };
}

async function findEligibleCandidatesByHouseAdType(
  pageType: AdvertisementDeliveryPageType,
  placementType: AdvertisementDeliveryPlacementType,
  placementId: number | undefined,
  context: AdvertisementDeliveryContext | undefined,
  now: Date,
  client: PoolClient | undefined,
  houseAdOnly: boolean
): Promise<AdvertisementDeliveryCandidate[]> {
  const db = client ?? pool;

  const values: unknown[] = [pageType, placementType, now];

  let parameterIndex = values.length + 1;

  let placementIdCondition = "";

  if (placementId !== undefined) {
    placementIdCondition = `       AND p.id = $${parameterIndex}
    `;

    values.push(placementId);
    parameterIndex += 1;
  }

  const result = await db.query<AdvertisementDeliveryCandidateDbRow>(
    `
SELECT
a.id AS advertisement_id,
a.name AS advertisement_name,
a.advertisement_type,
a.destination_url,
a.priority,
a.open_in_new_tab,
a.is_clickable,
a.is_house_ad,

    p.id AS placement_id,
    p.code AS placement_code,
    p.display_name AS placement_display_name,
    p.description AS placement_description,
    p.page_type,
    p.placement_type,
    p.insertion_type AS placement_insertion_type,
    p.display_order AS placement_display_order,
    p.collapse_when_empty,
    p.fallback_behavior,
    p.display_frequency,
    p.frequency_value,
    p.auto_close_enabled,
    p.auto_close_seconds,
    p.close_button_enabled,
    p.close_on_overlay_click,

    pr.id AS placement_rule_id,
    pr.display_order AS placement_rule_display_order,
    pr.insertion_type AS placement_rule_insertion_type,
    pr.insertion_position,
    pr.max_impressions,

    s.id AS schedule_id,
    s.priority AS schedule_priority,

    c.id AS creative_id,
    c.creative_type,
    c.title AS creative_title,
    c.alt_text AS creative_alt_text,
    c.media_url AS creative_media_url,
    c.thumbnail_url AS creative_thumbnail_url,
    c.width_px AS creative_width_px,
    c.height_px AS creative_height_px,
    c.display_order AS creative_display_order,
    c.is_primary AS creative_is_primary,

    f.id AS format_id,
    f.code AS format_code,
    f.display_name AS format_display_name,
    f.description AS format_description,
    f.width_px AS format_width_px,
    f.height_px AS format_height_px,
    f.is_responsive AS format_is_responsive,

    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'targetType', t.target_type,
            'targetValue', t.target_value,
            'isInclude', t.is_include
          )
          ORDER BY
            t.is_include DESC,
            t.target_type ASC,
            t.target_value ASC,
            t.id ASC
        )
        FROM advertisement_targets t
        WHERE t.advertisement_id = a.id
      ),
      '[]'::jsonb
    ) AS targets

  FROM advertisements a

  INNER JOIN advertisement_placement_rules pr
    ON pr.advertisement_id = a.id
   AND pr.status = 'ACTIVE'

  INNER JOIN advertisement_placements p
    ON p.id = pr.placement_id
   AND p.status = 'ACTIVE'
   AND p.is_enabled = TRUE
   AND p.page_type = $1
   AND p.placement_type = $2
   ${placementIdCondition}

  INNER JOIN advertisement_schedules s
    ON s.advertisement_id = a.id
   AND s.placement_id = p.id
   AND (
     s.placement_rule_id IS NULL
     OR s.placement_rule_id = pr.id
   )
   AND s.status = 'ACTIVE'
   AND s.start_at <= $3
   AND s.end_at > $3

  LEFT JOIN LATERAL (
    SELECT
      c.id,
      c.creative_type,
      c.title,
      c.alt_text,
      c.media_url,
      c.thumbnail_url,
      c.width_px,
      c.height_px,
      c.display_order,
      c.is_primary,
      c.format_id
    FROM advertisement_creatives c
    WHERE c.advertisement_id = a.id
      AND c.status = 'ACTIVE'
    ORDER BY
      c.is_primary DESC,
      c.display_order ASC,
      c.id ASC
    LIMIT 1
  ) c
    ON TRUE

  LEFT JOIN advertisement_formats f
    ON f.id = c.format_id
   AND f.status = 'ACTIVE'

  WHERE a.workflow_status = 'APPROVED'
    AND a.status = 'ACTIVE'
    AND a.is_house_ad = ${houseAdOnly ? "TRUE" : "FALSE"}
    ${houseAdOnly ? "AND p.fallback_behavior = 'HOUSE_AD'" : ""}
    AND (
      a.start_at IS NULL
      OR a.start_at <= $3
    )
    AND (
      a.end_at IS NULL
      OR a.end_at > $3
    )

  ORDER BY
    s.priority DESC,
    a.priority DESC,
    pr.display_order ASC,
    p.display_order ASC,
    a.id ASC,
    pr.id ASC
`,
    values
  );

  return result.rows.map(mapCandidate);
}

export async function findEligibleCandidates(
  pageType: AdvertisementDeliveryPageType,
  placementType: AdvertisementDeliveryPlacementType,
  placementId?: number,
  context?: AdvertisementDeliveryContext,
  now: Date = new Date(),
  client?: PoolClient
): Promise<AdvertisementDeliveryCandidate[]> {
  return findEligibleCandidatesByHouseAdType(
    pageType,
    placementType,
    placementId,
    context,
    now,
    client,
    false
  );
}

export async function findEligibleHouseAdCandidates(
  pageType: AdvertisementDeliveryPageType,
  placementType: AdvertisementDeliveryPlacementType,
  placementId?: number,
  context?: AdvertisementDeliveryContext,
  now: Date = new Date(),
  client?: PoolClient
): Promise<AdvertisementDeliveryCandidate[]> {
  return findEligibleCandidatesByHouseAdType(
    pageType,
    placementType,
    placementId,
    context,
    now,
    client,
    true
  );
}
