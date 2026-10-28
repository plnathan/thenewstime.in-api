import { pool } from "../../../../shared/config/db.js";

export type FormatInput = {
  code: string;
  displayName: string;
  description?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  mobileWidthPx?: number | null;
  mobileHeightPx?: number | null;
  isResponsive: boolean;
  displayOrder: number;
};

const columns = `id, code, display_name AS "displayName", description,
 width_px AS "widthPx", height_px AS "heightPx",
 mobile_width_px AS "mobileWidthPx", mobile_height_px AS "mobileHeightPx",
 is_responsive AS "isResponsive", is_system_format AS "isSystemFormat",
 status, display_order AS "displayOrder", created_at AS "createdAt", updated_at AS "updatedAt",
 created_by AS "createdBy", updated_by AS "updatedBy"`;

export async function listFormats() {
  const result = await pool.query(
    `SELECT ${columns} FROM advertisement_formats ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, display_order, id`
  );
  return result.rows;
}
export async function getFormat(id: number) {
  const result = await pool.query(
    `SELECT ${columns} FROM advertisement_formats WHERE id=$1`,
    [id]
  );
  return result.rows[0] ?? null;
}
export async function createFormat(input: FormatInput, actor: number) {
  const result = await pool.query(
    `INSERT INTO advertisement_formats
  (code,display_name,description,width_px,height_px,mobile_width_px,mobile_height_px,is_responsive,display_order,status,is_system_format,created_by,updated_by)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE',false,$10,$10) RETURNING id`,
    [
      input.code,
      input.displayName,
      input.description ?? null,
      input.widthPx ?? null,
      input.heightPx ?? null,
      input.mobileWidthPx ?? null,
      input.mobileHeightPx ?? null,
      input.isResponsive,
      input.displayOrder,
      actor
    ]
  );
  return getFormat(Number(result.rows[0].id));
}
export async function updateFormat(
  id: number,
  input: FormatInput,
  actor: number
) {
  const result = await pool.query(
    `UPDATE advertisement_formats SET display_name=$2,description=$3,width_px=$4,height_px=$5,
  mobile_width_px=$6,mobile_height_px=$7,is_responsive=$8,display_order=$9,updated_by=$10,updated_at=NOW()
  WHERE id=$1 RETURNING id`,
    [
      id,
      input.displayName,
      input.description ?? null,
      input.widthPx ?? null,
      input.heightPx ?? null,
      input.mobileWidthPx ?? null,
      input.mobileHeightPx ?? null,
      input.isResponsive,
      input.displayOrder,
      actor
    ]
  );
  return result.rowCount ? getFormat(id) : null;
}
export async function setFormatStatus(
  id: number,
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED",
  actor: number
) {
  const result = await pool.query(
    `UPDATE advertisement_formats SET status=$2,updated_by=$3,updated_at=NOW() WHERE id=$1 RETURNING id`,
    [id, status, actor]
  );
  return result.rowCount ? getFormat(id) : null;
}
export async function isFormatUsed(id: number) {
  const result = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM advertisement_placements WHERE format_id=$1) AS used`,
    [id]
  );
  return Boolean(result.rows[0]?.used);
}
