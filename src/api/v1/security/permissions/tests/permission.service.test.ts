import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../../../shared/utils/apiErrorInfo.js";

import * as repository from "../permission.repository.js";
import * as service from "../permission.service.js";

import type {
  CreatePermissionInput,
  Permission,
  UpdatePermissionInput
} from "../permission.types.js";

vi.mock("../permission.repository.js", () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  assignToRole: vi.fn(),
  removeFromRole: vi.fn(),
  findByRoleId: vi.fn()
}));

const mockedRepository = vi.mocked(repository);

const createPermission = (
  overrides: Partial<Permission> = {}
): Permission => ({
  id: 1,
  code: "NEWS_READ",
  displayName: "Read News",
  description: "Permission to read news",
  module: "NEWS",
  resource: "news",
  action: "read",
  displayOrder: 1,
  isSystemPermission: false,
  status: "ACTIVE",
  createdBy: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedBy: 1,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides
});

describe("Permission Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getAll
  // ---------------------------------------------------------------------------

  describe("getAll", () => {
    it("should return all permissions", async () => {
      const permissions = [
        createPermission({
          id: 1,
          code: "NEWS_READ"
        }),
        createPermission({
          id: 2,
          code: "NEWS_CREATE"
        })
      ];

      mockedRepository.findAll.mockResolvedValue(permissions);

      const result = await service.getAll();

      expect(result).toEqual(permissions);
      expect(mockedRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it("should return an empty array when no permissions exist", async () => {
      mockedRepository.findAll.mockResolvedValue([]);

      const result = await service.getAll();

      expect(result).toEqual([]);
      expect(mockedRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it("should propagate repository errors", async () => {
      const error = new Error("Database failure");

      mockedRepository.findAll.mockRejectedValue(error);

      await expect(service.getAll()).rejects.toBe(error);
    });
  });

  // ---------------------------------------------------------------------------
  // getById
  // ---------------------------------------------------------------------------

  describe("getById", () => {
    it("should return a permission when found", async () => {
      const permission = createPermission({
        id: 10
      });

      mockedRepository.findById.mockResolvedValue(permission);

      const result = await service.getById(10);

      expect(result).toEqual(permission);
      expect(mockedRepository.findById).toHaveBeenCalledWith(10);
    });

    it("should throw 404 when permission is not found", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expect(service.getById(9999)).rejects.toMatchObject({
        statusCode: 404,
        message: "Permission not found."
      });

      expect(mockedRepository.findById).toHaveBeenCalledWith(9999);
    });

    it("should propagate repository errors", async () => {
      const error = new Error("Database failure");

      mockedRepository.findById.mockRejectedValue(error);

      await expect(service.getById(1)).rejects.toBe(error);
    });
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe("create", () => {
    it("should create a permission when the code does not already exist", async () => {
      const input: CreatePermissionInput = {
        code: "NEWS_CREATE",
        displayName: "Create News",
        description: "Permission to create news",
        module: "NEWS",
        resource: "news",
        action: "create",
        displayOrder: 2,
        isSystemPermission: false
      };

      const createdPermission = createPermission({
        id: 20,
        code: "NEWS_CREATE",
        displayName: "Create News",
        description: "Permission to create news",
        module: "NEWS",
        resource: "news",
        action: "create",
        displayOrder: 2,
        isSystemPermission: false
      });

      mockedRepository.findByCode.mockResolvedValue(null);
      mockedRepository.create.mockResolvedValue(createdPermission);

      const result = await service.create(input, 5);

      expect(result).toEqual(createdPermission);

      expect(mockedRepository.findByCode).toHaveBeenCalledWith(
        "NEWS_CREATE"
      );

      expect(mockedRepository.create).toHaveBeenCalledWith(input, 5);
    });

    it("should reject duplicate permission code with 409", async () => {
      const input: CreatePermissionInput = {
        code: "NEWS_READ",
        displayName: "Read News"
      };

      const existingPermission = createPermission({
        code: "NEWS_READ"
      });

      mockedRepository.findByCode.mockResolvedValue(existingPermission);

      await expect(service.create(input, 5)).rejects.toMatchObject({
        statusCode: 409,
        message: "Permission code already exists."
      });

      expect(mockedRepository.findByCode).toHaveBeenCalledWith("NEWS_READ");
      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should propagate repository errors from findByCode", async () => {
      const error = new Error("Database failure");

      mockedRepository.findByCode.mockRejectedValue(error);

      const input: CreatePermissionInput = {
        code: "NEWS_CREATE",
        displayName: "Create News"
      };

      await expect(service.create(input, 5)).rejects.toBe(error);

      expect(mockedRepository.create).not.toHaveBeenCalled();
    });

    it("should propagate repository errors from create", async () => {
      const input: CreatePermissionInput = {
        code: "NEWS_CREATE",
        displayName: "Create News"
      };

      const error = new Error("Insert failed");

      mockedRepository.findByCode.mockResolvedValue(null);
      mockedRepository.create.mockRejectedValue(error);

      await expect(service.create(input, 5)).rejects.toBe(error);
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe("update", () => {
    it("should update a permission successfully", async () => {
      const existingPermission = createPermission({
        id: 10
      });

      const input: UpdatePermissionInput = {
        displayName: "Updated News Reader",
        description: "Updated description",
        displayOrder: 5,
        status: "ACTIVE"
      };

      const updatedPermission = createPermission({
        id: 10,
        displayName: "Updated News Reader",
        description: "Updated description",
        displayOrder: 5
      });

      mockedRepository.findById.mockResolvedValue(existingPermission);
      mockedRepository.update.mockResolvedValue(updatedPermission);

      const result = await service.update(10, input, 7);

      expect(result).toEqual(updatedPermission);

      expect(mockedRepository.findById).toHaveBeenCalledWith(10);

      expect(mockedRepository.update).toHaveBeenCalledWith(
        10,
        input,
        7
      );
    });

    it("should throw 404 when updating an unknown permission", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      const input: UpdatePermissionInput = {
        displayName: "Updated Permission"
      };

      await expect(service.update(9999, input, 7)).rejects.toMatchObject({
        statusCode: 404,
        message: "Permission not found."
      });

      expect(mockedRepository.findById).toHaveBeenCalledWith(9999);
      expect(mockedRepository.update).not.toHaveBeenCalled();
    });

    it("should reject deactivation of a system permission", async () => {
      const systemPermission = createPermission({
        id: 20,
        code: "SYSTEM_PERMISSION",
        isSystemPermission: true,
        status: "ACTIVE"
      });

      const input: UpdatePermissionInput = {
        status: "INACTIVE"
      };

      mockedRepository.findById.mockResolvedValue(systemPermission);

      await expect(service.update(20, input, 7)).rejects.toMatchObject({
        statusCode: 400,
        message: "System permissions cannot be deactivated."
      });

      expect(mockedRepository.findById).toHaveBeenCalledWith(20);
      expect(mockedRepository.update).not.toHaveBeenCalled();
    });

    it("should allow updating a system permission without deactivating it", async () => {
      const systemPermission = createPermission({
        id: 20,
        code: "SYSTEM_PERMISSION",
        isSystemPermission: true,
        status: "ACTIVE"
      });

      const input: UpdatePermissionInput = {
        displayName: "Updated System Permission",
        status: "ACTIVE"
      };

      const updatedPermission = createPermission({
        id: 20,
        code: "SYSTEM_PERMISSION",
        isSystemPermission: true,
        displayName: "Updated System Permission"
      });

      mockedRepository.findById.mockResolvedValue(systemPermission);
      mockedRepository.update.mockResolvedValue(updatedPermission);

      const result = await service.update(20, input, 7);

      expect(result).toEqual(updatedPermission);

      expect(mockedRepository.update).toHaveBeenCalledWith(
        20,
        input,
        7
      );
    });

    it("should allow changing a system permission to ACTIVE explicitly", async () => {
      const systemPermission = createPermission({
        id: 21,
        isSystemPermission: true,
        status: "INACTIVE"
      });

      const input: UpdatePermissionInput = {
        status: "ACTIVE"
      };

      const updatedPermission = createPermission({
        id: 21,
        isSystemPermission: true,
        status: "ACTIVE"
      });

      mockedRepository.findById.mockResolvedValue(systemPermission);
      mockedRepository.update.mockResolvedValue(updatedPermission);

      const result = await service.update(21, input, 7);

      expect(result).toEqual(updatedPermission);

      expect(mockedRepository.update).toHaveBeenCalledWith(
        21,
        input,
        7
      );
    });

    it("should allow deactivating a normal permission", async () => {
      const normalPermission = createPermission({
        id: 30,
        isSystemPermission: false,
        status: "ACTIVE"
      });

      const input: UpdatePermissionInput = {
        status: "INACTIVE"
      };

      const updatedPermission = createPermission({
        id: 30,
        isSystemPermission: false,
        status: "INACTIVE"
      });

      mockedRepository.findById.mockResolvedValue(normalPermission);
      mockedRepository.update.mockResolvedValue(updatedPermission);

      const result = await service.update(30, input, 7);

      expect(result).toEqual(updatedPermission);

      expect(mockedRepository.update).toHaveBeenCalledWith(
        30,
        input,
        7
      );
    });

    it("should allow updating a normal permission without changing status", async () => {
      const normalPermission = createPermission({
        id: 31,
        status: "ACTIVE"
      });

      const input: UpdatePermissionInput = {
        displayName: "Updated Permission"
      };

      const updatedPermission = createPermission({
        id: 31,
        displayName: "Updated Permission"
      });

      mockedRepository.findById.mockResolvedValue(normalPermission);
      mockedRepository.update.mockResolvedValue(updatedPermission);

      const result = await service.update(31, input, 7);

      expect(result).toEqual(updatedPermission);
    });

    it("should propagate repository errors from findById", async () => {
      const error = new Error("Database failure");

      mockedRepository.findById.mockRejectedValue(error);

      const input: UpdatePermissionInput = {
        displayName: "Updated Permission"
      };

      await expect(service.update(1, input, 7)).rejects.toBe(error);

      expect(mockedRepository.update).not.toHaveBeenCalled();
    });

    it("should return the repository update result", async () => {
      const existingPermission = createPermission({
        id: 40
      });

      const input: UpdatePermissionInput = {
        displayName: "Updated Permission"
      };

      const updatedPermission = createPermission({
        id: 40,
        displayName: "Updated Permission"
      });

      mockedRepository.findById.mockResolvedValue(existingPermission);
      mockedRepository.update.mockResolvedValue(updatedPermission);

      const result = await service.update(40, input, 7);

      expect(result).toBe(updatedPermission);
    });

    it("should propagate repository errors from update", async () => {
      const existingPermission = createPermission({
        id: 41
      });

      const input: UpdatePermissionInput = {
        displayName: "Updated Permission"
      };

      const error = new Error("Update failed");

      mockedRepository.findById.mockResolvedValue(existingPermission);
      mockedRepository.update.mockRejectedValue(error);

      await expect(service.update(41, input, 7)).rejects.toBe(error);
    });
  });

  // ---------------------------------------------------------------------------
  // assignToRole
  // ---------------------------------------------------------------------------

  describe("assignToRole", () => {
    it("should assign an active permission to a role", async () => {
      const permission = createPermission({
        id: 10,
        status: "ACTIVE"
      });

      mockedRepository.findById.mockResolvedValue(permission);
      mockedRepository.assignToRole.mockResolvedValue(undefined);

      await expect(
        service.assignToRole(5, 10, 7)
      ).resolves.toBeUndefined();

      expect(mockedRepository.findById).toHaveBeenCalledWith(10);

      expect(mockedRepository.assignToRole).toHaveBeenCalledWith(
        5,
        10,
        7
      );
    });

    it("should throw 404 when permission does not exist", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      await expect(
        service.assignToRole(5, 9999, 7)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Permission not found."
      });

      expect(mockedRepository.findById).toHaveBeenCalledWith(9999);
      expect(mockedRepository.assignToRole).not.toHaveBeenCalled();
    });

    it("should reject assigning an inactive permission", async () => {
      const permission = createPermission({
        id: 11,
        status: "INACTIVE"
      });

      mockedRepository.findById.mockResolvedValue(permission);

      await expect(
        service.assignToRole(5, 11, 7)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Inactive permissions cannot be assigned."
      });

      expect(mockedRepository.findById).toHaveBeenCalledWith(11);
      expect(mockedRepository.assignToRole).not.toHaveBeenCalled();
    });

    it("should reject assigning a suspended permission", async () => {
      const permission = createPermission({
        id: 12,
        status: "SUSPENDED"
      });

      mockedRepository.findById.mockResolvedValue(permission);

      await expect(
        service.assignToRole(5, 12, 7)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Inactive permissions cannot be assigned."
      });

      expect(mockedRepository.assignToRole).not.toHaveBeenCalled();
    });

    it("should allow assigning a system permission when it is active", async () => {
      const permission = createPermission({
        id: 13,
        isSystemPermission: true,
        status: "ACTIVE"
      });

      mockedRepository.findById.mockResolvedValue(permission);
      mockedRepository.assignToRole.mockResolvedValue(undefined);

      await expect(
        service.assignToRole(5, 13, 7)
      ).resolves.toBeUndefined();

      expect(mockedRepository.assignToRole).toHaveBeenCalledWith(
        5,
        13,
        7
      );
    });

    it("should propagate repository errors from findById", async () => {
      const error = new Error("Database failure");

      mockedRepository.findById.mockRejectedValue(error);

      await expect(
        service.assignToRole(5, 10, 7)
      ).rejects.toBe(error);

      expect(mockedRepository.assignToRole).not.toHaveBeenCalled();
    });

    it("should propagate repository errors from assignToRole", async () => {
      const permission = createPermission({
        id: 14,
        status: "ACTIVE"
      });

      const error = new Error("Assignment failed");

      mockedRepository.findById.mockResolvedValue(permission);
      mockedRepository.assignToRole.mockRejectedValue(error);

      await expect(
        service.assignToRole(5, 14, 7)
      ).rejects.toBe(error);
    });
  });

  // ---------------------------------------------------------------------------
  // removeFromRole
  // ---------------------------------------------------------------------------

  describe("removeFromRole", () => {
    it("should remove a permission from a role", async () => {
      mockedRepository.removeFromRole.mockResolvedValue(undefined);

      await expect(
        service.removeFromRole(5, 10)
      ).resolves.toBeUndefined();

      expect(mockedRepository.removeFromRole).toHaveBeenCalledWith(
        5,
        10
      );
    });

    it("should be idempotent when the role-permission assignment does not exist", async () => {
      mockedRepository.removeFromRole.mockResolvedValue(undefined);

      await expect(
        service.removeFromRole(999, 999)
      ).resolves.toBeUndefined();

      expect(mockedRepository.removeFromRole).toHaveBeenCalledWith(
        999,
        999
      );
    });

    it("should propagate repository errors", async () => {
      const error = new Error("Delete failed");

      mockedRepository.removeFromRole.mockRejectedValue(error);

      await expect(
        service.removeFromRole(5, 10)
      ).rejects.toBe(error);
    });
  });

  // ---------------------------------------------------------------------------
  // getRolePermissions
  // ---------------------------------------------------------------------------

  describe("getRolePermissions", () => {
    it("should return permissions assigned to a role", async () => {
      const permissions = [
        createPermission({
          id: 1,
          code: "NEWS_READ"
        }),
        createPermission({
          id: 2,
          code: "NEWS_CREATE"
        })
      ];

      mockedRepository.findByRoleId.mockResolvedValue(permissions);

      const result = await service.getRolePermissions(5);

      expect(result).toEqual(permissions);

      expect(mockedRepository.findByRoleId).toHaveBeenCalledWith(5);
    });

    it("should return an empty array when a role has no permissions", async () => {
      mockedRepository.findByRoleId.mockResolvedValue([]);

      const result = await service.getRolePermissions(5);

      expect(result).toEqual([]);

      expect(mockedRepository.findByRoleId).toHaveBeenCalledWith(5);
    });

    it("should return an empty array for an unknown role when repository returns empty", async () => {
      mockedRepository.findByRoleId.mockResolvedValue([]);

      const result = await service.getRolePermissions(9999);

      expect(result).toEqual([]);

      expect(mockedRepository.findByRoleId).toHaveBeenCalledWith(9999);
    });

    it("should propagate repository errors", async () => {
      const error = new Error("Database failure");

      mockedRepository.findByRoleId.mockRejectedValue(error);

      await expect(
        service.getRolePermissions(5)
      ).rejects.toBe(error);
    });
  });

  // ---------------------------------------------------------------------------
  // Service contract / ApiError sanity checks
  // ---------------------------------------------------------------------------

  describe("ApiError behavior", () => {
    it("should throw an ApiError instance for an unknown permission", async () => {
      mockedRepository.findById.mockResolvedValue(null);

      try {
        await service.getById(9999);
        throw new Error("Expected service.getById to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({
          statusCode: 404,
          message: "Permission not found."
        });
      }
    });

    it("should throw an ApiError instance for a duplicate permission code", async () => {
      mockedRepository.findByCode.mockResolvedValue(
        createPermission({
          code: "NEWS_READ"
        })
      );

      const input: CreatePermissionInput = {
        code: "NEWS_READ",
        displayName: "Read News"
      };

      try {
        await service.create(input, 1);
        throw new Error("Expected service.create to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({
          statusCode: 409,
          message: "Permission code already exists."
        });
      }
    });
  });
});