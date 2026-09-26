import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../tracking.repository.js";
import * as service from "../tracking.service.js";
import type { AdvertisementTrackingRelationship } from "../tracking.types.js";
import type { AdvertisementTrackingInput } from "../tracking.validation.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    connect: vi.fn()
  }
}));

vi.mock("../tracking.repository.js", () => ({
  findTrackingRelationship: vi.fn(),
  lockPlacementRule: vi.fn(),
  countImpressionsForSchedule: vi.fn(),
  createImpression: vi.fn(),
  createClick: vi.fn(),
  advertisementExists: vi.fn(),
  getMetrics: vi.fn()
}));

const mockedPoolConnect = vi.mocked(pool.connect);

const baseInput: AdvertisementTrackingInput = {
  advertisementId: 101,
  placementId: 201,
  placementRuleId: 301,
  scheduleId: 401,
  creativeId: 501,
  pageType: "HOME",
  placementType: "HOME_TOP",
  sessionId: "session-101",
  visitorId: "550e8400-e29b-41d4-a716-446655440000",
  browser: "Chrome",
  operatingSystem: "Windows",
  deviceType: "DESKTOP",
  pageUrl: "https://www.thenewstime.in/",
  referrerUrl: "https://www.google.com/"
};

const activeRelationship: AdvertisementTrackingRelationship = {
  advertisementId: 101,
  placementId: 201,
  placementRuleId: 301,
  scheduleId: 401,
  creativeId: 501,
  pageType: "HOME",
  placementType: "HOME_TOP",
  placementEnabled: true,
  placementStatus: "ACTIVE",
  placementRuleStatus: "ACTIVE",
  insertionType: "FIXED",
  maxImpressions: 100,
  scheduleStatus: "ACTIVE",
  scheduleStartAt: new Date(Date.now() - 60_000),
  scheduleEndAt: new Date(Date.now() + 60_000),
  advertisementStatus: "ACTIVE",
  advertisementWorkflowStatus: "APPROVED",
  creativeStatus: "ACTIVE"
};

function createMockClient() {
  const client = {
    query: vi.fn(),
    release: vi.fn()
  };

  client.query.mockResolvedValue({});

  return client;
}

