import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../payment.repository.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

const mockedQuery = pool.query as unknown as Mock;

function createPaymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    advertisement_id: 10,
    amount: "25000.00",
    payment_type: "ADVANCE",
    payment_date: new Date("2026-09-23T10:00:00.000Z"),
    payment_method: "UPI",
    payment_status: "VERIFIED",
    transaction_reference: "TXN-10001",
    notes: "Advance payment",
    recorded_by: 1,
    recorded_at: new Date("2026-09-23T10:00:00.000Z"),
    verified_by: 2,
    verified_at: new Date("2026-09-23T11:00:00.000Z"),
    cancelled_by: null,
    cancelled_at: null,
    cancellation_reason: null,
    refunded_by: null,
    refunded_at: null,
    refund_reference: null,
    refund_reason: null,
    created_at: new Date("2026-09-23T10:00:00.000Z"),
    updated_at: new Date("2026-09-23T11:00:00.000Z"),
    ...overrides
  };
}

function createRefundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 500,
    payment_id: 100,
    amount: "5000.00",
    refund_date: new Date("2026-09-23T12:00:00.000Z"),
    refund_reference: "REF-50001",
    refund_reason: "Customer refund",
    refunded_by: 2,
    created_at: new Date("2026-09-23T12:00:00.000Z"),
    updated_at: new Date("2026-09-23T12:00:00.000Z"),
    ...overrides
  };
}

function createQueryResult(rows: unknown[], command = "SELECT") {
  return {
    rows,
    rowCount: rows.length,
    command,
    oid: 0,
    fields: []
  };
}

