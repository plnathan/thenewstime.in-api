import type {
  PoolClient,
  QueryResult,
  QueryResultRow
} from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assignRole,
  createSession,
  createUser,
  existsByEmail,
  existsByMobile,
  existsByUsername,
  findRoleByCode,
  findRolesByUserId,
  findSessionByRefreshTokenHash,
  findUserById,
  findUserByUsername,
  revokeSession,
  rotateSession,
  updateFailedLogin,
  updateSuccessfulLogin
} from "../auth.repository.js";

import { pool } from "../../../../../shared/config/db.js";

/**
 * ---------------------------------------------------------------------------
 * Mock database pool
 * ---------------------------------------------------------------------------
 *
 * auth.repository.ts imports the database pool from:
 *
 *   ../../../../../shared/config/db.js
 *
 * Therefore the test must mock the same module path.
 */
const mockPoolQuery = vi.hoisted(() => vi.fn());

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: mockPoolQuery
  }
}));

const mockedPool = {
  query: mockPoolQuery
};

/**
 * Create a fake PostgreSQL PoolClient.
 */
const createMockClient = () => {
  return {
    query: vi.fn(),
    release: vi.fn()
  } as unknown as PoolClient & {
    query: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };
};

/**
 * Helper for creating PostgreSQL-like QueryResult objects.
 */
const queryResult = <T extends QueryResultRow>(
  rows: T[],
  rowCount = rows.length
): QueryResult<T> => {
  return {
    rows,
    rowCount,
    command: "SELECT",
    oid: 0,
    fields: []
  };
};