describe("tracking.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADVERTISEMENT_TRACKING_HASH_SECRET = "test-tracking-secret";
  });

  describe("trackImpression", () => {
    it("tracks an eligible impression", async () => {
      const client = createMockClient();

      mockedPoolConnect.mockResolvedValueOnce(client as never);

      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce(
        activeRelationship
      );

      vi.mocked(repository.countImpressionsForSchedule).mockResolvedValueOnce(
        20
      );

      vi.mocked(repository.createImpression).mockResolvedValueOnce({
        id: 9001,
        eventAt: new Date("2026-09-22T10:00:00Z")
      });

      const result = await service.trackImpression(baseInput, {
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0"
      });

      expect(result.tracked).toBe(true);
      expect(result.eventId).toBe(9001);
      expect(result.eventAt).toEqual(new Date("2026-09-22T10:00:00Z"));

      expect(repository.lockPlacementRule).toHaveBeenCalledWith(301, client);

      expect(repository.countImpressionsForSchedule).toHaveBeenCalledWith(
        401,
        301,
        client
      );

      expect(repository.createImpression).toHaveBeenCalledWith(
        expect.objectContaining({
          advertisementId: 101,
          placementId: 201,
          placementRuleId: 301,
          scheduleId: 401,
          creativeId: 501,
          ipHash: expect.any(String),
          userAgent: "Mozilla/5.0"
        }),
        client
      );

      expect(client.query).toHaveBeenCalledWith("BEGIN");
      expect(client.query).toHaveBeenCalledWith("COMMIT");
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("stops tracking when max impressions is reached", async () => {
      const client = createMockClient();

      mockedPoolConnect.mockResolvedValueOnce(client as never);

      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce(
        activeRelationship
      );

      vi.mocked(repository.countImpressionsForSchedule).mockResolvedValueOnce(
        100
      );

      const result = await service.trackImpression(baseInput, {});

      expect(result).toEqual({
        tracked: false,
        eventId: null,
        eventAt: null,
        reason: "MAX_IMPRESSIONS_REACHED"
      });

      expect(repository.createImpression).not.toHaveBeenCalled();

      expect(client.query).toHaveBeenCalledWith("COMMIT");
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("allows tracking when max impressions is null", async () => {
      const client = createMockClient();

      mockedPoolConnect.mockResolvedValueOnce(client as never);

      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        maxImpressions: null
      });

      vi.mocked(repository.createImpression).mockResolvedValueOnce({
        id: 9002,
        eventAt: new Date("2026-09-22T10:01:00Z")
      });

      const result = await service.trackImpression(baseInput, {});

      expect(result.tracked).toBe(true);
      expect(repository.countImpressionsForSchedule).not.toHaveBeenCalled();
    });

    it("rejects an unknown relationship", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce(
        null
      );

      await expect(service.trackImpression(baseInput, {})).rejects.toThrow(
        "Invalid advertisement tracking relationship."
      );

      expect(mockedPoolConnect).not.toHaveBeenCalled();
    });

    it("rejects a mismatched advertisement relationship", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        advertisementId: 999
      });

      await expect(service.trackImpression(baseInput, {})).rejects.toThrow(
        "Advertisement tracking relationship does not match the requested delivery."
      );
    });

    it("rejects a non-active advertisement", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        advertisementStatus: "PAUSED"
      });

      await expect(service.trackImpression(baseInput, {})).rejects.toThrow(
        "Advertisement is not active for impression tracking."
      );
    });

    it("rejects an unapproved advertisement", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        advertisementWorkflowStatus: "SUBMITTED"
      });

      await expect(service.trackImpression(baseInput, {})).rejects.toThrow(
        "Advertisement is not approved for impression tracking."
      );
    });

    it("rejects an inactive placement", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        placementStatus: "INACTIVE"
      });

      await expect(service.trackImpression(baseInput, {})).rejects.toThrow(
        "Advertisement placement is not active or enabled."
      );
    });

    it("rejects a disabled placement", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        placementEnabled: false
      });

      await expect(service.trackImpression(baseInput, {})).rejects.toThrow(
        "Advertisement placement is not active or enabled."
      );
    });

    it("rejects an inactive placement rule", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        placementRuleStatus: "INACTIVE"
      });

      await expect(service.trackImpression(baseInput, {})).rejects.toThrow(
        "Advertisement placement rule is not active."
      );
    });

    it("rejects an inactive schedule", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        scheduleStatus: "PAUSED"
      });

      await expect(service.trackImpression(baseInput, {})).rejects.toThrow(
        "Advertisement schedule is not active."
      );
    });

    it("rejects a schedule outside its time window", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        scheduleStartAt: new Date(Date.now() + 60_000)
      });

      await expect(service.trackImpression(baseInput, {})).rejects.toThrow(
        "Advertisement schedule is not currently active."
      );
    });

    it("rejects an inactive creative", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        creativeStatus: "INACTIVE"
      });

      await expect(service.trackImpression(baseInput, {})).rejects.toThrow(
        "Advertisement creative is not active."
      );
    });

    it("rolls back when impression insertion fails", async () => {
      const client = createMockClient();

      mockedPoolConnect.mockResolvedValueOnce(client as never);

      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce(
        activeRelationship
      );

      vi.mocked(repository.countImpressionsForSchedule).mockResolvedValueOnce(
        10
      );

      vi.mocked(repository.createImpression).mockRejectedValueOnce(
        new Error("Database error")
      );

      await expect(service.trackImpression(baseInput, {})).rejects.toThrow(
        "Database error"
      );

      expect(client.query).toHaveBeenCalledWith("ROLLBACK");
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });

  describe("trackClick", () => {
    it("tracks a click for an approved advertisement", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        scheduleStatus: "ACTIVE"
      });

      vi.mocked(repository.createClick).mockResolvedValueOnce({
        id: 9101,
        eventAt: new Date("2026-09-22T10:10:00Z")
      });

      const result = await service.trackClick(baseInput, {
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0"
      });

      expect(result).toEqual({
        tracked: true,
        eventId: 9101,
        eventAt: new Date("2026-09-22T10:10:00Z")
      });

      expect(repository.createClick).toHaveBeenCalledWith(
        expect.objectContaining({
          advertisementId: 101,
          ipHash: expect.any(String),
          userAgent: "Mozilla/5.0"
        })
      );
    });

    it("allows click tracking for a paused schedule", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        scheduleStatus: "PAUSED"
      });

      vi.mocked(repository.createClick).mockResolvedValueOnce({
        id: 9102,
        eventAt: new Date("2026-09-22T10:11:00Z")
      });

      const result = await service.trackClick(baseInput, {});

      expect(result.tracked).toBe(true);
    });

    it("allows click tracking for a completed schedule", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        scheduleStatus: "COMPLETED"
      });

      vi.mocked(repository.createClick).mockResolvedValueOnce({
        id: 9103,
        eventAt: new Date("2026-09-22T10:12:00Z")
      });

      const result = await service.trackClick(baseInput, {});

      expect(result.tracked).toBe(true);
    });

    it("rejects a scheduled-only click", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        scheduleStatus: "SCHEDULED"
      });

      await expect(service.trackClick(baseInput, {})).rejects.toThrow(
        "Advertisement schedule is not available for click tracking."
      );

      expect(repository.createClick).not.toHaveBeenCalled();
    });

    it("rejects a cancelled schedule when the relationship is not usable", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        scheduleStatus: "CANCELLED"
      });

      vi.mocked(repository.createClick).mockResolvedValueOnce({
        id: 9104,
        eventAt: new Date("2026-09-22T10:13:00Z")
      });

      const result = await service.trackClick(baseInput, {});

      expect(result.tracked).toBe(true);
    });

    it("rejects an unapproved advertisement", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        advertisementWorkflowStatus: "SUBMITTED"
      });

      await expect(service.trackClick(baseInput, {})).rejects.toThrow(
        "Advertisement is not approved for click tracking."
      );
    });

    it("rejects an inactive creative", async () => {
      vi.mocked(repository.findTrackingRelationship).mockResolvedValueOnce({
        ...activeRelationship,
        creativeStatus: "INACTIVE"
      });

      await expect(service.trackClick(baseInput, {})).rejects.toThrow(
        "Advertisement creative is not active."
      );
    });
  });

  describe("getMetrics", () => {
    it("rejects a missing advertisement", async () => {
      vi.mocked(repository.advertisementExists).mockResolvedValueOnce(false);

      await expect(service.getMetrics(999, {})).rejects.toThrow(
        "Advertisement not found."
      );

      expect(repository.getMetrics).not.toHaveBeenCalled();
    });

    it("returns metrics for an existing advertisement", async () => {
      vi.mocked(repository.advertisementExists).mockResolvedValueOnce(true);

      const metrics = {
        advertisementId: 101,
        period: {
          from: null,
          to: null
        },
        totals: {
          impressions: 100,
          clicks: 10,
          uniqueImpressionVisitors: 80,
          uniqueClickVisitors: 9,
          clickThroughRate: 10
        },
        daily: [],
        placements: [],
        creatives: []
      };

      vi.mocked(repository.getMetrics).mockResolvedValueOnce(metrics);

      const result = await service.getMetrics(101, {});

      expect(result).toEqual(metrics);
      expect(repository.getMetrics).toHaveBeenCalledWith(
        101,
        undefined,
        undefined
      );
    });
  });
});
