import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementSchedule,
  CreateScheduleInput,
  ScheduleQuery,
  UpdateScheduleInput
} from "./schedule.types.js";

interface AdvertisementWorkflowRow {
  workflow_status: string;
}

interface PlacementRow {
  id: number;
  status: string;
  is_enabled: boolean;
}

interface PlacementRuleRow {
  id: number;
  advertisement_id: number;
  placement_id: number;
  status: string;
}

const mapSchedule = (row: any): AdvertisementSchedule => ({
  id: Number(row.id),
  advertisementId: Number(row.advertisement_id),
  placementId: Number(row.placement_id),
  placementRuleId:
    row.placement_rule_id === null ? null : Number(row.placement_rule_id),
  startAt: row.start_at,
  endAt: row.end_at,
  status: row.status,
  priority: Number(row.priority),
  rescheduledFromId:
    row.rescheduled_from_id === null ? null : Number(row.rescheduled_from_id),
  notes: row.notes,
  createdBy: row.created_by === null ? null : Number(row.created_by),
  updatedBy: row.updated_by === null ? null : Number(row.updated_by),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const selectColumns = `  id,
  advertisement_id,
  placement_id,
  placement_rule_id,
  start_at,
  end_at,
  status,
  priority,
  rescheduled_from_id,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at`;

export const findAll = async (
  query: ScheduleQuery = {},
  client?: PoolClient
): Promise<AdvertisementSchedule[]> => {
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

  if (query.placementRuleId !== undefined) {
    values.push(query.placementRuleId);
    conditions.push(`placement_rule_id = $${values.length}`);
  }

  if (query.status !== undefined) {
    values.push(query.status);
    conditions.push(`status = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await db.query(
    `       SELECT ${selectColumns}
      FROM advertisement_schedules
      ${whereClause}
      ORDER BY start_at ASC, priority DESC, id ASC
    `,
    values
  );

  return result.rows.map(mapSchedule);
};

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<AdvertisementSchedule | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `       SELECT ${selectColumns}
      FROM advertisement_schedules
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ? mapSchedule(result.rows[0]) : null;
};

export const findAdvertisementOperationalStatus = async (
  advertisementId: number,
  client?: PoolClient
): Promise<string | null> => {
  const db = client ?? pool;
  const result = await db.query<{ status: string }>(
    `SELECT status FROM advertisements WHERE id = $1 LIMIT 1`,
    [advertisementId]
  );
  return result.rows[0]?.status ?? null;
};

export const findAdvertisementWorkflowStatus = async (
  advertisementId: number,
  client?: PoolClient
): Promise<string | null> => {
  const db = client ?? pool;

  const result = await db.query<AdvertisementWorkflowRow>(
    `       SELECT workflow_status
      FROM advertisements
      WHERE id = $1
      LIMIT 1
    `,
    [advertisementId]
  );

  return result.rows[0]?.workflow_status ?? null;
};

export interface AdvertisementCampaignWindow {
  startAt: Date | string | null;
  endAt: Date | string | null;
}

export const findAdvertisementCampaignWindow = async (
  advertisementId: number,
  client?: PoolClient
): Promise<AdvertisementCampaignWindow | null> => {
  const db = client ?? pool;
  const result = await db.query<{
    start_at: Date | string | null;
    end_at: Date | string | null;
  }>(`SELECT start_at, end_at FROM advertisements WHERE id = $1 LIMIT 1`, [
    advertisementId
  ]);
  const row = result.rows[0];
  return row ? { startAt: row.start_at, endAt: row.end_at } : null;
};

export const findPlacement = async (
  placementId: number,
  client?: PoolClient
): Promise<PlacementRow | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `       SELECT
        id,
        status,
        is_enabled
      FROM advertisement_placements
      WHERE id = $1
      LIMIT 1
    `,
    [placementId]
  );

  return result.rows[0]
    ? {
        id: Number(result.rows[0].id),
        status: result.rows[0].status,
        is_enabled: Boolean(result.rows[0].is_enabled)
      }
    : null;
};

export const findPlacementRule = async (
  placementRuleId: number,
  client?: PoolClient
): Promise<PlacementRuleRow | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `       SELECT
        id,
        advertisement_id,
        placement_id,
        status
      FROM advertisement_placement_rules
      WHERE id = $1
      LIMIT 1
    `,
    [placementRuleId]
  );

  return result.rows[0]
    ? {
        id: Number(result.rows[0].id),
        advertisement_id: Number(result.rows[0].advertisement_id),
        placement_id: Number(result.rows[0].placement_id),
        status: result.rows[0].status
      }
    : null;
};

