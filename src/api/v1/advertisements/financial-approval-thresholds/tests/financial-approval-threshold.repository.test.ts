import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import {
  activate,
  countActiveByApprovalType,
  create,
  deactivate,
  deactivateActiveForApprovalType,
  findActiveByApprovalType,
  findActiveByApprovalTypeForUpdate,
  findAll,
  findById,
  update
} from "../financial-approval-threshold.repository.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

const mockedQuery = vi.mocked(pool.query);

const createRow = (overrides: Record<string, unknown> = {}) => ({
  id: "100",
  approval_type: "DISCOUNT" as const,
  amount_threshold: "5000.00",
  percentage_threshold: null,
  status: "ACTIVE" as const,
  created_by: "5",
  updated_by: "5",
  created_at: new Date("2026-09-24T10:00:00.000Z"),
  updated_at: new Date("2026-09-24T10:00:00.000Z"),
  ...overrides
});

describe("Financial Approval Threshold Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findAll", () => {
    it("should find all thresholds without filters", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [createRow()],
        rowCount: 1
      } as never);

      const result = await findAll();

      expect(result).toEqual([
        {
          id: 100,
          approvalType: "DISCOUNT",
          amountThreshold: 5000,
          percentageThreshold: null,
          status: "ACTIVE",
          createdBy: 5,
          updatedBy: 5,
          createdAt: new Date("2026-09-24T10:00:00.000Z"),
          updatedAt: new Date("2026-09-24T10:00:00.000Z")
        }
      ]);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "FROM advertisement_financial_approval_thresholds"
        ),
        []
      );
    });

    it("should filter by approval type", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [createRow()],
        rowCount: 1
      } as never);

      await findAll({
        approvalType: "DISCOUNT"
      });

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("approval_type = $1"),
        ["DISCOUNT"]
      );
    });

    it("should filter by status", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [createRow({ status: "INACTIVE" })],
        rowCount: 1
      } as never);

      await findAll({
        status: "INACTIVE"
      });

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = $1"),
        ["INACTIVE"]
      );
    });

    it("should filter by approval type and status", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [createRow()],
        rowCount: 1
      } as never);

      await findAll({
        approvalType: "DISCOUNT",
        status: "ACTIVE"
      });

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("approval_type = $1 AND status = $2"),
        ["DISCOUNT", "ACTIVE"]
      );
    });

    it("should return an empty array when no rows exist", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      const result = await findAll();

      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("should return a threshold by id", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [createRow()],
        rowCount: 1
      } as never);

      const result = await findById(100);

      expect(result?.id).toBe(100);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = $1"),
        [100]
      );
    });

    it("should return null when threshold does not exist", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      const result = await findById(999);

      expect(result).toBeNull();
    });
  });

  describe("findActiveByApprovalType", () => {
    it("should return the latest active threshold", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [createRow()],
        rowCount: 1
      } as never);

      const result = await findActiveByApprovalType("DISCOUNT");

      expect(result?.status).toBe("ACTIVE");

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = 'ACTIVE'"),
        ["DISCOUNT"]
      );

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY"),
        ["DISCOUNT"]
      );
    });

    it("should return null when no active threshold exists", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      const result = await findActiveByApprovalType("REFUND");

      expect(result).toBeNull();
    });
  });

  describe("findActiveByApprovalTypeForUpdate", () => {
    it("should lock the active threshold row for update", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [createRow()],
        rowCount: 1
      } as never);

      const result = await findActiveByApprovalTypeForUpdate("DISCOUNT");

      expect(result?.id).toBe(100);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("FOR UPDATE"),
        ["DISCOUNT"]
      );
    });

    it("should return null when no active threshold exists", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      const result = await findActiveByApprovalTypeForUpdate("REFUND");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should create an amount-based threshold", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [createRow()],
        rowCount: 1
      } as never);

      const result = await create(
        {
          approvalType: "DISCOUNT",
          amountThreshold: 5000
        },
        5
      );

      expect(result.id).toBe(100);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining(
          "INSERT INTO advertisement_financial_approval_thresholds"
        ),
        ["DISCOUNT", 5000, null, 5]
      );
    });

    it("should create a percentage-based threshold", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [
          createRow({
            amount_threshold: null,
            percentage_threshold: "10.50"
          })
        ],
        rowCount: 1
      } as never);

      const result = await create(
        {
          approvalType: "DISCOUNT",
          percentageThreshold: 10.5
        },
        5
      );

      expect(result.percentageThreshold).toBe(10.5);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO"),
        ["DISCOUNT", null, 10.5, 5]
      );
    });

    it("should throw when insert returns no row", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      await expect(
        create(
          {
            approvalType: "DISCOUNT",
            amountThreshold: 5000
          },
          5
        )
      ).rejects.toThrow("Failed to create financial approval threshold.");
    });
  });

  describe("update", () => {
    it("should return null when threshold does not exist", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      const result = await update(
        999,
        {
          amountThreshold: 7500
        },
        5
      );

      expect(result).toBeNull();
      expect(mockedQuery).toHaveBeenCalledTimes(1);
    });

    it("should update an existing threshold", async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [createRow()],
          rowCount: 1
        } as never)
        .mockResolvedValueOnce({
          rows: [
            createRow({
              amount_threshold: "7500.00",
              updated_by: "7"
            })
          ],
          rowCount: 1
        } as never);

      const result = await update(
        100,
        {
          amountThreshold: 7500
        },
        7
      );

      expect(result?.amountThreshold).toBe(7500);
      expect(result?.updatedBy).toBe(7);

      expect(mockedQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          "UPDATE advertisement_financial_approval_thresholds"
        ),
        ["DISCOUNT", 7500, null, 7, 100]
      );
    });

    it("should update approval type and percentage threshold", async () => {
      mockedQuery
        .mockResolvedValueOnce({
          rows: [createRow()],
          rowCount: 1
        } as never)
        .mockResolvedValueOnce({
          rows: [
            createRow({
              approval_type: "REFUND",
              amount_threshold: null,
              percentage_threshold: "15.00"
            })
          ],
          rowCount: 1
        } as never);

      const result = await update(
        100,
        {
          approvalType: "REFUND",
          amountThreshold: null,
          percentageThreshold: 15
        },
        7
      );

      expect(result?.approvalType).toBe("REFUND");
      expect(result?.amountThreshold).toBeNull();
      expect(result?.percentageThreshold).toBe(15);
    });
  });

  describe("activate", () => {
    it("should activate a threshold", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [
          createRow({
            status: "ACTIVE",
            updated_by: "7"
          })
        ],
        rowCount: 1
      } as never);

      const result = await activate(100, 7);

      expect(result?.status).toBe("ACTIVE");

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET"),
        [7, 100]
      );
    });

    it("should return null when threshold does not exist", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      const result = await activate(999, 7);

      expect(result).toBeNull();
    });
  });

  describe("deactivate", () => {
    it("should deactivate a threshold", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [
          createRow({
            status: "INACTIVE",
            updated_by: "7"
          })
        ],
        rowCount: 1
      } as never);

      const result = await deactivate(100, 7);

      expect(result?.status).toBe("INACTIVE");

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = 'INACTIVE'"),
        [7, 100]
      );
    });

    it("should return null when threshold does not exist", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      const result = await deactivate(999, 7);

      expect(result).toBeNull();
    });
  });

  describe("deactivateActiveForApprovalType", () => {
    it("should deactivate all active thresholds of an approval type", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1
      } as never);

      await deactivateActiveForApprovalType("DISCOUNT", 7);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE approval_type = $2"),
        [7, "DISCOUNT"]
      );
    });

    it("should exclude a specific threshold when excludeId is provided", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 1
      } as never);

      await deactivateActiveForApprovalType("DISCOUNT", 7, 100);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("AND id <> $3"),
        [7, "DISCOUNT", 100]
      );
    });
  });

  describe("countActiveByApprovalType", () => {
    it("should return the active threshold count", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ count: "3" }],
        rowCount: 1
      } as never);

      const result = await countActiveByApprovalType("DISCOUNT");

      expect(result).toBe(3);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("COUNT(*)::text AS count"),
        ["DISCOUNT"]
      );
    });

    it("should exclude a threshold when excludeId is provided", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [{ count: "1" }],
        rowCount: 1
      } as never);

      const result = await countActiveByApprovalType("DISCOUNT", 100);

      expect(result).toBe(1);

      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining("AND id <> $2"),
        ["DISCOUNT", 100]
      );
    });

    it("should return zero when the count row is missing", async () => {
      mockedQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as never);

      const result = await countActiveByApprovalType("DISCOUNT");

      expect(result).toBe(0);
    });
  });
});
