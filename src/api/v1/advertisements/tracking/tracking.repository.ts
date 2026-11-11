import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementMetrics,
  AdvertisementTrackingRequest,
  AdvertisementTrackingRelationship
} from "./tracking.types.js";

interface TrackingInsertResult {
  id: number;
  eventAt: Date;
}

interface MetricsRow {
  impressions: string;
  clicks: string;
  unique_impression_visitors: string;
  unique_click_visitors: string;
}

interface DailyMetricRow {
  date: string;
  impressions: string;
  clicks: string;
}

interface PlacementMetricRow {
  placement_id: string;
  impressions: string;
  clicks: string;
}

interface CreativeMetricRow {
  creative_id: string;
  impressions: string;
  clicks: string;
}

const mapCount = (value: string | number | null | undefined): number =>
  Number(value ?? 0);

const calculateCtr = (impressions: number, clicks: number): number => {
  if (impressions === 0) {
    return 0;
  }

  return Number(((clicks / impressions) * 100).toFixed(2));
};

export const findTrackingRelationship = async (
  advertisementId: number,
  placementId: number,
  placementRuleId: number,
  scheduleId: number,
  creativeId: number,
  client?: PoolClient
): Promise<AdvertisementTrackingRelationship | null> => {
  const executor = client ?? pool;

  const result = await executor.query(
    `
      SELECT
        a.id AS advertisement_id,
        a.status AS advertisement_status,
        a.workflow_status AS advertisement_workflow_status,
        a.start_at AS advertisement_start_at,
        a.end_at AS advertisement_end_at,

        p.id AS placement_id,
        p.page_type,
        p.placement_type,
        p.is_enabled AS placement_enabled,
        p.status AS placement_status,
        COALESCE(p.rotation_enabled, FALSE) AS rotation_enabled,
        EXISTS (
          SELECT 1
          FROM advertisement_rotation_members arm
          WHERE arm.placement_id = p.id
            AND arm.advertisement_id = a.id
            AND arm.status = 'ACTIVE'
        ) AS rotation_member_active,

        pr.id AS placement_rule_id,
        pr.status AS placement_rule_status,
        pr.insertion_type,
        pr.max_impressions,

        s.id AS schedule_id,
        s.status AS schedule_status,
        s.start_at AS schedule_start_at,
        s.end_at AS schedule_end_at,

        c.id AS creative_id,
        c.status AS creative_status

      FROM advertisements a

      INNER JOIN advertisement_placements p
        ON p.id = $2

      LEFT JOIN advertisement_placement_rules pr
        ON pr.id = $3
       AND pr.advertisement_id = a.id
       AND pr.placement_id = p.id

      LEFT JOIN advertisement_schedules s
        ON s.id = $4
       AND s.advertisement_id = a.id
       AND (
         s.placement_id = p.id
         OR s.placement_id IS NULL
       )
       AND (
         s.placement_rule_id = pr.id
         OR s.placement_rule_id IS NULL
       )

      LEFT JOIN advertisement_creatives c
        ON c.id = $5
       AND c.advertisement_id = a.id

      WHERE a.id = $1
      LIMIT 1
    `,
    [advertisementId, placementId, placementRuleId, scheduleId, creativeId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    advertisementId: Number(row.advertisement_id),

    placementId: Number(row.placement_id),

    placementRuleId:
      row.placement_rule_id === null ? null : Number(row.placement_rule_id),

    scheduleId: row.schedule_id === null ? null : Number(row.schedule_id),

    creativeId: row.creative_id === null ? null : Number(row.creative_id),

    pageType: row.page_type,

    placementType: row.placement_type,

    placementEnabled: row.placement_enabled,

    placementStatus: row.placement_status,

    placementRuleStatus:
      row.placement_rule_status === null ? null : row.placement_rule_status,

    insertionType: row.insertion_type === null ? null : row.insertion_type,

    maxImpressions:
      row.max_impressions === null ? null : Number(row.max_impressions),

    scheduleStatus: row.schedule_status === null ? null : row.schedule_status,

    scheduleStartAt:
      row.schedule_start_at === null ? null : new Date(row.schedule_start_at),

    scheduleEndAt:
      row.schedule_end_at === null ? null : new Date(row.schedule_end_at),

    advertisementStatus: row.advertisement_status,

    advertisementWorkflowStatus: row.advertisement_workflow_status,
    advertisementStartAt:
      row.advertisement_start_at === null
        ? null
        : new Date(row.advertisement_start_at),
    advertisementEndAt:
      row.advertisement_end_at === null
        ? null
        : new Date(row.advertisement_end_at),
    rotationEnabled: row.rotation_enabled ?? false,
    rotationMemberActive: row.rotation_member_active ?? false,

    creativeStatus: row.creative_status === null ? null : row.creative_status
  };
};

export const lockPlacementRule = async (
  placementRuleId: number,
  client: PoolClient
): Promise<{
  maxImpressions: number | null;
} | null> => {
  const result = await client.query(
    `
      SELECT
        max_impressions
      FROM advertisement_placement_rules
      WHERE id = $1
      FOR UPDATE
    `,
    [placementRuleId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    maxImpressions:
      row.max_impressions === null ? null : Number(row.max_impressions)
  };
};

export const countImpressionsForSchedule = async (
  scheduleId: number,
  placementRuleId: number,
  client: PoolClient
): Promise<number> => {
  const result = await client.query(
    `
      SELECT
        COUNT(*)::bigint AS impression_count
      FROM advertisement_impressions
      WHERE schedule_id = $1
        AND placement_rule_id = $2
    `,
    [scheduleId, placementRuleId]
  );

  return Number(result.rows[0]?.impression_count ?? 0);
};

/** Finds a previously committed impression for an identical client event ID. */
export const findImpressionByClientEventId = async (
  clientEventId: string,
  client: PoolClient
): Promise<TrackingInsertResult | null> => {
  const result = await client.query<{ id: number; impression_at: Date }>(
    `SELECT id, impression_at FROM advertisement_impressions WHERE client_event_id = $1`,
    [clientEventId]
  );
  const row = result.rows[0];
  return row
    ? { id: Number(row.id), eventAt: new Date(row.impression_at) }
    : null;
};

export const createImpression = async (
  input: AdvertisementTrackingRequest,
  client: PoolClient
): Promise<TrackingInsertResult> => {
  const result = await client.query(
    `
      INSERT INTO advertisement_impressions (
        advertisement_id,
        placement_id,
        placement_rule_id,
        schedule_id,
        creative_id,
        page_type,
        session_id,
        visitor_id,
        ip_hash,
        browser,
        operating_system,
        device_type,
        user_agent,
        page_url,
        referrer_url,
        client_event_id,
        impression_at
      )
      VALUES (
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
        CURRENT_TIMESTAMP
      )
      RETURNING
        id,
        impression_at
    `,
    [
      input.advertisementId,
      input.placementId,
      input.placementRuleId,
      input.scheduleId,
      input.creativeId,
      input.pageType,
      input.sessionId ?? null,
      input.visitorId ?? null,
      input.ipHash ?? null,
      input.browser ?? null,
      input.operatingSystem ?? null,
      input.deviceType ?? null,
      input.userAgent ?? null,
      input.pageUrl ?? null,
      input.referrerUrl ?? null,
      input.clientEventId ?? null
    ]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Unable to create advertisement impression.");
  }

  return {
    id: Number(row.id),
    eventAt: new Date(row.impression_at)
  };
};

/** Fetches existing event IDs in one query, after placement-rule locks are held. */
export const findExistingImpressionEventIds = async (
  eventIds: string[],
  client: PoolClient
): Promise<Set<string>> => {
  if (eventIds.length === 0) return new Set();
  const result = await client.query<{ client_event_id: string }>(
    `SELECT client_event_id FROM advertisement_impressions WHERE client_event_id = ANY($1::uuid[])`,
    [eventIds]
  );
  return new Set(result.rows.map((row) => row.client_event_id));
};

/** A single SQL INSERT for the eligible events; unique IDs make retries harmless. */
export const createImpressionsBulk = async (
  requests: AdvertisementTrackingRequest[],
  client: PoolClient
): Promise<Array<{ clientEventId: string | null; id: number }>> => {
  if (requests.length === 0) return [];
  const columns = [
    "advertisement_id",
    "placement_id",
    "placement_rule_id",
    "schedule_id",
    "creative_id",
    "page_type",
    "session_id",
    "visitor_id",
    "ip_hash",
    "browser",
    "operating_system",
    "device_type",
    "user_agent",
    "page_url",
    "referrer_url",
    "client_event_id"
  ];
  const params: unknown[] = [];
  const values = requests.map((request) => {
    const row = [
      request.advertisementId,
      request.placementId,
      request.placementRuleId,
      request.scheduleId,
      request.creativeId,
      request.pageType,
      request.sessionId ?? null,
      request.visitorId ?? null,
      request.ipHash ?? null,
      request.browser ?? null,
      request.operatingSystem ?? null,
      request.deviceType ?? null,
      request.userAgent ?? null,
      request.pageUrl ?? null,
      request.referrerUrl ?? null,
      request.clientEventId ?? null
    ];
    const placeholders = row.map((value) => {
      params.push(value);
      return `$${params.length}`;
    });
    return `(${placeholders.join(", ")}, CURRENT_TIMESTAMP)`;
  });
  const result = await client.query<{
    id: number;
    client_event_id: string | null;
  }>(
    `INSERT INTO advertisement_impressions (${columns.join(", ")}, impression_at)
     VALUES ${values.join(", ")}
     ON CONFLICT (client_event_id) WHERE client_event_id IS NOT NULL DO NOTHING
     RETURNING id, client_event_id`,
    params
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    clientEventId: row.client_event_id
  }));
};

