import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../../../shared/config/db.js", () => ({ pool: { query } }));
import {
  getMaintenanceState,
  setMaintenanceState
} from "../maintenance.service.js";

const originalOverride = process.env.PUBLIC_MAINTENANCE_MODE;
afterEach(() => {
  if (originalOverride === undefined)
    delete process.env.PUBLIC_MAINTENANCE_MODE;
  else process.env.PUBLIC_MAINTENANCE_MODE = originalOverride;
});
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.PUBLIC_MAINTENANCE_MODE;
});

describe("maintenance configuration service", () => {
  it("reads enabled maintenance and serializes expected restoration", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          enabled: true,
          message_ta: "சேவை பராமரிப்பு",
          expected_restoration_at: new Date("2026-11-12T04:30:00.000Z")
        }
      ]
    });
    await expect(getMaintenanceState()).resolves.toEqual({
      maintenance: true,
      message: "சேவை பராமரிப்பு",
      expectedRestorationAt: "2026-11-12T04:30:00.000Z",
      source: "DATABASE"
    });
  });
  it("reads disabled maintenance", async () => {
    query.mockResolvedValueOnce({
      rows: [
        { enabled: false, message_ta: "Message", expected_restoration_at: null }
      ]
    });
    await expect(getMaintenanceState()).resolves.toMatchObject({
      maintenance: false,
      source: "DATABASE",
      expectedRestorationAt: null
    });
  });
  it("environment override takes precedence and skips database", async () => {
    process.env.PUBLIC_MAINTENANCE_MODE = "true";
    await expect(getMaintenanceState()).resolves.toMatchObject({
      maintenance: true,
      source: "ENVIRONMENT"
    });
    expect(query).not.toHaveBeenCalled();
  });
  it("fails clearly when migration has not been applied", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(getMaintenanceState()).rejects.toThrow(/migration/i);
  });
  it("persists requested settings and returns current state", async () => {
    query
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            enabled: true,
            message_ta: "Tamil notice",
            expected_restoration_at: null
          }
        ]
      });
    const result = await setMaintenanceState({
      enabled: true,
      message: "Tamil notice",
      expectedRestorationAt: null,
      userId: 42
    });
    const firstCall = query.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) throw new Error("Expected maintenance UPDATE query");
    expect(firstCall[0]).toContain("UPDATE public.system_maintenance");
    expect(firstCall[1]).toEqual([true, "Tamil notice", null, 42]);
    expect(result.maintenance).toBe(true);
  });
  it("propagates database errors rather than silently reporting available", async () => {
    query.mockRejectedValueOnce(new Error("DB unavailable"));
    await expect(getMaintenanceState()).rejects.toThrow("DB unavailable");
  });
});
