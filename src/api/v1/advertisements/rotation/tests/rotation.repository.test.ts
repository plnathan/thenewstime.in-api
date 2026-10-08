import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import {
  createMember,
  findActiveMembersByPlacement,
  findMemberByAdvertisement,
  findMemberById,
  findMembersByPlacement,
  findPlacement,
  findRotationConfig,
  hasActivePlacementRule,
  updateMember,
  updateRotationConfig
} from "../rotation.repository.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

const mockedPoolQuery = vi.mocked(pool.query);

const createConfigRow = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  placement_id: "10",
  rotation_enabled: true,
  rotation_mode: "TIME_BASED",
  rotation_interval_seconds: 10,
  rotation_strategy: "ROUND_ROBIN",
  ...overrides
});

const createMemberRow = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  id: "20",
  placement_id: "10",
  advertisement_id: "30",
  advertisement_name: "Test Advertisement",
  advertisement_status: "ACTIVE",
  advertisement_workflow_status: "APPROVED",
  priority: 100,
  status: "ACTIVE",
  created_at: new Date("2026-09-28T10:00:00.000Z"),
  updated_at: new Date("2026-09-28T10:00:00.000Z"),
  ...overrides
});

describe("rotation.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return rotation configuration", async () => {
    mockedPoolQuery.mockResolvedValueOnce({
      rows: [createConfigRow()]
    } as never);

    const result = await findRotationConfig(10);

    expect(result).toEqual({
      placementId: 10,
      rotationEnabled: true,
      rotationMode: "TIME_BASED",
      rotationIntervalSeconds: 10,
      rotationStrategy: "ROUND_ROBIN"
    });

    expect(mockedPoolQuery).toHaveBeenCalledTimes(1);
  });

  it("should return null when placement configuration does not exist", async () => {
    mockedPoolQuery.mockResolvedValueOnce({
      rows: []
    } as never);

    const result = await findRotationConfig(999);

    expect(result).toBeNull();
  });

  it("should verify placement existence", async () => {
    mockedPoolQuery.mockResolvedValueOnce({
      rows: [{ id: "10" }]
    } as never);

    await expect(findPlacement(10)).resolves.toBe(true);
  });

  it("should return false for missing placement", async () => {
    mockedPoolQuery.mockResolvedValueOnce({
      rows: []
    } as never);

    await expect(findPlacement(999)).resolves.toBe(false);
  });

  it("should update rotation configuration", async () => {
    mockedPoolQuery.mockResolvedValueOnce({
      rows: [createConfigRow()]
    } as never);

    const result = await updateRotationConfig(
      10,
      {
        rotationEnabled: true,
        rotationIntervalSeconds: 15
      },
      100
    );

    expect(result).toEqual({
      placementId: 10,
      rotationEnabled: true,
      rotationMode: "TIME_BASED",
      rotationIntervalSeconds: 10,
      rotationStrategy: "ROUND_ROBIN"
    });

    expect(mockedPoolQuery).toHaveBeenCalledTimes(1);

    const [query, values] = mockedPoolQuery.mock.calls[0] ?? [];

    expect(query).toContain("UPDATE advertisement_placements");

    expect(values).toEqual([10, true, null, 15, null, 100]);
  });

  it("should return members ordered by priority", async () => {
    mockedPoolQuery.mockResolvedValueOnce({
      rows: [
        createMemberRow({
          id: "21",
          advertisement_id: "31",
          priority: 100
        }),
        createMemberRow({
          id: "22",
          advertisement_id: "32",
          priority: 50
        })
      ]
    } as never);

    const result = await findMembersByPlacement(10);

    expect(result).toHaveLength(2);
    expect(result[0]?.priority).toBe(100);
    expect(result[1]?.priority).toBe(50);

    const [query] = mockedPoolQuery.mock.calls[0] ?? [];

    expect(query).toContain("advertisement_rotation_members");

    expect(query).toContain("ORDER BY");

    expect(query).toContain("rm.priority DESC");
  });

  it("should return active members only", async () => {
    mockedPoolQuery.mockResolvedValueOnce({
      rows: [createMemberRow()]
    } as never);

    const result = await findActiveMembersByPlacement(10);

    expect(result).toHaveLength(1);

    const [query] = mockedPoolQuery.mock.calls[0] ?? [];

    expect(query).toContain("rm.status = 'ACTIVE'");
  });

  it("should find a member by placement and member id", async () => {
    mockedPoolQuery.mockResolvedValueOnce({
      rows: [createMemberRow()]
    } as never);

    const result = await findMemberById(10, 20);

    expect(result?.id).toBe(20);
    expect(result?.placementId).toBe(10);
    expect(result?.advertisementId).toBe(30);
  });

  it("should return null when member does not exist", async () => {
    mockedPoolQuery.mockResolvedValueOnce({
      rows: []
    } as never);

    await expect(findMemberById(10, 999)).resolves.toBeNull();
  });

  it("should find a member by advertisement", async () => {
    mockedPoolQuery.mockResolvedValueOnce({
      rows: [createMemberRow()]
    } as never);

    const result = await findMemberByAdvertisement(10, 30);

    expect(result?.advertisementId).toBe(30);
  });

  it("should verify an active placement rule", async () => {
    mockedPoolQuery.mockResolvedValueOnce({
      rows: [{ id: "40" }]
    } as never);

    await expect(hasActivePlacementRule(30, 10)).resolves.toBe(true);

    const [query, values] = mockedPoolQuery.mock.calls[0] ?? [];

    expect(query).toContain("advertisement_placement_rules");

    expect(values).toEqual([30, 10]);
  });

  it("should create a rotation member", async () => {
    mockedPoolQuery
      .mockResolvedValueOnce({
        rows: [{ id: "20" }]
      } as never)
      .mockResolvedValueOnce({
        rows: [createMemberRow()]
      } as never);

    const result = await createMember(10, {
      advertisementId: 30,
      priority: 100,
      status: "ACTIVE"
    });

    expect(result.id).toBe(20);
    expect(result.priority).toBe(100);

    expect(mockedPoolQuery).toHaveBeenCalledTimes(2);
  });

  it("should update a rotation member", async () => {
    mockedPoolQuery
      .mockResolvedValueOnce({
        rows: [{ id: "20" }]
      } as never)
      .mockResolvedValueOnce({
        rows: [
          createMemberRow({
            priority: 200
          })
        ]
      } as never);

    const result = await updateMember(10, 20, {
      priority: 200
    });

    expect(result?.priority).toBe(200);
    expect(mockedPoolQuery).toHaveBeenCalledTimes(2);
  });
});
