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

export interface AdvertisementDeliveryFormatCandidate {
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

export interface AdvertisementDeliveryCreativeCandidate {
  id: number;
  creativeType: "IMAGE" | "VIDEO" | "HTML" | "TEXT";
  variant: "DESKTOP" | "MOBILE";
  title: string | null;
  altText: string | null;
  mediaUrl: string;
  thumbnailUrl: string | null;
  widthPx: number | null;
  heightPx: number | null;
  displayOrder: number;
  isPrimary: boolean;
  format: AdvertisementDeliveryFormatCandidate | null;
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

  rotationEnabled: boolean;
  rotationMode: "TIME_BASED";
  rotationIntervalSeconds: number;
  rotationStrategy: "ROUND_ROBIN";

  rotationMemberId: number | null;
  rotationPriority: number | null;

  placementRuleId: number;
  placementRuleDisplayOrder: number;
  placementRuleInsertionType: string | null;
  insertionPosition: number | null;
  maxImpressions: number | null;

  scheduleId: number;
  schedulePriority: number;

  /** Backward-compatible default creative. */
  creative: Omit<AdvertisementDeliveryCreativeCandidate, "format"> | null;

  /** All active creatives, in deterministic display order. */
  creatives: AdvertisementDeliveryCreativeCandidate[];

  /** Format belonging to the default creative. */
  format: AdvertisementDeliveryFormatCandidate | null;

  targets: AdvertisementDeliveryTargetRow[];
}

interface AdvertisementDeliveryCandidateDbRow {
  advertisement_id: string | number;
  advertisement_name: string;
  advertisement_type: string;
  destination_url: string | null;
  priority: number | string;
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
  placement_display_order: number | string;
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

  rotation_enabled: boolean;
  rotation_mode: "TIME_BASED";
  rotation_interval_seconds: number | string;
  rotation_strategy: "ROUND_ROBIN";

  rotation_member_id: string | number | null;
  rotation_priority: number | string | null;

  placement_rule_id: string | number;
  placement_rule_display_order: number | string;
  placement_rule_insertion_type: string | null;
  insertion_position: number | null;
  max_impressions: number | null;

  schedule_id: string | number;
  schedule_priority: number | string;

  creative_id: string | number | null;
  creative_type: "IMAGE" | "VIDEO" | "HTML" | "TEXT" | null;
  creative_variant: "DESKTOP" | "MOBILE" | null;
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
  mobile_format_width_px: number | null;
  mobile_format_height_px: number | null;
  format_is_responsive: boolean | null;

