import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../tracking.repository.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn()
  }
}));

const mockedPoolQuery = pool.query as unknown as ReturnType<typeof vi.fn>;

const createMockClient = (): PoolClient => {
  return {
    query: vi.fn(),
    release: vi.fn()
  } as unknown as PoolClient;
};

const mockedClientQuery = (client: PoolClient): ReturnType<typeof vi.fn> =>
  client.query as unknown as ReturnType<typeof vi.fn>;

const queryResult = <T>(rows: T[], rowCount = rows.length) => ({
  rows,
  rowCount
});

describe("tracking.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findTrackingRelationship", () => {
    it("returns the tracking relationship when the complete relationship exists", async () => {
      mockedPoolQuery.mockResolvedValueOnce(
        queryResult([
          {
            advertisement_id: "101",
            placement_id: "201",
            placement_rule_id: "301",
            schedule_id: "401",
            creative_id: "501",
            page_type: "HOME",
            placement_type: "HOME_TOP",
            placement_enabled: true,
            placement_status: "ACTIVE",
            placement_rule_status: "ACTIVE",
            insertion_type: "FIXED",
            max_impressions: "100",
            schedule_status: "ACTIVE",
            schedule_start_at: new Date("2026-09-22T00:00:00.000Z"),
            schedule_end_at: new Date("2026-09-23T00:00:00.000Z"),
            advertisement_status: "ACTIVE",
            advertisement_workflow_status: "APPROVED",
            creative_status: "ACTIVE"
          }
        ])
      );

      const result = await repository.findTrackingRelationship(
        101,
        201,
        301,
        401,
        501
      );

      expect(result).toEqual({
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
        scheduleStartAt: new Date("2026-09-22T00:00:00.000Z"),
        scheduleEndAt: new Date("2026-09-23T00:00:00.000Z"),
        advertisementStatus: "ACTIVE",
        advertisementWorkflowStatus: "APPROVED",
        creativeStatus: "ACTIVE"
      });
    });

    it("returns null when the placement does not exist", async () => {
      mockedPoolQuery.mockResolvedValueOnce(queryResult([]));

      const result = await repository.findTrackingRelationship(
        101,
        201,
        301,
        401,
        501
      );

      expect(result).toBeNull();
    });
  });

  describe("lockPlacementRule", () => {
    it("locks the placement rule and returns its impression limit", async () => {
      const client = createMockClient();
      const query = mockedClientQuery(client);

      query.mockResolvedValueOnce(
        queryResult([
          {
            max_impressions: "100"
          }
        ])
      );

      const result = await repository.lockPlacementRule(301, client);

      expect(result).toEqual({
        maxImpressions: 100
      });

      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("FOR UPDATE"),
        [301]
      );
    });

    it("returns null when the placement rule does not exist", async () => {
      const client = createMockClient();
      const query = mockedClientQuery(client);

      query.mockResolvedValueOnce(queryResult([]));

      const result = await repository.lockPlacementRule(301, client);

      expect(result).toBeNull();
    });
  });

  describe("countImpressionsForSchedule", () => {
    it("returns the number of impressions for a schedule and placement rule", async () => {
      const client = createMockClient();
      const query = mockedClientQuery(client);

      query.mockResolvedValueOnce(
        queryResult([
          {
            impression_count: "17"
          }
        ])
      );

      const result = await repository.countImpressionsForSchedule(
        401,
        301,
        client
      );

      expect(result).toBe(17);

      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("COUNT(*)"),
        [401, 301]
      );
    });

    it("returns zero when there are no impressions", async () => {
      const client = createMockClient();
      const query = mockedClientQuery(client);

      query.mockResolvedValueOnce(queryResult([]));

      const result = await repository.countImpressionsForSchedule(
        401,
        301,
        client
      );

      expect(result).toBe(0);
    });
  });

  describe("createImpression", () => {
    it("creates an impression event", async () => {
      const client = createMockClient();
      const query = mockedClientQuery(client);

      query.mockResolvedValueOnce(
        queryResult([
          {
            id: "701",
            impression_at: new Date("2026-09-22T10:00:00.000Z")
          }
        ])
      );

      const result = await repository.createImpression(
        {
          advertisementId: 101,
          placementId: 201,
          placementRuleId: 301,
          scheduleId: 401,
          creativeId: 501,
          pageType: "HOME",
          placementType: "HOME_TOP",
          sessionId: "session-1",
          visitorId: "550e8400-e29b-41d4-a716-446655440000",
          browser: "Chrome",
          operatingSystem: "Windows",
          deviceType: "DESKTOP",
          pageUrl: "https://www.thenewstime.in/",
          referrerUrl: "https://www.google.com/",
          ipHash: "hashed-ip",
          userAgent: "Mozilla/5.0"
        },
        client
      );

      expect(result).toEqual({
        id: 701,
        eventAt: new Date("2026-09-22T10:00:00.000Z")
      });
    });
  });

  describe("createClick", () => {
    it("creates a click event", async () => {
      mockedPoolQuery.mockResolvedValueOnce(
        queryResult([
          {
            id: "801",
            click_at: new Date("2026-09-22T10:01:00.000Z")
          }
        ])
      );

      const result = await repository.createClick({
        advertisementId: 101,
        placementId: 201,
        placementRuleId: 301,
        scheduleId: 401,
        creativeId: 501,
        pageType: "HOME",
        placementType: "HOME_TOP",
        sessionId: "session-1",
        visitorId: "550e8400-e29b-41d4-a716-446655440000",
        browser: "Chrome",
        operatingSystem: "Windows",
        deviceType: "DESKTOP",
        pageUrl: "https://www.thenewstime.in/",
        referrerUrl: "https://www.google.com/",
        ipHash: "hashed-ip",
        userAgent: "Mozilla/5.0"
      });

      expect(result).toEqual({
        id: 801,
        eventAt: new Date("2026-09-22T10:01:00.000Z")
      });
    });
  });

  describe("advertisementExists", () => {
    it("returns true when advertisement exists", async () => {
      mockedPoolQuery.mockResolvedValueOnce(queryResult([{ id: "101" }]));

      await expect(repository.advertisementExists(101)).resolves.toBe(true);
    });

    it("returns false when advertisement does not exist", async () => {
      mockedPoolQuery.mockResolvedValueOnce(queryResult([]));

      await expect(repository.advertisementExists(101)).resolves.toBe(false);
    });
  });

  describe("getMetrics", () => {
    it("returns advertisement metrics without a date filter", async () => {
      mockedPoolQuery
        .mockResolvedValueOnce(
          queryResult([
            {
              impressions: "100",
              clicks: "5",
              unique_impression_visitors: "80",
              unique_click_visitors: "5"
            }
          ])
        )
        .mockResolvedValueOnce(
          queryResult([
            {
              date: "2026-09-22",
              impressions: "100",
              clicks: "5"
            }
          ])
        )
        .mockResolvedValueOnce(
          queryResult([
            {
              placement_id: "201",
              impressions: "100",
              clicks: "5"
            }
          ])
        )
        .mockResolvedValueOnce(
          queryResult([
            {
              creative_id: "501",
              impressions: "100",
              clicks: "5"
            }
          ])
        );

      const result = await repository.getMetrics(101, undefined, undefined);

      expect(result.totals).toEqual({
        impressions: 100,
        clicks: 5,
        uniqueImpressionVisitors: 80,
        uniqueClickVisitors: 5,
        clickThroughRate: 5
      });

      expect(result.daily).toEqual([
        {
          date: "2026-09-22",
          impressions: 100,
          clicks: 5,
          clickThroughRate: 5
        }
      ]);

      expect(result.placements).toEqual([
        {
          placementId: 201,
          impressions: 100,
          clicks: 5,
          clickThroughRate: 5
        }
      ]);

      expect(result.creatives).toEqual([
        {
          creativeId: 501,
          impressions: 100,
          clicks: 5,
          clickThroughRate: 5
        }
      ]);
    });

    it("applies a from date filter", async () => {
      const from = new Date("2026-09-01T00:00:00.000Z");

      mockedPoolQuery
        .mockResolvedValueOnce(
          queryResult([
            {
              impressions: "20",
              clicks: "2",
              unique_impression_visitors: "15",
              unique_click_visitors: "2"
            }
          ])
        )
        .mockResolvedValueOnce(queryResult([]))
        .mockResolvedValueOnce(queryResult([]))
        .mockResolvedValueOnce(queryResult([]));

      const result = await repository.getMetrics(101, from, undefined);

      expect(result.totals.impressions).toBe(20);
      expect(result.totals.clicks).toBe(2);

      expect(mockedPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("impression_at >= $2"),
        [101, from]
      );
    });

    it("applies from and to date filters", async () => {
      const from = new Date("2026-09-01T00:00:00.000Z");
      const to = new Date("2026-09-22T23:59:59.999Z");

      mockedPoolQuery
        .mockResolvedValueOnce(
          queryResult([
            {
              impressions: "30",
              clicks: "3",
              unique_impression_visitors: "25",
              unique_click_visitors: "3"
            }
          ])
        )
        .mockResolvedValueOnce(queryResult([]))
        .mockResolvedValueOnce(queryResult([]))
        .mockResolvedValueOnce(queryResult([]));

      const result = await repository.getMetrics(101, from, to);

      expect(result.totals.impressions).toBe(30);
      expect(result.totals.clicks).toBe(3);

      expect(mockedPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("impression_at >= $2"),
        [101, from, to]
      );
    });

    it("returns zero metrics when no events exist", async () => {
      mockedPoolQuery
        .mockResolvedValueOnce(
          queryResult([
            {
              impressions: "0",
              clicks: "0",
              unique_impression_visitors: "0",
              unique_click_visitors: "0"
            }
          ])
        )
        .mockResolvedValueOnce(queryResult([]))
        .mockResolvedValueOnce(queryResult([]))
        .mockResolvedValueOnce(queryResult([]));

      const result = await repository.getMetrics(101, undefined, undefined);

      expect(result.totals).toEqual({
        impressions: 0,
        clicks: 0,
        uniqueImpressionVisitors: 0,
        uniqueClickVisitors: 0,
        clickThroughRate: 0
      });

      expect(result.daily).toEqual([]);
      expect(result.placements).toEqual([]);
      expect(result.creatives).toEqual([]);
    });
  });
});
