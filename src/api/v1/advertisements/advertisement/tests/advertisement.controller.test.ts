import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateAdvertisement,
  mockGetAdvertisementById,
  mockGetAdvertisements,
  mockUpdateAdvertisement,
  mockActivateAdvertisement,
  mockSendSuccess,
  mockSendPaginated
} = vi.hoisted(() => ({
  mockCreateAdvertisement: vi.fn(),
  mockGetAdvertisementById: vi.fn(),
  mockGetAdvertisements: vi.fn(),
  mockUpdateAdvertisement: vi.fn(),
  mockActivateAdvertisement: vi.fn(),
  mockSendSuccess: vi.fn(),
  mockSendPaginated: vi.fn()
}));

vi.mock("../advertisement.service.js", () => ({
  createAdvertisement: mockCreateAdvertisement,
  getAdvertisementById: mockGetAdvertisementById,
  getAdvertisements: mockGetAdvertisements,
  updateAdvertisement: mockUpdateAdvertisement,
  activateAdvertisement: mockActivateAdvertisement
}));

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: mockSendSuccess,
  sendPaginated: mockSendPaginated
}));

import type { NextFunction, Request, Response } from "express";

import {
  activateAdvertisement,
  createAdvertisement,
  getAdvertisementById,
  getAdvertisements,
  updateAdvertisement
} from "../advertisement.controller.js";

