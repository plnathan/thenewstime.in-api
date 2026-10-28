import { pool } from "../../../../shared/config/db.js";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

export interface CreativeRotationConfig {
  advertisementId: number;
  rotationEnabled: boolean;
  rotationIntervalSeconds: number;
  rotationStrategy: "ROUND_ROBIN";
}

export interface UpdateCreativeRotationInput {
  rotationEnabled?: boolean;
  rotationIntervalSeconds?: number;
  rotationStrategy?: "ROUND_ROBIN";
}

interface ConfigRow {
  advertisement_id: string | number;
  rotation_enabled: boolean;
  rotation_interval_seconds: number;
  rotation_strategy: "ROUND_ROBIN";
}

const mapConfig = (row: ConfigRow): CreativeRotationConfig => ({
  advertisementId: Number(row.advertisement_id),
  rotationEnabled: row.rotation_enabled,
  rotationIntervalSeconds: Number(row.rotation_interval_seconds),
  rotationStrategy: row.rotation_strategy
});

const checkId = (id: number): void => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ApiError(400, "Advertisement ID must be a positive integer.");
  }
};

export const getCreativeRotationConfig = async (
  advertisementId: number
): Promise<CreativeRotationConfig> => {
  checkId(advertisementId);
  const result = await pool.query<ConfigRow>(
    `SELECT a.id AS advertisement_id,
            COALESCE(c.rotation_enabled, FALSE) AS rotation_enabled,
            COALESCE(c.rotation_interval_seconds, 10) AS rotation_interval_seconds,
            COALESCE(c.rotation_strategy, 'ROUND_ROBIN') AS rotation_strategy
       FROM advertisements a
       LEFT JOIN advertisement_creative_rotation_configs c
         ON c.advertisement_id = a.id
      WHERE a.id = $1`,
    [advertisementId]
  );
  if (!result.rows[0]) throw new ApiError(404, "Advertisement not found.");
  return mapConfig(result.rows[0]);
};

export const updateCreativeRotationConfig = async (
  advertisementId: number,
  input: UpdateCreativeRotationInput
): Promise<CreativeRotationConfig> => {
  checkId(advertisementId);
  if (
    input.rotationEnabled === undefined &&
    input.rotationIntervalSeconds === undefined &&
    input.rotationStrategy === undefined
  )
    throw new ApiError(
      400,
      "At least one creative rotation field is required."
    );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ad = await client.query<{
      id: string | number;
      workflow_status: string;
      status: string;
    }>(
      "SELECT id, workflow_status, status FROM advertisements WHERE id = $1 FOR UPDATE",
      [advertisementId]
    );
    if (!ad.rows[0]) throw new ApiError(404, "Advertisement not found.");
    if (
      ["ARCHIVED"].includes(ad.rows[0].workflow_status) ||
      ad.rows[0].status === "ARCHIVED"
    ) {
      throw new ApiError(409, "Archived advertisements cannot be modified.");
    }

    // Validate the resulting enabled state, including partial PATCH requests.
    const existing = await client.query<{ rotation_enabled: boolean }>(
      `SELECT rotation_enabled FROM advertisement_creative_rotation_configs
       WHERE advertisement_id = $1`,
      [advertisementId]
    );
    const willEnable =
      input.rotationEnabled ?? existing.rows[0]?.rotation_enabled ?? false;
    if (willEnable) {
      const limitResult = await client.query<{
        max_active_creatives_per_advertisement: number;
      }>(
        `SELECT max_active_creatives_per_advertisement
         FROM advertisement_rotation_limits WHERE id = 1`
      );
      const maxSlides = Number(
        limitResult.rows[0]?.max_active_creatives_per_advertisement ?? 5
      );
      if (!Number.isSafeInteger(maxSlides) || maxSlides < 1) {
        throw new ApiError(
          409,
          "Invalid creative rotation limit configuration."
        );
      }
      const creativeRows = await client.query<{
        id: string | number;
        variant: string;
        display_order: number | string;
      }>(
        `SELECT id, variant, display_order FROM advertisement_creatives
         WHERE advertisement_id = $1 AND status = 'ACTIVE'
           AND NULLIF(BTRIM(media_url), '') IS NOT NULL
         ORDER BY display_order, id`,
        [advertisementId]
      );
      const desktop = creativeRows.rows.filter(
        (row) => row.variant === "DESKTOP"
      );
      const mobile = creativeRows.rows.filter(
        (row) => row.variant === "MOBILE"
      );
      if (desktop.length < 2) {
        throw new ApiError(
          409,
          "Enable creative rotation only when at least two active desktop creatives exist."
        );
      }
      if (desktop.length > maxSlides) {
        throw new ApiError(
          409,
          `Creative rotation exceeds the limit of ${maxSlides} desktop slides.`
        );
      }
      const desktopOrders = new Set(
        desktop.map((row) => Number(row.display_order))
      );
      if (desktopOrders.size !== desktop.length) {
        throw new ApiError(
          409,
          "Each active desktop creative must have a unique display order."
        );
      }
      const mobileOrders = new Set<number>();
      for (const row of mobile) {
        const order = Number(row.display_order);
        if (!desktopOrders.has(order) || mobileOrders.has(order)) {
          throw new ApiError(
            409,
            "Each mobile creative must match exactly one desktop display order."
          );
        }
        mobileOrders.add(order);
      }
    }

    const result = await client.query<ConfigRow>(
      `INSERT INTO advertisement_creative_rotation_configs
         (advertisement_id, rotation_enabled, rotation_interval_seconds, rotation_strategy)
       VALUES ($1, COALESCE($2::boolean, FALSE), COALESCE($3::integer, 10), COALESCE($4::varchar, 'ROUND_ROBIN'))
       ON CONFLICT (advertisement_id) DO UPDATE SET
         rotation_enabled = COALESCE($2::boolean, advertisement_creative_rotation_configs.rotation_enabled),
         rotation_interval_seconds = COALESCE($3::integer, advertisement_creative_rotation_configs.rotation_interval_seconds),
         rotation_strategy = COALESCE($4::varchar, advertisement_creative_rotation_configs.rotation_strategy),
         updated_at = CURRENT_TIMESTAMP
       RETURNING advertisement_id, rotation_enabled, rotation_interval_seconds, rotation_strategy`,
      [
        advertisementId,
        input.rotationEnabled ?? null,
        input.rotationIntervalSeconds ?? null,
        input.rotationStrategy ?? null
      ]
    );
    await client.query("COMMIT");
    return mapConfig(result.rows[0]!);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
