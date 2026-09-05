import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../../../shared/utils/apiErrorInfo.js";

import * as repository from "../role.repository.js";
import * as service from "../role.service.js";

import type {
  CreateRoleInput,
  Role,
  UpdateRoleInput
} from "../role.types.js";

/*
 * ============================================================================
 * MOCK ROLE REPOSITORY
 * ============================================================================
 */

vi.mock("../role.repository.js", () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  assignUserRole: vi.fn(),
  removeUserRole: vi.fn(),
  findUserRoles: vi.fn()
}));

/*
 * ============================================================================
 * TEST DATA
 * ============================================================================
 */

const baseRole: Role = {
  id: 10,
  code: "EDITOR",
  displayName: "Editor",
  description: "Editor role",
  displayOrder: 10,
  status: "ACTIVE",
  createdBy: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedBy: 1,
  updatedAt: new Date("2026-01-01T00:00:00.000Z")
};

const superAdminRole: Role = {
  id: 1,
  code: "SUPER_ADMIN",
  displayName: "Super Administrator",
  description: "System super administrator",
  displayOrder: 1,
  status: "ACTIVE",
  createdBy: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedBy: 1,
  updatedAt: new Date("2026-01-01T00:00:00.000Z")
};

const inactiveRole: Role = {
  ...baseRole,
  id: 20,
  code: "INACTIVE_ROLE",
  displayName: "Inactive Role",
  status: "INACTIVE"
};

const createRoleInput: CreateRoleInput = {
  code: "EDITOR",
  displayName: "Editor",
  description: "Editor role",
  displayOrder: 10
};

const updateRoleInput: UpdateRoleInput = {
  displayName: "Senior Editor",
  description: "Senior editor role",
  displayOrder: 20
};

/*
 * ============================================================================
 * HELPERS
 * ============================================================================
 */

const expectApiError = async (
  promise: Promise<unknown>,
  statusCode: number,
  message: string
): Promise<void> => {
  try {
    await promise;
    throw new Error("Expected promise to reject.");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);

    const apiError = error as ApiError & {
      statusCode?: number;
      status?: number;
      message: string;
    };

    expect(apiError.message).toBe(message);

    /*
     * Support the project's ApiError implementation whether it exposes
     * statusCode or status.
     */
    expect(apiError.statusCode ?? apiError.status).toBe(statusCode);
  }
};

/*
 * ============================================================================
 * TEST SUITE
 * ============================================================================
 */