describe("Advertisement Payment Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("should return a mapped payment when found", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([createPaymentRow()])
      );

      const result = await repository.findById(100);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(100);
      expect(result?.advertisementId).toBe(10);
      expect(result?.amount).toBe(25000);
      expect(result?.paymentType).toBe("ADVANCE");
      expect(result?.paymentStatus).toBe("VERIFIED");
      expect(result?.transactionReference).toBe("TXN-10001");
    });

    it("should return null when payment does not exist", async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });

    it("should query using the payment id", async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      await repository.findById(123);

      expect(mockedQuery).toHaveBeenCalledTimes(1);
      expect(mockedQuery.mock.calls[0]?.[0]).toContain(
        "advertisement_payments"
      );
      expect(mockedQuery.mock.calls[0]?.[1]).toEqual([123]);
    });
  });

  describe("findRawById", () => {
    it("should return the raw database row", async () => {
      const row = createPaymentRow();

      mockedQuery.mockResolvedValueOnce(createQueryResult([row]));

      const result = await repository.findRawById(100);

      expect(result).toEqual(row);
    });

    it("should return null when no row exists", async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await repository.findRawById(999);

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should insert a payment and return the mapped row", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult(
          [createPaymentRow({ payment_status: "RECEIVED" })],
          "INSERT"
        )
      );

      const result = await repository.create(
        {
          advertisementId: 10,
          amount: 25000,
          paymentType: "ADVANCE",
          paymentDate: new Date("2026-09-23T10:00:00.000Z"),
          paymentMethod: "UPI",
          transactionReference: "TXN-10001",
          notes: "Advance payment"
        },
        1
      );

      expect(result.id).toBe(100);
      expect(result.advertisementId).toBe(10);
      expect(result.amount).toBe(25000);

      expect(mockedQuery).toHaveBeenCalledTimes(1);

      const [sql, params] = mockedQuery.mock.calls[0] as [string, unknown[]];

      expect(sql).toContain("INSERT INTO advertisement_payments");
      expect(params).toContain(10);
      expect(params).toContain(25000);
      expect(params).toContain("ADVANCE");
      expect(params).toContain("UPI");
      expect(params).toContain("TXN-10001");
      expect(params).toContain(1);
    });
  });

  describe("update", () => {
    it("should update payment fields", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult(
          [
            createPaymentRow({
              amount: "30000.00",
              payment_type: "INSTALLMENT",
              notes: "Updated"
            })
          ],
          "UPDATE"
        )
      );

      const result = await repository.update(100, {
        amount: 30000,
        paymentType: "INSTALLMENT",
        notes: "Updated"
      });

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(30000);
      expect(result?.paymentType).toBe("INSTALLMENT");
      expect(result?.notes).toBe("Updated");

      expect(mockedQuery.mock.calls[0]?.[0]).toContain(
        "UPDATE advertisement_payments"
      );
    });

    it("should return null when the payment does not exist", async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([], "UPDATE"));

      const result = await repository.update(999, {
        amount: 1000
      });

      expect(result).toBeNull();
    });
  });

  describe("verify", () => {
    it("should verify a payment", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult(
          [
            createPaymentRow({
              payment_status: "VERIFIED",
              verified_by: 5
            })
          ],
          "UPDATE"
        )
      );

      const result = await repository.verify(100, 5);

      expect(result).not.toBeNull();
      expect(result?.paymentStatus).toBe("VERIFIED");
      expect(result?.verifiedBy).toBe(5);

      const [sql, params] = mockedQuery.mock.calls[0] as [string, unknown[]];

      expect(sql).toContain("UPDATE advertisement_payments");
      expect(params).toEqual([5, 100]);
    });
  });

  describe("cancel", () => {
    it("should cancel a payment with a reason", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult(
          [
            createPaymentRow({
              payment_status: "CANCELLED",
              cancelled_by: 5,
              cancellation_reason: "Duplicate transaction"
            })
          ],
          "UPDATE"
        )
      );

      const result = await repository.cancel(100, 5, "Duplicate transaction");

      expect(result?.paymentStatus).toBe("CANCELLED");
      expect(result?.cancelledBy).toBe(5);
      expect(result?.cancellationReason).toBe("Duplicate transaction");
    });
  });

  describe("markRefunded", () => {
    it("should mark a payment as refunded", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult(
          [
            createPaymentRow({
              payment_status: "REFUNDED",
              refunded_by: 5,
              refund_reference: "REF-100",
              refund_reason: "Full refund"
            })
          ],
          "UPDATE"
        )
      );

      const result = await repository.markRefunded(
        100,
        5,
        "REF-100",
        "Full refund"
      );

      expect(result?.paymentStatus).toBe("REFUNDED");
      expect(result?.refundedBy).toBe(5);
      expect(result?.refundReference).toBe("REF-100");
      expect(result?.refundReason).toBe("Full refund");
    });
  });

  describe("createRefund", () => {
    it("should create a refund ledger entry", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult(
          [
            createRefundRow({
              refunded_by: 5
            })
          ],
          "INSERT"
        )
      );

      const result = await repository.createRefund(
        {
          paymentId: 100,
          amount: 5000,
          refundDate: new Date("2026-09-23T12:00:00.000Z"),
          refundReference: "REF-50001",
          refundReason: "Customer refund"
        },
        5
      );

      expect(result.id).toBe(500);
      expect(result.paymentId).toBe(100);
      expect(result.amount).toBe(5000);
      expect(result.refundReference).toBe("REF-50001");
      expect(result.refundedBy).toBe(5);
    });
  });

  describe("findRefundById", () => {
    it("should return a refund when found", async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([createRefundRow()]));

      const result = await repository.findRefundById(500);

      expect(result?.id).toBe(500);
      expect(result?.paymentId).toBe(100);
      expect(result?.amount).toBe(5000);
    });

    it("should return null when refund does not exist", async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await repository.findRefundById(999);

      expect(result).toBeNull();
    });
  });

  describe("findRefundsByPaymentId", () => {
    it("should return all refunds for a payment", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          createRefundRow(),
          createRefundRow({
            id: 501,
            amount: "2500.00"
          })
        ])
      );

      const result = await repository.findRefundsByPaymentId(100);

      expect(result).toHaveLength(2);
      expect(result[0]?.amount).toBe(5000);
      expect(result[1]?.amount).toBe(2500);
    });

    it("should return an empty array when no refunds exist", async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await repository.findRefundsByPaymentId(100);

      expect(result).toEqual([]);
    });
  });

  describe("getTotalRefundedAmount", () => {
    it("should return the total refunded amount", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            total: "7500.00"
          }
        ])
      );

      const result = await repository.getTotalRefundedAmount(100);

      expect(result).toBe(7500);
    });

    it("should return zero when there are no refunds", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            total: null
          }
        ])
      );

      const result = await repository.getTotalRefundedAmount(100);

      expect(result).toBe(0);
    });
  });

  describe("getList", () => {
    it("should return payment list items with client information", async () => {
      mockedQuery
        .mockResolvedValueOnce(
          createQueryResult([
            {
              count: "1"
            }
          ])
        )
        .mockResolvedValueOnce(
          createQueryResult([
            {
              ...createPaymentRow(),
              advertisement_name: "Test Advertisement",
              client_id: 20,
              client_name: "ABC Traders",
              client_code: "CLI-001",
              total_refunded_amount: "5000.00",
              net_paid_amount: "20000.00"
            }
          ])
        );

      const result = await repository.getList({}, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.advertisementName).toBe("Test Advertisement");
      expect(result.items[0]?.clientId).toBe(20);
      expect(result.items[0]?.clientName).toBe("ABC Traders");
      expect(result.items[0]?.clientCode).toBe("CLI-001");
      expect(result.items[0]?.totalRefundedAmount).toBe(5000);
      expect(result.items[0]?.netPaidAmount).toBe(20000);
      expect(result.total).toBe(1);

      expect(mockedQuery).toHaveBeenCalledTimes(2);
    });

    it("should apply advertisement and status filters", async () => {
      mockedQuery
        .mockResolvedValueOnce(
          createQueryResult([
            {
              count: "0"
            }
          ])
        )
        .mockResolvedValueOnce(createQueryResult([]));

      await repository.getList(
        {
          advertisementId: 10,
          paymentStatus: "VERIFIED"
        },
        2,
        10
      );

      const countCall = mockedQuery.mock.calls[0];

      expect(countCall?.[0]).toContain("advertisement_payments");

      expect(countCall?.[1]).toContain(10);
      expect(countCall?.[1]).toContain("VERIFIED");
    });
  });

  describe("getSummary", () => {
    it("should return the payment summary", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            advertisement_id: 10,
            advertisement_amount: "50000.00",
            discount_amount: "5000.00",
            adjustment_amount: "1000.00",
            verified_payment_amount: "30000.00",
            refunded_amount: "2000.00",
            net_paid_amount: "28000.00"
          }
        ])
      );

      const result = await repository.getSummary(10);

      expect(result).not.toBeNull();
      expect(result?.advertisementId).toBe(10);
      expect(result?.advertisementAmount).toBe(50000);
      expect(result?.discountAmount).toBe(5000);
      expect(result?.adjustmentAmount).toBe(1000);
      expect(result?.verifiedPaymentAmount).toBe(30000);
      expect(result?.refundedAmount).toBe(2000);
      expect(result?.netPaidAmount).toBe(28000);
      expect(result?.outstandingAmount).toBe(16000);
    });

    it("should return null when advertisement does not exist", async () => {
      mockedQuery.mockResolvedValueOnce(createQueryResult([]));

      const result = await repository.getSummary(999);

      expect(result).toBeNull();
    });
  });

  describe("advertisementExists", () => {
    it("should return true when advertisement exists", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            exists: true
          }
        ])
      );

      const result = await repository.advertisementExists(10);

      expect(result).toBe(true);
    });

    it("should return false when advertisement does not exist", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            exists: false
          }
        ])
      );

      const result = await repository.advertisementExists(999);

      expect(result).toBe(false);
    });
  });

  describe("hasTransactionReference", () => {
    it("should return true when transaction reference exists", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            exists: true
          }
        ])
      );

      const result = await repository.hasTransactionReference("TXN-10001");

      expect(result).toBe(true);
    });

    it("should return false when transaction reference does not exist", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            exists: false
          }
        ])
      );

      const result = await repository.hasTransactionReference("TXN-99999");

      expect(result).toBe(false);
    });
  });

  describe("getVerifiedPaymentAmount", () => {
    it("should return the verified payment amount", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            total: "35000.00"
          }
        ])
      );

      const result = await repository.getVerifiedPaymentAmount(10);

      expect(result).toBe(35000);
    });

    it("should return zero when there are no verified payments", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            total: null
          }
        ])
      );

      const result = await repository.getVerifiedPaymentAmount(10);

      expect(result).toBe(0);
    });
  });

  describe("getRefundedAmountForPayment", () => {
    it("should return the refunded amount for a payment", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            total: "2500.00"
          }
        ])
      );

      const result = await repository.getRefundedAmountForPayment(100);

      expect(result).toBe(2500);
    });

    it("should return zero when no refund exists", async () => {
      mockedQuery.mockResolvedValueOnce(
        createQueryResult([
          {
            total: null
          }
        ])
      );

      const result = await repository.getRefundedAmountForPayment(100);

      expect(result).toBe(0);
    });
  });
});