export const createClick = async (
  input: AdvertisementTrackingRequest,
  client?: PoolClient
): Promise<TrackingInsertResult> => {
  const executor = client ?? pool;
  const result = await executor.query(
    `
      INSERT INTO advertisement_clicks (
        advertisement_id,
        placement_id,
        placement_rule_id,
        schedule_id,
        creative_id,
        page_type,
        session_id,
        visitor_id,
        ip_hash,
        browser,
        operating_system,
        device_type,
        user_agent,
        page_url,
        referrer_url,
        click_at
      )
      VALUES (
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
        CURRENT_TIMESTAMP
      )
      RETURNING
        id,
        click_at
    `,
    [
      input.advertisementId,
      input.placementId,
      input.placementRuleId,
      input.scheduleId,
      input.creativeId,
      input.pageType,
      input.sessionId ?? null,
      input.visitorId ?? null,
      input.ipHash ?? null,
      input.browser ?? null,
      input.operatingSystem ?? null,
      input.deviceType ?? null,
      input.userAgent ?? null,
      input.pageUrl ?? null,
      input.referrerUrl ?? null
    ]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Unable to create advertisement click.");
  }

  return {
    id: Number(row.id),
    eventAt: new Date(row.click_at)
  };
};

export const advertisementExists = async (
  advertisementId: number
): Promise<boolean> => {
  const result = await pool.query(
    `
      SELECT 1
      FROM advertisements
      WHERE id = $1
      LIMIT 1
    `,
    [advertisementId]
  );

  return result.rows.length > 0;
};

