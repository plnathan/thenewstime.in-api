import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../../../shared/utils/apiErrorInfo.js";

import * as paymentRepository from "../payment.repository.js";
import * as paymentService from "../payment.service.js";

import type { AdvertisementPayment } from "../payment.types.js";

vi.mock("../payment.repository.js", () => ({
  withAdvertisementLock: vi.fn(
    async <T>(
      _advertisementId: number,
      callback: (executor: unknown) => Promise<T>
    ): Promise<T> => callback({})
  ),
  findById: vi.fn(),
  findRawById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  verify: vi.fn(),
  cancel: vi.fn(),
  markRefunded: vi.fn(),
  createRefund: vi.fn(),
  findRefundById: vi.fn(),
  findRefundsByPaymentId: vi.fn(),
  getTotalRefundedAmount: vi.fn(),
  getList: vi.fn(),
  getSummary: vi.fn(),
  getUnsettledPaymentAmounts: vi.fn(),
  advertisementExists: vi.fn(),
  hasTransactionReference: vi.fn(),
  getVerifiedPaymentAmount: vi.fn(),
  getRefundedAmountForPayment: vi.fn()
}));

const mockedRepository = vi.mocked(paymentRepository);

function createPayment(
  overrides: Partial<AdvertisementPayment> = {}
): AdvertisementPayment {
  return {
    id: 100,
    advertisementId: 10,
    amount: 25000,
    paymentType: "ADVANCE",
    paymentDate: new Date("2026-09-23T10:00:00.000Z"),
    paymentMethod: "UPI",
    paymentStatus: "PENDING",
    transactionReference: "TXN-10001",
    notes: "Advance payment",
    recordedBy: 1,
    recordedAt: new Date("2026-09-23T10:00:00.000Z"),
    verifiedBy: null,
    verifiedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    cancellationReason: null,
    refundedBy: null,
    refundedAt: null,
    refundReference: null,
    refundReason: null,
    createdAt: new Date("2026-09-23T10:00:00.000Z"),
    updatedAt: new Date("2026-09-23T10:00:00.000Z"),
    ...overrides
  };
}

function createRefund() {
  return {
    id: 500,
    paymentId: 100,
    amount: 5000,
    refundDate: new Date("2026-09-23T12:00:00.000Z"),
    refundReference: "REF-50001",
    refundReason: "Customer refund",
    refundedBy: 2,
    createdAt: new Date("2026-09-23T12:00:00.000Z"),
    updatedAt: new Date("2026-09-23T12:00:00.000Z")
  };
}

