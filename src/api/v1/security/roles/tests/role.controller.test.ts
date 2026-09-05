import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NextFunction, Request, Response } from "express";

import * as service from "../role.service.js";
import * as controller from "../role.controller.js";

import type { Role } from "../role.types.js";

vi.mock("../role.service.js", () => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  getUserRoles: vi.fn(),
  assignUserRole: vi.fn(),
  removeUserRole: vi.fn()
}));

describe("Role Controller", () => {
  const mockRole: Role = {
    id: 101,
    code: "TEST_ROLE",
    displayName: "Test Role",
    description: "Controller test role",
    displayOrder: 100,
    status: "ACTIVE",
    createdBy: 1,
    createdAt: new Date(),
    updatedBy: 1,
    updatedAt: new Date()
  };

  const mockRoleTwo: Role = {
    id: 102,
    code: "TEST_ROLE_TWO",
    displayName: "Test Role Two",
    description: "Second controller test role",
    displayOrder: 200,
    status: "ACTIVE",
    createdBy: 1,
    createdAt: new Date(),
    updatedBy: 1,
    updatedAt: new Date()
  };

  const createInput = {
    code: "TEST_ROLE",
    displayName: "Test Role",
    description: "Controller test role",
    displayOrder: 100
  };

  const updateInput = {
    displayName: "Updated Test Role",
    description: "Updated description",
    displayOrder: 150,
    status: "ACTIVE" as const
  };

  /*
   * --------------------------------------------------------------------------
   * Request helper
   * --------------------------------------------------------------------------
   *
   * AuthenticatedUser requires:
   *   id
   *   username
   *   roles
   *
   * Keep the helper strongly typed through Request.
   */

  const createRequest = (overrides: Partial<Request> = {}): Request =>
    ({
      body: {},
      params: {},
      user: {
        id: 1,
        username: "controller_test_user",
        roles: []
      },
      ...overrides
    }) as Request;

  /*
   * --------------------------------------------------------------------------
   * Response helper
   * --------------------------------------------------------------------------
   */

  const createResponse = (): Response => {
    const response = {
      status: vi.fn(),
      json: vi.fn()
    };

    response.status.mockReturnValue(response);

    return response as unknown as Response;
  };

  const createNext = (): NextFunction => vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /*
   * ==========================================================================
   * getAll()
   * ==========================================================================
   */

  describe("getAll()", () => {
    it("should retrieve all roles and send success response", async () => {
      vi.mocked(service.getAll).mockResolvedValue([mockRole, mockRoleTwo]);

      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      await controller.getAll(req, res, next);

      expect(service.getAll).toHaveBeenCalledTimes(1);
      expect(service.getAll).toHaveBeenCalledWith();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledTimes(1);

      expect(next).not.toHaveBeenCalled();
    });

    it("should return an empty array when no roles exist", async () => {
      vi.mocked(service.getAll).mockResolvedValue([]);

      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      await controller.getAll(req, res, next);

      expect(service.getAll).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledTimes(1);

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next()", async () => {
      const error = new Error("Failed to retrieve roles.");

      vi.mocked(service.getAll).mockRejectedValue(error);

      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      await controller.getAll(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  /*
   * ==========================================================================
   * getById()
   * ==========================================================================
   */

  describe("getById()", () => {
    it("should retrieve a role by ID", async () => {
      vi.mocked(service.getById).mockResolvedValue(mockRole);

      const req = createRequest({
        params: {
          id: "101"
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.getById(req, res, next);

      expect(service.getById).toHaveBeenCalledTimes(1);
      expect(service.getById).toHaveBeenCalledWith(101);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledTimes(1);

      expect(next).not.toHaveBeenCalled();
    });

    it("should convert the route parameter ID from string to number", async () => {
      vi.mocked(service.getById).mockResolvedValue(mockRole);

      const req = createRequest({
        params: {
          id: "999"
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.getById(req, res, next);

      expect(service.getById).toHaveBeenCalledTimes(1);

      const calls = vi.mocked(service.getById).mock.calls;
      expect(calls).toHaveLength(1);

      const calledId = calls[0]![0];

      expect(calledId).toBe(999);
      expect(typeof calledId).toBe("number");
    });

    it("should forward service errors to next()", async () => {
      const error = new Error("Role not found.");

      vi.mocked(service.getById).mockRejectedValue(error);

      const req = createRequest({
        params: {
          id: "999999"
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.getById(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  /*
   * ==========================================================================
   * create()
   * ==========================================================================
   */

  describe("create()", () => {
    it("should create a role using request body and authenticated user ID", async () => {
      vi.mocked(service.create).mockResolvedValue(mockRole);

      const req = createRequest({
        body: createInput,
        user: {
          id: 25,
          username: "create_test_user",
          roles: []
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.create(req, res, next);

      expect(service.create).toHaveBeenCalledTimes(1);

      expect(service.create).toHaveBeenCalledWith(createInput, 25);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledTimes(1);

      expect(next).not.toHaveBeenCalled();
    });

    it("should use req.user.id as createdBy", async () => {
      vi.mocked(service.create).mockResolvedValue(mockRole);

      const req = createRequest({
        body: createInput,
        user: {
          id: 777,
          username: "creator_777",
          roles: []
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.create(req, res, next);

      const calls = vi.mocked(service.create).mock.calls;

      expect(calls).toHaveLength(1);
      expect(calls[0]![1]).toBe(777);
    });

    it("should forward service errors to next()", async () => {
      const error = new Error("Role code already exists.");

      vi.mocked(service.create).mockRejectedValue(error);

      const req = createRequest({
        body: createInput,
        user: {
          id: 25,
          username: "create_test_user",
          roles: []
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.create(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  /*
   * ==========================================================================
   * update()
   * ==========================================================================
   */

  describe("update()", () => {
    it("should update a role using ID, body and authenticated user ID", async () => {
      vi.mocked(service.update).mockResolvedValue({
        ...mockRole,
        ...updateInput
      });

      const req = createRequest({
        params: {
          id: "101"
        },
        body: updateInput,
        user: {
          id: 50,
          username: "update_test_user",
          roles: []
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.update(req, res, next);

      expect(service.update).toHaveBeenCalledTimes(1);

      expect(service.update).toHaveBeenCalledWith(101, updateInput, 50);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledTimes(1);

      expect(next).not.toHaveBeenCalled();
    });

    it("should convert role ID from string to number", async () => {
      vi.mocked(service.update).mockResolvedValue(mockRole);

      const req = createRequest({
        params: {
          id: "12345"
        },
        body: {
          displayName: "Updated"
        },
        user: {
          id: 50,
          username: "update_test_user",
          roles: []
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.update(req, res, next);

      const calls = vi.mocked(service.update).mock.calls;

      expect(calls).toHaveLength(1);

      const calledId = calls[0]![0];

      expect(calledId).toBe(12345);
      expect(typeof calledId).toBe("number");
    });

    it("should forward service errors to next()", async () => {
      const error = new Error(
        "SUPER_ADMIN cannot be deactivated or suspended."
      );

      vi.mocked(service.update).mockRejectedValue(error);

      const req = createRequest({
        params: {
          id: "1"
        },
        body: {
          status: "INACTIVE"
        },
        user: {
          id: 50,
          username: "update_test_user",
          roles: []
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.update(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  /*
   * ==========================================================================
   * getUserRoles()
   * ==========================================================================
   */

  describe("getUserRoles()", () => {
    it("should retrieve roles assigned to a user", async () => {
      vi.mocked(service.getUserRoles).mockResolvedValue([
        mockRole,
        mockRoleTwo
      ]);

      const req = createRequest({
        params: {
          userId: "200"
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.getUserRoles(req, res, next);

      expect(service.getUserRoles).toHaveBeenCalledTimes(1);
      expect(service.getUserRoles).toHaveBeenCalledWith(200);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledTimes(1);

      expect(next).not.toHaveBeenCalled();
    });

    it("should return an empty role list when user has no roles", async () => {
      vi.mocked(service.getUserRoles).mockResolvedValue([]);

      const req = createRequest({
        params: {
          userId: "201"
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.getUserRoles(req, res, next);

      expect(service.getUserRoles).toHaveBeenCalledWith(201);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledTimes(1);
    });

    it("should forward service errors to next()", async () => {
      const error = new Error("Unable to retrieve user roles.");

      vi.mocked(service.getUserRoles).mockRejectedValue(error);

      const req = createRequest({
        params: {
          userId: "200"
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.getUserRoles(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  /*
   * ==========================================================================
   * assignUserRole()
   * ==========================================================================
   */

  describe("assignUserRole()", () => {
    it("should assign a role to a user", async () => {
      vi.mocked(service.assignUserRole).mockResolvedValue();

      const req = createRequest({
        params: {
          userId: "200",
          roleId: "101"
        },
        user: {
          id: 25,
          username: "assign_test_user",
          roles: []
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.assignUserRole(req, res, next);

      expect(service.assignUserRole).toHaveBeenCalledTimes(1);

      expect(service.assignUserRole).toHaveBeenCalledWith(200, 101, 25);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledTimes(1);

      expect(next).not.toHaveBeenCalled();
    });

    it("should convert userId and roleId to numbers", async () => {
      vi.mocked(service.assignUserRole).mockResolvedValue();

      const req = createRequest({
        params: {
          userId: "500",
          roleId: "600"
        },
        user: {
          id: 25,
          username: "assign_test_user",
          roles: []
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.assignUserRole(req, res, next);

      const calls = vi.mocked(service.assignUserRole).mock.calls;

      expect(calls).toHaveLength(1);

      const call = calls[0]!;

      expect(call[0]).toBe(500);
      expect(call[1]).toBe(600);
      expect(call[2]).toBe(25);

      expect(typeof call[0]).toBe("number");
      expect(typeof call[1]).toBe("number");
      expect(typeof call[2]).toBe("number");
    });

    it("should forward service errors to next()", async () => {
      const error = new Error(
        "Only SUPER_ADMIN can assign the SUPER_ADMIN role."
      );

      vi.mocked(service.assignUserRole).mockRejectedValue(error);

      const req = createRequest({
        params: {
          userId: "200",
          roleId: "1"
        },
        user: {
          id: 25,
          username: "assign_test_user",
          roles: []
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.assignUserRole(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  /*
   * ==========================================================================
   * removeUserRole()
   * ==========================================================================
   */

  describe("removeUserRole()", () => {
    it("should remove a role from a user", async () => {
      vi.mocked(service.removeUserRole).mockResolvedValue();

      const req = createRequest({
        params: {
          userId: "200",
          roleId: "101"
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.removeUserRole(req, res, next);

      expect(service.removeUserRole).toHaveBeenCalledTimes(1);

      expect(service.removeUserRole).toHaveBeenCalledWith(200, 101);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledTimes(1);

      expect(next).not.toHaveBeenCalled();
    });

    it("should convert userId and roleId to numbers", async () => {
      vi.mocked(service.removeUserRole).mockResolvedValue();

      const req = createRequest({
        params: {
          userId: "700",
          roleId: "800"
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.removeUserRole(req, res, next);

      const calls = vi.mocked(service.removeUserRole).mock.calls;

      expect(calls).toHaveLength(1);

      const call = calls[0]!;

      expect(call[0]).toBe(700);
      expect(call[1]).toBe(800);

      expect(typeof call[0]).toBe("number");
      expect(typeof call[1]).toBe("number");
    });

    it("should forward service errors to next()", async () => {
      const error = new Error("A user must have at least one role.");

      vi.mocked(service.removeUserRole).mockRejectedValue(error);

      const req = createRequest({
        params: {
          userId: "200",
          roleId: "101"
        }
      });

      const res = createResponse();
      const next = createNext();

      await controller.removeUserRole(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