  creatives: AdvertisementDeliveryCreativeCandidate[] | string | null;
  targets: AdvertisementDeliveryTargetRow[] | string | null;
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJsonArray<T>(value: T[] | string | null): T[] {
  if (!value) {
    return [];
  }

  if (typeof value !== "string") {
    return Array.isArray(value) ? value : [];
  }

  const parsed: unknown = JSON.parse(value);

  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function mapTargetRows(
  targets: AdvertisementDeliveryTargetRow[] | string | null
): AdvertisementDeliveryTargetRow[] {
  return parseJsonArray<AdvertisementDeliveryTargetRow>(targets).map(
    (target) => ({
      id: toNumber(target.id),
      targetType: target.targetType,
      targetValue: target.targetValue,
      isInclude: Boolean(target.isInclude)
    })
  );
}

function mapFormat(value: {
  id: number | string | null;
  code: string | null;
  displayName: string | null;
  description: string | null;
  widthPx: number | null;
  heightPx: number | null;
  mobileWidthPx: number | null;
  mobileHeightPx: number | null;
  isResponsive: boolean | null;
}): AdvertisementDeliveryFormatCandidate | null {
  if (value.id === null) {
    return null;
  }

  return {
    id: toNumber(value.id),
    code: value.code ?? "",
    displayName: value.displayName ?? "",
    description: value.description,
    widthPx: value.widthPx,
    heightPx: value.heightPx,
    mobileWidthPx: value.mobileWidthPx,
    mobileHeightPx: value.mobileHeightPx,
    isResponsive: value.isResponsive ?? true
  };
}

function mapAggregatedCreatives(
  value: AdvertisementDeliveryCreativeCandidate[] | string | null
): AdvertisementDeliveryCreativeCandidate[] {
  const parsed = parseJsonArray<AdvertisementDeliveryCreativeCandidate>(value);

  return parsed
    .filter(
      (creative) =>
        creative !== null &&
        typeof creative === "object" &&
        typeof creative.mediaUrl === "string" &&
        creative.mediaUrl.trim().length > 0
    )
    .map((creative) => ({
      ...creative,
      id: toNumber(creative.id),
      displayOrder: toNumber(creative.displayOrder),
      isPrimary: Boolean(creative.isPrimary),
      widthPx: creative.widthPx === null ? null : toNumber(creative.widthPx),
      heightPx: creative.heightPx === null ? null : toNumber(creative.heightPx),
      format: creative.format
        ? {
            ...creative.format,
            id: toNumber(creative.format.id),
            widthPx:
              creative.format.widthPx === null
                ? null
                : toNumber(creative.format.widthPx),
            heightPx:
              creative.format.heightPx === null
                ? null
                : toNumber(creative.format.heightPx),
            mobileWidthPx:
              creative.format.mobileWidthPx === null
                ? null
                : toNumber(creative.format.mobileWidthPx),
            mobileHeightPx:
              creative.format.mobileHeightPx === null
                ? null
                : toNumber(creative.format.mobileHeightPx)
          }
        : null
    }));
}

function mapCandidate(
  row: AdvertisementDeliveryCandidateDbRow
): AdvertisementDeliveryCandidate {
  const defaultFormat = mapFormat({
    id: row.format_id,
    code: row.format_code,
    displayName: row.format_display_name,
    description: row.format_description,
    widthPx: row.format_width_px,
    heightPx: row.format_height_px,
    mobileWidthPx: row.mobile_format_width_px,
    mobileHeightPx: row.mobile_format_height_px,
    isResponsive: row.format_is_responsive
  });

  const singularCreative =
    row.creative_id === null || row.creative_media_url === null
      ? null
      : {
          id: toNumber(row.creative_id),
          creativeType: row.creative_type as
            "IMAGE" | "VIDEO" | "HTML" | "TEXT",
          variant: row.creative_variant as "DESKTOP" | "MOBILE",
          title: row.creative_title,
          altText: row.creative_alt_text,
          mediaUrl: row.creative_media_url,
          thumbnailUrl: row.creative_thumbnail_url,
          widthPx: row.creative_width_px,
          heightPx: row.creative_height_px,
          displayOrder: row.creative_display_order ?? 0,
          isPrimary: row.creative_is_primary ?? false
        };

  const aggregatedCreatives = mapAggregatedCreatives(row.creatives);

  const creatives =
    aggregatedCreatives.length > 0
      ? aggregatedCreatives
      : singularCreative
        ? [
            {
              ...singularCreative,
              format: defaultFormat
            }
          ]
        : [];

  const selectedDefaultCreative =
    creatives.find((item) => item.isPrimary) ?? creatives[0] ?? null;

  return {
    advertisementId: toNumber(row.advertisement_id),
    advertisementName: row.advertisement_name,
    advertisementType: row.advertisement_type,
    destinationUrl: row.destination_url,
    priority: toNumber(row.priority),
    openInNewTab: row.open_in_new_tab,
    isClickable: row.is_clickable,
    isHouseAd: row.is_house_ad,

    placementId: toNumber(row.placement_id),
    placementCode: row.placement_code,
    placementDisplayName: row.placement_display_name,
    placementDescription: row.placement_description,
    pageType: row.page_type,
    placementType: row.placement_type,
    placementInsertionType: row.placement_insertion_type,
    placementDisplayOrder: toNumber(row.placement_display_order),
    collapseWhenEmpty: row.collapse_when_empty,
    fallbackBehavior: row.fallback_behavior,
    displayFrequency: row.display_frequency,
    frequencyValue: row.frequency_value,
    autoCloseEnabled: row.auto_close_enabled,
    autoCloseSeconds: row.auto_close_seconds,
    closeButtonEnabled: row.close_button_enabled,
    closeOnOverlayClick: row.close_on_overlay_click,

    rotationEnabled: row.rotation_enabled,
    rotationMode: row.rotation_mode,
    rotationIntervalSeconds: toNumber(row.rotation_interval_seconds),
    rotationStrategy: row.rotation_strategy,

    rotationMemberId:
      row.rotation_member_id === null ? null : toNumber(row.rotation_member_id),
    rotationPriority:
      row.rotation_priority === null ? null : toNumber(row.rotation_priority),

    placementRuleId: toNumber(row.placement_rule_id),
    placementRuleDisplayOrder: toNumber(row.placement_rule_display_order),
    placementRuleInsertionType: row.placement_rule_insertion_type,
    insertionPosition: row.insertion_position,
    maxImpressions: row.max_impressions,

    scheduleId: toNumber(row.schedule_id),
    schedulePriority: toNumber(row.schedule_priority),

    creative: selectedDefaultCreative
      ? {
          id: selectedDefaultCreative.id,
          creativeType: selectedDefaultCreative.creativeType,
          variant: selectedDefaultCreative.variant,
          title: selectedDefaultCreative.title,
          altText: selectedDefaultCreative.altText,
          mediaUrl: selectedDefaultCreative.mediaUrl,
          thumbnailUrl: selectedDefaultCreative.thumbnailUrl,
          widthPx: selectedDefaultCreative.widthPx,
          heightPx: selectedDefaultCreative.heightPx,
          displayOrder: selectedDefaultCreative.displayOrder,
          isPrimary: selectedDefaultCreative.isPrimary
        }
      : null,

    creatives,

    format: selectedDefaultCreative?.format ?? defaultFormat,

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

  let placementIdCondition = "";

  if (placementId !== undefined) {
    values.push(placementId);
    placementIdCondition = `AND p.id = $${values.length}`;
  }

  // Target matching is applied by the delivery service.
  void context;

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

  COALESCE(p.rotation_enabled, FALSE) AS rotation_enabled,
  COALESCE(p.rotation_mode, 'TIME_BASED') AS rotation_mode,
  COALESCE(p.rotation_interval_seconds, 10) AS rotation_interval_seconds,
  COALESCE(p.rotation_strategy, 'ROUND_ROBIN') AS rotation_strategy,

  rm.id AS rotation_member_id,
  rm.priority AS rotation_priority,

  pr.id AS placement_rule_id,
  pr.display_order AS placement_rule_display_order,
  pr.insertion_type AS placement_rule_insertion_type,
  pr.insertion_position,
  pr.max_impressions,

  s.id AS schedule_id,
  s.priority AS schedule_priority,

  c.id AS creative_id,
  c.creative_type,
  c.variant AS creative_variant,
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
  f.mobile_width_px AS mobile_format_width_px,
  f.mobile_height_px AS mobile_format_height_px,
  f.is_responsive AS format_is_responsive,

  COALESCE(creative_set.creatives, '[]'::jsonb) AS creatives,

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

LEFT JOIN advertisement_rotation_members rm
  ON rm.placement_id = p.id
 AND rm.advertisement_id = a.id
 AND rm.status = 'ACTIVE'
 AND p.rotation_enabled = TRUE

LEFT JOIN LATERAL (
  SELECT
    active_creative.id,
    active_creative.creative_type,
    active_creative.variant,
    active_creative.title,
    active_creative.alt_text,
    active_creative.media_url,
    active_creative.thumbnail_url,
    active_creative.width_px,
    active_creative.height_px,
    active_creative.display_order,
    active_creative.is_primary,
    active_creative.format_id
  FROM advertisement_creatives active_creative
    LEFT JOIN advertisement_formats active_creative_format
    ON active_creative_format.id = active_creative.format_id
   AND active_creative_format.status = 'ACTIVE'
       AND NULLIF(BTRIM(active_creative.media_url), '') IS NOT NULL
           AND (
      active_creative.format_id IS NULL
      OR active_creative_format.id IS NOT NULL
    )
  WHERE active_creative.advertisement_id = a.id
    AND active_creative.status = 'ACTIVE'
    AND NULLIF(BTRIM(active_creative.media_url), '') IS NOT NULL
  ORDER BY
    active_creative.is_primary DESC,
    active_creative.display_order ASC,
    active_creative.id ASC
  LIMIT 1
) c
  ON TRUE

LEFT JOIN advertisement_formats f
  ON f.id = c.format_id
 AND f.status = 'ACTIVE'

LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', active_creative.id,
        'creativeType', active_creative.creative_type,
        'variant', active_creative.variant,
        'title', active_creative.title,
        'altText', active_creative.alt_text,
        'mediaUrl', active_creative.media_url,
        'thumbnailUrl', active_creative.thumbnail_url,
        'widthPx', active_creative.width_px,
        'heightPx', active_creative.height_px,
        'displayOrder', active_creative.display_order,
        'isPrimary', active_creative.is_primary,
        'format',
          CASE
            WHEN active_format.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'id', active_format.id,
              'code', active_format.code,
              'displayName', active_format.display_name,
              'description', active_format.description,
              'widthPx', active_format.width_px,
              'heightPx', active_format.height_px,
              'mobileWidthPx', active_format.mobile_width_px,
              'mobileHeightPx', active_format.mobile_height_px,
              'isResponsive', active_format.is_responsive
            )
          END
      )
      ORDER BY
        active_creative.is_primary DESC,
        active_creative.display_order ASC,
        active_creative.id ASC
    ) AS creatives
  FROM advertisement_creatives active_creative
  LEFT JOIN advertisement_formats active_format
    ON active_format.id = active_creative.format_id
   AND active_format.status = 'ACTIVE'
    WHERE active_creative.advertisement_id = a.id
    AND active_creative.status = 'ACTIVE'
    AND (
      active_creative.format_id IS NULL
      OR active_format.id IS NOT NULL
    )
    AND NULLIF(BTRIM(active_creative.media_url), '') IS NOT NULL
) creative_set
  ON TRUE

WHERE a.workflow_status = 'APPROVED'
  AND a.status = 'ACTIVE'
  AND a.is_house_ad = ${houseAdOnly ? "TRUE" : "FALSE"}
  ${houseAdOnly ? "AND p.fallback_behavior = 'HOUSE_AD'" : ""}
  AND a.start_at IS NOT NULL
  AND a.end_at IS NOT NULL
  AND a.end_at > a.start_at
  AND a.start_at <= $3
  AND a.end_at > $3
  -- Rotation-enabled placements may deliver only advertisements that are
  -- explicitly configured as active members of that placement's rotation.
  AND (COALESCE(p.rotation_enabled, FALSE) = FALSE OR rm.id IS NOT NULL)
    AND c.id IS NOT NULL
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
