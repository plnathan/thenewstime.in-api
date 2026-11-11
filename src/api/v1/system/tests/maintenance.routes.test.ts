import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const { getMaintenanceState, setMaintenanceState, authenticate, authorize } =
  vi.hoisted(() => ({
    getMaintenanceState: vi.fn(),
    setMaintenanceState: vi.fn(),
    authenticate: vi.fn((req, _res, next) => {
      req.user = { id: 7 };
      next();
    }),
    authorize: vi.fn(
      () =>
        (
          _req: express.Request,
          _res: express.Response,
          next: express.NextFunction
        ) =>
          next()
    )
  }));
vi.mock("../maintenance.service.js", () => ({
  getMaintenanceState,
  setMaintenanceState
}));
vi.mock("../../security/middleware/authenticate.middleware.js", () => ({
  authenticate
}));
vi.mock("../../security/middleware/authorize.middleware.js", () => ({
  authorize
}));
import router from "../maintenance.routes.js";
const app = express();
app.use(express.json());
app.use("/api/v1/system", router);
app.use(
  (
    _err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    res.status(500).json({ success: false });
  }
);
const state = {
  maintenance: true,
  message: "Maintenance",
  expectedRestorationAt: null,
  source: "DATABASE"
};
// The router invokes authorize(...) when it is imported, before tests run.
// Do not clear authorize's registration calls in beforeEach.
beforeEach(() => {
  getMaintenanceState.mockReset();
  setMaintenanceState.mockReset();
  authenticate.mockClear();
  getMaintenanceState.mockResolvedValue(state);
  setMaintenanceState.mockResolvedValue(state);
});
describe("maintenance routes", () => {
  it("public availability returns no-store and state without authentication", async () => {
    const response = await request(app).get(
      "/api/v1/system/public-availability"
    );
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body).toMatchObject({ success: true, maintenance: true });
  });
  it("rejects malformed settings without persisting", async () => {
    const response = await request(app)
      .put("/api/v1/system/maintenance")
      .send({ enabled: "yes", message: "", expectedRestorationAt: "tomorrow" });
    expect(response.status).toBe(400);
    expect(setMaintenanceState).not.toHaveBeenCalled();
  });
  it("saves valid settings with authenticated user id", async () => {
    const payload = {
      enabled: true,
      message: "Tamil notice",
      expectedRestorationAt: "2026-11-12T10:00:00+05:30"
    };
    const response = await request(app)
      .put("/api/v1/system/maintenance")
      .send(payload);
    expect(response.status).toBe(200);
    expect(setMaintenanceState).toHaveBeenCalledWith({ ...payload, userId: 7 });
  });
  it("requires SECURITY permissions for admin routes", async () => {
    // Load a fresh router inside this test so permission registration is observed
    // even when Vitest clears mocks after initial module collection.
    vi.resetModules();
    authorize.mockClear();
    await import("../maintenance.routes.js");
    expect(authorize).toHaveBeenCalledWith("SECURITY", "permissions", "read");
    expect(authorize).toHaveBeenCalledWith("SECURITY", "permissions", "update");
  });
  it("reports service errors through centralized error handling", async () => {
    getMaintenanceState.mockRejectedValueOnce(new Error("offline"));
    const response = await request(app).get(
      "/api/v1/system/public-availability"
    );
    expect(response.status).toBe(500);
  });
});
