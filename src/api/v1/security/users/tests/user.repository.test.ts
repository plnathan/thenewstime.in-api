import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../user.repository.js";

import type {
  CreateUserInput,
  UpdateUserInput,
  User
} from "../user.types.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn()
  }
}));

describe("User Repository", () => {
  // ===========================================================================
  // Mock helpers
  // ===========================================================================

  /*
   * pg Pool.query() has multiple overloads. When it is mocked through
   * vi.mocked(), TypeScript can infer the mocked return type as void.
   *
   * These explicit Vitest mock references avoid that problem.
   */
  const poolQueryMock = pool.query as unknown as ReturnType<typeof vi.fn>;
  const poolConnectMock = pool.connect as unknown as ReturnType<typeof vi.fn>;

  const createClient = () => {
    const query = vi.fn();
    const release = vi.fn();

    const client = {
      query,
      release
    } as unknown as PoolClient;

    return {
      client,
      query,
      release
    };
  };

  // ===========================================================================
  // Database fixtures
  // ===========================================================================

  const mockUserRow = {
    id: 101,
    role_id: 2,
    full_name: "Test User",
    display_name: "Test",
    username: "testuser",
    email: "test@example.com",
    mobile: "9876543210",
    profile_image_url: null,
    last_login_at: null,
    password_changed_at: null,
    must_change_password: true,
    password_expires_at: null,
    failed_login_count: 0,
    status: "ACTIVE",
    created_by: 1,
    created_at: new Date("2026-01-01T10:00:00.000Z"),
    updated_by: 1,
    updated_at: new Date("2026-01-01T10:00:00.000Z")
  };

  const expectedUser: User = {
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
    createdAt: mockUserRow.created_at,
    updatedBy: 1,
    updatedAt: mockUserRow.updated_at
  };

  const createInput: CreateUserInput = {
    fullName: "New User",
    displayName: "New",
    username: "newuser",
    email: "new@example.com",
    mobile: "9876543211",
    password: "password123",
    roleId: 2,
    profileImageUrl: "https://example.com/profile.jpg",
    mustChangePassword: true,
    passwordExpiresAt: "2026-12-31T23:59:59.000Z"
  };

  const updateInput: UpdateUserInput = {
    fullName: "Updated User",
    displayName: "Updated",
    email: "updated@example.com",
    mobile: "9876543222",
    profileImageUrl: "https://example.com/updated.jpg",
    status: "ACTIVE",
    mustChangePassword: false,
    password: "newpassword123",
    passwordExpiresAt: "2027-12-31T23:59:59.000Z"
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // findById
  // ===========================================================================

  describe("findById", () => {
    it("should return mapped user when user exists", async () => {
      poolQueryMock.mockResolvedValue({
        rows: [mockUserRow]
      });

      const result = await repository.findById(101);

      expect(poolQueryMock).toHaveBeenCalledTimes(1);

      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining("WHERE u.id = $1"),
        [101]
      );

      expect(result).toEqual(expectedUser);
    });

    it("should return null when user does not exist", async () => {
      poolQueryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });

    it("should use supplied client instead of pool", async () => {
      const { client, query } = createClient();

      query.mockResolvedValue({
        rows: [mockUserRow]
      });

      const result = await repository.findById(
        101,
        client
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE u.id = $1"),
        [101]
      );

      expect(poolQueryMock).not.toHaveBeenCalled();

      expect(result).toEqual(expectedUser);
    });

    it("should propagate database errors", async () => {
      const error = new Error("Database failure");

      poolQueryMock.mockRejectedValue(error);

      await expect(
        repository.findById(101)
      ).rejects.toThrow(error);
    });
  });

  // ===========================================================================
  // findByUsername
  // ===========================================================================

  describe("findByUsername", () => {
    it("should find user case-insensitively by username", async () => {
      poolQueryMock.mockResolvedValue({
        rows: [mockUserRow]
      });

      const result = await repository.findByUsername(
        "TestUser"
      );

      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "LOWER(u.username) = LOWER($1)"
        ),
        ["TestUser"]
      );

      expect(result).toEqual(expectedUser);
    });

    it("should return null when username does not exist", async () => {
      poolQueryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.findByUsername(
        "unknown"
      );

      expect(result).toBeNull();
    });

    it("should use supplied client", async () => {
      const { client, query } = createClient();

      query.mockResolvedValue({
        rows: [mockUserRow]
      });

      const result = await repository.findByUsername(
        "testuser",
        client
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining(
          "LOWER(u.username) = LOWER($1)"
        ),
        ["testuser"]
      );

      expect(poolQueryMock).not.toHaveBeenCalled();

      expect(result).toEqual(expectedUser);
    });

    it("should propagate database errors", async () => {
      const error = new Error(
        "Username lookup failed"
      );

      poolQueryMock.mockRejectedValue(error);

      await expect(
        repository.findByUsername("testuser")
      ).rejects.toThrow(error);
    });
  });

  // ===========================================================================
  // findByEmail
  // ===========================================================================

  describe("findByEmail", () => {
    it("should find user case-insensitively by email", async () => {
      poolQueryMock.mockResolvedValue({
        rows: [mockUserRow]
      });

      const result = await repository.findByEmail(
        "TEST@EXAMPLE.COM"
      );

      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "LOWER(u.email) = LOWER($1)"
        ),
        ["TEST@EXAMPLE.COM"]
      );

      expect(result).toEqual(expectedUser);
    });

    it("should return null when email does not exist", async () => {
      poolQueryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.findByEmail(
        "missing@example.com"
      );

      expect(result).toBeNull();
    });

    it("should use supplied client", async () => {
      const { client, query } = createClient();

      query.mockResolvedValue({
        rows: [mockUserRow]
      });

      const result = await repository.findByEmail(
        "test@example.com",
        client
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining(
          "LOWER(u.email) = LOWER($1)"
        ),
        ["test@example.com"]
      );

      expect(poolQueryMock).not.toHaveBeenCalled();

      expect(result).toEqual(expectedUser);
    });

    it("should propagate database errors", async () => {
      const error = new Error(
        "Email lookup failed"
      );

      poolQueryMock.mockRejectedValue(error);

      await expect(
        repository.findByEmail("test@example.com")
      ).rejects.toThrow(error);
    });
  });

  // ===========================================================================
  // findByMobile
  // ===========================================================================

  describe("findByMobile", () => {
    it("should find user by mobile number", async () => {
      poolQueryMock.mockResolvedValue({
        rows: [mockUserRow]
      });

      const result = await repository.findByMobile(
        "9876543210"
      );

      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "WHERE u.mobile = $1"
        ),
        ["9876543210"]
      );

      expect(result).toEqual(expectedUser);
    });

    it("should return null when mobile does not exist", async () => {
      poolQueryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.findByMobile(
        "9999999999"
      );

      expect(result).toBeNull();
    });

    it("should use supplied client", async () => {
      const { client, query } = createClient();

      query.mockResolvedValue({
        rows: [mockUserRow]
      });

      const result = await repository.findByMobile(
        "9876543210",
        client
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining(
          "WHERE u.mobile = $1"
        ),
        ["9876543210"]
      );

      expect(poolQueryMock).not.toHaveBeenCalled();

      expect(result).toEqual(expectedUser);
    });

    it("should propagate database errors", async () => {
      const error = new Error(
        "Mobile lookup failed"
      );

      poolQueryMock.mockRejectedValue(error);

      await expect(
        repository.findByMobile("9876543210")
      ).rejects.toThrow(error);
    });
  });

  // ===========================================================================
  // findAll
  // ===========================================================================

  describe("findAll", () => {
    it("should return all users with role information", async () => {
      const row = {
        ...mockUserRow,
        role_code: "EDITOR",
        role_display_name: "Editor"
      };

      poolQueryMock.mockResolvedValue({
        rows: [row]
      });

      const result = await repository.findAll();

      expect(poolQueryMock).toHaveBeenCalledTimes(1);

      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "LEFT JOIN roles r"
        )
      );

      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY")
      );

      expect(result).toEqual([
        {
          ...expectedUser,
          roleCode: "EDITOR",
          roleDisplayName: "Editor"
        }
      ]);
    });

    it("should return an empty array when no users exist", async () => {
      poolQueryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it("should preserve null role information", async () => {
      const row = {
        ...mockUserRow,
        role_code: null,
        role_display_name: null
      };

      poolQueryMock.mockResolvedValue({
        rows: [row]
      });

      const result = await repository.findAll();

      expect(result).toEqual([
        {
          ...expectedUser,
          roleCode: null,
          roleDisplayName: null
        }
      ]);
    });

    it("should propagate database errors", async () => {
      const error = new Error(
        "Failed to retrieve users"
      );

      poolQueryMock.mockRejectedValue(error);

      await expect(
        repository.findAll()
      ).rejects.toThrow(error);
    });
  });

  // ===========================================================================
  // create
  // ===========================================================================

  describe("create", () => {
    it("should create user and user-role inside a transaction", async () => {
      const createdUserRow = {
        ...mockUserRow,
        id: 201,
        username: "newuser"
      };

      const {
        client,
        query,
        release
      } = createClient();

      poolConnectMock.mockResolvedValue(client);

      query
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: [createdUserRow]
        })
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: []
        });

      const result = await repository.create(
        createInput,
        "hashed-password",
        10
      );

      expect(poolConnectMock).toHaveBeenCalledTimes(1);

      expect(query).toHaveBeenNthCalledWith(
        1,
        "BEGIN"
      );

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          "INSERT INTO users"
        ),
        expect.arrayContaining([
          createInput.roleId,
          createInput.fullName,
          createInput.displayName,
          createInput.username,
          createInput.email,
          createInput.mobile,
          "hashed-password"
        ])
      );

      expect(query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining(
          "INSERT INTO user_roles"
        ),
        [
          201,
          createInput.roleId,
          10
        ]
      );

      expect(query).toHaveBeenNthCalledWith(
        4,
        "COMMIT"
      );

      expect(release).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        ...expectedUser,
        id: 201,
        username: "newuser"
      });
    });

    it("should rollback transaction when user creation fails", async () => {
      const {
        client,
        query,
        release
      } = createClient();

      const error = new Error(
        "Insert failed"
      );

      poolConnectMock.mockResolvedValue(client);

      query
        .mockResolvedValueOnce({
          rows: []
        })
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          rows: []
        });

      await expect(
        repository.create(
          createInput,
          "hashed-password",
          10
        )
      ).rejects.toThrow(error);

      expect(query).toHaveBeenNthCalledWith(
        1,
        "BEGIN"
      );

      expect(query).toHaveBeenNthCalledWith(
        3,
        "ROLLBACK"
      );

      expect(release).toHaveBeenCalledTimes(1);
    });

    it("should rollback when user_roles insertion fails", async () => {
      const {
        client,
        query,
        release
      } = createClient();

      const error = new Error(
        "Role assignment failed"
      );

      const createdUserRow = {
        ...mockUserRow,
        id: 202,
        username: "rolefailure"
      };

      poolConnectMock.mockResolvedValue(client);

      query
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: [createdUserRow]
        })
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          rows: []
        });

      await expect(
        repository.create(
          createInput,
          "hashed-password",
          10
        )
      ).rejects.toThrow(error);

      expect(query).toHaveBeenNthCalledWith(
        1,
        "BEGIN"
      );

      expect(query).toHaveBeenNthCalledWith(
        4,
        "ROLLBACK"
      );

      expect(query).not.toHaveBeenCalledWith(
        "COMMIT"
      );

      expect(release).toHaveBeenCalledTimes(1);
    });

    it("should release the client even when rollback fails", async () => {
      const {
        client,
        query,
        release
      } = createClient();

      poolConnectMock.mockResolvedValueOnce(client);

      const originalError = new Error(
        "Original database error"
      );

      const rollbackError = new Error(
        "Rollback failed"
      );

      query
        .mockResolvedValueOnce({
          rows: []
        })
        .mockRejectedValueOnce(originalError)
        .mockRejectedValueOnce(rollbackError);

      await expect(
        repository.create(
          createInput,
          "hashed-password",
          10
        )
      ).rejects.toThrow("Rollback failed");

      expect(query).toHaveBeenNthCalledWith(
        1,
        "BEGIN"
      );

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          "INSERT INTO users"
        ),
        expect.any(Array)
      );

      expect(query).toHaveBeenNthCalledWith(
        3,
        "ROLLBACK"
      );

      expect(release).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // update
  // ===========================================================================

  describe("update", () => {
    it("should update user and return mapped user", async () => {
      const updatedUserRow = {
        ...mockUserRow,
        full_name: "Updated User",
        display_name: "Updated",
        email: "updated@example.com",
        mobile: "9876543222"
      };

      poolQueryMock.mockResolvedValue({
        rows: [updatedUserRow]
      });

      const result = await repository.update(
        101,
        updateInput,
        "new-password-hash",
        55
      );

      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "UPDATE users"
        ),
        [
          updateInput.fullName,
          updateInput.displayName,
          updateInput.email,
          updateInput.mobile,
          updateInput.profileImageUrl,
          updateInput.status,
          updateInput.mustChangePassword,
          "new-password-hash",
          updateInput.passwordExpiresAt,
          55,
          101
        ]
      );

      expect(result).toEqual({
        ...expectedUser,
        fullName: "Updated User",
        displayName: "Updated",
        email: "updated@example.com",
        mobile: "9876543222"
      });
    });

    it("should return null when user does not exist", async () => {
      poolQueryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.update(
        999,
        updateInput,
        null,
        55
      );

      expect(result).toBeNull();
    });

    it("should use supplied client", async () => {
      const {
        client,
        query
      } = createClient();

      query.mockResolvedValue({
        rows: [mockUserRow]
      });

      const result = await repository.update(
        101,
        updateInput,
        "new-password-hash",
        55,
        client
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining(
          "UPDATE users"
        ),
        [
          updateInput.fullName,
          updateInput.displayName,
          updateInput.email,
          updateInput.mobile,
          updateInput.profileImageUrl,
          updateInput.status,
          updateInput.mustChangePassword,
          "new-password-hash",
          updateInput.passwordExpiresAt,
          55,
          101
        ]
      );

      expect(poolQueryMock).not.toHaveBeenCalled();

      expect(result).toEqual(expectedUser);
    });

    it("should propagate database errors", async () => {
      const error = new Error(
        "Update failed"
      );

      poolQueryMock.mockRejectedValue(error);

      await expect(
        repository.update(
          101,
          updateInput,
          null,
          55
        )
      ).rejects.toThrow(error);
    });
  });

  // ===========================================================================
  // deactivate
  // ===========================================================================

  describe("deactivate", () => {
    it("should deactivate user and return mapped user", async () => {
      const inactiveUserRow = {
        ...mockUserRow,
        status: "INACTIVE",
        updated_by: 55
      };

      poolQueryMock.mockResolvedValue({
        rows: [inactiveUserRow]
      });

      const result = await repository.deactivate(
        101,
        55
      );

      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "status = 'INACTIVE'"
        ),
        [55, 101]
      );

      expect(result).toEqual({
        ...expectedUser,
        status: "INACTIVE",
        updatedBy: 55
      });
    });

    it("should return null when user does not exist", async () => {
      poolQueryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.deactivate(
        999,
        55
      );

      expect(result).toBeNull();
    });

    it("should propagate database errors", async () => {
      const error = new Error(
        "Deactivation failed"
      );

      poolQueryMock.mockRejectedValue(error);

      await expect(
        repository.deactivate(
          101,
          55
        )
      ).rejects.toThrow(error);
    });
  });
});