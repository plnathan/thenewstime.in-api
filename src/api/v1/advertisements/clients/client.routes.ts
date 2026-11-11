import { Router } from "express";
import { z } from "zod";
import { pool } from "../../../../shared/config/db.js";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";

import * as controller from "./client.controller.js";

import {
  clientIdSchema,
  clientQuerySchema,
  createClientSchema,
  updateClientSchema
} from "./client.validation.js";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("ADVERTISEMENT", "advertisements.client", "read"),
  validate(clientQuerySchema, "query"),
  controller.getAll
);

router.get(
  "/business-types",
  authorize("ADVERTISEMENT", "advertisements.client", "read"),
  async (_req, res, next) => {
    try {
      const result = await pool.query<{
        id: number | string;
        code: string;
        display_name: string;
        description: string | null;
        display_order: number;
        status: "ACTIVE" | "INACTIVE";
      }>(`SELECT id, code, display_name, description, display_order, status
          FROM advertisement_business_types
          ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
                   display_order ASC, display_name ASC`);
      res.json({
        success: true,
        data: result.rows.map((row) => ({
          id: Number(row.id),
          code: row.code,
          displayName: row.display_name,
          description: row.description,
          displayOrder: Number(row.display_order),
          status: row.status
        }))
      });
    } catch (error) {
      next(error);
    }
  }
);

const businessTypeInput = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9_.-]+$/),
  displayName: z.string().trim().min(1).max(150),
  description: z.string().trim().optional().nullable(),
  displayOrder: z.number().int().min(0).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
});
const businessTypePatch = businessTypeInput
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required"
  );
const typeId = (raw: string) =>
  /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
const businessTypeSelect = `SELECT id, code, display_name AS "displayName", description,
  display_order AS "displayOrder", status, created_at AS "createdAt",
  updated_at AS "updatedAt" FROM public.advertisement_business_types`;

router.get(
  "/business-types/:id",
  authorize("ADVERTISEMENT", "advertisements.client", "read"),
  async (req, res, next) => {
    try {
      const id = typeId(String(req.params.id));
      if (!id) {
        res
          .status(400)
          .json({ success: false, message: "Invalid business type ID" });
        return;
      }
      const result = await pool.query(`${businessTypeSelect} WHERE id = $1`, [
        id
      ]);
      if (!result.rows.length) {
        res
          .status(404)
          .json({ success: false, message: "Business type not found" });
        return;
      }
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);
router.post(
  "/business-types",
  authorize("ADVERTISEMENT", "advertisements.client", "create"),
  async (req, res, next) => {
    try {
      const parsed = businessTypeInput.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            success: false,
            message: "Invalid business type",
            errors: parsed.error.flatten()
          });
        return;
      }
      const v = parsed.data;
      const result = await pool.query(
        `INSERT INTO public.advertisement_business_types
      (code, display_name, description, display_order, status)
      VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          v.code,
          v.displayName,
          v.description || null,
          v.displayOrder ?? 0,
          v.status ?? "ACTIVE"
        ]
      );
      const created = await pool.query(`${businessTypeSelect} WHERE id = $1`, [
        result.rows[0].id
      ]);
      res.status(201).json({ success: true, data: created.rows[0] });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        res
          .status(409)
          .json({
            success: false,
            message: "Business type code already exists"
          });
        return;
      }
      next(error);
    }
  }
);
router.patch(
  "/business-types/:id",
  authorize("ADVERTISEMENT", "advertisements.client", "update"),
  async (req, res, next) => {
    try {
      const id = typeId(String(req.params.id));
      if (!id) {
        res
          .status(400)
          .json({ success: false, message: "Invalid business type ID" });
        return;
      }
      const parsed = businessTypePatch.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            success: false,
            message: "Invalid business type",
            errors: parsed.error.flatten()
          });
        return;
      }
      const v = parsed.data;
      const columns: Record<string, string> = {
        code: "code",
        displayName: "display_name",
        description: "description",
        displayOrder: "display_order",
        status: "status"
      };
      const entries = Object.entries(v).filter(([key]) => key in columns);
      const sets = entries.map(
        ([key], index) => `${columns[key]} = $${index + 1}`
      );
      const values = entries.map(([, value]) => value);
      const updated = await pool.query(
        `UPDATE public.advertisement_business_types SET ${sets.join(", ")}
      WHERE id = $${values.length + 1} RETURNING id`,
        [...values, id]
      );
      if (!updated.rows.length) {
        res
          .status(404)
          .json({ success: false, message: "Business type not found" });
        return;
      }
      const result = await pool.query(`${businessTypeSelect} WHERE id = $1`, [
        id
      ]);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        res
          .status(409)
          .json({
            success: false,
            message: "Business type code already exists"
          });
        return;
      }
      next(error);
    }
  }
);
router.patch(
  "/business-types/:id/status",
  authorize("ADVERTISEMENT", "advertisements.client", "update"),
  async (req, res, next) => {
    try {
      const id = typeId(String(req.params.id));
      const parsed = z
        .object({ status: z.enum(["ACTIVE", "INACTIVE"]) })
        .safeParse(req.body);
      if (!id || !parsed.success) {
        res
          .status(400)
          .json({ success: false, message: "Invalid ID or status" });
        return;
      }
      const updated = await pool.query(
        `UPDATE public.advertisement_business_types SET status = $1 WHERE id = $2 RETURNING id`,
        [parsed.data.status, id]
      );
      if (!updated.rows.length) {
        res
          .status(404)
          .json({ success: false, message: "Business type not found" });
        return;
      }
      const result = await pool.query(`${businessTypeSelect} WHERE id = $1`, [
        id
      ]);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.client", "read"),
  validate(clientIdSchema, "params"),
  controller.getById
);

router.post(
  "/",
  authorize("ADVERTISEMENT", "advertisements.client", "create"),
  validate(createClientSchema, "body"),
  controller.create
);

router.patch(
  "/:id",
  authorize("ADVERTISEMENT", "advertisements.client", "update"),
  validate(clientIdSchema, "params"),
  validate(updateClientSchema, "body"),
  controller.update
);

export default router;