describe("Auth Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // findUserById
  // -------------------------------------------------------------------------

  describe("findUserById", () => {
    it("should return the user when found", async () => {
      const user = {
        id: 101,
        full_name: "Test User",
        display_name: "Test",
        username: "test.user",
        email: "test@example.com",
        mobile: "9876543210",
        password_hash: "hashed-password",
        status: "ACTIVE",
        failed_login_count: 0,
        must_change_password: false,
        password_expires_at: null
      };

      mockPoolQuery.mockResolvedValueOnce(
        queryResult([user])
      );

      const result = await findUserById(101);

      expect(result).toEqual(user);

      expect(mockedPool.query).toHaveBeenCalledTimes(1);

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining("FROM users"),
        [101]
      );
    });

    it("should return null when the user does not exist", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      const result = await findUserById(999);

      expect(result).toBeNull();
    });

    it("should use the supplied client when provided", async () => {
      const client = createMockClient();

      const user = {
        id: 101,
        full_name: "Test User",
        display_name: "Test",
        username: "test.user",
        email: null,
        mobile: null,
        password_hash: "hashed-password",
        status: "ACTIVE",
        failed_login_count: 0,
        must_change_password: false,
        password_expires_at: null
      };

      client.query.mockResolvedValueOnce(
        queryResult([user])
      );

      const result = await findUserById(101, client);

      expect(result).toEqual(user);

      expect(client.query).toHaveBeenCalledTimes(1);

      expect(mockPoolQuery).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // findUserByUsername
  // -------------------------------------------------------------------------

  describe("findUserByUsername", () => {
    it("should find a user case-insensitively", async () => {
      const user = {
        id: 102,
        full_name: "Test User",
        display_name: "Test",
        username: "Test.User",
        email: "test@example.com",
        mobile: null,
        password_hash: "hashed-password",
        status: "ACTIVE",
        failed_login_count: 0,
        must_change_password: false,
        password_expires_at: null
      };

      mockPoolQuery.mockResolvedValueOnce(
        queryResult([user])
      );

      const result = await findUserByUsername(
        "TEST.USER"
      );

      expect(result).toEqual(user);

      /**
       * Production SQL qualifies the username column:
       *
       *   LOWER(u.username) = LOWER($1)
       */
      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "LOWER(u.username)"
        ),
        ["TEST.USER"]
      );
    });

    it("should return null when the username is not found", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      const result = await findUserByUsername(
        "unknown-user"
      );

      expect(result).toBeNull();
    });

    it("should use the supplied client", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([
          {
            id: 103,
            full_name: "Client User",
            display_name: "Client",
            username: "client.user",
            email: null,
            mobile: null,
            password_hash: "hash",
            status: "ACTIVE",
            failed_login_count: 0,
            must_change_password: false,
            password_expires_at: null
          }
        ])
      );

      await findUserByUsername(
        "client.user",
        client
      );

      expect(client.query).toHaveBeenCalledTimes(1);

      expect(mockPoolQuery).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // existsByUsername
  // -------------------------------------------------------------------------

  describe("existsByUsername", () => {
    it("should return true when the username exists", async () => {
      /**
       * Production SQL is:
       *
       *   SELECT 1
       *   FROM users
       *   WHERE LOWER(username) = LOWER($1)
       *   LIMIT 1
       *
       * Therefore existence is represented by the presence
       * of a returned row.
       */
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([{ "?column?": 1 }])
      );

      const result = await existsByUsername(
        "test.user"
      );

      expect(result).toBe(true);

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT 1"),
        ["test.user"]
      );
    });

    it("should return false when the username does not exist", async () => {
      /**
       * No matching username means PostgreSQL returns
       * zero rows.
       */
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      const result = await existsByUsername(
        "unknown.user"
      );

      expect(result).toBe(false);
    });

    it("should use case-insensitive username comparison", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([{ "?column?": 1 }])
      );

      await existsByUsername("TEST.USER");

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "LOWER(username)"
        ),
        ["TEST.USER"]
      );
    });
  });

  // -------------------------------------------------------------------------
  // existsByEmail
  // -------------------------------------------------------------------------

  describe("existsByEmail", () => {
    it("should return true when the email exists", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([{ "?column?": 1 }])
      );

      const result = await existsByEmail(
        "test@example.com"
      );

      expect(result).toBe(true);
    });

    it("should return false when the email does not exist", async () => {
      /**
       * No matching email means zero rows.
       */
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      const result = await existsByEmail(
        "unknown@example.com"
      );

      expect(result).toBe(false);
    });

    it("should use case-insensitive email comparison", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([{ "?column?": 1 }])
      );

      await existsByEmail(
        "TEST@EXAMPLE.COM"
      );

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "LOWER(email)"
        ),
        ["TEST@EXAMPLE.COM"]
      );
    });
  });

  // -------------------------------------------------------------------------
  // existsByMobile
  // -------------------------------------------------------------------------

  describe("existsByMobile", () => {
    it("should return true when the mobile number exists", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([{ "?column?": 1 }])
      );

      const result = await existsByMobile(
        "9876543210"
      );

      expect(result).toBe(true);
    });

    it("should return false when the mobile number does not exist", async () => {
      /**
       * No matching mobile means zero rows.
       */
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      const result = await existsByMobile(
        "9000000000"
      );

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // findRoleByCode
  // -------------------------------------------------------------------------

  describe("findRoleByCode", () => {
    it("should return the role id when an active role exists", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([{ id: 5 }])
      );

      const result = await findRoleByCode(
        "REPORTER",
        client
      );

      expect(result).toBe(5);

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("roles"),
        ["REPORTER"]
      );
    });

    it("should return null when the role does not exist", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([])
      );

      const result = await findRoleByCode(
        "UNKNOWN",
        client
      );

      expect(result).toBeNull();
    });

    it("should use the supplied client", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([{ id: 10 }])
      );

      await findRoleByCode(
        "ADMIN",
        client
      );

      expect(client.query).toHaveBeenCalledTimes(1);

      expect(mockPoolQuery).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // findRolesByUserId
  // -------------------------------------------------------------------------

  describe("findRolesByUserId", () => {
    it("should return all active roles for a user", async () => {
      const roles = [
        {
          id: 1,
          code: "ADMIN",
          display_name: "Administrator"
        },
        {
          id: 2,
          code: "REPORTER",
          display_name: "Reporter"
        }
      ];

      mockPoolQuery.mockResolvedValueOnce(
        queryResult(roles)
      );

      const result = await findRolesByUserId(101);

      expect(result).toEqual(roles);

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining("user_roles"),
        [101]
      );
    });

    it("should return an empty array when the user has no roles", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      const result = await findRolesByUserId(101);

      expect(result).toEqual([]);
    });

    it("should use the supplied client", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([
          {
            id: 2,
            code: "REPORTER",
            display_name: "Reporter"
          }
        ])
      );

      const result = await findRolesByUserId(
        101,
        client
      );

      expect(result).toHaveLength(1);

      expect(client.query).toHaveBeenCalledTimes(1);

      expect(mockPoolQuery).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // assignRole
  // -------------------------------------------------------------------------

  describe("assignRole", () => {
    it("should assign a role to a user", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([])
      );

      await assignRole(
        101,
        5,
        client
      );

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "INSERT INTO user_roles"
        ),
        [101, 5]
      );
    });

    it("should use ON CONFLICT DO NOTHING", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([])
      );

      await assignRole(
        101,
        5,
        client
      );

      const sql =
        client.query.mock.calls[0]?.[0] as string;

      expect(sql).toContain(
        "ON CONFLICT (user_id, role_id)"
      );

      expect(sql).toContain(
        "DO NOTHING"
      );
    });
  });

  // -------------------------------------------------------------------------
  // createUser
  // -------------------------------------------------------------------------

  describe("createUser", () => {
    it("should create and return a new user id", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([{ id: 201 }])
      );

      const result = await createUser(
        {
          fullName: "New User",
          displayName: "New",
          username: "new.user",
          email: "new@example.com",
          mobile: "9876543211",
          passwordHash: "hashed-password",
          roleId: 5
        },
        client
      );

      expect(result).toBe(201);

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "INSERT INTO users"
        ),
        [
          5,
          "New User",
          "New",
          "new.user",
          "new@example.com",
          "9876543211",
          "hashed-password"
        ]
      );
    });

    it("should allow null email and mobile values", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([{ id: 202 }])
      );

      const result = await createUser(
        {
          fullName: "New User",
          displayName: "New",
          username: "new.user",
          email: null,
          mobile: null,
          passwordHash: "hashed-password",
          roleId: 5
        },
        client
      );

      expect(result).toBe(202);
    });

    it("should throw when the insert does not return an id", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([])
      );

      await expect(
        createUser(
          {
            fullName: "New User",
            displayName: "New",
            username: "new.user",
            email: null,
            mobile: null,
            passwordHash: "hashed-password",
            roleId: 5
          },
          client
        )
      ).rejects.toThrow(
        "Failed to create user: no id returned from insert"
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateSuccessfulLogin
  // -------------------------------------------------------------------------

  describe("updateSuccessfulLogin", () => {
    it("should reset failed login count", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      await updateSuccessfulLogin(101);

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "failed_login_count = 0"
        ),
        [101]
      );
    });

    it("should use the supplied client", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([])
      );

      await updateSuccessfulLogin(
        101,
        client
      );

      expect(client.query).toHaveBeenCalledTimes(1);

      expect(mockPoolQuery).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // updateFailedLogin
  // -------------------------------------------------------------------------

  describe("updateFailedLogin", () => {
    it("should increment the failed login count", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      await updateFailedLogin(101);

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "failed_login_count"
        ),
        [101]
      );

      const sql =
        mockedPool.query.mock.calls[0]?.[0] as string;

      expect(sql).toContain(
        "failed_login_count + 1"
      );
    });

    it("should use the supplied client", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([])
      );

      await updateFailedLogin(
        101,
        client
      );

      expect(client.query).toHaveBeenCalledTimes(1);

      expect(mockPoolQuery).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // createSession
  // -------------------------------------------------------------------------

  describe("createSession", () => {
    it("should create a session and return its id", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([{ id: 301 }])
      );

      const expiresAt = new Date(
        "2026-10-01T00:00:00.000Z"
      );

      const result = await createSession({
        userId: 101,
        refreshTokenHash: "refresh-hash",
        expiresAt,
        ipAddress: "127.0.0.1",
        userAgent: "Vitest"
      });

      expect(result).toBe(301);

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "INSERT INTO user_sessions"
        ),
        [
          101,
          "refresh-hash",
          expiresAt,
          "127.0.0.1",
          "Vitest"
        ]
      );
    });

    it("should support a null IP address", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([{ id: 302 }])
      );

      const expiresAt = new Date(
        "2026-10-01T00:00:00.000Z"
      );

      const result = await createSession({
        userId: 101,
        refreshTokenHash: "refresh-hash",
        expiresAt,
        ipAddress: null,
        userAgent: null
      });

      expect(result).toBe(302);
    });

    it("should throw when the insert does not return an id", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      const expiresAt = new Date(
        "2026-10-01T00:00:00.000Z"
      );

      await expect(
        createSession({
          userId: 101,
          refreshTokenHash: "refresh-hash",
          expiresAt,
          ipAddress: null,
          userAgent: null
        })
      ).rejects.toThrow(
        "Failed to create session: no id returned from insert"
      );
    });

    it("should use the supplied client", async () => {
      const client = createMockClient();

      client.query.mockResolvedValueOnce(
        queryResult([{ id: 303 }])
      );

      const expiresAt = new Date(
        "2026-10-01T00:00:00.000Z"
      );

      const result = await createSession(
        {
          userId: 101,
          refreshTokenHash: "refresh-hash",
          expiresAt,
          ipAddress: null,
          userAgent: null
        },
        client
      );

      expect(result).toBe(303);

      expect(client.query).toHaveBeenCalledTimes(1);

      expect(mockPoolQuery).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // findSessionByRefreshTokenHash
  // -------------------------------------------------------------------------

  describe("findSessionByRefreshTokenHash", () => {
    it("should return the session when found", async () => {
      const session = {
        id: 401,
        user_id: 101,
        refresh_token_hash: "hash-401",
        expires_at: new Date(
          "2026-10-01T00:00:00.000Z"
        ),
        created_at: new Date(
          "2026-09-01T00:00:00.000Z"
        ),
        last_used_at: null,
        revoked_at: null
      };

      mockPoolQuery.mockResolvedValueOnce(
        queryResult([session])
      );

      const result =
        await findSessionByRefreshTokenHash(
          "hash-401"
        );

      expect(result).toEqual(session);

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "refresh_token_hash"
        ),
        ["hash-401"]
      );
    });

    it("should return null when the session is not found", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      const result =
        await findSessionByRefreshTokenHash(
          "unknown-hash"
        );

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // rotateSession
  // -------------------------------------------------------------------------

  describe("rotateSession", () => {
    it("should update the refresh token hash and expiry", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      const expiresAt = new Date(
        "2026-11-01T00:00:00.000Z"
      );

      await rotateSession(
        401,
        "new-refresh-hash",
        expiresAt
      );

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "UPDATE user_sessions"
        ),
        [
          "new-refresh-hash",
          expiresAt,
          401
        ]
      );
    });

    it("should update last_used_at", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      const expiresAt = new Date(
        "2026-11-01T00:00:00.000Z"
      );

      await rotateSession(
        401,
        "new-refresh-hash",
        expiresAt
      );

      const sql =
        mockedPool.query.mock.calls[0]?.[0] as string;

      expect(sql).toContain(
        "last_used_at"
      );
    });

    it("should not rotate a revoked session", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      const expiresAt = new Date(
        "2026-11-01T00:00:00.000Z"
      );

      await rotateSession(
        401,
        "new-refresh-hash",
        expiresAt
      );

      const sql =
        mockedPool.query.mock.calls[0]?.[0] as string;

      expect(sql).toContain(
        "revoked_at IS NULL"
      );
    });
  });

  // -------------------------------------------------------------------------
  // revokeSession
  // -------------------------------------------------------------------------

  describe("revokeSession", () => {
    it("should revoke a session", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      await revokeSession(401);

      expect(mockedPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "UPDATE user_sessions"
        ),
        [401]
      );

      const sql =
        mockedPool.query.mock.calls[0]?.[0] as string;

      expect(sql).toContain(
        "revoked_at"
      );
    });

    it("should preserve an existing revoked timestamp", async () => {
      mockPoolQuery.mockResolvedValueOnce(
        queryResult([])
      );

      await revokeSession(401);

      const sql =
        mockedPool.query.mock.calls[0]?.[0] as string;

      expect(sql).toContain(
        "COALESCE(revoked_at, NOW())"
      );
    });
  });
});