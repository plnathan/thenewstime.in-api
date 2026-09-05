import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as permissionController from "../permission.controller.js";
import * as permissionService from "../permission.service.js";

import { sendSuccess } from "../../../../../shared/utils/response.js";

import type {
  CreatePermissionInput,
  Permission,
  UpdatePermissionInput
} from "../permission.types.js";

/* -------------------------------------------------------------------------- */
/* Mocks                                                                      */
/* -------------------------------------------------------------------------- */

vi.mock("../permission.service.js", () => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  assignToRole: vi.fn(),
  removeFromRole: vi.fn(),
  getRolePermissions: vi.fn()
}));

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: vi.fn()
}));

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const mockPermission: Permission = {
  id: 101,
  code: "TEST_PERMISSION_READ",
  displayName: "Test Permission Read",
  description: "Permission controller test permission",
  module: "TEST",
  resource: "repository",
  action: "read",
  displayOrder: 900,
  isSystemPermission: false,
  status: "ACTIVE",
  createdBy: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedBy: 1,
  updatedAt: new Date("2026-01-01T00:00:00.000Z")
};

const mockPermissionList: Permission[] = [
  mockPermission,
  {
    ...mockPermission,
    id: 102,
    code: "TEST_PERMISSION_CREATE",
    displayName: "Test Permission Create",
    action: "create"
  }
];

const createInput: CreatePermissionInput = {
  code: "TEST_PERMISSION_READ",
  displayName: "Test Permission Read",
  description: "Permission controller test permission",
  module: "TEST",
  resource: "repository",
  action: "read",
  displayOrder: 900,
  isSystemPermission: false
};

const updateInput: UpdatePermissionInput = {
  displayName: "Updated Permission",
  description: "Updated permission description",
  module: "UPDATED_TEST",
  resource: "updated_repository",
  action: "update",
  displayOrder: 901,
  status: "ACTIVE"
};

const updatedPermission: Permission = {
  ...mockPermission,
  displayName: "Updated Permission",
  description: "Updated permission description",
  module: "UPDATED_TEST",
  resource: "updated_repository",
  action: "update",
  displayOrder: 901,
  status: "ACTIVE",
  updatedBy: 25
};

/* -------------------------------------------------------------------------- */
/* Request / Response helpers                                                 */
/* -------------------------------------------------------------------------- */

const createRequest = (overrides: Partial<Request> = {}): Request => {
  return {
    params: {},
    body: {},
    user: {
      id: 25
    },
    ...overrides
  } as Request;
};

const createResponse = (): Response => {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  } as unknown as Response;
};

const createNext = (): NextFunction => {
  return vi.fn();
};

/* -------------------------------------------------------------------------- */
/* Test suite                                                                 */
/* -------------------------------------------------------------------------- */

