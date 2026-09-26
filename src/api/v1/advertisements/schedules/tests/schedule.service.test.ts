import { beforeEach, describe, expect, it, vi } from "vitest";

import * as repository from "../schedule.repository.js";
import * as service from "../schedule.service.js";

import type {
  AdvertisementSchedule,
  CreateScheduleInput
} from "../schedule.types.js";

vi.mock("../schedule.repository.js", () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findAdvertisementWorkflowStatus: vi.fn(),
  findPlacement: vi.fn(),
  findPlacementRule: vi.fn(),
  findOverlapping: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  activate: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn()
}));

const createMockSchedule = (
  overrides: Partial<AdvertisementSchedule> = {}
): AdvertisementSchedule => ({
  id: 1,
  advertisementId: 10,
  placementId: 20,
  placementRuleId: null,
  startAt: new Date("2026-10-01T10:00:00.000Z"),
  endAt: new Date("2026-10-01T12:00:00.000Z"),
  status: "SCHEDULED",
  priority: 0,
  rescheduledFromId: null,
  notes: null,
  createdBy: 100,
  updatedBy: 100,
  createdAt: new Date("2026-09-20T10:00:00.000Z"),
  updatedAt: new Date("2026-09-20T10:00:00.000Z"),
  ...overrides
});

const validInput: CreateScheduleInput = {
  advertisementId: 10,
  placementId: 20,
  placementRuleId: null,
  startAt: new Date("2026-10-01T10:00:00.000Z"),
  endAt: new Date("2026-10-01T12:00:00.000Z"),
  status: "SCHEDULED",
  priority: 0,
  notes: null
};

