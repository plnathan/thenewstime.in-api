import { beforeEach, describe, expect, it, vi } from "vitest";

const { client, pool, repository } = vi.hoisted(() => {
  const client = {
    query: vi.fn(),
    release: vi.fn()
  };
  const repository = {
    lockPlacementRule: vi.fn(),
    findExistingImpressionEventIds: vi.fn(),
    findTrackingRelationship: vi.fn(),
    countImpressionsForSchedule: vi.fn(),
    createImpressionsBulk: vi.fn()
  };
  return { client, pool: { connect: vi.fn() }, repository };
});

vi.mock("../../../../../shared/config/db.js", () => ({ pool }));
vi.mock("../tracking.repository.js", () => repository);

import { trackImpressionBatch } from "../tracking.service.js";
import type { AdvertisementTrackingInput } from "../tracking.validation.js";

const event = (
  clientEventId: string,
  rule = 2
): AdvertisementTrackingInput => ({
  clientEventId,
  advertisementId: 10,
  placementId: 20,
  placementRuleId: rule,
  scheduleId: 30,
  creativeId: 40,
  pageType: "NEWS_LIST",
  placementType: "NEWS_LIST_SIDEBAR"
});
const id1 = "00000000-0000-4000-8000-000000000001";
const id2 = "00000000-0000-4000-8000-000000000002";
const relationship = {
  advertisementId: 10,
  placementId: 20,
  placementRuleId: 2,
  scheduleId: 30,
  creativeId: 40,
  pageType: "NEWS_LIST",
  placementType: "NEWS_LIST_SIDEBAR",
  advertisementStatus: "ACTIVE",
  advertisementWorkflowStatus: "APPROVED",
  placementStatus: "ACTIVE",
  placementEnabled: true,
  placementRuleStatus: "ACTIVE",
  scheduleStatus: "ACTIVE",
  scheduleStartAt: new Date("2020-01-01"),
  scheduleEndAt: new Date("2099-01-01"),
  advertisementStartAt: new Date("2020-01-01"),
  advertisementEndAt: new Date("2099-01-01"),
  rotationEnabled: false,
  rotationMemberActive: false,
  creativeStatus: "ACTIVE",
  maxImpressions: 2
};

beforeEach(() => {
  vi.clearAllMocks();
  pool.connect.mockResolvedValue(client);
  client.query.mockResolvedValue({ rows: [] });
  repository.lockPlacementRule.mockResolvedValue({ maxImpressions: 2 });
  repository.findExistingImpressionEventIds.mockResolvedValue(new Set());
  repository.findTrackingRelationship.mockResolvedValue(relationship);
  repository.countImpressionsForSchedule.mockResolvedValue(0);
  repository.createImpressionsBulk.mockImplementation(
    async (items: Array<{ clientEventId?: string }>) =>
      items.map((item, index) => ({
        id: index + 1,
        clientEventId: item.clientEventId ?? null
      }))
  );
});

describe("transaction-safe impression batch", () => {
  it("inserts two eligible events in one bulk call", async () => {
    const result = await trackImpressionBatch([event(id1), event(id2)], {});
    expect(result).toEqual({ accepted: 2, rejected: 0, duplicatesOrCapped: 0 });
    expect(repository.createImpressionsBulk).toHaveBeenCalledTimes(1);
    expect(repository.countImpressionsForSchedule).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith("COMMIT");
  });

  it("does not insert a duplicate client event in the same batch", async () => {
    const result = await trackImpressionBatch([event(id1), event(id1)], {});
    expect(result).toEqual({ accepted: 1, rejected: 0, duplicatesOrCapped: 1 });
    expect(repository.createImpressionsBulk.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it("respects impression caps within a batch", async () => {
    repository.countImpressionsForSchedule.mockResolvedValue(1);
    const result = await trackImpressionBatch([event(id1), event(id2)], {});
    expect(result).toEqual({ accepted: 1, rejected: 0, duplicatesOrCapped: 1 });
  });

  it("skips previously stored event IDs without consuming cap", async () => {
    repository.findExistingImpressionEventIds.mockResolvedValue(new Set([id1]));
    const result = await trackImpressionBatch([event(id1), event(id2)], {});
    expect(result).toEqual({ accepted: 1, rejected: 0, duplicatesOrCapped: 1 });
  });

  it("rolls back and releases connection on bulk write failure", async () => {
    repository.createImpressionsBulk.mockRejectedValue(
      new Error("database failure")
    );
    await expect(trackImpressionBatch([event(id1)], {})).rejects.toThrow(
      "database failure"
    );
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
