import type { Request, Response, NextFunction } from "express";
import { getMaintenanceState } from "../../api/v1/system/maintenance.service.js";

/** Public API protection. Administration/authentication routes stay accessible. */
export async function publicMaintenanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const path = req.path;
  if (
    path === "/api/v1/health" ||
    path.startsWith("/api/v1/auth/") ||
    path.startsWith("/api/v1/security/") ||
    path.startsWith("/api/v1/system/") ||
    path.startsWith("/api/v1/dashboard") ||
    path.startsWith("/api/v1/advertisements") ||
    path.startsWith("/api/v1/advertisement-clients") ||
    path.startsWith("/api/v1/advertisement-enquiries/admin")
  ) {
    next();
    return;
  }
  try {
    const state = await getMaintenanceState();
    if (!state.maintenance) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Retry-After", "120");
    res
      .status(503)
      .json({ success: false, code: "MAINTENANCE", message: state.message });
  } catch (error) {
    next(error);
  }
}