/**
 * Serializes schedule writes and manual activation checks for a placement.
 * Call only inside a transaction; the lock is released automatically on
 * commit/rollback. The namespace is reserved for advertisement scheduling.
 */
export const lockPlacementScheduleScope = async (
  placementId: number,
  client: PoolClient
): Promise<void> => {
  await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
    73421,
    placementId
  ]);
};

export const findOverlapping = async (
  advertisementId: number,
  placementId: number,
  startAt: Date,
  endAt: Date,
  excludeId?: number,
  client?: PoolClient
): Promise<AdvertisementSchedule | null> => {
  const db = client ?? pool;

  const values: unknown[] = [advertisementId, placementId, startAt, endAt];

  if (excludeId !== undefined) {
    values.push(excludeId);
  }

  const result = await db.query(
    `       SELECT
        s.id,
        s.advertisement_id,
        s.placement_id,
        s.placement_rule_id,
        s.start_at,
        s.end_at,
        s.status,
        s.priority,
        s.rescheduled_from_id,
        s.notes,
        s.created_by,
        s.updated_by,
        s.created_at,
        s.updated_at
      FROM advertisement_schedules s
      INNER JOIN advertisement_placements p ON p.id = s.placement_id
      WHERE s.placement_id = $2
        AND s.status IN ('SCHEDULED', 'ACTIVE', 'PAUSED')
        AND s.start_at < $4
        AND s.end_at > $3
        AND (
          s.advertisement_id = $1
          OR COALESCE(p.rotation_enabled, FALSE) = FALSE
        )
        ${excludeId !== undefined ? `AND s.id <> $${values.length}` : ""}
      ORDER BY s.start_at ASC, s.id ASC
      LIMIT 1
    `,
    values
  );

  return result.rows[0] ? mapSchedule(result.rows[0]) : null;
};

export const create = async (
  input: CreateScheduleInput,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementSchedule> => {
  const db = client ?? pool;

  const result = await db.query(
    `       INSERT INTO advertisement_schedules
      (
        advertisement_id,
        placement_id,
        placement_rule_id,
        start_at,
        end_at,
        status,
        priority,
        rescheduled_from_id,
        notes,
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
        $10
      )
      RETURNING ${selectColumns}
    `,
    [
      input.advertisementId,
      input.placementId,
      input.placementRuleId ?? null,
      input.startAt,
      input.endAt,
      input.status ?? "SCHEDULED",
      input.priority ?? 0,
      input.rescheduledFromId ?? null,
      input.notes ?? null,
      userId
    ]
  );

  return mapSchedule(result.rows[0]);
};

export const update = async (
  id: number,
  input: UpdateScheduleInput,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementSchedule | null> => {
  const db = client ?? pool;

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (column: string, value: unknown): void => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (input.placementRuleId !== undefined) {
    add("placement_rule_id", input.placementRuleId);
  }

  if (input.startAt !== undefined) {
    add("start_at", input.startAt);
  }

  if (input.endAt !== undefined) {
    add("end_at", input.endAt);
  }

  if (input.status !== undefined) {
    add("status", input.status);
  }

  if (input.priority !== undefined) {
    add("priority", input.priority);
  }

  if (input.rescheduledFromId !== undefined) {
    add("rescheduled_from_id", input.rescheduledFromId);
  }

  if (input.notes !== undefined) {
    add("notes", input.notes);
  }

  if (fields.length === 0) {
    return findById(id, client);
  }

  values.push(userId);
  values.push(id);

  const result = await db.query(
    `       UPDATE advertisement_schedules
      SET
        ${fields.join(",\n        ")},
        updated_by = $${values.length - 1},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length}
      RETURNING ${selectColumns}
    `,
    values
  );

  return result.rows[0] ? mapSchedule(result.rows[0]) : null;
};

export const cancel = async (
  id: number,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementSchedule | null> => {
  return update(
    id,
    {
      status: "CANCELLED"
    },
    userId,
    client
  );
};

export const activate = async (
  id: number,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementSchedule | null> => {
  return update(
    id,
    {
      status: "ACTIVE"
    },
    userId,
    client
  );
};

export const pause = async (
  id: number,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementSchedule | null> => {
  return update(
    id,
    {
      status: "PAUSED"
    },
    userId,
    client
  );
};

export const resume = async (
  id: number,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementSchedule | null> => {
  return update(
    id,
    {
      status: "ACTIVE"
    },
    userId,
    client
  );
};

export const complete = async (
  id: number,
  userId: number,
  client?: PoolClient
): Promise<AdvertisementSchedule | null> => {
  return update(
    id,
    {
      status: "COMPLETED"
    },
    userId,
    client
  );
};
