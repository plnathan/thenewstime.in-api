import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
const { getMaintenanceState } = vi.hoisted(() => ({
  getMaintenanceState: vi.fn()
}));
vi.mock("../../../api/v1/system/maintenance.service.js", () => ({
  getMaintenanceState
}));
import { publicMaintenanceMiddleware } from "../maintenance.middleware.js";

function context(path: string) {
  const req = { path } as Request;
  const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}
beforeEach(() => vi.clearAllMocks());
describe("public maintenance enforcement", () => {
  it.each([
    "/api/v1/health",
    "/api/v1/system/public-availability",
    "/api/v1/security/users",
    "/api/v1/auth/login",
    "/api/v1/advertisements/list"
  ])("exempts %s", async (path) => {
    const { req, res, next } = context(path);
    await publicMaintenanceMiddleware(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(getMaintenanceState).not.toHaveBeenCalled();
  });
  it("allows public requests when maintenance is disabled", async () => {
    getMaintenanceState.mockResolvedValue({ maintenance: false });
    const { req, res, next } = context("/api/v1/news");
    await publicMaintenanceMiddleware(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
  it("returns 503, retry-after and maintenance message when enabled", async () => {
    getMaintenanceState.mockResolvedValue({
      maintenance: true,
      message: "Scheduled maintenance"
    });
    const { req, res, next } = context("/api/v1/news");
    await publicMaintenanceMiddleware(req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "120");
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: "MAINTENANCE",
      message: "Scheduled maintenance"
    });
    expect(next).not.toHaveBeenCalled();
  });
  it("forwards backend failures to error middleware", async () => {
    const error = new Error("database offline");
    getMaintenanceState.mockRejectedValue(error);
    const { req, res, next } = context("/api/v1/news");
    await publicMaintenanceMiddleware(req, res as unknown as Response, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
