import type { QueryResult } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../rate-card.repository.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

type MockQuery = (
  queryText: string,
  values?: unknown[]
) => Promise<QueryResult<Record<string, unknown>>>;

const mockedQuery = pool.query as unknown as {
  mockResolvedValueOnce: (
    value: QueryResult<Record<string, unknown>>
  ) => unknown;

  mockRejectedValueOnce: (error: unknown) => unknown;

  mockClear: () => unknown;

  mock: {
    calls: unknown[][];
  };
};

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

const createRateCardRow = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  id: 100,
  placement_id: 10,
  pricing_unit: "DAY",
  rate_amount: "10000.00",
  currency_code: "INR",
  effective_from: new Date("2026-09-01T00:00:00.000Z"),
  effective_to: new Date("2026-09-30T23:59:59.999Z"),
  status: "ACTIVE",
  created_by: 5,
  updated_by: 5,
  created_at: new Date("2026-08-25T10:00:00.000Z"),
  updated_at: new Date("2026-08-25T10:00:00.000Z"),
  ...overrides
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

const mockRejectedQuery = (error: unknown): void => {
  (
    mockQueryFunction as unknown as {
      mockRejectedValueOnce: (error: unknown) => unknown;
    }
  ).mockRejectedValueOnce(error);
};

const getQueryCalls = (): unknown[][] =>
  (
    mockQueryFunction as unknown as {
      mock: {
        calls: unknown[][];
      };
    }
  ).mock.calls;