describe("Role Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /*
   * ==========================================================================
   * getAll
   * ==========================================================================
   */

  describe("getAll", () => {
    it("should return all roles from the repository", async () => {
      vi.mocked(repository.findAll).mockResolvedValue([
        baseRole,
        superAdminRole
      ]);

      const result = await service.getAll();

      expect(result).toEqual([baseRole, superAdminRole]);

      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });

    it("should return an empty array when the repository returns no roles", async () => {
      vi.mocked(repository.findAll).mockResolvedValue([]);

      const result = await service.getAll();

      expect(result).toEqual([]);

      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  /*
   * ==========================================================================
   * getById
   * ==========================================================================
   */

  describe("getById", () => {
    it("should return the requested role", async () => {
      vi.mocked(repository.findById).mockResolvedValue(baseRole);

      const result = await service.getById(10);

      expect(result).toEqual(baseRole);

      expect(repository.findById).toHaveBeenCalledTimes(1);
      expect(repository.findById).toHaveBeenCalledWith(10);
    });

    it("should throw 404 when the role does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expectApiError(
        service.getById(99999),
        404,
        "Role not found."
      );

      expect(repository.findById).toHaveBeenCalledWith(99999);
    });
  });

  /*
   * ==========================================================================
   * create
   * ==========================================================================
   */

  describe("create", () => {
    it("should create a new role when the code does not already exist", async () => {
      vi.mocked(repository.findByCode).mockResolvedValue(null);
      vi.mocked(repository.create).mockResolvedValue(baseRole);

      const result = await service.create(createRoleInput, 100);

      expect(result).toEqual(baseRole);

      expect(repository.findByCode).toHaveBeenCalledTimes(1);
      expect(repository.findByCode).toHaveBeenCalledWith(
        createRoleInput.code
      );

      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(repository.create).toHaveBeenCalledWith(
        createRoleInput,
        100
      );
    });

    it("should throw 409 when the role code already exists", async () => {
      vi.mocked(repository.findByCode).mockResolvedValue(baseRole);

      await expectApiError(
        service.create(createRoleInput, 100),
        409,
        "Role code already exists."
      );

      expect(repository.findByCode).toHaveBeenCalledWith(
        createRoleInput.code
      );

      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  /*
   * ==========================================================================
   * update
   * ==========================================================================
   */

  describe("update", () => {
    it("should update an existing role", async () => {
      const updatedRole: Role = {
        ...baseRole,
        displayName: "Senior Editor",
        description: "Senior editor role",
        displayOrder: 20,
        updatedBy: 100
      };

      vi.mocked(repository.findById).mockResolvedValue(baseRole);
      vi.mocked(repository.update).mockResolvedValue(updatedRole);

      const result = await service.update(
        10,
        updateRoleInput,
        100
      );

      expect(result).toEqual(updatedRole);

      expect(repository.findById).toHaveBeenCalledWith(10);

      expect(repository.update).toHaveBeenCalledTimes(1);
      expect(repository.update).toHaveBeenCalledWith(
        10,
        updateRoleInput,
        100
      );
    });

    it("should throw 404 when updating a role that does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expectApiError(
        service.update(
          99999,
          updateRoleInput,
          100
        ),
        404,
        "Role not found."
      );

      expect(repository.findById).toHaveBeenCalledWith(99999);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should not allow SUPER_ADMIN to be deactivated", async () => {
      vi.mocked(repository.findById).mockResolvedValue(superAdminRole);

      const input: UpdateRoleInput = {
        status: "INACTIVE"
      };

      await expectApiError(
        service.update(1, input, 100),
        400,
        "SUPER_ADMIN cannot be deactivated or suspended."
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should not allow SUPER_ADMIN to be suspended", async () => {
      vi.mocked(repository.findById).mockResolvedValue(superAdminRole);

      const input: UpdateRoleInput = {
        status: "SUSPENDED"
      };

      await expectApiError(
        service.update(1, input, 100),
        400,
        "SUPER_ADMIN cannot be deactivated or suspended."
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should allow SUPER_ADMIN to remain active", async () => {
      const input: UpdateRoleInput = {
        status: "ACTIVE"
      };

      const updatedSuperAdmin: Role = {
        ...superAdminRole,
        displayName: "Super Administrator Updated"
      };

      vi.mocked(repository.findById).mockResolvedValue(superAdminRole);
      vi.mocked(repository.update).mockResolvedValue(updatedSuperAdmin);

      const result = await service.update(
        1,
        input,
        100
      );

      expect(result).toEqual(updatedSuperAdmin);

      expect(repository.update).toHaveBeenCalledWith(
        1,
        input,
        100
      );
    });

    it("should allow a normal role to become inactive", async () => {
      const input: UpdateRoleInput = {
        status: "INACTIVE"
      };

      const updatedRole: Role = {
        ...baseRole,
        status: "INACTIVE"
      };

      vi.mocked(repository.findById).mockResolvedValue(baseRole);
      vi.mocked(repository.update).mockResolvedValue(updatedRole);

      const result = await service.update(
        baseRole.id,
        input,
        100
      );

      expect(result).toEqual(updatedRole);

      expect(repository.update).toHaveBeenCalledWith(
        baseRole.id,
        input,
        100
      );
    });

    it("should throw 404 when repository update returns null", async () => {
      vi.mocked(repository.findById).mockResolvedValue(baseRole);
      vi.mocked(repository.update).mockResolvedValue(null);

      await expectApiError(
        service.update(
          baseRole.id,
          updateRoleInput,
          100
        ),
        404,
        "Role not found."
      );

      expect(repository.update).toHaveBeenCalledWith(
        baseRole.id,
        updateRoleInput,
        100
      );
    });
  });

  /*
   * ==========================================================================
   * assignUserRole
   * ==========================================================================
   */

  describe("assignUserRole", () => {
    it("should assign an active normal role to a user", async () => {
      vi.mocked(repository.findById).mockResolvedValue(baseRole);
      vi.mocked(repository.assignUserRole).mockResolvedValue(undefined);

      await service.assignUserRole(
        200,
        baseRole.id,
        100
      );

      expect(repository.findById).toHaveBeenCalledWith(
        baseRole.id
      );

      expect(repository.assignUserRole).toHaveBeenCalledTimes(1);
      expect(repository.assignUserRole).toHaveBeenCalledWith(
        200,
        baseRole.id,
        100
      );

      expect(repository.findUserRoles).not.toHaveBeenCalled();
    });

    it("should throw 404 when assigning an unknown role", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expectApiError(
        service.assignUserRole(
          200,
          99999,
          100
        ),
        404,
        "Role not found."
      );

      expect(repository.assignUserRole).not.toHaveBeenCalled();
    });

    it("should not assign an inactive role", async () => {
      vi.mocked(repository.findById).mockResolvedValue(inactiveRole);

      await expectApiError(
        service.assignUserRole(
          200,
          inactiveRole.id,
          100
        ),
        400,
        "Only active roles can be assigned."
      );

      expect(repository.assignUserRole).not.toHaveBeenCalled();
    });

    it("should allow an active SUPER_ADMIN to assign SUPER_ADMIN", async () => {
      vi.mocked(repository.findById).mockResolvedValue(
        superAdminRole
      );

      vi.mocked(repository.findUserRoles).mockResolvedValue([
        superAdminRole
      ]);

      vi.mocked(repository.assignUserRole).mockResolvedValue(
        undefined
      );

      await service.assignUserRole(
        200,
        superAdminRole.id,
        100
      );

      expect(repository.findById).toHaveBeenCalledWith(
        superAdminRole.id
      );

      expect(repository.findUserRoles).toHaveBeenCalledWith(100);

      expect(repository.assignUserRole).toHaveBeenCalledWith(
        200,
        superAdminRole.id,
        100
      );
    });

    it("should reject SUPER_ADMIN assignment when actor is not SUPER_ADMIN", async () => {
      vi.mocked(repository.findById).mockResolvedValue(
        superAdminRole
      );

      vi.mocked(repository.findUserRoles).mockResolvedValue([
        baseRole
      ]);

      await expectApiError(
        service.assignUserRole(
          200,
          superAdminRole.id,
          100
        ),
        403,
        "Only SUPER_ADMIN can assign the SUPER_ADMIN role."
      );

      expect(repository.findUserRoles).toHaveBeenCalledWith(100);

      expect(repository.assignUserRole).not.toHaveBeenCalled();
    });

    it("should reject SUPER_ADMIN assignment when actor has no roles", async () => {
      vi.mocked(repository.findById).mockResolvedValue(
        superAdminRole
      );

      vi.mocked(repository.findUserRoles).mockResolvedValue([]);

      await expectApiError(
        service.assignUserRole(
          200,
          superAdminRole.id,
          100
        ),
        403,
        "Only SUPER_ADMIN can assign the SUPER_ADMIN role."
      );

      expect(repository.assignUserRole).not.toHaveBeenCalled();
    });

    it("should reject SUPER_ADMIN assignment when actor SUPER_ADMIN role is inactive", async () => {
      const inactiveSuperAdmin: Role = {
        ...superAdminRole,
        status: "INACTIVE"
      };

      vi.mocked(repository.findById).mockResolvedValue(
        superAdminRole
      );

      vi.mocked(repository.findUserRoles).mockResolvedValue([
        inactiveSuperAdmin
      ]);

      await expectApiError(
        service.assignUserRole(
          200,
          superAdminRole.id,
          100
        ),
        403,
        "Only SUPER_ADMIN can assign the SUPER_ADMIN role."
      );

      expect(repository.assignUserRole).not.toHaveBeenCalled();
    });
  });

  /*
   * ==========================================================================
   * removeUserRole
   * ==========================================================================
   */

  describe("removeUserRole", () => {
    it("should remove a role when the user has more than one role", async () => {
      const secondRole: Role = {
        ...baseRole,
        id: 11,
        code: "REPORTER",
        displayName: "Reporter"
      };

      vi.mocked(repository.findUserRoles).mockResolvedValue([
        baseRole,
        secondRole
      ]);

      vi.mocked(repository.removeUserRole).mockResolvedValue(
        undefined
      );

      await service.removeUserRole(
        200,
        baseRole.id
      );

      expect(repository.findUserRoles).toHaveBeenCalledWith(200);

      expect(repository.removeUserRole).toHaveBeenCalledTimes(1);
      expect(repository.removeUserRole).toHaveBeenCalledWith(
        200,
        baseRole.id
      );
    });

    it("should not remove the last role from a user", async () => {
      vi.mocked(repository.findUserRoles).mockResolvedValue([
        baseRole
      ]);

      await expectApiError(
        service.removeUserRole(
          200,
          baseRole.id
        ),
        400,
        "A user must have at least one role."
      );

      expect(repository.removeUserRole).not.toHaveBeenCalled();
    });

    it("should not remove a role that the user does not have", async () => {
      const secondRole: Role = {
        ...baseRole,
        id: 11,
        code: "REPORTER",
        displayName: "Reporter"
      };

      vi.mocked(repository.findUserRoles).mockResolvedValue([
        baseRole,
        secondRole
      ]);

      await expectApiError(
        service.removeUserRole(
          200,
          99999
        ),
        404,
        "User does not have this role."
      );

      expect(repository.removeUserRole).not.toHaveBeenCalled();
    });

    it("should remove the requested role when the user has multiple roles", async () => {
      const secondRole: Role = {
        ...baseRole,
        id: 11,
        code: "REPORTER",
        displayName: "Reporter"
      };

      const thirdRole: Role = {
        ...baseRole,
        id: 12,
        code: "AUTHOR",
        displayName: "Author"
      };

      vi.mocked(repository.findUserRoles).mockResolvedValue([
        baseRole,
        secondRole,
        thirdRole
      ]);

      vi.mocked(repository.removeUserRole).mockResolvedValue(
        undefined
      );

      await service.removeUserRole(
        200,
        secondRole.id
      );

      expect(repository.removeUserRole).toHaveBeenCalledWith(
        200,
        secondRole.id
      );
    });
  });

  /*
   * ==========================================================================
   * getUserRoles
   * ==========================================================================
   */

  describe("getUserRoles", () => {
    it("should return all roles assigned to a user", async () => {
      vi.mocked(repository.findUserRoles).mockResolvedValue([
        baseRole,
        superAdminRole
      ]);

      const result = await service.getUserRoles(200);

      expect(result).toEqual([
        baseRole,
        superAdminRole
      ]);

      expect(repository.findUserRoles).toHaveBeenCalledTimes(1);
      expect(repository.findUserRoles).toHaveBeenCalledWith(200);
    });

    it("should return an empty array when the user has no roles", async () => {
      vi.mocked(repository.findUserRoles).mockResolvedValue([]);

      const result = await service.getUserRoles(200);

      expect(result).toEqual([]);

      expect(repository.findUserRoles).toHaveBeenCalledWith(200);
    });
  });
});