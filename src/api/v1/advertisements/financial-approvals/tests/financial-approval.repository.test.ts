import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../financial-approval.repository.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

const mockedQuery = pool.query as unknown as ReturnType<typeof vi.fn>;

function createApprovalRow(
  overrides: Partial<{
    id: number;
    advertisement_id: number;
    client_id: number;
    payment_id: number | null;
    approval_type: "DISCOUNT" | "ADJUSTMENT" | "REFUND" | "PARTIAL_REFUND";
    requested_amount: string | null;
    requested_percentage: string | null;
    status: "SUBMITTED" | "HOLD" | "APPROVED" | "REJECTED";
    requested_by: number;
    requested_at: Date;
    reviewed_by: number | null;
    reviewed_at: Date | null;
    hold_reason: string | null;
    rejection_reason: string | null;
    approval_remarks: string | null;
    created_at: Date;
    updated_at: Date;
  }> = {}
) {
  const now = new Date();

  return {
    id: 101,
    advertisement_id: 501,
    client_id: 301,
    payment_id: 701,
    approval_type: "DISCOUNT" as const,
    requested_amount: "5000.00",
    requested_percentage: "10.0000",
    status: "SUBMITTED" as const,
    requested_by: 11,
    requested_at: now,
    reviewed_by: null,
    reviewed_at: null,
    hold_reason: null,
    rejection_reason: null,
    approval_remarks: "Discount requested.",
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

function createHistoryRow(
  overrides: Partial<{
    id: number;
    approval_id: number;
    from_status: "SUBMITTED" | "HOLD" | "APPROVED" | "REJECTED" | null;
    to_status: "SUBMITTED" | "HOLD" | "APPROVED" | "REJECTED";
    action_by: number;
    action_at: Date;
    remarks: string | null;
    hold_reason: string | null;
    rejection_reason: string | null;
  }> = {}
) {
  return {
    id: 201,
    approval_id: 101,
    from_status: null,
    to_status: "SUBMITTED" as const,
    action_by: 11,
    action_at: new Date(),
    remarks: "Approval submitted.",
    hold_reason: null,
    rejection_reason: null,
    ...overrides
  };
}

function queryResult<T>(rows: T[]) {
  return {
    rows,
    rowCount: rows.length,
    command: "SELECT",
    oid: 0,
    fields: []
  };
}

describe("Advertisement Financial Approval Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("should return the financial approval when found", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([createApprovalRow()]));

      const result = await repository.findById(101);

      expect(result).toEqual({
        id: 101,
        advertisementId: 501,
        clientId: 301,
        paymentId: 701,
        approvalType: "DISCOUNT",
        requestedAmount: 5000,
        requestedPercentage: 10,
        approvedAmount: null,
        approvedPercentage: null,
        status: "SUBMITTED",
        requestedBy: 11,
        requestedAt: expect.any(Date),
        reviewedBy: null,
        reviewedAt: null,
        holdReason: null,
        rejectionReason: null,
        approvalRemarks: "Discount requested.",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });

      expect(mockedQuery).toHaveBeenCalledTimes(1);
      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([101]);
    });

    it("should return null when the financial approval does not exist", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([]));

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should create a financial approval with SUBMITTED status", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([createApprovalRow()]));

      const result = await repository.create(
        {
          advertisementId: 501,
          clientId: 301,
          paymentId: 701,
          approvalType: "DISCOUNT",
          requestedAmount: 5000,
          requestedPercentage: 10,
          approvalRemarks: "Discount requested."
        },
        11
      );

      expect(result.id).toBe(101);
      expect(result.advertisementId).toBe(501);
      expect(result.clientId).toBe(301);
      expect(result.paymentId).toBe(701);
      expect(result.approvalType).toBe("DISCOUNT");
      expect(result.requestedAmount).toBe(5000);
      expect(result.requestedPercentage).toBe(10);
      expect(result.status).toBe("SUBMITTED");
      expect(result.requestedBy).toBe(11);

      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([
        501,
        301,
        701,
        "DISCOUNT",
        5000,
        10,
        11,
        "Discount requested."
      ]);
    });

    it("should use null for optional payment and financial fields", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createApprovalRow({
            payment_id: null,
            requested_amount: null,
            requested_percentage: null,
            approval_remarks: null
          })
        ])
      );

      const result = await repository.create(
        {
          advertisementId: 501,
          clientId: 301,
          approvalType: "REFUND"
        },
        11
      );

      expect(result.paymentId).toBeNull();
      expect(result.requestedAmount).toBeNull();
      expect(result.requestedPercentage).toBeNull();
      expect(result.approvalRemarks).toBeNull();

      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([
        501,
        301,
        null,
        "REFUND",
        null,
        null,
        11,
        null
      ]);
    });

    it("should throw when creation returns no row", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([]));

      await expect(
        repository.create(
          {
            advertisementId: 501,
            clientId: 301,
            approvalType: "ADJUSTMENT",
            requestedAmount: 2500
          },
          11
        )
      ).rejects.toThrow("Failed to create financial approval.");
    });
  });

  describe("updateApprovalRemarks", () => {
    it("should update approval remarks", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createApprovalRow({
            approval_remarks: "Updated approval remarks."
          })
        ])
      );

      const result = await repository.updateApprovalRemarks(
        101,
        "Updated approval remarks."
      );

      expect(result?.approvalRemarks).toBe("Updated approval remarks.");
      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([
        101,
        "Updated approval remarks."
      ]);
    });

    it("should return null when approval does not exist", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([]));

      const result = await repository.updateApprovalRemarks(999, null);

      expect(result).toBeNull();
    });
  });

  describe("hold", () => {
    it("should place a submitted approval on hold", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createApprovalRow({
            status: "HOLD",
            reviewed_by: 22,
            reviewed_at: new Date(),
            hold_reason: "Awaiting financial confirmation."
          })
        ])
      );

      const result = await repository.hold(
        101,
        {
          holdReason: "Awaiting financial confirmation."
        },
        22
      );

      expect(result?.status).toBe("HOLD");
      expect(result?.reviewedBy).toBe(22);
      expect(result?.holdReason).toBe("Awaiting financial confirmation.");
      expect(result?.rejectionReason).toBeNull();

      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([
        101,
        22,
        "Awaiting financial confirmation."
      ]);
    });

    it("should return null when the approval is not in SUBMITTED status", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([]));

      const result = await repository.hold(
        101,
        {
          holdReason: "Awaiting confirmation."
        },
        22
      );

      expect(result).toBeNull();
    });
  });

  describe("reject", () => {
    it("should reject a submitted approval", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createApprovalRow({
            status: "REJECTED",
            reviewed_by: 22,
            reviewed_at: new Date(),
            rejection_reason: "Requested amount is not approved."
          })
        ])
      );

      const result = await repository.reject(
        101,
        {
          rejectionReason: "Requested amount is not approved."
        },
        22
      );

      expect(result?.status).toBe("REJECTED");
      expect(result?.reviewedBy).toBe(22);
      expect(result?.rejectionReason).toBe("Requested amount is not approved.");
      expect(result?.holdReason).toBeNull();
    });

    it("should reject an approval currently on hold", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createApprovalRow({
            status: "REJECTED",
            reviewed_by: 22,
            reviewed_at: new Date(),
            rejection_reason: "Financial request rejected."
          })
        ])
      );

      const result = await repository.reject(
        101,
        {
          rejectionReason: "Financial request rejected."
        },
        22
      );

      expect(result?.status).toBe("REJECTED");
    });

    it("should return null when the approval cannot be rejected", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([]));

      const result = await repository.reject(
        101,
        {
          rejectionReason: "Rejected."
        },
        22
      );

      expect(result).toBeNull();
    });
  });

  describe("approve", () => {
    it("should approve a submitted approval", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createApprovalRow({
            status: "APPROVED",
            reviewed_by: 22,
            reviewed_at: new Date(),
            approval_remarks: "Approved by financial manager."
          })
        ])
      );

      const result = await repository.approve(
        101,
        {
          approvalRemarks: "Approved by financial manager."
        },
        22
      );

      expect(result?.status).toBe("APPROVED");
      expect(result?.reviewedBy).toBe(22);
      expect(result?.approvalRemarks).toBe("Approved by financial manager.");
      expect(result?.holdReason).toBeNull();
      expect(result?.rejectionReason).toBeNull();
    });

    it("should approve an approval currently on hold", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createApprovalRow({
            status: "APPROVED",
            reviewed_by: 22,
            reviewed_at: new Date()
          })
        ])
      );

      const result = await repository.approve(101, {}, 22);

      expect(result?.status).toBe("APPROVED");
    });

    it("should return null when the approval cannot be approved", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([]));

      const result = await repository.approve(
        101,
        {
          approvalRemarks: "Approved."
        },
        22
      );

      expect(result).toBeNull();
    });
  });

  describe("resubmit", () => {
    it("should resubmit an approval from HOLD", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createApprovalRow({
            status: "SUBMITTED",
            requested_by: 33,
            reviewed_by: null,
            reviewed_at: null,
            hold_reason: null,
            rejection_reason: null,
            approval_remarks: "Resubmitted after clarification."
          })
        ])
      );

      const result = await repository.resubmit(
        101,
        "Resubmitted after clarification.",
        33
      );

      expect(result?.status).toBe("SUBMITTED");
      expect(result?.requestedBy).toBe(33);
      expect(result?.reviewedBy).toBeNull();
      expect(result?.reviewedAt).toBeNull();
      expect(result?.holdReason).toBeNull();
      expect(result?.rejectionReason).toBeNull();
    });

    it("should resubmit an approval from REJECTED", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createApprovalRow({
            status: "SUBMITTED",
            requested_by: 33
          })
        ])
      );

      const result = await repository.resubmit(101, null, 33);

      expect(result?.status).toBe("SUBMITTED");
      expect(result?.requestedBy).toBe(33);
    });

    it("should return null when the approval cannot be resubmitted", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([]));

      const result = await repository.resubmit(101, null, 33);

      expect(result).toBeNull();
    });
  });

  describe("createHistory", () => {
    it("should create the initial SUBMITTED history entry", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([createHistoryRow()]));

      const result = await repository.createHistory(
        101,
        null,
        "SUBMITTED",
        11,
        "Approval submitted."
      );

      expect(result).toEqual({
        id: 201,
        approvalId: 101,
        fromStatus: null,
        toStatus: "SUBMITTED",
        actionBy: 11,
        actionAt: expect.any(Date),
        remarks: "Approval submitted.",
        holdReason: null,
        rejectionReason: null
      });

      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([
        101,
        null,
        "SUBMITTED",
        11,
        "Approval submitted.",
        null,
        null
      ]);
    });

    it("should create a status transition history entry", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createHistoryRow({
            from_status: "SUBMITTED",
            to_status: "HOLD",
            action_by: 22,
            remarks: "Placed on hold.",
            hold_reason: "Awaiting confirmation."
          })
        ])
      );

      const result = await repository.createHistory(
        101,
        "SUBMITTED",
        "HOLD",
        22,
        "Placed on hold.",
        "Awaiting confirmation."
      );

      expect(result.fromStatus).toBe("SUBMITTED");
      expect(result.toStatus).toBe("HOLD");
      expect(result.actionBy).toBe(22);
      expect(result.holdReason).toBe("Awaiting confirmation.");
    });

    it("should throw when history creation returns no row", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([]));

      await expect(
        repository.createHistory(101, "SUBMITTED", "APPROVED", 22, "Approved.")
      ).rejects.toThrow("Failed to create financial approval history.");
    });
  });

  describe("findHistoryByApprovalId", () => {
    it("should return approval history ordered by action time", async () => {
      const firstDate = new Date("2026-09-23T10:00:00Z");
      const secondDate = new Date("2026-09-23T11:00:00Z");

      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createHistoryRow({
            id: 201,
            action_at: firstDate,
            to_status: "SUBMITTED"
          }),
          createHistoryRow({
            id: 202,
            from_status: "SUBMITTED",
            to_status: "HOLD",
            action_at: secondDate,
            action_by: 22,
            remarks: "On hold.",
            hold_reason: "Awaiting confirmation."
          })
        ])
      );

      const result = await repository.findHistoryByApprovalId(101);

      expect(result).toHaveLength(2);
      expect(result[0]?.toStatus).toBe("SUBMITTED");
      expect(result[1]?.fromStatus).toBe("SUBMITTED");
      expect(result[1]?.toStatus).toBe("HOLD");
      expect(result[1]?.holdReason).toBe("Awaiting confirmation.");

      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([101]);
    });

    it("should return an empty array when no history exists", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([]));

      const result = await repository.findHistoryByApprovalId(999);

      expect(result).toEqual([]);
    });
  });

  describe("exists", () => {
    it("should return true when approval exists", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([{ exists: true }]));

      const result = await repository.exists(101);

      expect(result).toBe(true);
    });

    it("should return false when approval does not exist", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([{ exists: false }]));

      const result = await repository.exists(999);

      expect(result).toBe(false);
    });
  });

  describe("existsForAdvertisement", () => {
    it("should return true when an approval exists for the advertisement", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([{ exists: true }]));

      const result = await repository.existsForAdvertisement(501);

      expect(result).toBe(true);
      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([501]);
    });

    it("should return false when no approval exists for the advertisement", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([{ exists: false }]));

      const result = await repository.existsForAdvertisement(999);

      expect(result).toBe(false);
    });
  });

  describe("findLatestByAdvertisementId", () => {
    it("should return the latest approval for an advertisement", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createApprovalRow({
            id: 105,
            requested_at: new Date("2026-09-23T12:00:00Z")
          })
        ])
      );

      const result = await repository.findLatestByAdvertisementId(501);

      expect(result?.id).toBe(105);
      expect(result?.advertisementId).toBe(501);
    });

    it("should return null when the advertisement has no approvals", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([]));

      const result = await repository.findLatestByAdvertisementId(999);

      expect(result).toBeNull();
    });
  });

  describe("findPendingByAdvertisementId", () => {
    it("should return a submitted or held approval", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createApprovalRow({
            status: "HOLD",
            hold_reason: "Awaiting confirmation."
          })
        ])
      );

      const result = await repository.findPendingByAdvertisementId(501);

      expect(result?.status).toBe("HOLD");
      expect(result?.advertisementId).toBe(501);
    });

    it("should return null when there is no pending approval", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([]));

      const result = await repository.findPendingByAdvertisementId(999);

      expect(result).toBeNull();
    });
  });

  describe("findPendingByPaymentId", () => {
    it("should return a submitted or held approval for a payment", async () => {
      mockedQuery.mockResolvedValueOnce(
        queryResult([
          createApprovalRow({
            payment_id: 701,
            status: "SUBMITTED"
          })
        ])
      );

      const result = await repository.findPendingByPaymentId(701);

      expect(result?.paymentId).toBe(701);
      expect(result?.status).toBe("SUBMITTED");
    });

    it("should return null when there is no pending approval for the payment", async () => {
      mockedQuery.mockResolvedValueOnce(queryResult([]));

      const result = await repository.findPendingByPaymentId(999);

      expect(result).toBeNull();
    });
  });

  describe("list", () => {
    it("should return paginated financial approvals", async () => {
      mockedQuery
        .mockResolvedValueOnce(queryResult([{ count: "2" }]))
        .mockResolvedValueOnce(
          queryResult([
            createApprovalRow({ id: 101 }),
            createApprovalRow({ id: 102 })
          ])
        );

      const result = await repository.list({
        advertisementId: 501,
        clientId: 301,
        approvalType: "DISCOUNT",
        status: "SUBMITTED",
        requestedBy: 11,
        page: 1,
        pageSize: 20
      });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toBe(101);
      expect(result.items[1]?.id).toBe(102);

      expect(mockedQuery).toHaveBeenCalledTimes(2);

      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([
        501,
        301,
        "DISCOUNT",
        "SUBMITTED",
        11
      ]);

      expect(mockedQuery.mock.calls[1]?.[1]).toEqual([
        501,
        301,
        "DISCOUNT",
        "SUBMITTED",
        11,
        20,
        0
      ]);
    });

    it("should return an empty result when no approvals match", async () => {
      mockedQuery
        .mockResolvedValueOnce(queryResult([{ count: "0" }]))
        .mockResolvedValueOnce(queryResult([]));

      const result = await repository.list({
        page: 2,
        pageSize: 10
      });

      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);

      expect(mockedQuery).toHaveBeenCalledTimes(2);

      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([]);

      expect(mockedQuery.mock.calls[1]?.[1]).toEqual([10, 10]);
    });

    it("should support payment, reviewedBy and pagination filters", async () => {
      mockedQuery
        .mockResolvedValueOnce(queryResult([{ count: "1" }]))
        .mockResolvedValueOnce(
          queryResult([
            createApprovalRow({
              payment_id: 701,
              reviewed_by: 22,
              status: "APPROVED"
            })
          ])
        );

      const result = await repository.list({
        paymentId: 701,
        reviewedBy: 22,
        status: "APPROVED",
        page: 3,
        pageSize: 5
      });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.paymentId).toBe(701);
      expect(result.items[0]?.reviewedBy).toBe(22);

      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([701, "APPROVED", 22]);

      expect(mockedQuery.mock.calls[1]?.[1]).toEqual([
        701,
        "APPROVED",
        22,
        5,
        10
      ]);
    });

    it("should support all list filters", async () => {
      mockedQuery
        .mockResolvedValueOnce(queryResult([{ count: "1" }]))
        .mockResolvedValueOnce(queryResult([createApprovalRow()]));

      await repository.list({
        advertisementId: 501,
        clientId: 301,
        paymentId: 701,
        approvalType: "ADJUSTMENT",
        status: "HOLD",
        requestedBy: 11,
        reviewedBy: 22,
        page: 2,
        pageSize: 25
      });

      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([
        501,
        301,
        701,
        "ADJUSTMENT",
        "HOLD",
        11,
        22
      ]);

      expect(mockedQuery.mock.calls[1]?.[1]).toEqual([
        501,
        301,
        701,
        "ADJUSTMENT",
        "HOLD",
        11,
        22,
        25,
        25
      ]);
    });

    it("should correctly map decimal financial values", async () => {
      mockedQuery
        .mockResolvedValueOnce(queryResult([{ count: "1" }]))
        .mockResolvedValueOnce(
          queryResult([
            createApprovalRow({
              requested_amount: "12345.67",
              requested_percentage: "12.3456"
            })
          ])
        );

      const result = await repository.list({
        page: 1,
        pageSize: 10
      });

      expect(result.items[0]?.requestedAmount).toBe(12345.67);
      expect(result.items[0]?.requestedPercentage).toBe(12.3456);
    });
  });

  describe("DbExecutor support", () => {
    it("should use the supplied PoolClient executor", async () => {
      const client = {
        query: vi.fn()
      } as unknown as PoolClient;

      const mockedClientQuery = client.query as unknown as ReturnType<
        typeof vi.fn
      >;

      mockedClientQuery.mockResolvedValueOnce(
        queryResult([createApprovalRow()])
      );

      const result = await repository.findById(101, client);

      expect(result?.id).toBe(101);
      expect(mockedClientQuery).toHaveBeenCalledTimes(1);
      expect(mockedClientQuery.mock.calls[0]?.[1]).toEqual([101]);
      expect(mockedQuery).not.toHaveBeenCalled();
    });
  });
});