describe("advertisement.controller", () => {
  const createRequest = (overrides: Partial<Request> = {}) =>
    ({
      body: {},
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

  describe("createAdvertisement", () => {
    it("should create an advertisement and send a success response", async () => {
      const req = createRequest({
        body: {
          clientId: 10,
          isHouseAd: false,
          name: "Test Advertisement",
          advertisementAmount: 15000,
          discountPercentage: 0,
          advancePercentage: 0,
          currencyCode: "INR"
        }
      });

      const res = createResponse();
      const next = createNext();

      const advertisement = {
        id: 1,
        clientId: 10,
        isHouseAd: false,
        name: "Test Advertisement",
        advertisementAmount: 15000,
        discountPercentage: 0,
        discountAmount: 0,
        advancePercentage: 0,
        advanceAmount: 0,
        currencyCode: "INR"
      };

      mockCreateAdvertisement.mockResolvedValue(advertisement);

      await createAdvertisement(req, res, next);

      expect(mockCreateAdvertisement).toHaveBeenCalledWith(
        req.body,
        req.user.id
      );

      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement created successfully.",
        advertisement,
        201
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next", async () => {
      const req = createRequest({
        body: {
          clientId: 10,
          isHouseAd: false,
          name: "Test Advertisement",
          advertisementAmount: 15000
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Create failed");

      mockCreateAdvertisement.mockRejectedValue(error);

      await createAdvertisement(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("getAdvertisementById", () => {
    it("should retrieve an advertisement and send a success response", async () => {
      const req = createRequest({
        params: {
          id: "25"
        }
      });

      const res = createResponse();
      const next = createNext();

      const advertisement = {
        id: 25,
        clientId: 10,
        isHouseAd: false,
        name: "Test Advertisement"
      };

      mockGetAdvertisementById.mockResolvedValue(advertisement);

      await getAdvertisementById(req, res, next);

      expect(mockGetAdvertisementById).toHaveBeenCalledWith(25);

      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement retrieved successfully.",
        advertisement
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

      const error = new Error("Advertisement not found");

      mockGetAdvertisementById.mockRejectedValue(error);

      await getAdvertisementById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("getAdvertisements", () => {
    it("should use default pagination values", async () => {
      const req = createRequest({
        query: {}
      });

      const res = createResponse();
      const next = createNext();

      const result = {
        items: [
          {
            id: 1,
            advertiserId: 10,
            clientId: 20,
            clientName: "Test Client",
            clientCode: "CLI001",
            name: "Test Advertisement",
            advertisementType: "DISPLAY",
            priority: 0,
            status: "DRAFT",
            workflowStatus: "DRAFT",
            startAt: null,
            endAt: null,
            advertisementAmount: null,
            discountPercentage: 0,
            discountAmount: 0,
            advancePercentage: 0,
            advanceAmount: 0,
            adjustmentAmount: 0,
            currencyCode: "INR",
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        total: 1
      };

      mockGetAdvertisements.mockResolvedValue(result);

      await getAdvertisements(req, res, next);

      expect(mockGetAdvertisements).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20
      });

      expect(mockSendPaginated).toHaveBeenCalledWith(
        res,
        "Advertisements retrieved successfully.",
        result.items,
        {
          page: 1,
          pageSize: 20,
          totalRecords: 1,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false
        }
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should pass all supported filters to the service", async () => {
      const req = createRequest({
        query: {
          page: "2",
          pageSize: "10",
          search: "school",
          clientId: "25",
          workflowStatus: "SUBMITTED",
          status: "ACTIVE"
        }
      });

      const res = createResponse();
      const next = createNext();

      const result = {
        items: [],
        total: 15
      };

      mockGetAdvertisements.mockResolvedValue(result);

      await getAdvertisements(req, res, next);

      expect(mockGetAdvertisements).toHaveBeenCalledWith({
        page: 2,
        pageSize: 10,
        search: "school",
        clientId: 25,
        workflowStatus: "SUBMITTED",
        status: "ACTIVE"
      });

      expect(mockSendPaginated).toHaveBeenCalledWith(
        res,
        "Advertisements retrieved successfully.",
        [],
        {
          page: 2,
          pageSize: 10,
          totalRecords: 15,
          totalPages: 2,
          hasPrevious: true,
          hasNext: false
        }
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should correctly calculate pagination for a later page", async () => {
      const req = createRequest({
        query: {
          page: "3",
          pageSize: "10"
        }
      });

      const res = createResponse();
      const next = createNext();

      const result = {
        items: [],
        total: 25
      };

      mockGetAdvertisements.mockResolvedValue(result);

      await getAdvertisements(req, res, next);

      expect(mockSendPaginated).toHaveBeenCalledWith(
        res,
        "Advertisements retrieved successfully.",
        [],
        {
          page: 3,
          pageSize: 10,
          totalRecords: 25,
          totalPages: 3,
          hasPrevious: true,
          hasNext: false
        }
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next", async () => {
      const req = createRequest({
        query: {}
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("List failed");

      mockGetAdvertisements.mockRejectedValue(error);

      await getAdvertisements(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockSendPaginated).not.toHaveBeenCalled();
    });
  });

  describe("updateAdvertisement", () => {
    it("should update an advertisement and send a success response", async () => {
      const req = createRequest({
        params: {
          id: "50"
        },
        body: {
          name: "Updated Advertisement",
          advertisementAmount: 18000
        }
      });

      const res = createResponse();
      const next = createNext();

      const advertisement = {
        id: 50,
        name: "Updated Advertisement",
        advertisementAmount: 18000
      };

      mockUpdateAdvertisement.mockResolvedValue(advertisement);

      await updateAdvertisement(req, res, next);

      expect(mockUpdateAdvertisement).toHaveBeenCalledWith(
        50,
        req.body,
        req.user.id
      );

      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement updated successfully.",
        advertisement
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next", async () => {
      const req = createRequest({
        params: {
          id: "50"
        },
        body: {
          name: "Updated Advertisement"
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Update failed");

      mockUpdateAdvertisement.mockRejectedValue(error);

      await updateAdvertisement(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("activateAdvertisement", () => {
    it("should activate an archived advertisement and send a success response", async () => {
      const req = createRequest({
        params: {
          id: "75"
        },
        body: {
          remarks: "Reactivating archived advertisement for reuse."
        }
      });

      const res = createResponse();
      const next = createNext();

      const result = {
        advertisement: {
          id: 75,
          name: "Archived Advertisement",
          workflowStatus: "DRAFT",
          status: "DRAFT"
        },
        history: {
          id: 10,
          advertisementId: 75,
          fromStatus: "ARCHIVED",
          toStatus: "DRAFT"
        }
      };

      mockActivateAdvertisement.mockResolvedValue(result);

      await activateAdvertisement(req, res, next);

      expect(mockActivateAdvertisement).toHaveBeenCalledWith(
        75,
        req.user.id,
        req.body
      );

      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement activated successfully.",
        result
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next", async () => {
      const req = createRequest({
        params: {
          id: "75"
        },
        body: {
          remarks: "Activation attempt."
        }
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Activation failed");

      mockActivateAdvertisement.mockRejectedValue(error);

      await activateAdvertisement(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });
  });
});

