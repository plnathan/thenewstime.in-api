import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  sendPaginated,
  sendSuccess
} from "../../../../../shared/utils/response.js";

import * as service from "../client.service.js";
import * as controller from "../client.controller.js";

vi.mock("../client.service.js", () => ({
  createClient: vi.fn(),
  getClientById: vi.fn(),
  getClients: vi.fn(),
  updateClient: vi.fn()
}));

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendPaginated: vi.fn(),
  sendSuccess: vi.fn()
}));

const serviceMock = vi.mocked(service);
const sendSuccessMock = vi.mocked(sendSuccess);
const sendPaginatedMock = vi.mocked(sendPaginated);

const nextMock = vi.fn() as unknown as NextFunction;

const client = {
  id: 101,
  clientCode: "TEST-CLIENT-001",
  name: "Test Client"
};

const createRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    body: {},
    query: {},
    params: {},
    user: {
      id: 10
    },
    ...overrides
  }) as unknown as Request;

const response = {} as Response;

describe("Advertisement Client Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("creates a client and sends 201 response", async () => {
      serviceMock.createClient.mockResolvedValue(client as never);

      const req = createRequest({
        body: {
          clientCode: "TEST-001",
          name: "Test Client"
        }
      });

      await controller.create(req, response, nextMock);

      expect(serviceMock.createClient).toHaveBeenCalledWith(req.body, 10);

      expect(sendSuccessMock).toHaveBeenCalledWith(
        response,
        "Advertisement client created successfully.",
        client,
        201
      );

      expect(nextMock).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("Create failed");

      serviceMock.createClient.mockRejectedValue(error);

      await controller.create(
        createRequest({
          body: {
            clientCode: "TEST-001",
            name: "Test Client"
          }
        }),
        response,
        nextMock
      );

      expect(nextMock).toHaveBeenCalledWith(error);
      expect(sendSuccessMock).not.toHaveBeenCalled();
    });
  });

  describe("getAll", () => {
    it("gets clients with query filters and sends pagination", async () => {
      serviceMock.getClients.mockResolvedValue({
        items: [client as never],
        total: 45
      });

      const req = createRequest({
        query: {
          page: "2",
          pageSize: "20",
          search: "test",
          status: "ACTIVE",
          businessTypeId: "10"
        }
      });

      await controller.getAll(req, response, nextMock);

      expect(serviceMock.getClients).toHaveBeenCalledWith({
        page: 2,
        pageSize: 20,
        search: "test",
        status: "ACTIVE",
        businessTypeId: 10
      });

      expect(sendPaginatedMock).toHaveBeenCalledWith(
        response,
        "Advertisement clients retrieved successfully.",
        [client],
        {
          page: 2,
          pageSize: 20,
          totalRecords: 45,
          totalPages: 3,
          hasPrevious: true,
          hasNext: true
        }
      );
    });

    it("uses default pagination values", async () => {
      serviceMock.getClients.mockResolvedValue({
        items: [],
        total: 0
      });

      const req = createRequest({
        query: {}
      });

      await controller.getAll(req, response, nextMock);

      expect(serviceMock.getClients).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        search: undefined,
        status: undefined,
        businessTypeId: undefined
      });

      expect(sendPaginatedMock).toHaveBeenCalledWith(
        response,
        "Advertisement clients retrieved successfully.",
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

    it("passes service errors to next", async () => {
      const error = new Error("List failed");

      serviceMock.getClients.mockRejectedValue(error);

      await controller.getAll(
        createRequest({
          query: {}
        }),
        response,
        nextMock
      );

      expect(nextMock).toHaveBeenCalledWith(error);
    });
  });

  describe("getById", () => {
    it("gets a client by id", async () => {
      serviceMock.getClientById.mockResolvedValue(client as never);

      await controller.getById(
        createRequest({
          params: {
            id: "101"
          }
        }),
        response,
        nextMock
      );

      expect(serviceMock.getClientById).toHaveBeenCalledWith(101);

      expect(sendSuccessMock).toHaveBeenCalledWith(
        response,
        "Advertisement client retrieved successfully.",
        client
      );
    });

    it("passes service errors to next", async () => {
      const error = new Error("Client not found");

      serviceMock.getClientById.mockRejectedValue(error);

      await controller.getById(
        createRequest({
          params: {
            id: "999"
          }
        }),
        response,
        nextMock
      );

      expect(nextMock).toHaveBeenCalledWith(error);
    });
  });

  describe("update", () => {
    it("updates a client", async () => {
      serviceMock.updateClient.mockResolvedValue(client as never);

      const req = createRequest({
        params: {
          id: "101"
        },
        body: {
          name: "Updated Client"
        }
      });

      await controller.update(req, response, nextMock);

      expect(serviceMock.updateClient).toHaveBeenCalledWith(101, req.body, 10);

      expect(sendSuccessMock).toHaveBeenCalledWith(
        response,
        "Advertisement client updated successfully.",
        client
      );
    });

    it("passes service errors to next", async () => {
      const error = new Error("Update failed");

      serviceMock.updateClient.mockRejectedValue(error);

      await controller.update(
        createRequest({
          params: {
            id: "101"
          },
          body: {
            name: "Updated"
          }
        }),
        response,
        nextMock
      );

      expect(nextMock).toHaveBeenCalledWith(error);
    });
  });
});