describe("Advertisement Payment Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedRepository.advertisementExists.mockResolvedValue(true);
    mockedRepository.hasTransactionReference.mockResolvedValue(false);

    mockedRepository.getSummary.mockResolvedValue({
      advertisementId: 10,
      advertisementAmount: 100000,
      discountAmount: 0,
      adjustmentAmount: 0,
      verifiedPaymentAmount: 0,
      refundedAmount: 0,
      netPaidAmount: 0,
      outstandingAmount: 100000,
      advanceRequiredAmount: 0,
      advanceReceivedAmount: 0,
      advancePendingAmount: 0
    });

    mockedRepository.getUnsettledPaymentAmounts.mockResolvedValue({
      total: 0,
      advance: 0
    });
  });

  describe("getPaymentById", () => {
    it("should return the payment", async () => {
      const payment = createPayment();

      mockedRepository.findById.mockResolvedValue(payment);

      const result = await paymentService.getPaymentById(100);

      expect(result).toEqual(payment);
      expect(mockedRepository.findById).toHaveBeenCalledWith(100);
    });

    it("should throw 404 when payment does not exist", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expect(paymentService.getPaymentById(999)).rejects.toBeInstanceOf(
        ApiError
      );

      await expect(paymentService.getPaymentById(999)).rejects.toMatchObject({
        statusCode: 404
      });
    });
  });

  describe("createPayment", () => {
    it("should create a payment successfully", async () => {
      const payment = createPayment();

      mockedRepository.getSummary.mockResolvedValue({
        advertisementId: 10,
        advertisementAmount: 100000,
        discountAmount: 0,
        adjustmentAmount: 0,
        verifiedPaymentAmount: 0,
        refundedAmount: 0,
        netPaidAmount: 0,
        outstandingAmount: 100000,
        advanceRequiredAmount: 25000,
        advanceReceivedAmount: 0,
        advancePendingAmount: 25000
      });

      mockedRepository.create.mockResolvedValue(payment);

      const result = await paymentService.createPayment(
        {
          advertisementId: 10,
          amount: 25000,
          paymentType: "ADVANCE",
          paymentMethod: "UPI",
          transactionReference: " TXN-10001 ",
          notes: " Advance payment "
        },
        1
      );

      expect(result).toEqual(payment);

      expect(mockedRepository.withAdvertisementLock).toHaveBeenCalledWith(
        10,
        expect.any(Function)
      );

      expect(mockedRepository.getSummary).toHaveBeenCalledWith(
        10,
        expect.anything()
      );

      expect(mockedRepository.getUnsettledPaymentAmounts).toHaveBeenCalledWith(
        10,
        expect.anything()
      );

      expect(mockedRepository.hasTransactionReference).toHaveBeenCalledWith(
        "TXN-10001",
        undefined,
        expect.anything()
      );

      expect(mockedRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          advertisementId: 10,
          amount: 25000,
          paymentType: "ADVANCE",
          paymentMethod: "UPI",
          transactionReference: "TXN-10001",
          notes: "Advance payment"
        }),
        1,
        expect.anything()
      );
    });

    it("should reject payment when advertisement does not exist", async () => {
      mockedRepository.advertisementExists.mockResolvedValue(false);

      await expect(
        paymentService.createPayment(
          {
            advertisementId: 999,
            amount: 1000,
            paymentType: "REGULAR"
          },
          1
        )
      ).rejects.toMatchObject({
        statusCode: 404
      });

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should reject duplicate transaction references", async () => {
      mockedRepository.hasTransactionReference.mockResolvedValue(true);

      await expect(
        paymentService.createPayment(
          {
            advertisementId: 10,
            amount: 1000,
            paymentType: "REGULAR",
            transactionReference: "TXN-10001"
          },
          1
        )
      ).rejects.toMatchObject({
        statusCode: 409
      });

      expect(mockedRepository.getUnsettledPaymentAmounts).toHaveBeenCalledWith(
        10,
        expect.anything()
      );

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should trim transaction reference and notes", async () => {
      mockedRepository.create.mockResolvedValue(createPayment());

      await paymentService.createPayment(
        {
          advertisementId: 10,
          amount: 1000,
          paymentType: "REGULAR",
          transactionReference: " TXN-ABC ",
          notes: " Payment note "
        },
        1
      );

      expect(mockedRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionReference: "TXN-ABC",
          notes: "Payment note"
        }),
        1,
        expect.anything()
      );
    });
  });

  describe("updatePayment", () => {
    it("should update a PENDING payment", async () => {
      const payment = createPayment();

      mockedRepository.findById.mockResolvedValue(payment);

      mockedRepository.update.mockResolvedValue(
        createPayment({
          amount: 30000
        })
      );

      const result = await paymentService.updatePayment(100, {
        amount: 30000
      });

      expect(result.amount).toBe(30000);

      expect(mockedRepository.update).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          amount: 30000
        })
      );
    });

    it("should reject update when payment does not exist", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expect(
        paymentService.updatePayment(999, {
          amount: 1000
        })
      ).rejects.toMatchObject({
        statusCode: 404
      });

      expect(mockedRepository.update).not.toHaveBeenCalled();
    });

    it("should reject update of a RECEIVED payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "RECEIVED"
        })
      );

      await expect(
        paymentService.updatePayment(100, {
          amount: 30000
        })
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedRepository.update).not.toHaveBeenCalled();
    });

    it("should reject update of a VERIFIED payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "VERIFIED"
        })
      );

      await expect(
        paymentService.updatePayment(100, {
          amount: 30000
        })
      ).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it("should reject update of a CANCELLED payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "CANCELLED"
        })
      );

      await expect(
        paymentService.updatePayment(100, {
          amount: 30000
        })
      ).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it("should reject update of a REFUNDED payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "REFUNDED"
        })
      );

      await expect(
        paymentService.updatePayment(100, {
          amount: 30000
        })
      ).rejects.toMatchObject({
        statusCode: 400
      });
    });
  });

  describe("listPayments", () => {
    it("should return paginated payments", async () => {
      const result = {
        items: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0
        }
      };

      mockedRepository.getList.mockResolvedValue({
        items: [],
        total: 0
      });

      const response = await paymentService.listPayments({}, 1, 20);

      expect(response).toEqual(result);

      expect(mockedRepository.getList).toHaveBeenCalledWith({}, 1, 20);
    });

    it("should calculate total pages correctly", async () => {
      mockedRepository.getList.mockResolvedValue({
        items: [],
        total: 45
      });

      const result = await paymentService.listPayments({}, 2, 20);

      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 20,
        total: 45,
        totalPages: 3
      });
    });
  });

  describe("verifyPayment", () => {
    it("should verify a PENDING payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "PENDING"
        })
      );

      const verified = createPayment({
        paymentStatus: "VERIFIED",
        verifiedBy: 5
      });

      mockedRepository.verify.mockResolvedValue(verified);

      const result = await paymentService.verifyPayment(100, 5);

      expect(result).toEqual(verified);

      expect(mockedRepository.verify).toHaveBeenCalledWith(100, 5);
    });

    it("should verify a RECEIVED payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "RECEIVED"
        })
      );

      mockedRepository.verify.mockResolvedValue(
        createPayment({
          paymentStatus: "VERIFIED"
        })
      );

      const result = await paymentService.verifyPayment(100, 5);

      expect(result.paymentStatus).toBe("VERIFIED");
    });

    it("should reject verification of a missing payment", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expect(paymentService.verifyPayment(999, 5)).rejects.toMatchObject({
        statusCode: 404
      });
    });

    it("should reject verification of an already verified payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "VERIFIED"
        })
      );

      await expect(paymentService.verifyPayment(100, 5)).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedRepository.verify).not.toHaveBeenCalled();
    });

    it("should reject verification of a cancelled payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "CANCELLED"
        })
      );

      await expect(paymentService.verifyPayment(100, 5)).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it("should reject verification of a refunded payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "REFUNDED"
        })
      );

      await expect(paymentService.verifyPayment(100, 5)).rejects.toMatchObject({
        statusCode: 400
      });
    });
  });

  describe("cancelPayment", () => {
    it("should cancel a PENDING payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "PENDING"
        })
      );

      const cancelled = createPayment({
        paymentStatus: "CANCELLED",
        cancelledBy: 5,
        cancellationReason: "Duplicate entry"
      });

      mockedRepository.cancel.mockResolvedValue(cancelled);

      const result = await paymentService.cancelPayment(
        100,
        5,
        " Duplicate entry "
      );

      expect(result).toEqual(cancelled);

      expect(mockedRepository.cancel).toHaveBeenCalledWith(
        100,
        5,
        "Duplicate entry"
      );
    });

    it("should cancel a RECEIVED payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "RECEIVED"
        })
      );

      mockedRepository.cancel.mockResolvedValue(
        createPayment({
          paymentStatus: "CANCELLED"
        })
      );

      const result = await paymentService.cancelPayment(
        100,
        5,
        "Duplicate entry"
      );

      expect(result.paymentStatus).toBe("CANCELLED");
    });

    it("should reject cancellation without a reason", async () => {
      mockedRepository.findById.mockResolvedValue(createPayment());

      await expect(
        paymentService.cancelPayment(100, 5, "   ")
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedRepository.cancel).not.toHaveBeenCalled();
    });

    it("should reject cancellation of a VERIFIED payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "VERIFIED"
        })
      );

      await expect(
        paymentService.cancelPayment(100, 5, "Cancellation requested")
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedRepository.cancel).not.toHaveBeenCalled();
    });

    it("should reject cancellation of a REFUNDED payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "REFUNDED"
        })
      );

      await expect(
        paymentService.cancelPayment(100, 5, "Cancellation requested")
      ).rejects.toMatchObject({
        statusCode: 400
      });
    });
  });

  describe("getPaymentRefunds", () => {
    it("should return refunds for a payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "VERIFIED"
        })
      );

      const refunds = [createRefund()];

      mockedRepository.findRefundsByPaymentId.mockResolvedValue(refunds);

      const result = await paymentService.getPaymentRefunds(100);

      expect(result).toEqual(refunds);

      expect(mockedRepository.findRefundsByPaymentId).toHaveBeenCalledWith(100);
    });

    it("should reject when payment does not exist", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expect(paymentService.getPaymentRefunds(999)).rejects.toMatchObject(
        {
          statusCode: 404
        }
      );

      expect(mockedRepository.findRefundsByPaymentId).not.toHaveBeenCalled();
    });
  });

  describe("createPaymentRefund", () => {
    it("should create a partial refund for a VERIFIED payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "VERIFIED",
          amount: 25000
        })
      );

      mockedRepository.getTotalRefundedAmount.mockResolvedValue(5000);

      const refund = createRefund();

      mockedRepository.createRefund.mockResolvedValue(refund);

      const result = await paymentService.createPaymentRefund(
        {
          paymentId: 100,
          amount: 5000,
          refundReference: "REF-50001",
          refundReason: "Customer refund"
        },
        5
      );

      expect(result).toEqual(refund);

      expect(mockedRepository.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 100,
          amount: 5000
        }),
        5
      );

      expect(mockedRepository.markRefunded).not.toHaveBeenCalled();
    });

    it("should mark the payment refunded when the full amount is refunded", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "VERIFIED",
          amount: 25000
        })
      );

      mockedRepository.getTotalRefundedAmount.mockResolvedValue(0);

      const refund = createRefund();

      mockedRepository.createRefund.mockResolvedValue(refund);

      mockedRepository.markRefunded.mockResolvedValue(
        createPayment({
          paymentStatus: "REFUNDED"
        })
      );

      await paymentService.createPaymentRefund(
        {
          paymentId: 100,
          amount: 25000,
          refundReference: "REF-FULL",
          refundReason: "Full refund"
        },
        5
      );

      expect(mockedRepository.markRefunded).toHaveBeenCalledWith(
        100,
        5,
        "REF-FULL",
        "Full refund"
      );
    });

    it("should reject refund when payment does not exist", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expect(
        paymentService.createPaymentRefund(
          {
            paymentId: 999,
            amount: 1000
          },
          5
        )
      ).rejects.toMatchObject({
        statusCode: 404
      });
    });

    it("should reject refund of a PENDING payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "PENDING"
        })
      );

      await expect(
        paymentService.createPaymentRefund(
          {
            paymentId: 100,
            amount: 1000
          },
          5
        )
      ).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it("should reject refund of a RECEIVED payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "RECEIVED"
        })
      );

      await expect(
        paymentService.createPaymentRefund(
          {
            paymentId: 100,
            amount: 1000
          },
          5
        )
      ).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it("should reject refund of a CANCELLED payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "CANCELLED"
        })
      );

      await expect(
        paymentService.createPaymentRefund(
          {
            paymentId: 100,
            amount: 1000
          },
          5
        )
      ).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it("should reject refund of an already refunded payment", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "REFUNDED"
        })
      );

      await expect(
        paymentService.createPaymentRefund(
          {
            paymentId: 100,
            amount: 1000
          },
          5
        )
      ).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it("should reject refund greater than the remaining refundable amount", async () => {
      mockedRepository.findById.mockResolvedValue(
        createPayment({
          paymentStatus: "VERIFIED",
          amount: 25000
        })
      );

      mockedRepository.getTotalRefundedAmount.mockResolvedValue(20000);

      await expect(
        paymentService.createPaymentRefund(
          {
            paymentId: 100,
            amount: 6000
          },
          5
        )
      ).rejects.toMatchObject({
        statusCode: 400
      });

      expect(mockedRepository.createRefund).not.toHaveBeenCalled();
    });
  });

  describe("getPaymentSummary", () => {
    it("should return the payment summary", async () => {
      const summary = {
        advertisementId: 10,
        advertisementAmount: 50000,
        discountAmount: 5000,
        adjustmentAmount: 1000,
        verifiedPaymentAmount: 30000,
        refundedAmount: 2000,
        netPaidAmount: 28000,
        outstandingAmount: 16000,
        advanceRequiredAmount: 0,
        advanceReceivedAmount: 0,
        advancePendingAmount: 0
      };

      mockedRepository.advertisementExists.mockResolvedValue(true);

      mockedRepository.getSummary.mockResolvedValue(summary);

      const result = await paymentService.getPaymentSummary(10);

      expect(result).toEqual(summary);

      expect(mockedRepository.getSummary).toHaveBeenCalledWith(10);
    });

    it("should reject when advertisement does not exist", async () => {
      mockedRepository.advertisementExists.mockResolvedValue(false);

      await expect(paymentService.getPaymentSummary(999)).rejects.toMatchObject(
        {
          statusCode: 404
        }
      );

      expect(mockedRepository.getSummary).not.toHaveBeenCalled();
    });

    it("should throw when repository returns no summary", async () => {
      mockedRepository.getSummary.mockResolvedValue(null);

      await expect(paymentService.getPaymentSummary(10)).rejects.toMatchObject({
        statusCode: 404
      });
    });
  });
});
