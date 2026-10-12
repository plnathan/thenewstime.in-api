import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  sendPaginated,
  sendSuccess
} from "../../../../../shared/utils/response.js";

import * as financialApprovalService from "../financial-approval.service.js";

import {
  approveFinancialApproval,
  checkFinancialApprovalExists,
  checkFinancialApprovalExistsForAdvertisement,
  createFinancialApproval,
  getFinancialApprovalById,
  getFinancialApprovalHistory,
  getFinancialApprovals,
  getLatestFinancialApprovalByAdvertisementId,
  getPendingFinancialApprovalByAdvertisementId,
  getPendingFinancialApprovalByPaymentId,
  holdFinancialApproval,
  rejectFinancialApproval,
  resubmitFinancialApproval,
  updateFinancialApprovalRemarks
} from "../financial-approval.controller.js";

vi.mock("../financial-approval.service.js", () => ({
  create: vi.fn(),
  getById: vi.fn(),
  updateApprovalRemarks: vi.fn(),
  hold: vi.fn(),
  reject: vi.fn(),
  approve: vi.fn(),
  resubmit: vi.fn(),
  getHistory: vi.fn(),
  list: vi.fn(),
  exists: vi.fn(),
  existsForAdvertisement: vi.fn(),
  getLatestByAdvertisementId: vi.fn(),
  getPendingByAdvertisementId: vi.fn(),
  getPendingByPaymentId: vi.fn()
}));

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: vi.fn(),
  sendPaginated: vi.fn()
}));

const mockedService = vi.mocked(financialApprovalService);
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

function createFinancialApprovalFixture() {
  return {
    id: 100,
    advertisementId: 10,
    clientId: 20,
    paymentId: 50,
    approvalType: "DISCOUNT" as const,
    requestedAmount: 5000,
    requestedPercentage: 10,
    status: "SUBMITTED" as const,
    requestedBy: 5,
    requestedAt: new Date("2026-09-23T10:00:00.000Z"),
    reviewedBy: null,
    reviewedAt: null,
    holdReason: null,
    rejectionReason: null,
    approvalRemarks: "Discount approval requested",
    approvedAmount: null,
    approvedPercentage: null,
    createdAt: new Date("2026-09-23T10:00:00.000Z"),
    updatedAt: new Date("2026-09-23T10:00:00.000Z")
  };
}

function createFinancialApprovalHistoryFixture() {
  return [
    {
      id: 1,
      approvalId: 100,
      fromStatus: null,
      toStatus: "SUBMITTED" as const,
      actionBy: 5,
      actionAt: new Date("2026-09-23T10:00:00.000Z"),
      remarks: "Approval requested",
      holdReason: null,
      rejectionReason: null
    },
    {
      id: 2,
      approvalId: 100,
      fromStatus: "SUBMITTED" as const,
      toStatus: "APPROVED" as const,
      actionBy: 7,
      actionAt: new Date("2026-09-23T11:00:00.000Z"),
      remarks: "Approved",
      holdReason: null,
      rejectionReason: null
    }
  ];
}

