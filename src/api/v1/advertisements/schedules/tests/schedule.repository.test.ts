import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPoolQuery = vi.hoisted(() => vi.fn());

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: mockPoolQuery
  }
}));

import {
  activate,
  cancel,
  complete,
  create,
  findAdvertisementWorkflowStatus,
  findAll,
  findById,
  findOverlapping,
  findPlacement,
  findPlacementRule,
  pause,
  resume,
  update
} from "../schedule.repository.js";

const scheduleRow = {
  id: "1",
  advertisement_id: "10",
  placement_id: "20",
  placement_rule_id: "30",
  start_at: new Date("2026-10-01T10:00:00.000Z"),
  end_at: new Date("2026-10-01T12:00:00.000Z"),
  status: "SCHEDULED",
  priority: 5,
  rescheduled_from_id: null,
  notes: "Test schedule",
  created_by: "100",
  updated_by: "100",
  created_at: new Date("2026-09-20T10:00:00.000Z"),
  updated_at: new Date("2026-09-20T10:00:00.000Z")
};

describe("Advertisement Schedule Repository", () => {
  beforeEach(() => {
    mockPoolQuery.mockReset();
  });

  it("should find all schedules", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [scheduleRow],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await findAll({
      advertisementId: 10
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
    expect(result[0]?.advertisementId).toBe(10);
    expect(result[0]?.placementId).toBe(20);
    expect(result[0]?.priority).toBe(5);
    expect(result[0]?.status).toBe("SCHEDULED");

    expect(mockPoolQuery).toHaveBeenCalledOnce();
  });

  it("should find a schedule by id", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [scheduleRow],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await findById(1);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(1);
  });

  it("should return null for an unknown schedule", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [],
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      fields: []
    });

    const result = await findById(999);

    expect(result).toBeNull();
  });

  it("should find advertisement workflow status", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          workflow_status: "APPROVED"
        }
      ],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await findAdvertisementWorkflowStatus(10);

    expect(result).toBe("APPROVED");
  });

  it("should find an active placement", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "20",
          status: "ACTIVE",
          is_enabled: true
        }
      ],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await findPlacement(20);

    expect(result).toEqual({
      id: 20,
      status: "ACTIVE",
      is_enabled: true
    });
  });

  it("should find a placement rule", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "30",
          advertisement_id: "10",
          placement_id: "20",
          status: "ACTIVE"
        }
      ],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await findPlacementRule(30);

    expect(result).toEqual({
      id: 30,
      advertisement_id: 10,
      placement_id: 20,
      status: "ACTIVE"
    });
  });

  it("should find an overlapping schedule", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [scheduleRow],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await findOverlapping(
      10,
      20,
      new Date("2026-10-01T11:00:00.000Z"),
      new Date("2026-10-01T13:00:00.000Z")
    );

    expect(result?.id).toBe(1);
  });

  it("should create a schedule", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [scheduleRow],
      command: "INSERT",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await create(
      {
        advertisementId: 10,
        placementId: 20,
        placementRuleId: 30,
        startAt: new Date("2026-10-01T10:00:00.000Z"),
        endAt: new Date("2026-10-01T12:00:00.000Z"),
        status: "SCHEDULED",
        priority: 5,
        notes: "Test schedule"
      },
      100
    );

    expect(result.id).toBe(1);
    expect(mockPoolQuery).toHaveBeenCalledOnce();
  });

  it("should update a schedule", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          ...scheduleRow,
          priority: 10
        }
      ],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await update(
      1,
      {
        priority: 10
      },
      100
    );

    expect(result?.priority).toBe(10);
  });

  it("should return the existing schedule when update has no fields", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [scheduleRow],
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await update(1, {}, 100);

    expect(result?.id).toBe(1);
  });

  it("should activate a schedule", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          ...scheduleRow,
          status: "ACTIVE"
        }
      ],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await activate(1, 100);

    expect(result?.status).toBe("ACTIVE");

    expect(mockPoolQuery).toHaveBeenCalledOnce();

    const call = mockPoolQuery.mock.calls[0];
    expect(call).toBeDefined();
    const [, values] = call!;

    expect(values).toEqual(["ACTIVE", 100, 1]);
  });

  it("should pause a schedule", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          ...scheduleRow,
          status: "PAUSED"
        }
      ],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await pause(1, 100);

    expect(result?.status).toBe("PAUSED");

    expect(mockPoolQuery).toHaveBeenCalledOnce();

    const call = mockPoolQuery.mock.calls[0];
    expect(call).toBeDefined();
    const [, values] = call!;

    expect(values).toEqual(["PAUSED", 100, 1]);
  });

  it("should resume a schedule", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          ...scheduleRow,
          status: "ACTIVE"
        }
      ],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await resume(1, 100);

    expect(result?.status).toBe("ACTIVE");

    expect(mockPoolQuery).toHaveBeenCalledOnce();

    const call = mockPoolQuery.mock.calls[0];
    expect(call).toBeDefined();
    const [, values] = call!;

    expect(values).toEqual(["ACTIVE", 100, 1]);
  });

  it("should complete a schedule", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          ...scheduleRow,
          status: "COMPLETED"
        }
      ],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await complete(1, 100);

    expect(result?.status).toBe("COMPLETED");

    expect(mockPoolQuery).toHaveBeenCalledOnce();

    const call = mockPoolQuery.mock.calls[0];
    expect(call).toBeDefined();
    const [, values] = call!;

    expect(values).toEqual(["COMPLETED", 100, 1]);
  });

  it("should cancel a schedule", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          ...scheduleRow,
          status: "CANCELLED"
        }
      ],
      command: "UPDATE",
      rowCount: 1,
      oid: 0,
      fields: []
    });

    const result = await cancel(1, 100);

    expect(result?.status).toBe("CANCELLED");

    expect(mockPoolQuery).toHaveBeenCalledOnce();

    const call = mockPoolQuery.mock.calls[0];
    expect(call).toBeDefined();
    const [, values] = call!;

    expect(values).toEqual(["CANCELLED", 100, 1]);
  });
});
