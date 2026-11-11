import { pool } from "../../../shared/config/db.js";

export interface MaintenanceState {
  maintenance: boolean;
  message: string;
  expectedRestorationAt: string | null;
  source: "ENVIRONMENT" | "DATABASE";
}

const defaultMessage =
  "எங்கள் இணையதளத்தில் பராமரிப்புப் பணிகள் நடைபெற்று வருகின்றன. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.";

/** Emergency override takes precedence over database settings. */
export async function getMaintenanceState(): Promise<MaintenanceState> {
  if (process.env.PUBLIC_MAINTENANCE_MODE === "true") {
    return {
      maintenance: true,
      message: defaultMessage,
      expectedRestorationAt: null,
      source: "ENVIRONMENT"
    };
  }
  const result = await pool.query<{
    enabled: boolean;
    message_ta: string;
    expected_restoration_at: Date | null;
  }>(
    "SELECT enabled, message_ta, expected_restoration_at FROM public.system_maintenance WHERE id = 1"
  );
  const row = result.rows[0];
  if (!row)
    throw new Error(
      "Maintenance configuration missing. Run the Phase 3 SQL migration."
    );
  return {
    maintenance: row.enabled,
    message: row.message_ta,
    expectedRestorationAt: row.expected_restoration_at?.toISOString() ?? null,
    source: "DATABASE"
  };
}

export async function setMaintenanceState(input: {
  enabled: boolean;
  message: string;
  expectedRestorationAt: string | null;
  userId: number;
}): Promise<MaintenanceState> {
  await pool.query(
    `UPDATE public.system_maintenance
     SET enabled = $1, message_ta = $2, expected_restoration_at = $3,
         updated_by = $4, updated_at = now()
     WHERE id = 1`,
    [input.enabled, input.message, input.expectedRestorationAt, input.userId]
  );
  return getMaintenanceState();
}
