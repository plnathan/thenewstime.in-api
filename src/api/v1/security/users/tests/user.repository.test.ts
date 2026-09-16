import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../user.repository.js";

import type { CreateUserInput, UpdateUserInput, User } from "../user.types.js";

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

  const mockRoleRows = [
    {
      role_id: 2,
      role_code: "EDITOR",
      role_display_name: "Editor",
      role_status: "ACTIVE"
    },
    {
      role_id: 3,
      role_code: "REPORTER",
      role_display_name: "Reporter",
      role_status: "ACTIVE"
    }
  ];

  const expectedRoles = [
    {
      id: 2,
      code: "EDITOR",
      displayName: "Editor",
      status: "ACTIVE"
    },
    {
      id: 3,
      code: "REPORTER",
      displayName: "Reporter",
      status: "ACTIVE"
    }
  ];

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

    roles: expectedRoles,

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
    roleIds: [2, 3],
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
     vi.resetAllMocks();
  });

  // ===========================================================================
  // findById
  // ===========================================================================

  describe("findById", () => {
    it("should return mapped user with roles when user exists", async () => {
      poolQueryMock
        .mockResolvedValueOnce({
          rows: [mockUserRow]
        })
        .mockResolvedValueOnce({
          rows: mockRoleRows
        });

      const result = await repository.findById(101);

      expect(poolQueryMock).toHaveBeenCalledTimes(2);

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("WHERE u.id = $1"),
        [101]
      );

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("FROM user_roles ur"),
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

    it("should return user with an empty role list when no roles are assigned", async () => {
      poolQueryMock
        .mockResolvedValueOnce({
          rows: [mockUserRow]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      const result = await repository.findById(101);

      expect(result).toEqual({
        ...expectedUser,
        roles: []
      });
    });

    it("should use supplied client instead of pool", async () => {
      const { client, query } = createClient();

      query
        .mockResolvedValueOnce({
          rows: [mockUserRow]
        })
        .mockResolvedValueOnce({
          rows: mockRoleRows
        });

      const result = await repository.findById(101, client);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("WHERE u.id = $1"),
        [101]
      );

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("FROM user_roles ur"),
        [101]
      );

      expect(poolQueryMock).not.toHaveBeenCalled();

      expect(result).toEqual(expectedUser);
    });

    it("should propagate database errors", async () => {
      const error = new Error("Database failure");

      poolQueryMock.mockRejectedValue(error);

      await expect(repository.findById(101)).rejects.toThrow(error);
    });

    it("should propagate role lookup errors", async () => {
      const error = new Error("Role lookup failed");

      poolQueryMock
        .mockResolvedValueOnce({
          rows: [mockUserRow]
        })
        .mockRejectedValueOnce(error);

      await expect(repository.findById(101)).rejects.toThrow(error);
    });
  });

  // ===========================================================================
  // findByUsername
  // ===========================================================================

  describe("findByUsername", () => {
    it("should find user case-insensitively by username with roles", async () => {
      poolQueryMock
        .mockResolvedValueOnce({
          rows: [mockUserRow]
        })
        .mockResolvedValueOnce({
          rows: mockRoleRows
        });

      const result = await repository.findByUsername("TestUser");

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("LOWER(u.username) = LOWER($1)"),
        ["TestUser"]
      );

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("FROM user_roles ur"),
        [101]
      );

      expect(result).toEqual(expectedUser);
    });

    it("should return null when username does not exist", async () => {
      poolQueryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.findByUsername("unknown");

      expect(result).toBeNull();
    });

    it("should use supplied client", async () => {
      const { client, query } = createClient();

      query
        .mockResolvedValueOnce({
          rows: [mockUserRow]
        })
        .mockResolvedValueOnce({
          rows: mockRoleRows
        });

      const result = await repository.findByUsername("testuser", client);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("LOWER(u.username) = LOWER($1)"),
        ["testuser"]
      );

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("FROM user_roles ur"),
        [101]
      );

      expect(poolQueryMock).not.toHaveBeenCalled();

      expect(result).toEqual(expectedUser);
    });

    it("should propagate database errors", async () => {
      const error = new Error("Username lookup failed");

      poolQueryMock.mockRejectedValue(error);

      await expect(repository.findByUsername("testuser")).rejects.toThrow(
        error
      );
    });
  });

  // ===========================================================================
  // findByEmail
  // ===========================================================================

  describe("findByEmail", () => {
    it("should find user case-insensitively by email with roles", async () => {
      poolQueryMock
        .mockResolvedValueOnce({
          rows: [mockUserRow]
        })
        .mockResolvedValueOnce({
          rows: mockRoleRows
        });

      const result = await repository.findByEmail("TEST@EXAMPLE.COM");

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("LOWER(u.email) = LOWER($1)"),
        ["TEST@EXAMPLE.COM"]
      );

      expect(result).toEqual(expectedUser);
    });

    it("should return null when email does not exist", async () => {
      poolQueryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.findByEmail("missing@example.com");

      expect(result).toBeNull();
    });

    it("should use supplied client", async () => {
      const { client, query } = createClient();

      query
        .mockResolvedValueOnce({
          rows: [mockUserRow]
        })
        .mockResolvedValueOnce({
          rows: mockRoleRows
        });

      const result = await repository.findByEmail("test@example.com", client);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("LOWER(u.email) = LOWER($1)"),
        ["test@example.com"]
      );

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("FROM user_roles ur"),
        [101]
      );

      expect(poolQueryMock).not.toHaveBeenCalled();

      expect(result).toEqual(expectedUser);
    });

    it("should propagate database errors", async () => {
      const error = new Error("Email lookup failed");

      poolQueryMock.mockRejectedValue(error);

      await expect(repository.findByEmail("test@example.com")).rejects.toThrow(
        error
      );
    });
  });

  // ===========================================================================
  // findByMobile
  // ===========================================================================

  describe("findByMobile", () => {
    it("should find user by mobile number with roles", async () => {
      poolQueryMock
        .mockResolvedValueOnce({
          rows: [mockUserRow]
        })
        .mockResolvedValueOnce({
          rows: mockRoleRows
        });

      const result = await repository.findByMobile("9876543210");

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("WHERE u.mobile = $1"),
        ["9876543210"]
      );

      expect(result).toEqual(expectedUser);
    });

    it("should return null when mobile does not exist", async () => {
      poolQueryMock.mockResolvedValue({
        rows: []
      });

      const result = await repository.findByMobile("9999999999");

      expect(result).toBeNull();
    });

    it("should use supplied client", async () => {
      const { client, query } = createClient();

      query
        .mockResolvedValueOnce({
          rows: [mockUserRow]
        })
        .mockResolvedValueOnce({
          rows: mockRoleRows
        });

      const result = await repository.findByMobile("9876543210", client);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("WHERE u.mobile = $1"),
        ["9876543210"]
      );

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("FROM user_roles ur"),
        [101]
      );

      expect(poolQueryMock).not.toHaveBeenCalled();

      expect(result).toEqual(expectedUser);
    });

    it("should propagate database errors", async () => {
      const error = new Error("Mobile lookup failed");

      poolQueryMock.mockRejectedValue(error);

      await expect(repository.findByMobile("9876543210")).rejects.toThrow(
        error
      );
    });
  });

  // ===========================================================================
  // findAll
  // ===========================================================================

  describe("findAll", () => {
    it("should return all users with multiple roles", async () => {
      const row = {
        ...mockUserRow,
        roles: [
          {
            id: 2,
            code: "EDITOR",
            displayName: "Editor",
            status: "ACTIVE"
          },
          {
            id: 3,
            code: "REPORTER",
            displayName: "Reporter",
            status: "ACTIVE"
          }
        ]
      };

      poolQueryMock.mockResolvedValue({
        rows: [row]
      });

      const result = await repository.findAll();

      expect(poolQueryMock).toHaveBeenCalledTimes(1);

      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining("LEFT JOIN user_roles ur")
      );

      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining("json_agg")
      );

      expect(poolQueryMock).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY")
      );

      expect(result).toEqual([
        {
          ...expectedUser,
          roles: [
            {
              id: 2,
              code: "EDITOR",
              displayName: "Editor",
              status: "ACTIVE"
            },
            {
              id: 3,
              code: "REPORTER",
              displayName: "Reporter",
              status: "ACTIVE"
            }
          ]
        }
      ]);
    });

    it("should return an empty roles array when no roles are assigned", async () => {
      const row = {
        ...mockUserRow,
        roles: []
      };

      poolQueryMock.mockResolvedValue({
        rows: [row]
      });

      const result = await repository.findAll();

      expect(result).toEqual([
        {
          ...expectedUser,
          roles: []
        }
      ]);
    });

    it("should handle null or non-array role aggregation safely", async () => {
      const row = {
        ...mockUserRow,
        roles: null
      };

      poolQueryMock.mockResolvedValue({
        rows: [row]
      });

      const result = await repository.findAll();

      expect(result).toEqual([
        {
          ...expectedUser,
          roles: []
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

    it("should propagate database errors", async () => {
      const error = new Error("Failed to retrieve users");

      poolQueryMock.mockRejectedValue(error);

      await expect(repository.findAll()).rejects.toThrow(error);
    });
  });

  // ===========================================================================
  // create
  // ===========================================================================

  describe("create", () => {
    it("should create user and all user-roles inside a transaction", async () => {
      const createdUserRow = {
        ...mockUserRow,
        id: 201,
        role_id: 2,
        username: "newuser"
      };

      const { client, query, release } = createClient();

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
        })
        .mockResolvedValueOnce({
          rows: []
        });

      poolQueryMock
        .mockResolvedValueOnce({
          rows: [createdUserRow]
        })
        .mockResolvedValueOnce({
          rows: mockRoleRows
        });

      const result = await repository.create(
        createInput,
        "hashed-password",
        10
      );

      expect(poolConnectMock).toHaveBeenCalledTimes(1);

      expect(query).toHaveBeenNthCalledWith(1, "BEGIN");

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT INTO users"),
        expect.arrayContaining([
          createInput.roleIds[0],
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
        expect.stringContaining("INSERT INTO user_roles"),
        [201, createInput.roleIds, 10]
      );

      expect(query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining("UPDATE users"),
        [createInput.roleIds[0], 201]
      );

      expect(query).toHaveBeenNthCalledWith(5, "COMMIT");

      expect(release).toHaveBeenCalledTimes(1);

      expect(result).toEqual({
        ...expectedUser,
        id: 201,
        username: "newuser"
      });
    });

    it("should use the first role as the compatibility primary role", async () => {
      const input: CreateUserInput = {
        ...createInput,
        roleIds: [4, 2, 3]
      };

      const createdUserRow = {
        ...mockUserRow,
        id: 203,
        role_id: 4,
        username: "primaryrole"
      };

      const { client, query, release } = createClient();

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
        })
        .mockResolvedValueOnce({
          rows: []
        });

      poolQueryMock
        .mockResolvedValueOnce({
          rows: [createdUserRow]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      await repository.create(input, "hashed-password", 10);

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT INTO users"),
        expect.arrayContaining([4])
      );

      expect(query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining("UPDATE users"),
        [4, 203]
      );

      expect(release).toHaveBeenCalledTimes(1);
    });

    it("should rollback transaction when user creation fails", async () => {
      const { client, query, release } = createClient();

      const error = new Error("Insert failed");

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
        repository.create(createInput, "hashed-password", 10)
      ).rejects.toThrow(error);

      expect(query).toHaveBeenNthCalledWith(1, "BEGIN");

      expect(query).toHaveBeenNthCalledWith(3, "ROLLBACK");

      expect(release).toHaveBeenCalledTimes(1);
    });

    it("should rollback when user_roles insertion fails", async () => {
      const { client, query, release } = createClient();

      const error = new Error("Role assignment failed");

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
        repository.create(createInput, "hashed-password", 10)
      ).rejects.toThrow(error);

      expect(query).toHaveBeenNthCalledWith(1, "BEGIN");

      expect(query).toHaveBeenNthCalledWith(4, "ROLLBACK");

      expect(query).not.toHaveBeenCalledWith("COMMIT");

      expect(release).toHaveBeenCalledTimes(1);
    });

    it("should rollback when primary role synchronization fails", async () => {
      const { client, query, release } = createClient();

      const error = new Error("Primary role synchronization failed");

      const createdUserRow = {
        ...mockUserRow,
        id: 204,
        username: "primaryfailure"
      };

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
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          rows: []
        });

      await expect(
        repository.create(createInput, "hashed-password", 10)
      ).rejects.toThrow(error);

      expect(query).toHaveBeenNthCalledWith(5, "ROLLBACK");

      expect(query).not.toHaveBeenCalledWith("COMMIT");

      expect(release).toHaveBeenCalledTimes(1);
    });

    it("should release the client even when rollback fails", async () => {
      const { client, query, release } = createClient();

      poolConnectMock.mockResolvedValueOnce(client);

      const originalError = new Error("Original database error");

      const rollbackError = new Error("Rollback failed");

      query
        .mockResolvedValueOnce({
          rows: []
        })
        .mockRejectedValueOnce(originalError)
        .mockRejectedValueOnce(rollbackError);

      await expect(
        repository.create(createInput, "hashed-password", 10)
      ).rejects.toThrow("Rollback failed");

      expect(query).toHaveBeenNthCalledWith(1, "BEGIN");

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT INTO users"),
        expect.any(Array)
      );

      expect(query).toHaveBeenNthCalledWith(3, "ROLLBACK");

      expect(release).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // update
  // ===========================================================================

  describe("update", () => {
    it("should update user inside a transaction and return mapped user", async () => {
      const updatedUserRow = {
        ...mockUserRow,
        full_name: "Updated User",
        display_name: "Updated",
        email: "updated@example.com",
        mobile: "9876543222"
      };

      const expectedUpdatedUser: User = {
        ...expectedUser,
        fullName: "Updated User",
        displayName: "Updated",
        email: "updated@example.com",
        mobile: "9876543222"
      };

      const { client, query, release } = createClient();

      poolConnectMock.mockResolvedValue(client);

      query
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: [updatedUserRow]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      poolQueryMock
        .mockResolvedValueOnce({
          rows: [updatedUserRow]
        })
        .mockResolvedValueOnce({
          rows: mockRoleRows
        });

      const result = await repository.update(
        101,
        updateInput,
        "new-password-hash",
        55
      );

      expect(query).toHaveBeenNthCalledWith(1, "BEGIN");

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("UPDATE users"),
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

      expect(query).toHaveBeenNthCalledWith(3, "COMMIT");

      expect(result).toEqual(expectedUpdatedUser);

      expect(release).toHaveBeenCalledTimes(1);
    });

    it("should synchronize multiple roles during update", async () => {
      const input: UpdateUserInput = {
        ...updateInput,
        roleIds: [3, 4]
      };

      const updatedUserRow = {
        ...mockUserRow,
        role_id: 3,
        full_name: "Updated User"
      };

      const { client, query, release } = createClient();

      poolConnectMock.mockResolvedValue(client);

      query
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: [updatedUserRow]
        })
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: []
        });

      poolQueryMock
        .mockResolvedValueOnce({
          rows: [updatedUserRow]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              role_id: 3,
              role_code: "REPORTER",
              role_display_name: "Reporter",
              role_status: "ACTIVE"
            },
            {
              role_id: 4,
              role_code: "EDITOR",
              role_display_name: "Editor",
              role_status: "ACTIVE"
            }
          ]
        });

      const result = await repository.update(101, input, null, 55);

      expect(query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("DELETE FROM user_roles"),
        [101, [3, 4]]
      );

      expect(query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining("INSERT INTO user_roles"),
        [101, [3, 4], 55]
      );

      expect(query).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining("UPDATE users"),
        [3, 55, 101]
      );

      expect(query).toHaveBeenNthCalledWith(6, "COMMIT");

      expect(result).not.toBeNull();

      if (!result) {
        throw new Error("Expected user to be returned.");
      }

      expect(result.roles).toHaveLength(2);

      expect(release).toHaveBeenCalledTimes(1);
    });

    it("should return null when user does not exist", async () => {
      const { client, query, release } = createClient();

      poolConnectMock.mockResolvedValue(client);

      query
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: []
        });

      const result = await repository.update(999, updateInput, null, 55);

      expect(result).toBeNull();

      expect(query).toHaveBeenNthCalledWith(1, "BEGIN");

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("UPDATE users"),
        expect.any(Array)
      );

      expect(query).toHaveBeenNthCalledWith(3, "ROLLBACK");

      expect(query).not.toHaveBeenCalledWith("COMMIT");

      expect(release).toHaveBeenCalledTimes(1);
    });

    it("should use supplied client without opening a transaction", async () => {
      const { client, query } = createClient();

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
        expect.stringContaining("UPDATE users"),
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
      expect(poolConnectMock).not.toHaveBeenCalled();

      expect(result).toEqual({
        ...expectedUser,
        roles: []
      });
    });

    it("should propagate database errors", async () => {
      const { client, query, release } = createClient();

      const error = new Error("Update failed");

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
        repository.update(101, updateInput, null, 55)
      ).rejects.toThrow(error);

      expect(query).toHaveBeenNthCalledWith(3, "ROLLBACK");

      expect(release).toHaveBeenCalledTimes(1);
    });

    it("should rollback when role synchronization fails", async () => {
      const input: UpdateUserInput = {
        ...updateInput,
        roleIds: [2, 3]
      };

      const { client, query, release } = createClient();

      const error = new Error("Role synchronization failed");

      poolConnectMock.mockResolvedValue(client);

      query
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: [mockUserRow]
        })
        .mockResolvedValueOnce({
          rows: []
        })
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          rows: []
        });

      await expect(repository.update(101, input, null, 55)).rejects.toThrow(
        error
      );

      expect(query).toHaveBeenNthCalledWith(5, "ROLLBACK");

      expect(query).not.toHaveBeenCalledWith("COMMIT");

      expect(release).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // deactivate
  // ===========================================================================

  describe("deactivate", () => {
    it("should deactivate user and return mapped user with roles", async () => {
      const inactiveUserRow = {
        ...mockUserRow,
        status: "INACTIVE",
        updated_by: 55
      };

      poolQueryMock
        .mockResolvedValueOnce({
          rows: [inactiveUserRow]
        })
        .mockResolvedValueOnce({
          rows: [inactiveUserRow]
        })
        .mockResolvedValueOnce({
          rows: mockRoleRows
        });

      const result = await repository.deactivate(101, 55);

      expect(poolQueryMock).toHaveBeenCalledTimes(3);

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("status = 'INACTIVE'"),
        [55, 101]
      );

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("WHERE u.id = $1"),
        [101]
      );

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("FROM user_roles ur"),
        [101]
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

      const result = await repository.deactivate(999, 55);

      expect(result).toBeNull();

      expect(poolQueryMock).toHaveBeenCalledTimes(1);
    });

    it("should propagate database errors", async () => {
      const error = new Error("Deactivation failed");

      poolQueryMock.mockRejectedValue(error);

      await expect(repository.deactivate(101, 55)).rejects.toThrow(error);

      expect(poolQueryMock).toHaveBeenCalledTimes(1);
    });

    it("should propagate role lookup errors after deactivation", async () => {
      const inactiveUserRow = {
        ...mockUserRow,
        status: "INACTIVE",
        updated_by: 55
      };

      const error = new Error("Role lookup failed");

      poolQueryMock
        .mockResolvedValueOnce({
          rows: [inactiveUserRow]
        })
        .mockResolvedValueOnce({
          rows: [inactiveUserRow]
        })
        .mockRejectedValueOnce(error);

      await expect(repository.deactivate(101, 55)).rejects.toThrow(error);

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("status = 'INACTIVE'"),
        [55, 101]
      );

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("WHERE u.id = $1"),
        [101]
      );

      expect(poolQueryMock).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("FROM user_roles ur"),
        [101]
      );
    });
  });
});