describe("Advertisement Rate Card Repository", () => {
  beforeEach(() => {
    mockQueryFunction.mockClear();
  });

  describe("findAll", () => {
    it("should return all rate cards", async () => {
      const rows = [
        createRateCardRow(),
        createRateCardRow({
          id: 101,
          rate_amount: "12000.00",
          effective_from: new Date("2026-10-01T00:00:00.000Z"),
          effective_to: null
        })
      ];

      mockResolvedQuery(rows);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);

      expect(result[0]).toMatchObject({
        id: 100,
        placementId: 10,
        pricingUnit: "DAY",
        rateAmount: 10000,
        currencyCode: "INR",
        status: "ACTIVE",
        createdBy: 5,
        updatedBy: 5
      });

      expect(result[1]).toMatchObject({
        id: 101,
        rateAmount: 12000,
        effectiveTo: null
      });

      expect(getQueryCalls()).toHaveLength(1);
    });

    it("should filter by placement", async () => {
      mockResolvedQuery([createRateCardRow()]);

      await repository.findAll({
        placementId: 10
      });

      expect(getQueryCalls()[0]).toEqual([
        expect.stringContaining("placement_id = $1"),
        [10]
      ]);
    });

    it("should filter by pricing unit", async () => {
      mockResolvedQuery([
        createRateCardRow({
          pricing_unit: "WEEK"
        })
      ]);

      const result = await repository.findAll({
        pricingUnit: "WEEK"
      });

      expect(result[0]?.pricingUnit).toBe("WEEK");

      expect(getQueryCalls()[0]).toEqual([
        expect.stringContaining("pricing_unit = $1"),
        ["WEEK"]
      ]);
    });

    it("should filter by status", async () => {
      mockResolvedQuery([
        createRateCardRow({
          status: "INACTIVE"
        })
      ]);

      const result = await repository.findAll({
        status: "INACTIVE"
      });

      expect(result[0]?.status).toBe("INACTIVE");

      expect(getQueryCalls()[0]).toEqual([
        expect.stringContaining("status = $1"),
        ["INACTIVE"]
      ]);
    });

    it("should combine multiple filters", async () => {
      mockResolvedQuery([createRateCardRow()]);

      await repository.findAll({
        placementId: 10,
        pricingUnit: "DAY",
        status: "ACTIVE"
      });

      const calls = getQueryCalls();

      expect(calls).toHaveLength(1);

      const query = calls[0]?.[0];

      expect(query).toContain("placement_id = $1");

      expect(query).toContain("pricing_unit = $2");

      expect(query).toContain("status = $3");

      expect(calls[0]?.[1]).toEqual([10, "DAY", "ACTIVE"]);
    });

    it("should return an empty array when no rate cards exist", async () => {
      mockResolvedQuery([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("should return a mapped rate card", async () => {
      mockResolvedQuery([createRateCardRow()]);

      const result = await repository.findById(100);

      expect(result).toEqual({
        id: 100,
        placementId: 10,
        pricingUnit: "DAY",
        rateAmount: 10000,
        currencyCode: "INR",
        effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
        effectiveTo: new Date("2026-09-30T23:59:59.999Z"),
        status: "ACTIVE",
        createdBy: 5,
        updatedBy: 5,
        createdAt: new Date("2026-08-25T10:00:00.000Z"),
        updatedAt: new Date("2026-08-25T10:00:00.000Z")
      });

      expect(getQueryCalls()[0]).toEqual([
        expect.stringContaining("WHERE id = $1"),
        [100]
      ]);
    });

    it("should return null when the rate card does not exist", async () => {
      mockResolvedQuery([]);

      const result = await repository.findById(999999);

      expect(result).toBeNull();
    });
  });

  describe("findByPlacementId", () => {
    it("should return rate cards for a placement", async () => {
      mockResolvedQuery([
        createRateCardRow(),
        createRateCardRow({
          id: 101,
          rate_amount: "12000.00"
        })
      ]);

      const result = await repository.findByPlacementId(10);

      expect(result).toHaveLength(2);

      expect(result[0]?.placementId).toBe(10);

      expect(result[1]?.placementId).toBe(10);

      expect(getQueryCalls()[0]).toEqual([
        expect.stringContaining("WHERE placement_id = $1"),
        [10]
      ]);
    });

    it("should return an empty array when placement has no rate cards", async () => {
      mockResolvedQuery([]);

      const result = await repository.findByPlacementId(999999);

      expect(result).toEqual([]);
    });
  });

  describe("findEffectiveRate", () => {
    it("should return the active rate effective at the requested timestamp", async () => {
      mockResolvedQuery([createRateCardRow()]);

      const effectiveAt = new Date("2026-09-15T12:00:00.000Z");

      const result = await repository.findEffectiveRate(10, "DAY", effectiveAt);

      expect(result).not.toBeNull();

      expect(result).toMatchObject({
        id: 100,
        placementId: 10,
        pricingUnit: "DAY",
        rateAmount: 10000,
        status: "ACTIVE"
      });

      expect(getQueryCalls()[0]).toEqual([
        expect.stringContaining("status = 'ACTIVE'"),
        [10, "DAY", effectiveAt]
      ]);
    });

    it("should return null when no effective rate exists", async () => {
      mockResolvedQuery([]);

      const result = await repository.findEffectiveRate(
        10,
        "DAY",
        new Date("2026-08-15T12:00:00.000Z")
      );

      expect(result).toBeNull();
    });

    it("should use the requested pricing unit", async () => {
      mockResolvedQuery([
        createRateCardRow({
          pricing_unit: "WEEK",
          rate_amount: "50000.00"
        })
      ]);

      const result = await repository.findEffectiveRate(
        10,
        "WEEK",
        "2026-09-15T12:00:00.000Z"
      );

      expect(result?.pricingUnit).toBe("WEEK");

      expect(result?.rateAmount).toBe(50000);
    });

    it("should query only ACTIVE rates", async () => {
      mockResolvedQuery([createRateCardRow()]);

      await repository.findEffectiveRate(10, "DAY", "2026-09-15T12:00:00.000Z");

      expect(getQueryCalls()[0]?.[0]).toContain("status = 'ACTIVE'");
    });

    it("should respect the open-ended effectiveTo period", async () => {
      mockResolvedQuery([
        createRateCardRow({
          effective_to: null
        })
      ]);

      const result = await repository.findEffectiveRate(
        10,
        "DAY",
        "2026-10-15T12:00:00.000Z"
      );

      expect(result).not.toBeNull();

      expect(result?.effectiveTo).toBeNull();

      expect(getQueryCalls()[0]?.[0]).toContain("effective_to IS NULL");
    });
  });

  describe("create", () => {
    it("should create a rate card with the supplied values", async () => {
      mockResolvedQuery([createRateCardRow()]);

      const effectiveFrom = new Date("2026-09-01T00:00:00.000Z");

      const effectiveTo = new Date("2026-09-30T23:59:59.999Z");

      const result = await repository.create(
        {
          placementId: 10,
          pricingUnit: "DAY",
          rateAmount: 10000,
          currencyCode: "INR",
          effectiveFrom,
          effectiveTo,
          status: "ACTIVE"
        },
        5
      );

      expect(result).toMatchObject({
        id: 100,
        placementId: 10,
        pricingUnit: "DAY",
        rateAmount: 10000,
        currencyCode: "INR"
      });

      expect(getQueryCalls()[0]).toEqual([
        expect.stringContaining("INSERT INTO advertisement_rate_cards"),
        [10, "DAY", 10000, "INR", effectiveFrom, effectiveTo, "ACTIVE", 5]
      ]);
    });

    it("should default currency to INR", async () => {
      mockResolvedQuery([createRateCardRow()]);

      await repository.create(
        {
          placementId: 10,
          pricingUnit: "DAY",
          rateAmount: 10000,
          effectiveFrom: "2026-09-01T00:00:00.000Z"
        },
        5
      );

      expect(getQueryCalls()[0]?.[1]).toEqual([
        10,
        "DAY",
        10000,
        "INR",
        "2026-09-01T00:00:00.000Z",
        null,
        "ACTIVE",
        5
      ]);
    });

    it("should normalize currency code to uppercase", async () => {
      mockResolvedQuery([
        createRateCardRow({
          currency_code: "USD"
        })
      ]);

      await repository.create(
        {
          placementId: 10,
          pricingUnit: "DAY",
          rateAmount: 100,
          currencyCode: " usd ",
          effectiveFrom: "2026-09-01T00:00:00.000Z"
        },
        5
      );

      expect(getQueryCalls()[0]?.[1]).toEqual([
        10,
        "DAY",
        100,
        "USD",
        "2026-09-01T00:00:00.000Z",
        null,
        "ACTIVE",
        5
      ]);
    });

    it("should use the supplied status", async () => {
      mockResolvedQuery([
        createRateCardRow({
          status: "INACTIVE"
        })
      ]);

      await repository.create(
        {
          placementId: 10,
          pricingUnit: "DAY",
          rateAmount: 10000,
          effectiveFrom: "2026-09-01T00:00:00.000Z",
          status: "INACTIVE"
        },
        5
      );

      expect(getQueryCalls()[0]?.[1]).toEqual([
        10,
        "DAY",
        10000,
        "INR",
        "2026-09-01T00:00:00.000Z",
        null,
        "INACTIVE",
        5
      ]);
    });
  });

  describe("update", () => {
    it("should update the supplied fields", async () => {
      mockResolvedQuery([
        createRateCardRow({
          rate_amount: "12000.00",
          updated_by: 7
        })
      ]);

      const result = await repository.update(
        100,
        {
          rateAmount: 12000,
          status: "ACTIVE"
        },
        7
      );

      expect(result).toMatchObject({
        id: 100,
        rateAmount: 12000,
        updatedBy: 7
      });

      const query = getQueryCalls()[0]?.[0];

      expect(query).toContain("rate_amount = $1");

      expect(query).toContain("status = $2");

      expect(query).toContain("updated_by = $3");

      expect(query).toContain("WHERE id = $4");

      expect(getQueryCalls()[0]?.[1]).toEqual([12000, "ACTIVE", 7, 100]);
    });

    it("should allow clearing effectiveTo", async () => {
      mockResolvedQuery([
        createRateCardRow({
          effective_to: null
        })
      ]);

      const result = await repository.update(
        100,
        {
          effectiveTo: null
        },
        7
      );

      expect(result?.effectiveTo).toBeNull();

      expect(getQueryCalls()[0]?.[1]).toEqual([null, 7, 100]);
    });

    it("should normalize currency code during update", async () => {
      mockResolvedQuery([
        createRateCardRow({
          currency_code: "USD"
        })
      ]);

      await repository.update(
        100,
        {
          currencyCode: " usd "
        },
        7
      );

      expect(getQueryCalls()[0]?.[1]).toEqual(["USD", 7, 100]);
    });

    it("should update placement when placementId is supplied", async () => {
      mockResolvedQuery([
        createRateCardRow({
          placement_id: 20
        })
      ]);

      const result = await repository.update(
        100,
        {
          placementId: 20
        },
        7
      );

      expect(result?.placementId).toBe(20);

      expect(getQueryCalls()[0]?.[1]).toEqual([20, 7, 100]);
    });

    it("should update pricing unit when supplied", async () => {
      mockResolvedQuery([
        createRateCardRow({
          pricing_unit: "WEEK"
        })
      ]);

      const result = await repository.update(
        100,
        {
          pricingUnit: "WEEK"
        },
        7
      );

      expect(result?.pricingUnit).toBe("WEEK");

      expect(getQueryCalls()[0]?.[1]).toEqual(["WEEK", 7, 100]);
    });

    it("should update effectiveFrom when supplied", async () => {
      const effectiveFrom = new Date("2026-10-01T00:00:00.000Z");

      mockResolvedQuery([
        createRateCardRow({
          effective_from: effectiveFrom
        })
      ]);

      const result = await repository.update(
        100,
        {
          effectiveFrom
        },
        7
      );

      expect(result?.effectiveFrom).toEqual(effectiveFrom);

      expect(getQueryCalls()[0]?.[1]).toEqual([effectiveFrom, 7, 100]);
    });

    it("should update status when supplied", async () => {
      mockResolvedQuery([
        createRateCardRow({
          status: "ARCHIVED"
        })
      ]);

      const result = await repository.update(
        100,
        {
          status: "ARCHIVED"
        },
        7
      );

      expect(result?.status).toBe("ARCHIVED");

      expect(getQueryCalls()[0]?.[1]).toEqual(["ARCHIVED", 7, 100]);
    });

    it("should return the existing rate card when there is nothing to update", async () => {
      const row = createRateCardRow();

      mockResolvedQuery([row]);

      const result = await repository.update(100, {}, 7);

      expect(result?.id).toBe(100);

      expect(getQueryCalls()).toHaveLength(1);

      expect(getQueryCalls()[0]).toEqual([
        expect.stringContaining("WHERE id = $1"),
        [100]
      ]);
    });

    it("should return null when updating a missing rate card", async () => {
      mockResolvedQuery([]);

      const result = await repository.update(
        999999,
        {
          rateAmount: 15000
        },
        7
      );

      expect(result).toBeNull();
    });
  });

  describe("database error handling", () => {
    it("should propagate database errors", async () => {
      mockRejectedQuery(new Error("Database connection failed"));

      await expect(repository.findById(100)).rejects.toThrow(
        "Database connection failed"
      );
    });
  });
});
