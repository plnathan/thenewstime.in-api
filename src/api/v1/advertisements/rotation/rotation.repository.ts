import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  AdvertisementRotationConfig,
  AdvertisementRotationMember,
  AdvertisementRotationMemberStatus,
  AdvertisementRotationMode,
  AdvertisementRotationStrategy,
  CreateAdvertisementRotationMemberInput,
  UpdateAdvertisementRotationConfigInput,
  UpdateAdvertisementRotationMemberInput
} from "./rotation.types.js";

interface RotationConfigRow {
  placement_id: number | string;
  rotation_enabled: boolean;
  rotation_mode: AdvertisementRotationMode;
  rotation_interval_seconds: number | string;
  rotation_strategy: AdvertisementRotationStrategy;
}

interface RotationMemberRow {
  id: number | string;
  placement_id: number | string;
  advertisement_id: number | string;
  advertisement_name: string | null;
  advertisement_status: string | null;
  advertisement_workflow_status: string | null;
  priority: number | string;
  status: AdvertisementRotationMemberStatus;
  created_at: Date;
  updated_at: Date;
}

const mapRotationConfig = (
  row: RotationConfigRow
): AdvertisementRotationConfig => ({
  placementId: Number(row.placement_id),
  rotationEnabled: row.rotation_enabled,
  rotationMode: row.rotation_mode,
  rotationIntervalSeconds: Number(row.rotation_interval_seconds),
  rotationStrategy: row.rotation_strategy
});

