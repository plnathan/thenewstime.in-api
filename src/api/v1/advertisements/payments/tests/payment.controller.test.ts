import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  sendPaginated,
  sendSuccess
} from "../../../../../shared/utils/response.js";

import * as paymentService from "../payment.service.js";

import {
  cancelPayment,
  createPayment,
  createPaymentRefund,
  getPaymentById,
  getPaymentRefunds,
  getPaymentSummary,
  listPayments,
  updatePayment,
  verifyPayment
} from "../payment.controller.js";

vi.mock("../payment.service.js", () => ({
  getPaymentById: vi.fn(),
  createPayment: vi.fn(),
  updatePayment: vi.fn(),
  listPayments: vi.fn(),
  verifyPayment: vi.fn(),
  cancelPayment: vi.fn(),
  getPaymentRefunds: vi.fn(),
  createPaymentRefund: vi.fn(),
  getPaymentSummary: vi.fn()
}));

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: vi.fn(),
  sendPaginated: vi.fn()
}));

const mockedService = vi.mocked(paymentService);
const mockedSendSuccess = vi.mocked(sendSuccess);
const mockedSendPaginated = vi.mocked(sendPaginated);

function createResponse() {
  return {} as Response;
}

function createNext() {
  return vi.fn() as NextFunction;
}

function createRequest(overrides: Partial<Request> = {}) {
  return {
    body: {},
    params: {},
    query: {},
    user: {
      id: 5,
      username: "testuser",
      roles: ["ADMIN"]
    },
    ...overrides
  } as Request;
}

function createPaymentFixture() {
  return {
    id: 100,
    advertisementId: 10,
    amount: 25000,
    paymentType: "ADVANCE" as const,
    paymentDate: new Date("2026-09-23T10:00:00.000Z"),
    paymentMethod: "UPI" as const,
    paymentStatus: "PENDING" as const,
    transactionReference: "TXN-10001",
    notes: "Advance payment",
    recordedBy: 5,
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
    updatedAt: new Date("2026-09-23T10:00:00.000Z")
  };
}

function createPaymentListItemFixture() {
  return {
    id: 100,
    advertisementId: 10,
    advertisementName: "Test Advertisement",
    clientId: 20,
    clientName: "Test Client",
    clientCode: "CLI-00020",
    amount: 25000,
    paymentType: "ADVANCE" as const,
    paymentDate: new Date("2026-09-23T10:00:00.000Z"),
    paymentMethod: "UPI" as const,
    paymentStatus: "PENDING" as const,
    transactionReference: "TXN-10001",
    notes: "Advance payment",
    recordedBy: 5,
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
    totalRefundedAmount: 0,
    netPaidAmount: 25000,
    createdAt: new Date("2026-09-23T10:00:00.000Z"),
    updatedAt: new Date("2026-09-23T10:00:00.000Z")
  };
}

