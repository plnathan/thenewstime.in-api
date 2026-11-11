import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../security/middleware/authenticate.middleware.js";
import { authorize } from "../security/middleware/authorize.middleware.js";
import {
  getMaintenanceState,
  setMaintenanceState
} from "./maintenance.service.js";

const router = Router();
const schema = z.object({
  enabled: z.boolean(),
  message: z.string().trim().min(1).max(1000),
  expectedRestorationAt: z.string().datetime({ offset: true }).nullable()
});

router.get("/public-availability", async (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  try {
    const state = await getMaintenanceState();
    res.json({ success: true, ...state });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/maintenance",
  authenticate,
  authorize("SECURITY", "permissions", "read"),
  async (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      res.json({ success: true, ...(await getMaintenanceState()) });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/maintenance",
  authenticate,
  authorize("SECURITY", "permissions", "update"),
  async (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "Invalid maintenance settings.",
        errors: parsed.error.flatten()
      });
      return;
    }
    try {
      res.setHeader("Cache-Control", "no-store");
      const state = await setMaintenanceState({
        ...parsed.data,
        userId: req.user!.id
      });
      res.json({ success: true, ...state });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