describe("Permission Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ------------------------------------------------------------------------ */
  /* getAll                                                                   */
  /* ------------------------------------------------------------------------ */

  describe("getAll", () => {
    it("should return all permissions successfully", async () => {
      vi.mocked(permissionService.getAll).mockResolvedValue(mockPermissionList);

      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      await permissionController.getAll(req, res, next);

      expect(permissionService.getAll).toHaveBeenCalledTimes(1);

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        "Permissions retrieved successfully.",
        mockPermissionList
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should return an empty permission list successfully", async () => {
      vi.mocked(permissionService.getAll).mockResolvedValue([]);

      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      await permissionController.getAll(req, res, next);

      expect(permissionService.getAll).toHaveBeenCalledTimes(1);

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        "Permissions retrieved successfully.",
        []
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next", async () => {
      const error = new Error("Failed to retrieve permissions");

      vi.mocked(permissionService.getAll).mockRejectedValue(error);

      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      await permissionController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(sendSuccess).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------------ */
  /* getById                                                                  */
  /* ------------------------------------------------------------------------ */

  describe("getById", () => {
    it("should return a permission successfully", async () => {
      vi.mocked(permissionService.getById).mockResolvedValue(mockPermission);

      const req = createRequest({
        params: {
          id: "101"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.getById(req, res, next);

      expect(permissionService.getById).toHaveBeenCalledWith(101);

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        "Permission retrieved successfully.",
        mockPermission
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should convert permission id from string to number", async () => {
      vi.mocked(permissionService.getById).mockResolvedValue(mockPermission);

      const req = createRequest({
        params: {
          id: "123"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.getById(req, res, next);

      expect(permissionService.getById).toHaveBeenCalledWith(123);
    });

    it("should forward service errors to next", async () => {
      const error = new Error("Permission not found");

      vi.mocked(permissionService.getById).mockRejectedValue(error);

      const req = createRequest({
        params: {
          id: "999"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(sendSuccess).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------------ */
  /* create                                                                   */
  /* ------------------------------------------------------------------------ */

  describe("create", () => {
    it("should create a permission successfully", async () => {
      vi.mocked(permissionService.create).mockResolvedValue(mockPermission);

      const req = createRequest({
        body: createInput
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.create(req, res, next);

      expect(permissionService.create).toHaveBeenCalledWith(createInput, 25);

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        "Permission created successfully.",
        mockPermission,
        201
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should pass the authenticated user id to the service", async () => {
      vi.mocked(permissionService.create).mockResolvedValue(mockPermission);

      const req = createRequest({
        body: createInput,
        user: {
          id: 99,
          username: "test-user",
          roles: []
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.create(req, res, next);

      expect(permissionService.create).toHaveBeenCalledWith(createInput, 99);
    });

    it("should forward service errors to next", async () => {
      const error = new Error("Permission creation failed");

      vi.mocked(permissionService.create).mockRejectedValue(error);

      const req = createRequest({
        body: createInput
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(sendSuccess).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------------ */
  /* update                                                                   */
  /* ------------------------------------------------------------------------ */

  describe("update", () => {
    it("should update a permission successfully", async () => {
      vi.mocked(permissionService.update).mockResolvedValue(updatedPermission);

      const req = createRequest({
        params: {
          id: "101"
        },
        body: updateInput
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.update(req, res, next);

      expect(permissionService.update).toHaveBeenCalledWith(
        101,
        updateInput,
        25
      );

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        "Permission updated successfully.",
        updatedPermission
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should convert permission id from string to number", async () => {
      vi.mocked(permissionService.update).mockResolvedValue(updatedPermission);

      const req = createRequest({
        params: {
          id: "205"
        },
        body: updateInput
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.update(req, res, next);

      expect(permissionService.update).toHaveBeenCalledWith(
        205,
        updateInput,
        25
      );
    });

    it("should pass the authenticated user id to the service", async () => {
      vi.mocked(permissionService.update).mockResolvedValue(updatedPermission);

      const req = createRequest({
        params: {
          id: "101"
        },
        body: updateInput,
        user: {
          id: 77,
          username: "test-user",
          roles: []
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.update(req, res, next);

      expect(permissionService.update).toHaveBeenCalledWith(
        101,
        updateInput,
        77
      );
    });

    it("should forward service errors to next", async () => {
      const error = new Error("Permission update failed");

      vi.mocked(permissionService.update).mockRejectedValue(error);

      const req = createRequest({
        params: {
          id: "101"
        },
        body: updateInput
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(sendSuccess).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------------ */
  /* getRolePermissions                                                       */
  /* ------------------------------------------------------------------------ */

  describe("getRolePermissions", () => {
    it("should return permissions assigned to a role", async () => {
      vi.mocked(permissionService.getRolePermissions).mockResolvedValue(
        mockPermissionList
      );

      const req = createRequest({
        params: {
          roleId: "10"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.getRolePermissions(req, res, next);

      expect(permissionService.getRolePermissions).toHaveBeenCalledWith(10);

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        "Role permissions retrieved successfully.",
        mockPermissionList
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should return an empty list when a role has no permissions", async () => {
      vi.mocked(permissionService.getRolePermissions).mockResolvedValue([]);

      const req = createRequest({
        params: {
          roleId: "10"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.getRolePermissions(req, res, next);

      expect(permissionService.getRolePermissions).toHaveBeenCalledWith(10);

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        "Role permissions retrieved successfully.",
        []
      );
    });

    it("should convert role id from string to number", async () => {
      vi.mocked(permissionService.getRolePermissions).mockResolvedValue(
        mockPermissionList
      );

      const req = createRequest({
        params: {
          roleId: "25"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.getRolePermissions(req, res, next);

      expect(permissionService.getRolePermissions).toHaveBeenCalledWith(25);
    });

    it("should forward service errors to next", async () => {
      const error = new Error("Failed to retrieve role permissions");

      vi.mocked(permissionService.getRolePermissions).mockRejectedValue(error);

      const req = createRequest({
        params: {
          roleId: "10"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.getRolePermissions(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(sendSuccess).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------------ */
  /* assignToRole                                                             */
  /* ------------------------------------------------------------------------ */

  describe("assignToRole", () => {
    it("should assign a permission to a role successfully", async () => {
      vi.mocked(permissionService.assignToRole).mockResolvedValue(undefined);

      const req = createRequest({
        params: {
          roleId: "10",
          permissionId: "101"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.assignToRole(req, res, next);

      expect(permissionService.assignToRole).toHaveBeenCalledWith(10, 101, 25);

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        "Permission assigned to role successfully."
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should convert role and permission ids from strings to numbers", async () => {
      vi.mocked(permissionService.assignToRole).mockResolvedValue(undefined);

      const req = createRequest({
        params: {
          roleId: "20",
          permissionId: "202"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.assignToRole(req, res, next);

      expect(permissionService.assignToRole).toHaveBeenCalledWith(20, 202, 25);
    });

    it("should pass the authenticated user id to the service", async () => {
      vi.mocked(permissionService.assignToRole).mockResolvedValue(undefined);

      const req = createRequest({
        params: {
          roleId: "10",
          permissionId: "101"
        },
        user: {
          id: 88,
          username: "test-user",
          roles: []
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.assignToRole(req, res, next);

      expect(permissionService.assignToRole).toHaveBeenCalledWith(10, 101, 88);
    });

    it("should forward service errors to next", async () => {
      const error = new Error("Permission assignment failed");

      vi.mocked(permissionService.assignToRole).mockRejectedValue(error);

      const req = createRequest({
        params: {
          roleId: "10",
          permissionId: "101"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.assignToRole(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(sendSuccess).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------------ */
  /* removeFromRole                                                           */
  /* ------------------------------------------------------------------------ */

  describe("removeFromRole", () => {
    it("should remove a permission from a role successfully", async () => {
      vi.mocked(permissionService.removeFromRole).mockResolvedValue(undefined);

      const req = createRequest({
        params: {
          roleId: "10",
          permissionId: "101"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.removeFromRole(req, res, next);

      expect(permissionService.removeFromRole).toHaveBeenCalledWith(10, 101);

      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        "Permission removed from role successfully."
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should convert role and permission ids from strings to numbers", async () => {
      vi.mocked(permissionService.removeFromRole).mockResolvedValue(undefined);

      const req = createRequest({
        params: {
          roleId: "20",
          permissionId: "202"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.removeFromRole(req, res, next);

      expect(permissionService.removeFromRole).toHaveBeenCalledWith(20, 202);
    });

    it("should forward service errors to next", async () => {
      const error = new Error("Permission removal failed");

      vi.mocked(permissionService.removeFromRole).mockRejectedValue(error);

      const req = createRequest({
        params: {
          roleId: "10",
          permissionId: "101"
        }
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.removeFromRole(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(sendSuccess).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Response helper verification                                             */
  /* ------------------------------------------------------------------------ */

  describe("Response Helper Verification", () => {
    it("should use sendSuccess for getAll", async () => {
      vi.mocked(permissionService.getAll).mockResolvedValue(mockPermissionList);

      const req = createRequest();
      const res = createResponse();
      const next = createNext();

      await permissionController.getAll(req, res, next);

      expect(sendSuccess).toHaveBeenCalledTimes(1);
      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        "Permissions retrieved successfully.",
        mockPermissionList
      );
    });

    it("should use sendSuccess with HTTP 201 for create", async () => {
      vi.mocked(permissionService.create).mockResolvedValue(mockPermission);

      const req = createRequest({
        body: createInput
      });

      const res = createResponse();
      const next = createNext();

      await permissionController.create(req, res, next);

      expect(sendSuccess).toHaveBeenCalledTimes(1);
      expect(sendSuccess).toHaveBeenCalledWith(
        res,
        "Permission created successfully.",
        mockPermission,
        201
      );
    });
  });
});
