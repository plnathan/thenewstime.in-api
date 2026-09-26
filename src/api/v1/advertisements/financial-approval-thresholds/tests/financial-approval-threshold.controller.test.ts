import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  activate,
  create,
  deactivate,
  getAll,
  getById,
  update
} from "../financial-approval-threshold.controller.js";
import * as service from "../financial-approval-threshold.service.js";

import {
  sendPaginated,
  sendSuccess
} from "../../../../../shared/utils/response.js";

vi.mock("../financial-approval-threshold.service.js", () => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  activate: vi.fn(),
  deactivate: vi.fn()
}));

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: vi.fn(),
  sendPaginated: vi.fn()
}));

const mockedService = vi.mocked(service);
const mockedSendSuccess = vi.mocked(sendSuccess);
const mockedSendPaginated = vi.mocked(sendPaginated);

type RequestOverrides = Omit<Partial<Request>, "user"> & {
  user?: Request["user"] | undefined;
};

const createResponse = (): Response => {
  return {} as Response;
};

const createNext = (): NextFunction => {
  return vi.fn() as NextFunction;
};

const createRequest = (overrides: RequestOverrides = {}): Request => {
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
};

const createThresholdFixture = () => ({
  id: 100,
  approvalType: "DISCOUNT" as const,
  amountThreshold: 5000,
  percentageThreshold: null,
  status: "ACTIVE" as const,
  createdBy: 5,
  updatedBy: 5,
  createdAt: new Date("2026-09-24T10:00:00.000Z"),
  updatedAt: new Date("2026-09-24T10:00:00.000Z")
});