describe("Advertisement Payment Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPayment", () => {
    it("should create a payment successfully", async () => {
      const req = createRequest({
        body: {
          advertisementId: 10,
          amount: 25000,
          paymentType: "ADVANCE",
          paymentMethod: "UPI",
          transactionReference: "TXN-10001"
        }
      });

      const res = createResponse();
      const next = createNext();

      const payment = createPaymentFixture();

      mockedService.createPayment.mockResolvedValue(payment);

      await createPayment(req, res, next);

      expect(mockedService.createPayment).toHaveBeenCalledWith(req.body, 5);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement payment created successfully.",
        payment,
        201
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        body: {
          advertisementId: 10,
          amount: 25000,
          paymentType: "ADVANCE"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Creation failed");

      mockedService.createPayment.mockRejectedValue(error);

      await createPayment(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
    /*
    it("should forward an authentication error when user id is unavailable", async () => {
      const req = createRequest({
        user: {
          id: undefined as unknown as number,
          username: "testuser",
          roles: ["ADMIN"] as never
        }
      });

      const res = createResponse();
      const next = createNext();

      await createPayment(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(mockedService.createPayment).not.toHaveBeenCalled();
    });
    */
  });

  describe("getPaymentById", () => {
    it("should return a payment", async () => {
      const req = createRequest({
        params: {
          id: "100"
        }
      });

      const res = createResponse();
      const next = createNext();

      const payment = createPaymentFixture();

      mockedService.getPaymentById.mockResolvedValue(payment);

      await getPaymentById(req, res, next);

      expect(mockedService.getPaymentById).toHaveBeenCalledWith(100);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement payment retrieved successfully.",
        payment
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        params: {
          id: "100"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Payment not found");

      mockedService.getPaymentById.mockRejectedValue(error);

      await getPaymentById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updatePayment", () => {
    it("should update a payment", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          amount: 30000,
          notes: "Updated payment"
        }
      });

      const res = createResponse();
      const next = createNext();

      const payment = createPaymentFixture();

      mockedService.updatePayment.mockResolvedValue(payment);

      await updatePayment(req, res, next);

      expect(mockedService.updatePayment).toHaveBeenCalledWith(100, req.body);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement payment updated successfully.",
        payment
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          amount: 30000
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Update failed");

      mockedService.updatePayment.mockRejectedValue(error);

      await updatePayment(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("listPayments", () => {
    it("should return paginated payments", async () => {
      const req = createRequest({
        query: {
          page: "2",
          pageSize: "10",
          paymentStatus: "VERIFIED"
        }
      });

      const res = createResponse();
      const next = createNext();

      const result = {
        items: [createPaymentListItemFixture()],
        pagination: {
          page: 2,
          pageSize: 10,
          total: 1,
          totalPages: 1
        }
      };

      mockedService.listPayments.mockResolvedValue(result);

      await listPayments(req, res, next);

      expect(mockedService.listPayments).toHaveBeenCalledWith(
        {
          advertisementId: undefined,
          paymentType: undefined,
          paymentStatus: "VERIFIED",
          paymentMethod: undefined,
          fromDate: undefined,
          toDate: undefined,
          search: undefined
        },
        2,
        10
      );

      expect(mockedSendPaginated).toHaveBeenCalledWith(
        res,
        "Advertisement payments retrieved successfully.",
        result.items,
        {
          page: 2,
          pageSize: 10,
          totalRecords: 1,
          totalPages: 1,
          hasPrevious: true,
          hasNext: false
        }
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should use default pagination values", async () => {
      const req = createRequest({
        query: {}
      });

      const res = createResponse();
      const next = createNext();

      const result = {
        items: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0
        }
      };

      mockedService.listPayments.mockResolvedValue(result);

      await listPayments(req, res, next);

      expect(mockedService.listPayments).toHaveBeenCalledWith(
        {
          advertisementId: undefined,
          paymentType: undefined,
          paymentStatus: undefined,
          paymentMethod: undefined,
          fromDate: undefined,
          toDate: undefined,
          search: undefined
        },
        1,
        20
      );

      expect(mockedSendPaginated).toHaveBeenCalledWith(
        res,
        "Advertisement payments retrieved successfully.",
        [],
        {
          page: 1,
          pageSize: 20,
          totalRecords: 0,
          totalPages: 0,
          hasPrevious: false,
          hasNext: false
        }
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        query: {}
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("List failed");

      mockedService.listPayments.mockRejectedValue(error);

      await listPayments(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendPaginated).not.toHaveBeenCalled();
    });
  });

  describe("verifyPayment", () => {
    it("should verify a payment", async () => {
      const req = createRequest({
        params: {
          id: "100"
        }
      });

      const res = createResponse();
      const next = createNext();

      const payment = createPaymentFixture();

      mockedService.verifyPayment.mockResolvedValue(payment);

      await verifyPayment(req, res, next);

      expect(mockedService.verifyPayment).toHaveBeenCalledWith(100, 5);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement payment verified successfully.",
        payment
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward verification errors", async () => {
      const req = createRequest({
        params: {
          id: "100"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Verification failed");

      mockedService.verifyPayment.mockRejectedValue(error);

      await verifyPayment(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("cancelPayment", () => {
    it("should cancel a payment", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          cancellationReason: "Duplicate transaction"
        }
      });

      const res = createResponse();
      const next = createNext();

      const payment = createPaymentFixture();

      mockedService.cancelPayment.mockResolvedValue(payment);

      await cancelPayment(req, res, next);

      expect(mockedService.cancelPayment).toHaveBeenCalledWith(
        100,
        5,
        "Duplicate transaction"
      );

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement payment cancelled successfully.",
        payment
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward cancellation errors", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          cancellationReason: "Duplicate transaction"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Cancellation failed");

      mockedService.cancelPayment.mockRejectedValue(error);

      await cancelPayment(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("getPaymentRefunds", () => {
    it("should return payment refunds", async () => {
      const req = createRequest({
        params: {
          id: "100"
        }
      });

      const res = createResponse();
      const next = createNext();

      const refunds = [
        {
          id: 500,
          paymentId: 100,
          amount: 5000,
          refundDate: new Date("2026-09-23T12:00:00.000Z"),
          refundReference: "REF-50001",
          refundReason: "Customer refund",
          refundedBy: 5,
          createdAt: new Date("2026-09-23T12:00:00.000Z"),
          updatedAt: new Date("2026-09-23T12:00:00.000Z")
        }
      ];

      mockedService.getPaymentRefunds.mockResolvedValue(refunds);

      await getPaymentRefunds(req, res, next);

      expect(mockedService.getPaymentRefunds).toHaveBeenCalledWith(100);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement payment refunds retrieved successfully.",
        refunds
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward refund retrieval errors", async () => {
      const req = createRequest({
        params: {
          id: "100"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Refund retrieval failed");

      mockedService.getPaymentRefunds.mockRejectedValue(error);

      await getPaymentRefunds(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("createPaymentRefund", () => {
    it("should create a refund successfully", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          amount: 5000,
          refundReference: "REF-50001",
          refundReason: "Customer refund"
        }
      });

      const res = createResponse();
      const next = createNext();

      const refund = {
        id: 500,
        paymentId: 100,
        amount: 5000,
        refundDate: new Date("2026-09-23T12:00:00.000Z"),
        refundReference: "REF-50001",
        refundReason: "Customer refund",
        refundedBy: 5,
        createdAt: new Date("2026-09-23T12:00:00.000Z"),
        updatedAt: new Date("2026-09-23T12:00:00.000Z")
      };

      mockedService.createPaymentRefund.mockResolvedValue(refund);

      await createPaymentRefund(req, res, next);

      expect(mockedService.createPaymentRefund).toHaveBeenCalledWith(
        {
          paymentId: 100,
          amount: 5000,
          refundReference: "REF-50001",
          refundReason: "Customer refund"
        },
        5
      );

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement payment refund created successfully.",
        refund,
        201
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should create a refund with only the required fields", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          amount: 5000
        }
      });

      const res = createResponse();
      const next = createNext();

      const refund = {
        id: 500,
        paymentId: 100,
        amount: 5000,
        refundDate: new Date("2026-09-23T12:00:00.000Z"),
        refundReference: null,
        refundReason: null,
        refundedBy: 5,
        createdAt: new Date("2026-09-23T12:00:00.000Z"),
        updatedAt: new Date("2026-09-23T12:00:00.000Z")
      };

      mockedService.createPaymentRefund.mockResolvedValue(refund);

      await createPaymentRefund(req, res, next);

      expect(mockedService.createPaymentRefund).toHaveBeenCalledWith(
        {
          paymentId: 100,
          amount: 5000
        },
        5
      );

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement payment refund created successfully.",
        refund,
        201
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward refund errors", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          amount: 5000
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Refund failed");

      mockedService.createPaymentRefund.mockRejectedValue(error);

      await createPaymentRefund(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
    /*
    it("should forward an authentication error when user id is unavailable", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        user: {
          id: undefined as unknown as number,
          username: "testuser",
          roles: ["ADMIN"] as never
        },
        body: {
          amount: 5000
        }
      });

      const res = createResponse();
      const next = createNext();

      await createPaymentRefund(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(mockedService.createPaymentRefund).not.toHaveBeenCalled();
    });
    */
  });

  describe("getPaymentSummary", () => {
    it("should return payment summary", async () => {
      const req = createRequest({
        params: {
          id: "10"
        }
      });

      const res = createResponse();
      const next = createNext();

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

      mockedService.getPaymentSummary.mockResolvedValue(summary);

      await getPaymentSummary(req, res, next);

      expect(mockedService.getPaymentSummary).toHaveBeenCalledWith(10);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement payment summary retrieved successfully.",
        summary
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward summary errors", async () => {
      const req = createRequest({
        params: {
          id: "10"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Summary failed");

      mockedService.getPaymentSummary.mockRejectedValue(error);

      await getPaymentSummary(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });
});