describe("Advertisement Schedule Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(repository.findAdvertisementWorkflowStatus).mockResolvedValue(
      "APPROVED"
    );

    vi.mocked(repository.findPlacement).mockResolvedValue({
      id: 20,
      status: "ACTIVE",
      is_enabled: true
    });

    vi.mocked(repository.findPlacementRule).mockResolvedValue({
      id: 30,
      advertisement_id: 10,
      placement_id: 20,
      status: "ACTIVE"
    });

    vi.mocked(repository.findOverlapping).mockResolvedValue(null);

    vi.mocked(repository.create).mockResolvedValue(createMockSchedule());

    vi.mocked(repository.findById).mockResolvedValue(createMockSchedule());

    vi.mocked(repository.update).mockResolvedValue(
      createMockSchedule({
        priority: 10
      })
    );

    vi.mocked(repository.activate).mockResolvedValue(
      createMockSchedule({
        status: "ACTIVE"
      })
    );

    vi.mocked(repository.pause).mockResolvedValue(
      createMockSchedule({
        status: "PAUSED"
      })
    );

    vi.mocked(repository.resume).mockResolvedValue(
      createMockSchedule({
        status: "ACTIVE"
      })
    );

    vi.mocked(repository.complete).mockResolvedValue(
      createMockSchedule({
        status: "COMPLETED"
      })
    );

    vi.mocked(repository.cancel).mockResolvedValue(
      createMockSchedule({
        status: "CANCELLED"
      })
    );
  });

  it("should retrieve all schedules", async () => {
    const schedules = [createMockSchedule()];

    vi.mocked(repository.findAll).mockResolvedValue(schedules);

    const result = await service.getAll({
      advertisementId: 10
    });

    expect(result).toEqual(schedules);

    expect(repository.findAll).toHaveBeenCalledWith({
      advertisementId: 10
    });
  });

  it("should retrieve a schedule by id", async () => {
    const result = await service.getById(1);

    expect(result.id).toBe(1);

    expect(repository.findById).toHaveBeenCalledWith(1);
  });

  it("should throw 404 for an unknown schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(service.getById(999)).rejects.toMatchObject({
      statusCode: 404
    });
  });

  it("should create a schedule for an approved advertisement", async () => {
    const result = await service.create(validInput, 100);

    expect(result.id).toBe(1);

    expect(repository.create).toHaveBeenCalledWith(validInput, 100);
  });

  it("should reject scheduling a missing advertisement", async () => {
    vi.mocked(repository.findAdvertisementWorkflowStatus).mockResolvedValue(
      null
    );

    await expect(service.create(validInput, 100)).rejects.toMatchObject({
      statusCode: 404
    });
  });

  it("should reject scheduling a non-approved advertisement", async () => {
    vi.mocked(repository.findAdvertisementWorkflowStatus).mockResolvedValue(
      "DRAFT"
    );

    await expect(service.create(validInput, 100)).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it("should reject an inactive placement", async () => {
    vi.mocked(repository.findPlacement).mockResolvedValue({
      id: 20,
      status: "INACTIVE",
      is_enabled: false
    });

    await expect(service.create(validInput, 100)).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it("should reject a missing placement", async () => {
    vi.mocked(repository.findPlacement).mockResolvedValue(null);

    await expect(service.create(validInput, 100)).rejects.toMatchObject({
      statusCode: 404
    });
  });

  it("should reject an inactive placement rule", async () => {
    vi.mocked(repository.findPlacementRule).mockResolvedValue({
      id: 30,
      advertisement_id: 10,
      placement_id: 20,
      status: "INACTIVE"
    });

    await expect(
      service.create(
        {
          ...validInput,
          placementRuleId: 30
        },
        100
      )
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it("should reject an overlapping schedule", async () => {
    vi.mocked(repository.findOverlapping).mockResolvedValue(
      createMockSchedule({
        id: 2
      })
    );

    await expect(service.create(validInput, 100)).rejects.toMatchObject({
      statusCode: 409
    });
  });

  it("should reject an invalid date range", async () => {
    await expect(
      service.create(
        {
          ...validInput,
          endAt: new Date("2026-09-01T10:00:00.000Z")
        },
        100
      )
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it("should update a schedule", async () => {
    const result = await service.update(
      1,
      {
        priority: 10
      },
      100
    );

    expect(result.priority).toBe(10);

    expect(repository.update).toHaveBeenCalledWith(
      1,
      {
        priority: 10
      },
      100
    );
  });

  it("should reject an overlapping schedule update", async () => {
    vi.mocked(repository.findOverlapping).mockResolvedValue(
      createMockSchedule({
        id: 2
      })
    );

    await expect(
      service.update(
        1,
        {
          startAt: new Date("2026-10-01T11:00:00.000Z"),
          endAt: new Date("2026-10-01T13:00:00.000Z")
        },
        100
      )
    ).rejects.toMatchObject({
      statusCode: 409
    });
  });

  it("should activate a scheduled schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "SCHEDULED"
      })
    );

    const result = await service.activate(1, 100);

    expect(result.status).toBe("ACTIVE");

    expect(repository.activate).toHaveBeenCalledWith(1, 100);
    expect(repository.resume).not.toHaveBeenCalled();
  });

  it("should pause an active schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "ACTIVE"
      })
    );

    const result = await service.pause(1, 100);

    expect(result.status).toBe("PAUSED");

    expect(repository.pause).toHaveBeenCalledWith(1, 100);
  });

  it("should resume a paused schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "PAUSED"
      })
    );

    const result = await service.resume(1, 100);

    expect(result.status).toBe("ACTIVE");

    expect(repository.resume).toHaveBeenCalledWith(1, 100);
    expect(repository.activate).not.toHaveBeenCalled();
  });

  it("should complete an active schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "ACTIVE"
      })
    );

    const result = await service.complete(1, 100);

    expect(result.status).toBe("COMPLETED");

    expect(repository.complete).toHaveBeenCalledWith(1, 100);
  });

  it("should cancel a scheduled schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "SCHEDULED"
      })
    );

    const result = await service.cancel(1, 100);

    expect(result.status).toBe("CANCELLED");

    expect(repository.cancel).toHaveBeenCalledWith(1, 100);
  });

  it("should cancel an active schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "ACTIVE"
      })
    );

    const result = await service.cancel(1, 100);

    expect(result.status).toBe("CANCELLED");

    expect(repository.cancel).toHaveBeenCalledWith(1, 100);
  });

  it("should cancel a paused schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "PAUSED"
      })
    );

    const result = await service.cancel(1, 100);

    expect(result.status).toBe("CANCELLED");

    expect(repository.cancel).toHaveBeenCalledWith(1, 100);
  });

  it("should reject cancelling an already cancelled schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "CANCELLED"
      })
    );

    await expect(service.cancel(1, 100)).rejects.toMatchObject({
      statusCode: 409
    });

    expect(repository.cancel).not.toHaveBeenCalled();
  });

  it("should reject activating a completed schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "COMPLETED"
      })
    );

    await expect(service.activate(1, 100)).rejects.toMatchObject({
      statusCode: 409
    });

    expect(repository.activate).not.toHaveBeenCalled();
    expect(repository.resume).not.toHaveBeenCalled();
  });

  it("should reject activating a cancelled schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "CANCELLED"
      })
    );

    await expect(service.activate(1, 100)).rejects.toMatchObject({
      statusCode: 409
    });

    expect(repository.activate).not.toHaveBeenCalled();
    expect(repository.resume).not.toHaveBeenCalled();
  });

  it("should reject pausing a scheduled schedule when transition is not allowed", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "SCHEDULED"
      })
    );

    await expect(service.pause(1, 100)).resolves.toBeDefined();

    expect(repository.pause).toHaveBeenCalledWith(1, 100);
  });

  it("should reject pausing a completed schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "COMPLETED"
      })
    );

    await expect(service.pause(1, 100)).rejects.toMatchObject({
      statusCode: 409
    });

    expect(repository.pause).not.toHaveBeenCalled();
  });

  it("should reject pausing a cancelled schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "CANCELLED"
      })
    );

    await expect(service.pause(1, 100)).rejects.toMatchObject({
      statusCode: 409
    });

    expect(repository.pause).not.toHaveBeenCalled();
  });

  it("should reject completing a scheduled schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "SCHEDULED"
      })
    );

    await expect(service.complete(1, 100)).rejects.toMatchObject({
      statusCode: 409
    });

    expect(repository.complete).not.toHaveBeenCalled();
  });

  it("should reject completing a paused schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "PAUSED"
      })
    );

    await expect(service.complete(1, 100)).rejects.toMatchObject({
      statusCode: 409
    });

    expect(repository.complete).not.toHaveBeenCalled();
  });

  it("should reject completing a completed schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "COMPLETED"
      })
    );

    await expect(service.complete(1, 100)).rejects.toMatchObject({
      statusCode: 409
    });

    expect(repository.complete).not.toHaveBeenCalled();
  });

  it("should reject cancelling a completed schedule", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "COMPLETED"
      })
    );

    await expect(service.cancel(1, 100)).rejects.toMatchObject({
      statusCode: 409
    });

    expect(repository.cancel).not.toHaveBeenCalled();
  });

  it("should reject activating when the advertisement is no longer approved", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "SCHEDULED"
      })
    );

    vi.mocked(repository.findAdvertisementWorkflowStatus).mockResolvedValue(
      "DRAFT"
    );

    await expect(service.activate(1, 100)).rejects.toMatchObject({
      statusCode: 400
    });

    expect(repository.activate).not.toHaveBeenCalled();
  });

  it("should reject activating when the advertisement is missing", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "SCHEDULED"
      })
    );

    vi.mocked(repository.findAdvertisementWorkflowStatus).mockResolvedValue(
      null
    );

    await expect(service.activate(1, 100)).rejects.toMatchObject({
      statusCode: 404
    });

    expect(repository.activate).not.toHaveBeenCalled();
  });

  it("should reject activating when the placement is inactive", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "SCHEDULED"
      })
    );

    vi.mocked(repository.findPlacement).mockResolvedValue({
      id: 20,
      status: "INACTIVE",
      is_enabled: false
    });

    await expect(service.activate(1, 100)).rejects.toMatchObject({
      statusCode: 400
    });

    expect(repository.activate).not.toHaveBeenCalled();
  });

  it("should reject activating when the placement is missing", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "SCHEDULED"
      })
    );

    vi.mocked(repository.findPlacement).mockResolvedValue(null);

    await expect(service.activate(1, 100)).rejects.toMatchObject({
      statusCode: 404
    });

    expect(repository.activate).not.toHaveBeenCalled();
  });

  it("should reject activating when the placement rule is inactive", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "SCHEDULED",
        placementRuleId: 30
      })
    );

    vi.mocked(repository.findPlacementRule).mockResolvedValue({
      id: 30,
      advertisement_id: 10,
      placement_id: 20,
      status: "INACTIVE"
    });

    await expect(service.activate(1, 100)).rejects.toMatchObject({
      statusCode: 400
    });

    expect(repository.activate).not.toHaveBeenCalled();
  });

  it("should reject activating when another schedule overlaps", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "SCHEDULED"
      })
    );

    vi.mocked(repository.findOverlapping).mockResolvedValue(
      createMockSchedule({
        id: 2,
        status: "ACTIVE"
      })
    );

    await expect(service.activate(1, 100)).rejects.toMatchObject({
      statusCode: 409
    });

    expect(repository.findOverlapping).toHaveBeenCalledWith(
      10,
      20,
      new Date("2026-10-01T10:00:00.000Z"),
      new Date("2026-10-01T12:00:00.000Z"),
      1
    );

    expect(repository.activate).not.toHaveBeenCalled();
  });

  it("should allow activation when no other schedule overlaps", async () => {
    vi.mocked(repository.findById).mockResolvedValue(
      createMockSchedule({
        status: "SCHEDULED"
      })
    );

    vi.mocked(repository.findOverlapping).mockResolvedValue(null);

    const result = await service.activate(1, 100);

    expect(result.status).toBe("ACTIVE");

    expect(repository.findOverlapping).toHaveBeenCalledWith(
      10,
      20,
      new Date("2026-10-01T10:00:00.000Z"),
      new Date("2026-10-01T12:00:00.000Z"),
      1
    );

    expect(repository.activate).toHaveBeenCalledWith(1, 100);
  });

  it("should not create a schedule with ACTIVE status", async () => {
    await expect(
      service.create(
        {
          ...validInput,
          status: "ACTIVE"
        },
        100
      )
    ).rejects.toMatchObject({
      statusCode: 400
    });
  });

  it("should reject a missing reschedule source", async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(
      service.create(
        {
          ...validInput,
          rescheduledFromId: 999
        },
        100
      )
    ).rejects.toMatchObject({
      statusCode: 404
    });
  });
});