describe("Financial Approval Threshold Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAll", () => {
    it("should return paginated thresholds", async () => {
      const req = createRequest({
        query: {
          approvalType: "DISCOUNT",
          status: "ACTIVE",
          page: "2",
          pageSize: "1"
        }
      });

      const res = createResponse();
      const next = createNext();

      const thresholds = [
        createThresholdFixture(),
        {
          ...createThresholdFixture(),
          id: 101,
          approvalType: "REFUND" as const,
          amountThreshold: 2500
        },
        {
          ...createThresholdFixture(),
          id: 102,
          approvalType: "ADJUSTMENT" as const,
          amountThreshold: 1000
        }
      ];

      mockedService.list.mockResolvedValue(thresholds);

      await getAll(req, res, next);

      expect(mockedService.list).toHaveBeenCalledWith({
        approvalType: "DISCOUNT",
        status: "ACTIVE"
      });

      expect(mockedSendPaginated).toHaveBeenCalledWith(
        res,
        "Financial approval thresholds retrieved successfully.",
        [thresholds[1]],
        {
          page: 2,
          pageSize: 1,
          totalRecords: 3,
          totalPages: 3,
          hasPrevious: true,
          hasNext: true
        }
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should use default pagination values", async () => {
      const req = createRequest();

      const res = createResponse();
      const next = createNext();

      const thresholds = [
        createThresholdFixture(),
        {
          ...createThresholdFixture(),
          id: 101
        }
      ];

      mockedService.list.mockResolvedValue(thresholds);

      await getAll(req, res, next);

      expect(mockedService.list).toHaveBeenCalledWith({
        approvalType: undefined,
        status: undefined
      });

      expect(mockedSendPaginated).toHaveBeenCalledWith(
        res,
        "Financial approval thresholds retrieved successfully.",
        thresholds,
        {
          page: 1,
          pageSize: 20,
          totalRecords: 2,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false
        }
      );
    });

    it("should normalize invalid pagination values", async () => {
      const req = createRequest({
        query: {
          page: "0",
          pageSize: "-5"
        }
      });

      const res = createResponse();
      const next = createNext();

      const thresholds = [createThresholdFixture()];

      mockedService.list.mockResolvedValue(thresholds);

      await getAll(req, res, next);

      expect(mockedSendPaginated).toHaveBeenCalledWith(
        res,
        "Financial approval thresholds retrieved successfully.",
        thresholds,
        {
          page: 1,
          pageSize: 20,
          totalRecords: 1,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false
        }
      );
    });

    it("should return an empty paginated result", async () => {
      const req = createRequest();

      const res = createResponse();
      const next = createNext();

      mockedService.list.mockResolvedValue([]);

      await getAll(req, res, next);

      expect(mockedSendPaginated).toHaveBeenCalledWith(
        res,
        "Financial approval thresholds retrieved successfully.",
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
    });

    it("should forward service errors", async () => {
      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      const error = new Error("Threshold list failed");

      mockedService.list.mockRejectedValue(error);

      await getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendPaginated).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("should return a threshold by id", async () => {
      const req = createRequest({
        params: {
          id: "100"
        }
      });

      const res = createResponse();
      const next = createNext();

      const threshold = createThresholdFixture();

      mockedService.getById.mockResolvedValue(threshold);

      await getById(req, res, next);

      expect(mockedService.getById).toHaveBeenCalledWith(100);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval threshold retrieved successfully.",
        threshold
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

      const error = new Error("Threshold not found");

      mockedService.getById.mockRejectedValue(error);

      await getById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("should create a threshold successfully", async () => {
      const req = createRequest({
        body: {
          approvalType: "DISCOUNT",
          amountThreshold: 5000
        }
      });

      const res = createResponse();
      const next = createNext();

      const threshold = createThresholdFixture();

      mockedService.create.mockResolvedValue(threshold);

      await create(req, res, next);

      expect(mockedService.create).toHaveBeenCalledWith(req.body, 5);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval threshold created successfully.",
        threshold,
        201
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        body: {
          approvalType: "DISCOUNT",
          amountThreshold: 5000
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Threshold creation failed");

      mockedService.create.mockRejectedValue(error);

      await create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });

    it("should forward an authentication error when user id is missing", async () => {
      const req = createRequest({
        user: undefined
      });

      const res = createResponse();
      const next = createNext();

      await create(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Authenticated user ID is required."
        })
      );

      expect(mockedService.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update a threshold successfully", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          amountThreshold: 7500
        }
      });

      const res = createResponse();
      const next = createNext();

      const threshold = {
        ...createThresholdFixture(),
        amountThreshold: 7500
      };

      mockedService.update.mockResolvedValue(threshold);

      await update(req, res, next);

      expect(mockedService.update).toHaveBeenCalledWith(100, req.body, 5);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval threshold updated successfully.",
        threshold
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      const req = createRequest({
        params: {
          id: "100"
        },
        body: {
          amountThreshold: 7500
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Threshold update failed");

      mockedService.update.mockRejectedValue(error);

      await update(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("activate", () => {
    it("should activate a threshold successfully", async () => {
      const req = createRequest({
        params: {
          id: "100"
        }
      });

      const res = createResponse();
      const next = createNext();

      const threshold = {
        ...createThresholdFixture(),
        status: "ACTIVE" as const
      };

      mockedService.activate.mockResolvedValue(threshold);

      await activate(req, res, next);

      expect(mockedService.activate).toHaveBeenCalledWith(100, 5);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval threshold activated successfully.",
        threshold
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

      const error = new Error("Activation failed");

      mockedService.activate.mockRejectedValue(error);

      await activate(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("deactivate", () => {
    it("should deactivate a threshold successfully", async () => {
      const req = createRequest({
        params: {
          id: "100"
        }
      });

      const res = createResponse();
      const next = createNext();

      const threshold = {
        ...createThresholdFixture(),
        status: "INACTIVE" as const
      };

      mockedService.deactivate.mockResolvedValue(threshold);

      await deactivate(req, res, next);

      expect(mockedService.deactivate).toHaveBeenCalledWith(100, 5);

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Financial approval threshold deactivated successfully.",
        threshold
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

      const error = new Error("Deactivation failed");

      mockedService.deactivate.mockRejectedValue(error);

      await deactivate(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });
});