const buildMetricsFilters = (
  eventColumn: "impression_at" | "click_at",
  from: Date | undefined,
  to: Date | undefined
): {
  where: string;
  values: unknown[];
} => {
  const conditions = ["advertisement_id = $1"];

  const values: unknown[] = [];

  if (from !== undefined) {
    values.push(from);

    conditions.push(`${eventColumn} >= $${values.length + 1}`);
  }

  if (to !== undefined) {
    values.push(to);

    conditions.push(`${eventColumn} <= $${values.length + 1}`);
  }

  return {
    where: conditions.join(" AND "),
    values: [undefined, ...values].map((value, index) =>
      index === 0 ? undefined : value
    )
  };
};

const buildMetricQueryParameters = (
  advertisementId: number,
  from: Date | undefined,
  to: Date | undefined
): unknown[] => {
  const values: unknown[] = [advertisementId];

  if (from !== undefined) {
    values.push(from);
  }

  if (to !== undefined) {
    values.push(to);
  }

  return values;
};

const buildEventConditions = (
  eventColumn: "impression_at" | "click_at"
): string[] => {
  return [
    "advertisement_id = $1",
    ...(eventColumn === "impression_at"
      ? ["impression_at >= $2", "impression_at <= $3"]
      : ["click_at >= $2", "click_at <= $3"])
  ];
};