describe("Advertisement Financial Approval Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createFinancialApproval", () => {
    it("should create a financial approval successfully", async () => {
      const req = createRequest({
        body: {
          advertisementId: 10,
          clientId: 20,
          paymentId: 50,
          approvalType: "DISCOUNT",
          requestedAmount: 5000,
          requestedPercentage: 10,
          approvalRemarks: "Discount approval requested"
        }
      });

      const res = createResponse();
      const next = createNext();

      const approval = createFinancialApprovalFixture();

      mockedService.create.mockResolvedValue(approval);

      await createFinancialApproval(req, res, next);

      expect(mockedService.create).toHaveBeenCalledWith(req.body, 5);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval created successfully.",
        approval,
        201
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        body: {
          advertisementId: 10,
          clientId: 20,
          approvalType: "DISCOUNT",
          requestedAmount: 5000
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Creation failed");

      mockedService.create.mockRejectedValue(error);

      await createFinancialApproval(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("getFinancialApprovalById", () => {
    it("should return a financial approval", async () => {
      const req = createRequest({
        params: {
          id: "100"
        }
      });

      const res = createResponse();
      const next = createNext();

      const approval = createFinancialApprovalFixture();

      mockedService.getById.mockResolvedValue(approval);

      await getFinancialApprovalById(req, res, next);

      expect(mockedService.getById).toHaveBeenCalledWith(100);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval retrieved successfully.",
        approval
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
      const error = new Error("Financial approval not found");

      mockedService.getById.mockRejectedValue(error);

      await getFinancialApprovalById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("updateFinancialApprovalRemarks", () => {
    it("should update financial approval remarks", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          approvalRemarks: "Updated approval remarks"
        }
      });

      const res = createResponse();
      const next = createNext();

      const approval = createFinancialApprovalFixture();

      mockedService.updateApprovalRemarks.mockResolvedValue(approval);

      await updateFinancialApprovalRemarks(req, res, next);

      expect(
        mockedService.updateApprovalRemarks
      ).toHaveBeenCalledWith(100, "Updated approval remarks");

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval remarks updated successfully.",
        approval
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should pass null when approval remarks are not provided", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {}
      });

      const res = createResponse();
      const next = createNext();

      const approval = createFinancialApprovalFixture();

      mockedService.updateApprovalRemarks.mockResolvedValue(approval);

      await updateFinancialApprovalRemarks(req, res, next);

      expect(
        mockedService.updateApprovalRemarks
      ).toHaveBeenCalledWith(100, null);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval remarks updated successfully.",
        approval
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          approvalRemarks: "Updated remarks"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Remarks update failed");

      mockedService.updateApprovalRemarks.mockRejectedValue(error);

      await updateFinancialApprovalRemarks(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("holdFinancialApproval", () => {
    it("should place a financial approval on hold", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          holdReason: "Payment verification pending"
        }
      });

      const res = createResponse();
      const next = createNext();

      const approval = {
        ...createFinancialApprovalFixture(),
        status: "HOLD" as const,
        reviewedBy: 5,
        reviewedAt: new Date("2026-09-23T11:00:00.000Z"),
        holdReason: "Payment verification pending"
      };

      mockedService.hold.mockResolvedValue(approval);

      await holdFinancialApproval(req, res, next);

      expect(mockedService.hold).toHaveBeenCalledWith(
        100,
        req.body,
        5
      );

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval placed on hold successfully.",
        approval
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          holdReason: "Payment verification pending"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Hold failed");

      mockedService.hold.mockRejectedValue(error);

      await holdFinancialApproval(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("rejectFinancialApproval", () => {
    it("should reject a financial approval", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          rejectionReason: "Requested discount is not acceptable"
        }
      });

      const res = createResponse();
      const next = createNext();

      const approval = {
        ...createFinancialApprovalFixture(),
        status: "REJECTED" as const,
        reviewedBy: 5,
        reviewedAt: new Date("2026-09-23T11:00:00.000Z"),
        rejectionReason: "Requested discount is not acceptable"
      };

      mockedService.reject.mockResolvedValue(approval);

      await rejectFinancialApproval(req, res, next);

      expect(mockedService.reject).toHaveBeenCalledWith(
        100,
        req.body,
        5
      );

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval rejected successfully.",
        approval
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          rejectionReason: "Rejected"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Rejection failed");

      mockedService.reject.mockRejectedValue(error);

      await rejectFinancialApproval(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("approveFinancialApproval", () => {
    it("should approve a financial approval", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          approvalRemarks: "Approved after financial verification"
        }
      });

      const res = createResponse();
      const next = createNext();

      const approval = {
        ...createFinancialApprovalFixture(),
        status: "APPROVED" as const,
        reviewedBy: 5,
        reviewedAt: new Date("2026-09-23T11:00:00.000Z"),
        approvalRemarks: "Approved after financial verification"
      };

      mockedService.approve.mockResolvedValue(approval);

      await approveFinancialApproval(req, res, next);

      expect(mockedService.approve).toHaveBeenCalledWith(
        100,
        req.body,
        5
      );

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval approved successfully.",
        approval
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          approvalRemarks: "Approved"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Approval failed");

      mockedService.approve.mockRejectedValue(error);

      await approveFinancialApproval(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("resubmitFinancialApproval", () => {
    it("should resubmit a financial approval", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          approvalRemarks: "Resubmitted after correcting the request"
        }
      });

      const res = createResponse();
      const next = createNext();

      const approval = {
        ...createFinancialApprovalFixture(),
        status: "SUBMITTED" as const,
        requestedBy: 5,
        requestedAt: new Date("2026-09-23T12:00:00.000Z"),
        approvalRemarks: "Resubmitted after correcting the request"
      };

      mockedService.resubmit.mockResolvedValue(approval);

      await resubmitFinancialApproval(req, res, next);

      expect(mockedService.resubmit).toHaveBeenCalledWith(
        100,
        req.body,
        5
      );

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval resubmitted successfully.",
        approval
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          approvalRemarks: "Resubmit"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Resubmission failed");

      mockedService.resubmit.mockRejectedValue(error);

      await resubmitFinancialApproval(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("getFinancialApprovalHistory", () => {
    it("should return financial approval history", async () => {
      const req = createRequest({
        params: {
          id: "100"
        }
      });

      const res = createResponse();
      const next = createNext();

      const history = createFinancialApprovalHistoryFixture();

      mockedService.getHistory.mockResolvedValue(history);

      await getFinancialApprovalHistory(req, res, next);

      expect(mockedService.getHistory).toHaveBeenCalledWith(100);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval history retrieved successfully.",
        history
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
      const error = new Error("History retrieval failed");

      mockedService.getHistory.mockRejectedValue(error);

      await getFinancialApprovalHistory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("getFinancialApprovals", () => {
    it("should return filtered paginated financial approvals", async () => {
      const req = createRequest({
        query: {
          page: "2",
          pageSize: "10",
          advertisementId: "10",
          clientId: "20",
          paymentId: "50",
          approvalType: "DISCOUNT",
          status: "SUBMITTED",
          requestedBy: "5",
          reviewedBy: "7"
        }
      });

      const res = createResponse();
      const next = createNext();

      const approval = createFinancialApprovalFixture();

      const result = {
        items: [approval],
        total: 1
      };

      mockedService.list.mockResolvedValue(result);

      await getFinancialApprovals(req, res, next);

      expect(mockedService.list).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10,
        advertisementId: 10,
        clientId: 20,
        paymentId: 50,
        approvalType: "DISCOUNT",
        status: "SUBMITTED",
        requestedBy: 5,
        reviewedBy: 7
      });

      expect(mockedSendPaginated).toHaveBeenCalledWith(
        res,
        "Financial approvals retrieved successfully.",
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
        total: 0
      };

      mockedService.list.mockResolvedValue(result);

      await getFinancialApprovals(req, res, next);

      expect(mockedService.list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20
      });

      expect(mockedSendPaginated).toHaveBeenCalledWith(
        res,
        "Financial approvals retrieved successfully.",
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

    it("should handle multiple pages correctly", async () => {
      const req = createRequest({
        query: {
          page: "2",
          pageSize: "10"
        }
      });

      const res = createResponse();
      const next = createNext();

      const result = {
        items: [createFinancialApprovalFixture()],
        total: 25
      };

      mockedService.list.mockResolvedValue(result);

      await getFinancialApprovals(req, res, next);

      expect(mockedService.list).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10
      });

      expect(mockedSendPaginated).toHaveBeenCalledWith(
        res,
        "Financial approvals retrieved successfully.",
        result.items,
        {
          page: 2,
          pageSize: 10,
          totalRecords: 25,
          totalPages: 3,
          hasPrevious: true,
          hasNext: true
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

      mockedService.list.mockRejectedValue(error);

      await getFinancialApprovals(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendPaginated).not.toHaveBeenCalled();
    });
  });

  describe("checkFinancialApprovalExists", () => {
    it("should return true when financial approval exists", async () => {
      const req = createRequest({
        params: {
          id: "100"
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.exists.mockResolvedValue(true);

      await checkFinancialApprovalExists(req, res, next);

      expect(mockedService.exists).toHaveBeenCalledWith(100);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval existence checked successfully.",
        {
          exists: true
        }
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should return false when financial approval does not exist", async () => {
      const req = createRequest({
        params: {
          id: "999"
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.exists.mockResolvedValue(false);

      await checkFinancialApprovalExists(req, res, next);

      expect(mockedService.exists).toHaveBeenCalledWith(999);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval existence checked successfully.",
        {
          exists: false
        }
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
      const error = new Error("Existence check failed");

      mockedService.exists.mockRejectedValue(error);

      await checkFinancialApprovalExists(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("checkFinancialApprovalExistsForAdvertisement", () => {
    it("should return true when an approval exists for an advertisement", async () => {
      const req = createRequest({
        params: {
          advertisementId: "10"
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.existsForAdvertisement.mockResolvedValue(true);

      await checkFinancialApprovalExistsForAdvertisement(req, res, next);

      expect(
        mockedService.existsForAdvertisement
      ).toHaveBeenCalledWith(10);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement financial approval existence checked successfully.",
        {
          exists: true
        }
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should return false when no approval exists for an advertisement", async () => {
      const req = createRequest({
        params: {
          advertisementId: "999"
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.existsForAdvertisement.mockResolvedValue(false);

      await checkFinancialApprovalExistsForAdvertisement(req, res, next);

      expect(
        mockedService.existsForAdvertisement
      ).toHaveBeenCalledWith(999);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement financial approval existence checked successfully.",
        {
          exists: false
        }
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        params: {
          advertisementId: "10"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Advertisement existence check failed");

      mockedService.existsForAdvertisement.mockRejectedValue(error);

      await checkFinancialApprovalExistsForAdvertisement(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("getLatestFinancialApprovalByAdvertisementId", () => {
    it("should return the latest financial approval", async () => {
      const req = createRequest({
        params: {
          advertisementId: "10"
        }
      });

      const res = createResponse();
      const next = createNext();

      const approval = createFinancialApprovalFixture();

      mockedService.getLatestByAdvertisementId.mockResolvedValue(approval);

      await getLatestFinancialApprovalByAdvertisementId(req, res, next);

      expect(
        mockedService.getLatestByAdvertisementId
      ).toHaveBeenCalledWith(10);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Latest financial approval retrieved successfully.",
        approval
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should return null when no latest approval exists", async () => {
      const req = createRequest({
        params: {
          advertisementId: "999"
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.getLatestByAdvertisementId.mockResolvedValue(null);

      await getLatestFinancialApprovalByAdvertisementId(req, res, next);

      expect(
        mockedService.getLatestByAdvertisementId
      ).toHaveBeenCalledWith(999);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Latest financial approval retrieved successfully.",
        null
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        params: {
          advertisementId: "10"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Latest approval retrieval failed");

      mockedService.getLatestByAdvertisementId.mockRejectedValue(error);

      await getLatestFinancialApprovalByAdvertisementId(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("getPendingFinancialApprovalByAdvertisementId", () => {
    it("should return the pending financial approval", async () => {
      const req = createRequest({
        params: {
          advertisementId: "10"
        }
      });

      const res = createResponse();
      const next = createNext();

      const approval = {
        ...createFinancialApprovalFixture(),
        status: "HOLD" as const,
        holdReason: "Payment verification pending"
      };

      mockedService.getPendingByAdvertisementId.mockResolvedValue(approval);

      await getPendingFinancialApprovalByAdvertisementId(req, res, next);

      expect(
        mockedService.getPendingByAdvertisementId
      ).toHaveBeenCalledWith(10);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Pending financial approval retrieved successfully.",
        approval
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should return null when no pending approval exists", async () => {
      const req = createRequest({
        params: {
          advertisementId: "999"
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.getPendingByAdvertisementId.mockResolvedValue(null);

      await getPendingFinancialApprovalByAdvertisementId(req, res, next);

      expect(
        mockedService.getPendingByAdvertisementId
      ).toHaveBeenCalledWith(999);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Pending financial approval retrieved successfully.",
        null
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        params: {
          advertisementId: "10"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Pending approval retrieval failed");

      mockedService.getPendingByAdvertisementId.mockRejectedValue(error);

      await getPendingFinancialApprovalByAdvertisementId(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("getPendingFinancialApprovalByPaymentId", () => {
    it("should return the pending financial approval for a payment", async () => {
      const req = createRequest({
        params: {
          paymentId: "50"
        }
      });

      const res = createResponse();
      const next = createNext();

      const approval = {
        ...createFinancialApprovalFixture(),
        status: "SUBMITTED" as const
      };

      mockedService.getPendingByPaymentId.mockResolvedValue(approval);

      await getPendingFinancialApprovalByPaymentId(req, res, next);

      expect(
        mockedService.getPendingByPaymentId
      ).toHaveBeenCalledWith(50);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Pending financial approval for payment retrieved successfully.",
        approval
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should return null when no pending approval exists for a payment", async () => {
      const req = createRequest({
        params: {
          paymentId: "999"
        }
      });

      const res = createResponse();
      const next = createNext();

      mockedService.getPendingByPaymentId.mockResolvedValue(null);

      await getPendingFinancialApprovalByPaymentId(req, res, next);

      expect(
        mockedService.getPendingByPaymentId
      ).toHaveBeenCalledWith(999);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Pending financial approval for payment retrieved successfully.",
        null
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        params: {
          paymentId: "50"
        }
      });

      const res = createResponse();
      const next = createNext();
      const error = new Error("Pending payment approval retrieval failed");

      mockedService.getPendingByPaymentId.mockRejectedValue(error);

      await getPendingFinancialApprovalByPaymentId(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });
});
;
