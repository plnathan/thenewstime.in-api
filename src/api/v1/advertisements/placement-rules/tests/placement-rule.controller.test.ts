import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetAll,
  mockGetById,
  mockCreate,
  mockUpdate,
  mockDeactivate,
  mockSendSuccess,
  mockSendPaginated
} = vi.hoisted(() => ({
  mockGetAll: vi.fn(),
  mockGetById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDeactivate: vi.fn(),
  mockSendSuccess: vi.fn(),
  mockSendPaginated: vi.fn()
}));

vi.mock("../placement-rule.service.js", () => ({
  getAll: mockGetAll,
  getById: mockGetById,
  create: mockCreate,
  update: mockUpdate,
  deactivate: mockDeactivate
}));

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: mockSendSuccess,
  sendPaginated: mockSendPaginated
}));

import type { NextFunction, Request, Response } from "express";

import {
  create,
  deactivate,
  getAll,
  getById,
  update
} from "../placement-rule.controller.js";

describe("placement-rule.controller", () => {
  const createRequest = (overrides: Partial<Request> = {}) =>
    ({
      body: {},
      params: {},
      query: {},
      user: {
        id: 101
      },
      ...overrides
    }) as Request;

  const createResponse = () => ({}) as Response;

  const createNext = () => vi.fn() as NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAll", () => {
    it("should retrieve all placement rules and send a paginated response", async () => {
      const req = createRequest({
        query: {}
      });

      const res = createResponse();
      const next = createNext();

      const rules = [
        {
          id: 1,
          advertisementId: 10,
          placementId: 20,
          displayOrder: 0,
          insertionType: "FIXED",
          insertionPosition: null,
          maxImpressions: null,
          status: "ACTIVE"
        }
      ];

      mockGetAll.mockResolvedValueOnce(rules);

      await getAll(req, res, next);

      expect(mockGetAll).toHaveBeenCalledWith({});

      expect(mockSendPaginated).toHaveBeenCalledWith(
        res,
        "Advertisement placement rules retrieved successfully",
        rules,
        {
          page: 1,
          pageSize: 1,
          totalRecords: 1,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false
        }
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should pass supported filters to the service", async () => {
      const req = createRequest({
        query: {
          advertisementId: 10,
          placementId: 20,
          status: "INACTIVE"
        } as unknown as Request["query"]
      });

      const res = createResponse();
      const next = createNext();

      mockGetAll.mockResolvedValueOnce([]);

      await getAll(req, res, next);

      expect(mockGetAll).toHaveBeenCalledWith({
        advertisementId: 10,
        placementId: 20,
        status: "INACTIVE"
      });

      expect(mockSendPaginated).toHaveBeenCalledWith(
        res,
        "Advertisement placement rules retrieved successfully",
        [],
        {
          page: 1,
          pageSize: 0,
          totalRecords: 0,
          totalPages: 0,
          hasPrevious: false,
          hasNext: false
        }
      );
    });

    it("should forward service errors to next", async () => {
      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      const error = new Error("List failed");

      mockGetAll.mockRejectedValueOnce(error);

      await getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockSendPaginated).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("should retrieve a placement rule and send a success response", async () => {
      const req = createRequest({
        params: {
          id: "25"
        }
      });

      const res = createResponse();
      const next = createNext();

      const rule = {
        id: 25,
        advertisementId: 10,
        placementId: 20,
        displayOrder: 0,
        insertionType: "FIXED",
        insertionPosition: null,
        maxImpressions: null,
        status: "ACTIVE"
      };

      mockGetById.mockResolvedValueOnce(rule);

      await getById(req, res, next);

      expect(mockGetById).toHaveBeenCalledWith(25);

      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement placement rule retrieved successfully",
        rule
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next", async () => {
      const req = createRequest({
        params: {
          id: "25"
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Rule not found");

      mockGetById.mockRejectedValueOnce(error);

      await getById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("should create a placement rule and send a success response", async () => {
      const req = createRequest({
        body: {
          advertisementId: 10,
          placementId: 20,
          insertionType: "FIXED"
        }
      });

      const res = createResponse();
      const next = createNext();

      const rule = {
        id: 1,
        advertisementId: 10,
        placementId: 20,
        displayOrder: 0,
        insertionType: "FIXED",
        insertionPosition: null,
        maxImpressions: null,
        status: "ACTIVE"
      };

      mockCreate.mockResolvedValueOnce(rule);

      await create(req, res, next);

      expect(mockCreate).toHaveBeenCalledWith(req.body, req.user?.id);

      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement placement rule created successfully",
        rule,
        201
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next", async () => {
      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      const error = new Error("Create failed");

      mockCreate.mockRejectedValueOnce(error);

      await create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update a placement rule and send a success response", async () => {
      const req = createRequest({
        params: {
          id: "50"
        },
        body: {
          displayOrder: 5
        }
      });

      const res = createResponse();
      const next = createNext();

      const rule = {
        id: 50,
        advertisementId: 10,
        placementId: 20,
        displayOrder: 5,
        insertionType: "FIXED",
        insertionPosition: null,
        maxImpressions: null,
        status: "ACTIVE"
      };

      mockUpdate.mockResolvedValueOnce(rule);

      await update(req, res, next);

      expect(mockUpdate).toHaveBeenCalledWith(50, req.body, req.user?.id);

      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement placement rule updated successfully",
        rule
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next", async () => {
      const req = createRequest({
        params: {
          id: "50"
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Update failed");

      mockUpdate.mockRejectedValueOnce(error);

      await update(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("deactivate", () => {
    it("should deactivate a placement rule and send a success response", async () => {
      const req = createRequest({
        params: {
          id: "75"
        }
      });

      const res = createResponse();
      const next = createNext();

      const rule = {
        id: 75,
        advertisementId: 10,
        placementId: 20,
        displayOrder: 0,
        insertionType: "FIXED",
        insertionPosition: null,
        maxImpressions: null,
        status: "INACTIVE"
      };

      mockDeactivate.mockResolvedValueOnce(rule);

      await deactivate(req, res, next);

      expect(mockDeactivate).toHaveBeenCalledWith(75, req.user?.id);

      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement placement rule deactivated successfully",
        rule
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next", async () => {
      const req = createRequest({
        params: {
          id: "75"
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Deactivate failed");

      mockDeactivate.mockRejectedValueOnce(error);

      await deactivate(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });
});
