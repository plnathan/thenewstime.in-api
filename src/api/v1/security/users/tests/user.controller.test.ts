import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../../../shared/utils/apiErrorInfo.js";
import { sendSuccess } from "../../../../../shared/utils/response.js";

import type { AuthRole, AuthUser } from "../../auth/auth.types.js";
import * as controller from "../user.controller.js";
import * as service from "../user.service.js";

import type {
  CreateUserInput,
  UpdateUserInput,
  User,
  UserListItem
} from "../user.types.js";

vi.mock("../user.service.js", () => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn()
}));

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: vi.fn()
}));

describe("User Controller", () => {
  const next = vi.fn() as unknown as NextFunction;

  // ===========================================================================
  // Authentication fixtures
  // ===========================================================================

  const superAdminRole: AuthRole = {
    id: 1,
    code: "SUPER_ADMIN",
    displayName: "Super Administrator"
  };

  const adminRole: AuthRole = {
    id: 2,
    code: "ADMIN",
    displayName: "Administrator"
  };

  const createAuthenticatedUser = (
    id: number,
    username: string,
    roles: AuthRole[]
  ): AuthUser => ({
    id,
    fullName: username,
    displayName: username,
    username,
    email: `${username}@example.com`,
    mobile: null,
    status: "ACTIVE",
    roles
  });

  const createRequest = (overrides: Partial<Request> = {}): Request =>
    ({
      body: {},
      params: {},
      user: createAuthenticatedUser(
        1,
        "admin",
        [superAdminRole]
      ),
      ...overrides
    }) as Request;

  const response = {} as Response;

  // ===========================================================================
  // User fixtures
  // ===========================================================================

  const mockUser: User = {
    id: 101,
    roleId: 2,
    fullName: "Test User",
    displayName: "Test",
    username: "testuser",
    email: "test@example.com",
    mobile: "9876543210",
    profileImageUrl: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    mustChangePassword: true,
    passwordExpiresAt: null,
    failedLoginCount: 0,
    status: "ACTIVE",
    createdBy: 1,
    createdAt: new Date(),
    updatedBy: 1,
    updatedAt: new Date()
  };

  const mockUserList: UserListItem[] = [
    {
      ...mockUser,
      roleCode: "EDITOR",
      roleDisplayName: "Editor"
    }
  ];

  const mockCreateInput: CreateUserInput = {
    fullName: "New User",
    displayName: "New",
    username: "newuser",
    email: "new@example.com",
    mobile: "9876543211",
    password: "password123",
    roleId: 2
  };

  const mockUpdateInput: UpdateUserInput = {
    fullName: "Updated User",
    displayName: "Updated",
    email: "updated@example.com"
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // getAll
  // ===========================================================================

  describe("getAll", () => {
    it("should retrieve all users and send success response", async () => {
      vi.mocked(service.getAll).mockResolvedValue(mockUserList);

      const req = createRequest();

      await controller.getAll(req, response, next);

      expect(service.getAll).toHaveBeenCalledTimes(1);

      expect(sendSuccess).toHaveBeenCalledWith(
        response,
        "Users retrieved successfully.",
        mockUserList
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next", async () => {
      const error = new Error("Database failure");

      vi.mocked(service.getAll).mockRejectedValue(error);

      const req = createRequest();

      await controller.getAll(req, response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(sendSuccess).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // getById
  // ===========================================================================

  describe("getById", () => {
    it("should retrieve user by id", async () => {
      vi.mocked(service.getById).mockResolvedValue(mockUser);

      const req = createRequest({
        params: {
          id: "101"
        }
      });

      await controller.getById(req, response, next);

      expect(service.getById).toHaveBeenCalledWith(101);

      expect(sendSuccess).toHaveBeenCalledWith(
        response,
        "User retrieved successfully.",
        mockUser
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should convert string route parameter to number", async () => {
      vi.mocked(service.getById).mockResolvedValue(mockUser);

      const req = createRequest({
        params: {
          id: "250"
        }
      });

      await controller.getById(req, response, next);

      expect(service.getById).toHaveBeenCalledWith(250);
    });

    it("should forward service errors to next", async () => {
      const error = new ApiError(
        404,
        "User not found."
      );

      vi.mocked(service.getById).mockRejectedValue(error);

      const req = createRequest({
        params: {
          id: "999"
        }
      });

      await controller.getById(req, response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(sendSuccess).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // create
  // ===========================================================================

  describe("create", () => {
    it("should create a user and return 201", async () => {
      vi.mocked(service.create).mockResolvedValue(mockUser);

      const req = createRequest({
        body: mockCreateInput,
        user: createAuthenticatedUser(
          10,
          "admin",
          [superAdminRole]
        )
      });

      await controller.create(req, response, next);

      expect(service.create).toHaveBeenCalledWith(
        mockCreateInput,
        10
      );

      expect(sendSuccess).toHaveBeenCalledWith(
        response,
        "User created successfully.",
        mockUser,
        201
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should use authenticated user id as createdBy", async () => {
      vi.mocked(service.create).mockResolvedValue(mockUser);

      const req = createRequest({
        body: mockCreateInput,
        user: createAuthenticatedUser(
          55,
          "creator",
          [adminRole]
        )
      });

      await controller.create(req, response, next);

      expect(service.create).toHaveBeenCalledWith(
        mockCreateInput,
        55
      );
    });

    it("should forward service errors to next", async () => {
      const error = new ApiError(
        409,
        "Username already exists."
      );

      vi.mocked(service.create).mockRejectedValue(error);

      const req = createRequest({
        body: mockCreateInput
      });

      await controller.create(req, response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(sendSuccess).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // update
  // ===========================================================================

  describe("update", () => {
    it("should update a user and return success response", async () => {
      vi.mocked(service.update).mockResolvedValue(mockUser);

      const req = createRequest({
        params: {
          id: "101"
        },
        body: mockUpdateInput,
        user: createAuthenticatedUser(
          10,
          "admin",
          [superAdminRole]
        )
      });

      await controller.update(req, response, next);

      expect(service.update).toHaveBeenCalledWith(
        101,
        mockUpdateInput,
        10
      );

      expect(sendSuccess).toHaveBeenCalledWith(
        response,
        "User updated successfully.",
        mockUser
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should convert target user id to number", async () => {
      vi.mocked(service.update).mockResolvedValue(mockUser);

      const req = createRequest({
        params: {
          id: "500"
        },
        body: mockUpdateInput,
        user: createAuthenticatedUser(
          55,
          "creator",
          [adminRole]
        )
      });

      await controller.update(req, response, next);

      /*
       * Target user id = 500
       * Authenticated user id = 55
       */
      expect(service.update).toHaveBeenCalledWith(
        500,
        mockUpdateInput,
        55
      );
    });

    it("should forward service errors to next", async () => {
      const error = new ApiError(
        404,
        "User not found."
      );

      vi.mocked(service.update).mockRejectedValue(error);

      const req = createRequest({
        params: {
          id: "999"
        },
        body: mockUpdateInput
      });

      await controller.update(req, response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(sendSuccess).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // remove
  // ===========================================================================

  describe("remove", () => {
    it("should deactivate a user and return success response", async () => {
      const inactiveUser: User = {
        ...mockUser,
        status: "INACTIVE"
      };

      vi.mocked(service.deactivate).mockResolvedValue(
        inactiveUser
      );

      const req = createRequest({
        params: {
          id: "101"
        },
        user: createAuthenticatedUser(
          10,
          "admin",
          [superAdminRole]
        )
      });

      await controller.remove(req, response, next);

      expect(service.deactivate).toHaveBeenCalledWith(
        101,
        10
      );

      expect(sendSuccess).toHaveBeenCalledWith(
        response,
        "User deactivated successfully.",
        inactiveUser
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should convert target user id to number", async () => {
      const inactiveUser: User = {
        ...mockUser,
        status: "INACTIVE"
      };

      vi.mocked(service.deactivate).mockResolvedValue(
        inactiveUser
      );

      const req = createRequest({
        params: {
          id: "700"
        },
        user: createAuthenticatedUser(
          55,
          "creator",
          [adminRole]
        )
      });

      await controller.remove(req, response, next);

      /*
       * Target user id = 700
       * Authenticated user id = 55
       */
      expect(service.deactivate).toHaveBeenCalledWith(
        700,
        55
      );
    });

    it("should forward service errors to next", async () => {
      const error = new ApiError(
        400,
        "You cannot deactivate your own account."
      );

      vi.mocked(service.deactivate).mockRejectedValue(error);

      const req = createRequest({
        params: {
          id: "10"
        },
        user: createAuthenticatedUser(
          10,
          "admin",
          [superAdminRole]
        )
      });

      await controller.remove(req, response, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(sendSuccess).not.toHaveBeenCalled();
    });
  });
});