export const getMetrics = async (
  advertisementId: number,
  from: Date | undefined,
  to: Date | undefined
): Promise<AdvertisementMetrics> => {
  const values = buildMetricQueryParameters(advertisementId, from, to);

  const impressionConditions = ["advertisement_id = $1"];

  const clickConditions = ["advertisement_id = $1"];

  if (from !== undefined) {
    impressionConditions.push(`impression_at >= $${values.indexOf(from) + 1}`);

    clickConditions.push(`click_at >= $${values.indexOf(from) + 1}`);
  }

  if (to !== undefined) {
    impressionConditions.push(`impression_at < $${values.indexOf(to) + 1}`);

    clickConditions.push(`click_at < $${values.indexOf(to) + 1}`);
  }

  const impressionWhere = impressionConditions.join(" AND ");

  const clickWhere = clickConditions.join(" AND ");

  const totalsResult = await pool.query<MetricsRow>(
    `
        SELECT
          (
            SELECT COUNT(*)::bigint
            FROM advertisement_impressions
            WHERE ${impressionWhere}
          ) AS impressions,

          (
            SELECT COUNT(*)::bigint
            FROM advertisement_clicks
            WHERE ${clickWhere}
          ) AS clicks,

          (
            SELECT COUNT(DISTINCT visitor_id)::bigint
            FROM advertisement_impressions
            WHERE ${impressionWhere}
              AND visitor_id IS NOT NULL
          ) AS unique_impression_visitors,

          (
            SELECT COUNT(DISTINCT visitor_id)::bigint
            FROM advertisement_clicks
            WHERE ${clickWhere}
              AND visitor_id IS NOT NULL
          ) AS unique_click_visitors
      `,
    values
  );

  const totalsRow = totalsResult.rows[0];

  const impressions = mapCount(totalsRow?.impressions);

  const clicks = mapCount(totalsRow?.clicks);

  const uniqueImpressionVisitors = mapCount(
    totalsRow?.unique_impression_visitors
  );

  const uniqueClickVisitors = mapCount(totalsRow?.unique_click_visitors);

  const dailyResult = await pool.query<DailyMetricRow>(
    `
        SELECT
          event_date::text AS date,
          SUM(impressions)::bigint AS impressions,
          SUM(clicks)::bigint AS clicks
        FROM (
          SELECT
            (impression_at AT TIME ZONE 'Asia/Kolkata')::date AS event_date,
            COUNT(*)::bigint AS impressions,
            0::bigint AS clicks
          FROM advertisement_impressions
          WHERE ${impressionWhere}
          GROUP BY (impression_at AT TIME ZONE 'Asia/Kolkata')::date

          UNION ALL

          SELECT
            (click_at AT TIME ZONE 'Asia/Kolkata')::date AS event_date,
            0::bigint AS impressions,
            COUNT(*)::bigint AS clicks
          FROM advertisement_clicks
          WHERE ${clickWhere}
          GROUP BY (click_at AT TIME ZONE 'Asia/Kolkata')::date
        ) events
        GROUP BY event_date
        ORDER BY event_date ASC
      `,
    values
  );

  const placementResult = await pool.query<PlacementMetricRow>(
    `
        SELECT
          placement_id::text AS placement_id,
          SUM(impressions)::bigint AS impressions,
          SUM(clicks)::bigint AS clicks
        FROM (
          SELECT
            placement_id,
            COUNT(*)::bigint AS impressions,
            0::bigint AS clicks
          FROM advertisement_impressions
          WHERE ${impressionWhere}
            AND placement_id IS NOT NULL
          GROUP BY placement_id

          UNION ALL

          SELECT
            placement_id,
            0::bigint AS impressions,
            COUNT(*)::bigint AS clicks
          FROM advertisement_clicks
          WHERE ${clickWhere}
            AND placement_id IS NOT NULL
          GROUP BY placement_id
        ) events
        GROUP BY placement_id
        ORDER BY placement_id
      `,
    values
  );

  const creativeResult = await pool.query<CreativeMetricRow>(
    `
        SELECT
          creative_id::text AS creative_id,
          SUM(impressions)::bigint AS impressions,
          SUM(clicks)::bigint AS clicks
        FROM (
          SELECT
            creative_id,
            COUNT(*)::bigint AS impressions,
            0::bigint AS clicks
          FROM advertisement_impressions
          WHERE ${impressionWhere}
            AND creative_id IS NOT NULL
          GROUP BY creative_id

          UNION ALL

          SELECT
            creative_id,
            0::bigint AS impressions,
            COUNT(*)::bigint AS clicks
          FROM advertisement_clicks
          WHERE ${clickWhere}
            AND creative_id IS NOT NULL
          GROUP BY creative_id
        ) events
        GROUP BY creative_id
        ORDER BY creative_id
      `,
    values
  );

  return {
    advertisementId,

    period: {
      from: from ?? null,
      to: to ?? null
    },

    totals: {
      impressions,
      clicks,
      uniqueImpressionVisitors,
      uniqueClickVisitors,
      clickThroughRate: calculateCtr(impressions, clicks)
    },

    daily: dailyResult.rows.map((row) => {
      const rowImpressions = mapCount(row.impressions);

      const rowClicks = mapCount(row.clicks);

      return {
        date: row.date,
        impressions: rowImpressions,
        clicks: rowClicks,
        clickThroughRate: calculateCtr(rowImpressions, rowClicks)
      };
    }),

    placements: placementResult.rows.map((row) => {
      const rowImpressions = mapCount(row.impressions);

      const rowClicks = mapCount(row.clicks);

      return {
        placementId: Number(row.placement_id),
        impressions: rowImpressions,
        clicks: rowClicks,
        clickThroughRate: calculateCtr(rowImpressions, rowClicks)
      };
    }),

    creatives: creativeResult.rows.map((row) => {
      const rowImpressions = mapCount(row.impressions);

      const rowClicks = mapCount(row.clicks);

      return {
        creativeId: Number(row.creative_id),
        impressions: rowImpressions,
        clicks: rowClicks,
        clickThroughRate: calculateCtr(rowImpressions, rowClicks)
      };
    })
  };
};
