import { beforeEach, describe, expect, it, vi } from "vitest";

import * as repository from "../client.repository.js";
import * as service from "../client.service.js";

vi.mock("../client.repository.js", () => ({
  findByClientCode: vi.fn(),
  businessTypeExists: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  list: vi.fn(),
  update: vi.fn()
}));

const repositoryMock = vi.mocked(repository);

const client = {
  id: 101,
  clientCode: "TEST-CLIENT-001",
  name: "Test Client",
  displayName: null,
  businessName: null,
  businessTypeId: null,
  businessType: null,
  website: null,
  primaryAddress: null,
  communicationAddress: null,
  contactPerson: null,
  contactNo: null,
  alternateMobile: null,
  email: null,
  alternateEmail: null,
  websiteUrl: null,
  status: "ACTIVE" as const,
  notes: null,
  adCreationHold: false,
  adCreationHoldType: null,
  adCreationHoldReason: null,
  adCreationHoldRemarks: null,
  adCreationHoldAt: null,
  adCreationHoldBy: null,
  adCreationUnholdAt: null,
  adCreationUnholdBy: null,
  adCreationUnholdReason: null,
  createdBy: 1,
  updatedBy: 1,
  createdAt: new Date("2026-09-21T10:00:00.000Z"),
  updatedAt: new Date("2026-09-21T10:00:00.000Z")
};

describe("Advertisement Client Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createClient", () => {
    it("creates a client with trimmed code and name", async () => {
      repositoryMock.findByClientCode.mockResolvedValue(null);
      repositoryMock.create.mockResolvedValue(client);

      const result = await service.createClient(
        {
          clientCode: " TEST-CLIENT-001 ",
          name: " Test Client "
        },
        10
      );

      expect(result).toEqual(client);

      expect(repositoryMock.findByClientCode).toHaveBeenCalledWith(
        "TEST-CLIENT-001"
      );

      expect(repositoryMock.create).toHaveBeenCalledWith(
        {
          clientCode: "TEST-CLIENT-001",
          name: "Test Client"
        },
        10
      );
    });

    it("rejects an empty client code", async () => {
      await expect(
        service.createClient(
          {
            clientCode: "   ",
            name: "Test Client"
          },
          10
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Client code is required."
      });

      expect(repositoryMock.findByClientCode).not.toHaveBeenCalled();
    });

    it("rejects an empty client name", async () => {
      await expect(
        service.createClient(
          {
            clientCode: "TEST-001",
            name: "   "
          },
          10
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Client name is required."
      });

      expect(repositoryMock.findByClientCode).not.toHaveBeenCalled();
    });

    it("rejects duplicate client code", async () => {
      repositoryMock.findByClientCode.mockResolvedValue(client);

      await expect(
        service.createClient(
          {
            clientCode: "TEST-CLIENT-001",
            name: "Test Client"
          },
          10
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Advertisement client code already exists."
      });

      expect(repositoryMock.create).not.toHaveBeenCalled();
    });

    it("validates business type when supplied", async () => {
      repositoryMock.findByClientCode.mockResolvedValue(null);
      repositoryMock.businessTypeExists.mockResolvedValue(true);
      repositoryMock.create.mockResolvedValue(client);

      await service.createClient(
        {
          clientCode: "TEST-001",
          name: "Test Client",
          businessTypeId: 10
        },
        10
      );

      expect(repositoryMock.businessTypeExists).toHaveBeenCalledWith(10);
      expect(repositoryMock.create).toHaveBeenCalled();
    });

    it("rejects an unknown business type", async () => {
      repositoryMock.findByClientCode.mockResolvedValue(null);
      repositoryMock.businessTypeExists.mockResolvedValue(false);

      await expect(
        service.createClient(
          {
            clientCode: "TEST-001",
            name: "Test Client",
            businessTypeId: 999
          },
          10
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement business type not found."
      });

      expect(repositoryMock.create).not.toHaveBeenCalled();
    });
  });

  describe("getClientById", () => {
    it("returns the client when found", async () => {
      repositoryMock.findById.mockResolvedValue(client);

      const result = await service.getClientById(101);

      expect(result).toEqual(client);
      expect(repositoryMock.findById).toHaveBeenCalledWith(101);
    });

    it("throws 404 when client does not exist", async () => {
      repositoryMock.findById.mockResolvedValue(null);

      await expect(service.getClientById(999)).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement client not found."
      });
    });
  });

  describe("getClients", () => {
    it("delegates listing to repository", async () => {
      const result = {
        items: [client],
        total: 1
      };

      repositoryMock.list.mockResolvedValue(result);

      const filters = {
        page: 1,
        pageSize: 20,
        search: "test"
      };

      await expect(service.getClients(filters)).resolves.toEqual(result);

      expect(repositoryMock.list).toHaveBeenCalledWith(filters);
    });
  });

  describe("updateClient", () => {
    it("updates the client", async () => {
      repositoryMock.findById.mockResolvedValue(client);
      repositoryMock.update.mockResolvedValue({
        ...client,
        name: "Updated Client"
      });

      const result = await service.updateClient(
        101,
        {
          name: "Updated Client"
        },
        20
      );

      expect(result.name).toBe("Updated Client");
      expect(repositoryMock.update).toHaveBeenCalledWith(
        101,
        {
          name: "Updated Client"
        },
        20
      );
    });

    it("throws 404 when the existing client is not found", async () => {
      repositoryMock.findById.mockResolvedValue(null);

      await expect(
        service.updateClient(999, { name: "Updated" }, 20)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement client not found."
      });

      expect(repositoryMock.update).not.toHaveBeenCalled();
    });

    it("validates supplied business type", async () => {
      repositoryMock.findById.mockResolvedValue(client);
      repositoryMock.businessTypeExists.mockResolvedValue(false);

      await expect(
        service.updateClient(
          101,
          {
            businessTypeId: 999
          },
          20
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement business type not found."
      });

      expect(repositoryMock.update).not.toHaveBeenCalled();
    });

    it("rejects an empty name", async () => {
      repositoryMock.findById.mockResolvedValue(client);

      await expect(
        service.updateClient(
          101,
          {
            name: "   "
          },
          20
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Client name cannot be empty."
      });

      expect(repositoryMock.update).not.toHaveBeenCalled();
    });

    it("throws 404 when repository update returns null", async () => {
      repositoryMock.findById.mockResolvedValue(client);
      repositoryMock.update.mockResolvedValue(null);

      await expect(
        service.updateClient(
          101,
          {
            name: "Updated"
          },
          20
        )
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Advertisement client not found."
      });
    });
  });
});
