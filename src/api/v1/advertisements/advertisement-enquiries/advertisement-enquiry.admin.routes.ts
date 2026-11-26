import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";

const optionalQueryText = (maxLength: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(maxLength).optional()
  );

const optionalQueryStatus = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["PENDING", "RESPONDED", "REJECTED", "BOOKED"]).optional()
);

import { periodDate, currentIstPeriod } from "../date-period.js";
const periodFields = {
  periodFrom: periodDate.optional(),
  periodTo: periodDate.optional()
};
const validPeriod = (v: {
  periodFrom?: string | undefined;
  periodTo?: string | undefined;
}) =>
  (!v.periodFrom && !v.periodTo) ||
  (!!v.periodFrom && !!v.periodTo && v.periodFrom <= v.periodTo);
const periodSchema = z.object(periodFields).refine(validPeriod);
const periodWhere = (from: number, to: number) =>
  `COALESCE(responded_at, created_at) >= ($${from}::date::timestamp AT TIME ZONE 'Asia/Kolkata') AND COALESCE(responded_at, created_at) < (($${to}::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')`;
const querySchema = z
  .object({
    ...periodFields,
    name: optionalQueryText(120),
    company: optionalQueryText(160),
    mobile: optionalQueryText(30),
    status: optionalQueryStatus,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
  })
  .refine(validPeriod);
const updateSchema = z
  .object({
    status: z.enum(["PENDING", "RESPONDED", "REJECTED", "BOOKED"]).optional(),
    remarks: z.string().max(2000).nullable().optional()
  })
  .strict()
  .refine((v) => v.status !== undefined || v.remarks !== undefined);
export function createAdvertisementEnquiryAdminRouter(pool: Pool): Router {
  const router = Router();
  router.use(
    authenticate,
    authorize("ADVERTISEMENT", "advertisements", "read")
  );
  // Statistics share the grid date period, independent of other grid filters.
  router.get("/stats", async (req, res, next) => {
    try {
      const parsed = periodSchema.safeParse(req.query);
      if (!parsed.success) {
        res
          .status(400)
          .json({ success: false, message: "Invalid date period" });
        return;
      }
      const defaults = currentIstPeriod();
      const from = parsed.data.periodFrom ?? defaults.periodFrom;
      const to = parsed.data.periodTo ?? defaults.periodTo;
      const result = await pool.query<{
        total: string;
        pending: string;
        responded: string;
        booked: string;
        rejected: string;
      }>(
        `SELECT
        count(*)::text AS total,
        count(*) FILTER (WHERE status = 'PENDING')::text AS pending,
        count(*) FILTER (WHERE status = 'RESPONDED')::text AS responded,
        count(*) FILTER (WHERE status = 'BOOKED')::text AS booked,
        count(*) FILTER (WHERE status = 'REJECTED')::text AS rejected
        FROM advertisement_enquiries WHERE deleted_at IS NULL AND ${periodWhere(1, 2)}`,
        [from, to]
      );
      const counts = result.rows[0];
      res.json({
        success: true,
        data: {
          total: Number(counts?.total ?? 0),
          PENDING: Number(counts?.pending ?? 0),
          RESPONDED: Number(counts?.responded ?? 0),
          BOOKED: Number(counts?.booked ?? 0),
          REJECTED: Number(counts?.rejected ?? 0)
        }
      });
    } catch (error) {
      next(error);
    }
  });
  router.get("/", async (req, res, next) => {
    try {
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: "Invalid filters" });
        return;
      }
      const q = parsed.data;
      const params = [
        q.name ?? "",
        q.company ?? "",
        q.mobile ?? "",
        q.status ?? "",
        q.periodFrom ?? currentIstPeriod().periodFrom,
        q.periodTo ?? currentIstPeriod().periodTo
      ];
      const where = `deleted_at IS NULL AND ($1 = '' OR full_name ILIKE '%' || $1 || '%')
        AND ($2 = '' OR company_name ILIKE '%' || $2 || '%')
        AND ($3 = '' OR mobile_number ILIKE '%' || $3 || '%')
        AND ($4 = '' OR status = $4) AND ${periodWhere(5, 6)}`;
      const count = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM advertisement_enquiries WHERE ${where}`,
        params
      );
      const rows = await pool.query(
        `SELECT id::text, full_name AS "fullName", company_name AS "companyName",
        mobile_number AS "mobileNumber", email, advertisement_type AS "advertisementType",
        page_types AS "pageTypes", placement_types AS "placementTypes", preferred_start_date AS "preferredStartDate",
        preferred_end_date AS "preferredEndDate", additional_requirements AS "additionalRequirements",
        source, status, remarks, created_at AS "createdAt", updated_at AS "updatedAt", responded_at AS "respondedAt"
        FROM advertisement_enquiries WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT $7 OFFSET $8`,
        [...params, q.pageSize, (q.page - 1) * q.pageSize]
      );
      res.json({
        success: true,
        data: rows.rows,
        meta: {
          page: q.page,
          pageSize: q.pageSize,
          total: Number(count.rows[0]?.count ?? 0)
        }
      });
    } catch (e) {
      next(e);
    }
  });
  router.patch("/:id", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const parsed = updateSchema.safeParse(req.body);
      if (!Number.isSafeInteger(id) || id <= 0 || !parsed.success) {
        res
          .status(400)
          .json({ success: false, message: "Invalid enquiry update" });
        return;
      }
      const result = await pool.query(
        `UPDATE advertisement_enquiries SET
        responded_at=CASE WHEN $2 = 'PENDING' THEN NULL
          WHEN $2 IN ('RESPONDED','BOOKED','REJECTED') AND responded_at IS NULL THEN now()
          ELSE responded_at END,
        status=COALESCE($2,status), remarks=CASE WHEN $3::boolean THEN $4 ELSE remarks END,
        updated_at=now(), updated_by=$5 WHERE id=$1 AND deleted_at IS NULL RETURNING id::text`,
        [
          id,
          parsed.data.status ?? null,
          parsed.data.remarks !== undefined,
          parsed.data.remarks ?? null,
          req.user!.id
        ]
      );
      if (!result.rowCount) {
        res.status(404).json({ success: false, message: "Enquiry not found" });
        return;
      }
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });
  router.delete("/:id", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        res.status(400).json({ success: false, message: "Invalid enquiry ID" });
        return;
      }
      const result = await pool.query(
        `UPDATE advertisement_enquiries SET deleted_at=now(), deleted_by=$2,
        updated_at=now(), updated_by=$2 WHERE id=$1 AND deleted_at IS NULL RETURNING id::text`,
        [id, req.user!.id]
      );
      if (!result.rowCount) {
        res.status(404).json({ success: false, message: "Enquiry not found" });
        return;
      }
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });
  return router;
}