const mapRotationMember = (
  row: RotationMemberRow
): AdvertisementRotationMember => ({
  id: Number(row.id),
  placementId: Number(row.placement_id),
  advertisementId: Number(row.advertisement_id),
  advertisementName: row.advertisement_name,
  advertisementStatus: row.advertisement_status,
  advertisementWorkflowStatus: row.advertisement_workflow_status,
  priority: Number(row.priority),
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const rotationConfigColumns = `
  id,
  rotation_enabled,
  rotation_mode,
  rotation_interval_seconds,
  rotation_strategy
`;

const rotationMemberColumns = `
  rm.id,
  rm.placement_id,
  rm.advertisement_id,
  a.name AS advertisement_name,
  a.status AS advertisement_status,
  a.workflow_status AS advertisement_workflow_status,
  rm.priority,
  rm.status,
  rm.created_at,
  rm.updated_at
`;

export const findPlacement = async (
  placementId: number,
  client?: PoolClient
): Promise<boolean> => {
  const db = client ?? pool;

  const result = await db.query(
    `
      SELECT id
      FROM advertisement_placements
      WHERE id = $1
      LIMIT 1
    `,
    [placementId]
  );

  return result.rows.length > 0;
};

export const findPlacementForUpdate = async (
  placementId: number,
  client: PoolClient
): Promise<boolean> => {
  const result = await client.query(
    `
      SELECT id
      FROM advertisement_placements
      WHERE id = $1
      FOR UPDATE
    `,
    [placementId]
  );

  return result.rows.length > 0;
};

export const findRotationConfig = async (
  placementId: number,
  client?: PoolClient
): Promise<AdvertisementRotationConfig | null> => {
  const db = client ?? pool;

  const result = await db.query<RotationConfigRow>(
    `
      SELECT
        id AS placement_id,
        rotation_enabled,
        rotation_mode,
        rotation_interval_seconds,
        rotation_strategy
      FROM advertisement_placements
      WHERE id = $1
      LIMIT 1
    `,
    [placementId]
  );

  const row = result.rows[0];

  return row ? mapRotationConfig(row) : null;
};

export const updateRotationConfig = async (
  placementId: number,
  input: UpdateAdvertisementRotationConfigInput,
  updatedBy: number,
  client?: PoolClient
): Promise<AdvertisementRotationConfig | null> => {
  const db = client ?? pool;

  const result = await db.query<RotationConfigRow>(
    `
      UPDATE advertisement_placements
      SET
        rotation_enabled =
          COALESCE($2, rotation_enabled),

        rotation_mode =
          COALESCE($3, rotation_mode),

        rotation_interval_seconds =
          COALESCE(
            $4,
            rotation_interval_seconds
          ),

        rotation_strategy =
          COALESCE($5, rotation_strategy),

        updated_by = $6,
        updated_at = CURRENT_TIMESTAMP

      WHERE id = $1

      RETURNING
        id AS placement_id,
        rotation_enabled,
        rotation_mode,
        rotation_interval_seconds,
        rotation_strategy
    `,
    [
      placementId,
      input.rotationEnabled ?? null,
      input.rotationMode ?? null,
      input.rotationIntervalSeconds ?? null,
      input.rotationStrategy ?? null,
      updatedBy
    ]
  );

  const row = result.rows[0];

  return row ? mapRotationConfig(row) : null;
};

export const findMemberById = async (
  placementId: number,
  memberId: number,
  client?: PoolClient
): Promise<AdvertisementRotationMember | null> => {
  const db = client ?? pool;

  const result = await db.query<RotationMemberRow>(
    `
      SELECT
        ${rotationMemberColumns}
      FROM advertisement_rotation_members rm
      INNER JOIN advertisements a
        ON a.id = rm.advertisement_id
      WHERE
        rm.placement_id = $1
        AND rm.id = $2
      LIMIT 1
    `,
    [placementId, memberId]
  );

  const row = result.rows[0];

  return row ? mapRotationMember(row) : null;
};

export const findMemberByAdvertisement = async (
  placementId: number,
  advertisementId: number,
  client?: PoolClient
): Promise<AdvertisementRotationMember | null> => {
  const db = client ?? pool;

  const result = await db.query<RotationMemberRow>(
    `
      SELECT
        ${rotationMemberColumns}
      FROM advertisement_rotation_members rm
      INNER JOIN advertisements a
        ON a.id = rm.advertisement_id
      WHERE
        rm.placement_id = $1
        AND rm.advertisement_id = $2
      LIMIT 1
    `,
    [placementId, advertisementId]
  );

  const row = result.rows[0];

  return row ? mapRotationMember(row) : null;
};

export const findMembersByPlacement = async (
  placementId: number,
  client?: PoolClient
): Promise<AdvertisementRotationMember[]> => {
  const db = client ?? pool;

  const result = await db.query<RotationMemberRow>(
    `
      SELECT
        ${rotationMemberColumns}
      FROM advertisement_rotation_members rm
      INNER JOIN advertisements a
        ON a.id = rm.advertisement_id
      WHERE rm.placement_id = $1
      ORDER BY
        rm.priority DESC,
        rm.id ASC
    `,
    [placementId]
  );

  return result.rows.map(mapRotationMember);
};

export const findActiveMembersByPlacement = async (
  placementId: number,
  client?: PoolClient
): Promise<AdvertisementRotationMember[]> => {
  const db = client ?? pool;

  const result = await db.query<RotationMemberRow>(
    `
      SELECT
        ${rotationMemberColumns}
      FROM advertisement_rotation_members rm
      INNER JOIN advertisements a
        ON a.id = rm.advertisement_id
      WHERE
        rm.placement_id = $1
        AND rm.status = 'ACTIVE'
      ORDER BY
        rm.priority DESC,
        rm.id ASC
    `,
    [placementId]
  );

  return result.rows.map(mapRotationMember);
};

export const findAdvertisement = async (
  advertisementId: number,
  client?: PoolClient
): Promise<{
  id: number;
  name: string;
  status: string;
  workflowStatus: string;
} | null> => {
  const db = client ?? pool;

  const result = await db.query<{
    id: number | string;
    name: string;
    status: string;
    workflow_status: string;
  }>(
    `
      SELECT
        id,
        name,
        status,
        workflow_status
      FROM advertisements
      WHERE id = $1
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
    name: row.name,
    status: row.status,
    workflowStatus: row.workflow_status
  };
};

export const hasActivePlacementRule = async (
  advertisementId: number,
  placementId: number,
  client?: PoolClient
): Promise<boolean> => {
  const db = client ?? pool;

  const result = await db.query(
    `
      SELECT pr.id
      FROM advertisement_placement_rules pr
      WHERE
        pr.advertisement_id = $1
        AND pr.placement_id = $2
        AND pr.status = 'ACTIVE'
      LIMIT 1
    `,
    [advertisementId, placementId]
  );

  return result.rows.length > 0;
};

export const createMember = async (
  placementId: number,
  input: CreateAdvertisementRotationMemberInput,
  client?: PoolClient
): Promise<AdvertisementRotationMember> => {
  const db = client ?? pool;

  const result = await db.query<RotationMemberRow>(
    `
      INSERT INTO advertisement_rotation_members
      (
        placement_id,
        advertisement_id,
        priority,
        status
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4
      )
      RETURNING id
    `,
    [
      placementId,
      input.advertisementId,
      input.priority ?? 0,
      input.status ?? "ACTIVE"
    ]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Advertisement rotation member was not created.");
  }

  const member = await findMemberById(placementId, Number(row.id), client);

  if (!member) {
    throw new Error(
      "Advertisement rotation member was created but could not be retrieved."
    );
  }

  return member;
};

export const updateMember = async (
  placementId: number,
  memberId: number,
  input: UpdateAdvertisementRotationMemberInput,
  client?: PoolClient
): Promise<AdvertisementRotationMember | null> => {
  const db = client ?? pool;

  const result = await db.query<{ id: number | string }>(
    `
      UPDATE advertisement_rotation_members
      SET
        priority =
          COALESCE($3, priority),

        status =
          COALESCE($4, status),

        updated_at = CURRENT_TIMESTAMP

      WHERE
        placement_id = $1
        AND id = $2

      RETURNING id
    `,
    [placementId, memberId, input.priority ?? null, input.status ?? null]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return findMemberById(placementId, Number(row.id), client);
};

export const deactivateMember = async (
  placementId: number,
  memberId: number,
  client?: PoolClient
): Promise<AdvertisementRotationMember | null> => {
  return updateMember(
    placementId,
    memberId,
    {
      status: "INACTIVE"
    },
    client
  );
};
