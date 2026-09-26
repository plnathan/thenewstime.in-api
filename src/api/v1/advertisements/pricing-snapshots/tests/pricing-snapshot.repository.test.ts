import type { QueryResult } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../pricing-snapshot.repository.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

const mockQueryFunction = pool.query as unknown as ReturnType<typeof vi.fn>;

const createMockQueryResult = (
  rows: Record<string, unknown>[]
): QueryResult<Record<string, unknown>> => ({
  rows,
  rowCount: rows.length,
  command: "SELECT",
  oid: 0,
  fields: []
});

const mockResolvedQuery = (rows: Record<string, unknown>[]): void => {
  (
    mockQueryFunction as unknown as {
      mockResolvedValueOnce: (
        value: QueryResult<Record<string, unknown>>
      ) => unknown;
    }
  ).mockResolvedValueOnce(createMockQueryResult(rows));
};

const createSnapshotRow = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  id: 100,
  advertisement_id: 10,
  placement_id: 20,
  rate_card_id: 30,
  pricing_unit: "DAY",
  rate_amount: "5000.00",
  currency_code: "INR",
  rate_effective_from: new Date("2026-09-01T00:00:00.000Z"),
  rate_effective_to: new Date("2026-10-01T00:00:00.000Z"),
  quantity: "1.00",
  standard_amount: "5000.00",
  snapshot_at: new Date("2026-09-25T10:00:00.000Z"),
  created_by: 5,
  created_at: new Date("2026-09-25T10:00:00.000Z"),
  ...overrides
});

describe("Advertisement Pricing Snapshot Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("should return a mapped snapshot when found", async () => {
      mockResolvedQuery([createSnapshotRow()]);

      const result = await repository.findById(100);

      expect(result).toEqual({
        id: 100,
        advertisementId: 10,
        placementId: 20,
        rateCardId: 30,
        pricingUnit: "DAY",
        rateAmount: 5000,
        currencyCode: "INR",
        rateEffectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
        rateEffectiveTo: new Date("2026-10-01T00:00:00.000Z"),
        quantity: 1,
        standardAmount: 5000,
        snapshotAt: new Date("2026-09-25T10:00:00.000Z"),
        createdBy: 5,
        createdAt: new Date("2026-09-25T10:00:00.000Z")
      });

      expect(mockQueryFunction).toHaveBeenCalledTimes(1);
    });

    it("should return null when the snapshot does not exist", async () => {
      mockResolvedQuery([]);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe("findByAdvertisementId", () => {
    it("should return snapshots ordered by snapshot time", async () => {
      mockResolvedQuery([
        createSnapshotRow({
          id: 101,
          snapshot_at: new Date("2026-09-25T12:00:00.000Z")
        }),
        createSnapshotRow({
          id: 100,
          snapshot_at: new Date("2026-09-25T10:00:00.000Z")
        })
      ]);

      const result = await repository.findByAdvertisementId(10);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe(101);
      expect(result[1]?.id).toBe(100);
    });

    it("should return an empty array when no snapshots exist", async () => {
      mockResolvedQuery([]);

      const result = await repository.findByAdvertisementId(10);

      expect(result).toEqual([]);
    });
  });

  describe("findLatestByAdvertisementId", () => {
    it("should return the latest snapshot", async () => {
      mockResolvedQuery([
        createSnapshotRow({
          id: 200,
          snapshot_at: new Date("2026-09-25T15:00:00.000Z")
        })
      ]);

      const result = await repository.findLatestByAdvertisementId(10);

      expect(result?.id).toBe(200);
      expect(result?.advertisementId).toBe(10);
    });

    it("should return null when no snapshot exists", async () => {
      mockResolvedQuery([]);

      const result = await repository.findLatestByAdvertisementId(10);

      expect(result).toBeNull();
    });
  });

  describe("findLatestByAdvertisementAndPlacement", () => {
    it("should query by advertisement and placement", async () => {
      mockResolvedQuery([
        createSnapshotRow({
          id: 300,
          advertisement_id: 10,
          placement_id: 20
        })
      ]);

      const result = await repository.findLatestByAdvertisementAndPlacement(
        10,
        20
      );

      expect(result?.id).toBe(300);

      const calls = (
        mockQueryFunction as unknown as {
          mock: { calls: unknown[][] };
        }
      ).mock.calls;

      expect(calls).toHaveLength(1);
      expect(calls[0]?.[1]).toEqual([10, 20]);
    });
  });

  describe("create", () => {
    it("should create and map a pricing snapshot", async () => {
      mockResolvedQuery([createSnapshotRow()]);

      const input = {
        advertisementId: 10,
        placementId: 20,
        rateCardId: 30,
        pricingUnit: "DAY" as const,
        rateAmount: 5000,
        currencyCode: "inr",
        rateEffectiveFrom: "2026-09-01T00:00:00.000Z",
        rateEffectiveTo: "2026-10-01T00:00:00.000Z",
        quantity: 1,
        standardAmount: 5000
      };

      const result = await repository.create(input, 5);

      expect(result.id).toBe(100);
      expect(result.rateAmount).toBe(5000);
      expect(result.currencyCode).toBe("INR");
      expect(result.quantity).toBe(1);
      expect(result.standardAmount).toBe(5000);

      const calls = (
        mockQueryFunction as unknown as {
          mock: { calls: unknown[][] };
        }
      ).mock.calls;

      expect(calls).toHaveLength(1);

      const values = calls[0]?.[1];

      expect(values).toEqual([
        10,
        20,
        30,
        "DAY",
        5000,
        "INR",
        "2026-09-01T00:00:00.000Z",
        "2026-10-01T00:00:00.000Z",
        1,
        5000,
        null,
        5
      ]);
    });

    it("should default currency to INR", async () => {
      mockResolvedQuery([
        createSnapshotRow({
          pricing_unit: "FIXED",
          rate_amount: "25000.00",
          currency_code: "INR",
          quantity: "1.00",
          standard_amount: "25000.00"
        })
      ]);

      await repository.create(
        {
          advertisementId: 10,
          placementId: 20,
          rateCardId: 30,
          pricingUnit: "FIXED",
          rateAmount: 25000,
          rateEffectiveFrom: "2026-09-01T00:00:00.000Z",
          quantity: 1,
          standardAmount: 25000
        },
        5
      );

      const calls = (
        mockQueryFunction as unknown as {
          mock: { calls: unknown[][] };
        }
      ).mock.calls;

      const values = calls[0]?.[1];

      expect(values).toEqual([
        10,
        20,
        30,
        "FIXED",
        25000,
        "INR",
        "2026-09-01T00:00:00.000Z",
        null,
        1,
        25000,
        null,
        5
      ]);
    });
  });
});
