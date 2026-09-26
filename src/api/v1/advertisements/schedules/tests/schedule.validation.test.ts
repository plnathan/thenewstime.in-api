import { describe, expect, it } from "vitest";

import {
  createScheduleSchema,
  scheduleIdSchema,
  scheduleQuerySchema,
  updateScheduleSchema
} from "../schedule.validation.js";

describe("Advertisement Schedule Validation", () => {
  const startAt = "2026-10-01T10:00:00.000Z";
  const endAt = "2026-10-01T12:00:00.000Z";

  it("should validate a valid schedule", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      placementRuleId: 30,
      startAt,
      endAt,
      priority: 5,
      status: "SCHEDULED",
      notes: "Test schedule"
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.advertisementId).toBe(10);
      expect(result.data.placementId).toBe(20);
      expect(result.data.placementRuleId).toBe(30);
      expect(result.data.priority).toBe(5);
      expect(result.data.status).toBe("SCHEDULED");
      expect(result.data.startAt).toBeInstanceOf(Date);
      expect(result.data.endAt).toBeInstanceOf(Date);
    }
  });

  it("should apply default status", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      startAt,
      endAt
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.status).toBe("SCHEDULED");
      expect(result.data.priority).toBe(0);
    }
  });

  it("should reject non-positive advertisementId", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 0,
      placementId: 20,
      startAt,
      endAt
    });

    expect(result.success).toBe(false);
  });

  it("should reject non-positive placementId", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 0,
      startAt,
      endAt
    });

    expect(result.success).toBe(false);
  });

  it("should reject non-positive placementRuleId", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      placementRuleId: 0,
      startAt,
      endAt
    });

    expect(result.success).toBe(false);
  });

  it("should reject non-positive rescheduledFromId", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      rescheduledFromId: 0,
      startAt,
      endAt
    });

    expect(result.success).toBe(false);
  });

  it("should reject endAt before startAt", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      startAt: endAt,
      endAt: startAt
    });

    expect(result.success).toBe(false);
  });

  it("should reject equal startAt and endAt", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      startAt,
      endAt: startAt
    });

    expect(result.success).toBe(false);
  });

  it("should reject invalid startAt", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      startAt: "invalid-date",
      endAt
    });

    expect(result.success).toBe(false);
  });

  it("should reject invalid endAt", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      startAt,
      endAt: "invalid-date"
    });

    expect(result.success).toBe(false);
  });

  it("should reject negative priority", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      startAt,
      endAt,
      priority: -1
    });

    expect(result.success).toBe(false);
  });

  it("should accept zero priority", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      startAt,
      endAt,
      priority: 0
    });

    expect(result.success).toBe(true);
  });

  it("should reject non-integer priority", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      startAt,
      endAt,
      priority: 1.5
    });

    expect(result.success).toBe(false);
  });

  it("should reject ACTIVE status during creation", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      startAt,
      endAt,
      status: "ACTIVE"
    });

    expect(result.success).toBe(false);
  });

  it("should reject PAUSED status during creation", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      startAt,
      endAt,
      status: "PAUSED"
    });

    expect(result.success).toBe(false);
  });

  it("should reject COMPLETED status during creation", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      startAt,
      endAt,
      status: "COMPLETED"
    });

    expect(result.success).toBe(false);
  });

  it("should reject CANCELLED status during creation", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      startAt,
      endAt,
      status: "CANCELLED"
    });

    expect(result.success).toBe(false);
  });

  it("should accept nullable placementRuleId", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      placementRuleId: null,
      startAt,
      endAt
    });

    expect(result.success).toBe(true);
  });

  it("should accept nullable rescheduledFromId", () => {
    const result = createScheduleSchema.safeParse({
      advertisementId: 10,
      placementId: 20,
      rescheduledFromId: null,
      startAt,
      endAt
    });

    expect(result.success).toBe(true);
  });

  it("should validate schedule id", () => {
    expect(
      scheduleIdSchema.safeParse({
        id: 10
      }).success
    ).toBe(true);

    expect(
      scheduleIdSchema.safeParse({
        id: 0
      }).success
    ).toBe(false);
  });

  it("should reject non-integer schedule id", () => {
    expect(
      scheduleIdSchema.safeParse({
        id: 10.5
      }).success
    ).toBe(false);
  });

  it("should coerce string schedule id", () => {
    const result = scheduleIdSchema.safeParse({
      id: "10"
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.id).toBe(10);
    }
  });

  it("should validate schedule query filters", () => {
    const result = scheduleQuerySchema.safeParse({
      advertisementId: "10",
      placementId: "20",
      placementRuleId: "30",
      status: "ACTIVE"
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.advertisementId).toBe(10);
      expect(result.data.placementId).toBe(20);
      expect(result.data.placementRuleId).toBe(30);
      expect(result.data.status).toBe("ACTIVE");
    }
  });

  it("should validate all lifecycle statuses in query filters", () => {
    const statuses = [
      "SCHEDULED",
      "ACTIVE",
      "PAUSED",
      "COMPLETED",
      "CANCELLED"
    ] as const;

    for (const status of statuses) {
      const result = scheduleQuerySchema.safeParse({
        status
      });

      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid schedule status", () => {
    const result = scheduleQuerySchema.safeParse({
      status: "INVALID"
    });

    expect(result.success).toBe(false);
  });

  it("should validate a partial update", () => {
    const result = updateScheduleSchema.safeParse({
      priority: 10,
      notes: "Updated schedule"
    });

    expect(result.success).toBe(true);
  });

  it("should accept update placementRuleId as null", () => {
    const result = updateScheduleSchema.safeParse({
      placementRuleId: null
    });

    expect(result.success).toBe(true);
  });

  it("should accept update rescheduledFromId as null", () => {
    const result = updateScheduleSchema.safeParse({
      rescheduledFromId: null
    });

    expect(result.success).toBe(true);
  });

  it("should accept nullable update notes", () => {
    const result = updateScheduleSchema.safeParse({
      notes: null
    });

    expect(result.success).toBe(true);
  });

  it("should trim update notes", () => {
    const result = updateScheduleSchema.safeParse({
      notes: "  Updated schedule  "
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.notes).toBe("Updated schedule");
    }
  });

  it("should reject update notes longer than 2000 characters", () => {
    const result = updateScheduleSchema.safeParse({
      notes: "a".repeat(2001)
    });

    expect(result.success).toBe(false);
  });

  it("should reject invalid update date range", () => {
    const result = updateScheduleSchema.safeParse({
      startAt: endAt,
      endAt: startAt
    });

    expect(result.success).toBe(false);
  });

  it("should accept update with only startAt", () => {
    const result = updateScheduleSchema.safeParse({
      startAt
    });

    expect(result.success).toBe(true);
  });

  it("should accept update with only endAt", () => {
    const result = updateScheduleSchema.safeParse({
      endAt
    });

    expect(result.success).toBe(true);
  });

  it("should accept valid update date range", () => {
    const result = updateScheduleSchema.safeParse({
      startAt,
      endAt
    });

    expect(result.success).toBe(true);
  });

  it("should validate lifecycle status on update", () => {
    const statuses = [
      "SCHEDULED",
      "ACTIVE",
      "PAUSED",
      "COMPLETED",
      "CANCELLED"
    ] as const;

    for (const status of statuses) {
      const result = updateScheduleSchema.safeParse({
        status
      });

      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid lifecycle status on update", () => {
    const result = updateScheduleSchema.safeParse({
      status: "INVALID"
    });

    expect(result.success).toBe(false);
  });

  it("should reject negative update priority", () => {
    const result = updateScheduleSchema.safeParse({
      priority: -1
    });

    expect(result.success).toBe(false);
  });

  it("should reject non-integer update priority", () => {
    const result = updateScheduleSchema.safeParse({
      priority: 1.5
    });

    expect(result.success).toBe(false);
  });
});
