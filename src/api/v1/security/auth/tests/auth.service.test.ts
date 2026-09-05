import bcrypt from "bcrypt";
import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as repository from "../auth.repository.js";
import {
  getCurrentUser,
  login,
  logout,
  refresh,
  register
} from "../auth.service.js";

import {
  createAccessToken,
  createRefreshToken,
  getAccessTokenExpiresIn,
  getRefreshTokenExpiry,
  hashRefreshToken
} from "../auth.token.js";

import type { AuthUser, LoginResult, RegisterInput } from "../auth.types.js";

/*
|--------------------------------------------------------------------------
| Mocks
|--------------------------------------------------------------------------
*/

const mockPoolConnect = vi.hoisted(() => vi.fn());

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    connect: mockPoolConnect
  }
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn()
  }
}));

vi.mock("../auth.repository.js", () => ({
  findUserById: vi.fn(),
  findUserByUsername: vi.fn(),
  existsByUsername: vi.fn(),
  existsByEmail: vi.fn(),
  existsByMobile: vi.fn(),
  findRoleByCode: vi.fn(),
  findRolesByUserId: vi.fn(),
  assignRole: vi.fn(),
  createUser: vi.fn(),
  updateSuccessfulLogin: vi.fn(),
  updateFailedLogin: vi.fn(),
  createSession: vi.fn(),
  findSessionByRefreshTokenHash: vi.fn(),
  rotateSession: vi.fn(),
  revokeSession: vi.fn()
}));

vi.mock("../auth.token.js", () => ({
  createAccessToken: vi.fn(),
  createRefreshToken: vi.fn(),
  getAccessTokenExpiresIn: vi.fn(),
  getRefreshTokenExpiry: vi.fn(),
  hashRefreshToken: vi.fn()
}));

const mockedBcrypt = vi.mocked(bcrypt);
const mockedRepository = vi.mocked(repository);

const mockedCreateAccessToken = vi.mocked(createAccessToken);

const mockedCreateRefreshToken = vi.mocked(createRefreshToken);

const mockedGetAccessTokenExpiresIn = vi.mocked(getAccessTokenExpiresIn);

const mockedGetRefreshTokenExpiry = vi.mocked(getRefreshTokenExpiry);

const mockedHashRefreshToken = vi.mocked(hashRefreshToken);

/*
|--------------------------------------------------------------------------
| Test fixtures
|--------------------------------------------------------------------------
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

const createUserRow = (overrides = {}) => {
  return {
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
    password_expires_at: null,
    ...overrides
  };
};

const createRoles = () => {
  return [
    {
      id: 1,
      code: "REPORTER",
      display_name: "Reporter"
    }
  ];
};

const createAuthUser = (): AuthUser => {
  return {
    id: 101,
    fullName: "Test User",
    displayName: "Test",
    username: "test.user",
    email: "test@example.com",
    mobile: "9876543210",
    status: "ACTIVE",
    roles: [
      {
        id: 1,
        code: "REPORTER",
        displayName: "Reporter"
      }
    ]
  };
};

const createLoginResult = (): LoginResult => {
  return {
    user: createAuthUser(),
    tokens: {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: "15m"
    }
  };
};

const createRegisterInput = (
  overrides: Partial<RegisterInput> = {}
): RegisterInput => {
  return {
    fullName: "Test User",
    displayName: "Test",
    username: "test.user",
    password: "Password@123",
    email: "Test@Example.com",
    mobile: " 9876543210 ",
    ...overrides
  };
};

const defaultRole = process.env.SECURITY_DEFAULT_ROLE ?? "REPORTER";

/*
|--------------------------------------------------------------------------
| Tests
|--------------------------------------------------------------------------
*/

describe("Auth Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    /*
    |--------------------------------------------------------------------------
    | Database client
    |--------------------------------------------------------------------------
    */

    mockPoolConnect.mockResolvedValue(createMockClient());

    /*
    |--------------------------------------------------------------------------
    | Repository defaults
    |--------------------------------------------------------------------------
    */

    mockedRepository.existsByUsername.mockResolvedValue(false);

    mockedRepository.existsByEmail.mockResolvedValue(false);

    mockedRepository.existsByMobile.mockResolvedValue(false);

    mockedRepository.findRoleByCode.mockResolvedValue(5);

    mockedRepository.findUserById.mockResolvedValue(createUserRow());

    mockedRepository.findUserByUsername.mockResolvedValue(createUserRow());

    mockedRepository.findRolesByUserId.mockResolvedValue(createRoles());

    mockedRepository.createUser.mockResolvedValue(101);

    mockedRepository.assignRole.mockResolvedValue(undefined);

    mockedRepository.updateSuccessfulLogin.mockResolvedValue(undefined);

    mockedRepository.updateFailedLogin.mockResolvedValue(undefined);

    mockedRepository.createSession.mockResolvedValue(501);

    mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(null);

    mockedRepository.rotateSession.mockResolvedValue(undefined);

    mockedRepository.revokeSession.mockResolvedValue(undefined);

    /*
    |--------------------------------------------------------------------------
    | bcrypt defaults
    |--------------------------------------------------------------------------
    */

    mockedBcrypt.hash.mockResolvedValue("hashed-password" as never);

    mockedBcrypt.compare.mockResolvedValue(true as never);

    /*
    |--------------------------------------------------------------------------
    | Token defaults
    |--------------------------------------------------------------------------
    */

    mockedCreateAccessToken.mockReturnValue("access-token");

    mockedCreateRefreshToken.mockReturnValue("refresh-token");

    mockedHashRefreshToken.mockReturnValue("refresh-token-hash");

    mockedGetRefreshTokenExpiry.mockReturnValue(
      new Date("2026-10-01T00:00:00.000Z")
    );

    mockedGetAccessTokenExpiresIn.mockReturnValue("15m");
  });

  /*
  |--------------------------------------------------------------------------
  | REGISTER
  |--------------------------------------------------------------------------
  */

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const client = createMockClient();

      mockPoolConnect.mockResolvedValue(client);

      const input = createRegisterInput();

      const result = await register(input);

      expect(result).toEqual(createAuthUser());

      expect(client.query).toHaveBeenCalledWith("BEGIN");

      expect(client.query).toHaveBeenCalledWith("COMMIT");

      expect(client.query).not.toHaveBeenCalledWith("ROLLBACK");

      expect(client.release).toHaveBeenCalledTimes(1);

      expect(mockedRepository.existsByUsername).toHaveBeenCalledWith(
        input.username,
        client
      );

      expect(mockedRepository.existsByEmail).toHaveBeenCalledWith(
        "test@example.com",
        client
      );

      expect(mockedRepository.existsByMobile).toHaveBeenCalledWith(
        "9876543210",
        client
      );

      expect(mockedRepository.findRoleByCode).toHaveBeenCalledWith(
        defaultRole,
        client
      );

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(input.password, 12);

      expect(mockedRepository.createUser).toHaveBeenCalledWith(
        {
          fullName: input.fullName,
          displayName: input.displayName,
          username: input.username,
          email: "test@example.com",
          mobile: "9876543210",
          passwordHash: "hashed-password",
          roleId: 5
        },
        client
      );

      expect(mockedRepository.assignRole).toHaveBeenCalledWith(101, 5, client);

      expect(mockedRepository.findUserById).toHaveBeenCalledWith(101, client);

      expect(mockedRepository.findRolesByUserId).toHaveBeenCalledWith(
        101,
        client
      );
    });

    it("should normalize email before checking and storing it", async () => {
      const client = createMockClient();

      mockPoolConnect.mockResolvedValue(client);

      await register(
        createRegisterInput({
          email: "  USER@EXAMPLE.COM  "
        })
      );

      expect(mockedRepository.existsByEmail).toHaveBeenCalledWith(
        "user@example.com",
        client
      );

      expect(mockedRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@example.com"
        }),
        client
      );
    });

    it("should trim mobile before checking and storing it", async () => {
      const client = createMockClient();

      mockPoolConnect.mockResolvedValue(client);

      await register(
        createRegisterInput({
          mobile: "   9876543210   "
        })
      );

      expect(mockedRepository.existsByMobile).toHaveBeenCalledWith(
        "9876543210",
        client
      );

      expect(mockedRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          mobile: "9876543210"
        }),
        client
      );
    });

    it("should store null when email is not supplied", async () => {
      const client = createMockClient();

      mockPoolConnect.mockResolvedValue(client);

      await register(
        createRegisterInput({
          email: undefined
        })
      );

      expect(mockedRepository.existsByEmail).not.toHaveBeenCalled();

      expect(mockedRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: null
        }),
        client
      );
    });

    it("should store null when mobile is not supplied", async () => {
      const client = createMockClient();

      mockPoolConnect.mockResolvedValue(client);

      const input: RegisterInput = {
        fullName: "Test User",
        displayName: "Test",
        username: "test.user",
        password: "Password@123",
        email: "test@example.com"
      };

      await register(input);

      expect(mockedRepository.existsByMobile).not.toHaveBeenCalled();

      expect(mockedRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          mobile: null
        }),
        client
      );
    });

    it("should reject a duplicate username", async () => {
      const client = createMockClient();

      mockPoolConnect.mockResolvedValue(client);

      mockedRepository.existsByUsername.mockResolvedValue(true);

      await expect(register(createRegisterInput())).rejects.toMatchObject({
        statusCode: 409,
        message: "Username is already registered."
      });

      expect(mockedRepository.existsByEmail).not.toHaveBeenCalled();

      expect(mockedRepository.existsByMobile).not.toHaveBeenCalled();

      expect(mockedRepository.findRoleByCode).not.toHaveBeenCalled();

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();

      expect(mockedRepository.createUser).not.toHaveBeenCalled();

      expect(client.query).toHaveBeenCalledWith("ROLLBACK");

      expect(client.query).not.toHaveBeenCalledWith("COMMIT");

      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("should reject a duplicate email", async () => {
      const client = createMockClient();

      mockPoolConnect.mockResolvedValue(client);

      mockedRepository.existsByEmail.mockResolvedValue(true);

      await expect(register(createRegisterInput())).rejects.toMatchObject({
        statusCode: 409,
        message: "Email is already registered."
      });

      expect(mockedRepository.existsByMobile).not.toHaveBeenCalled();

      expect(mockedRepository.findRoleByCode).not.toHaveBeenCalled();

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();

      expect(mockedRepository.createUser).not.toHaveBeenCalled();

      expect(client.query).toHaveBeenCalledWith("ROLLBACK");

      expect(client.query).not.toHaveBeenCalledWith("COMMIT");

      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("should reject a duplicate mobile number", async () => {
      const client = createMockClient();

      mockPoolConnect.mockResolvedValue(client);

      mockedRepository.existsByMobile.mockResolvedValue(true);

      await expect(register(createRegisterInput())).rejects.toMatchObject({
        statusCode: 409,
        message: "Mobile number is already registered."
      });

      expect(mockedRepository.findRoleByCode).not.toHaveBeenCalled();

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();

      expect(mockedRepository.createUser).not.toHaveBeenCalled();

      expect(client.query).toHaveBeenCalledWith("ROLLBACK");

      expect(client.query).not.toHaveBeenCalledWith("COMMIT");

      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("should reject registration when the default role does not exist", async () => {
      const client = createMockClient();

      mockPoolConnect.mockResolvedValue(client);

      mockedRepository.findRoleByCode.mockResolvedValue(null);

      await expect(register(createRegisterInput())).rejects.toMatchObject({
        statusCode: 500,
        message: `Default role '${defaultRole}' was not found.`
      });

      expect(mockedBcrypt.hash).not.toHaveBeenCalled();

      expect(mockedRepository.createUser).not.toHaveBeenCalled();

      expect(client.query).toHaveBeenCalledWith("ROLLBACK");

      expect(client.query).not.toHaveBeenCalledWith("COMMIT");

      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("should rollback when createUser fails", async () => {
      const client = createMockClient();

      mockPoolConnect.mockResolvedValue(client);

      const error = new Error("Database insert failed");

      mockedRepository.createUser.mockRejectedValue(error);

      await expect(register(createRegisterInput())).rejects.toThrow(
        "Database insert failed"
      );

      expect(client.query).toHaveBeenCalledWith("BEGIN");

      expect(client.query).toHaveBeenCalledWith("ROLLBACK");

      expect(client.query).not.toHaveBeenCalledWith("COMMIT");

      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("should rollback when assignRole fails", async () => {
      const client = createMockClient();

      mockPoolConnect.mockResolvedValue(client);

      mockedRepository.assignRole.mockRejectedValue(
        new Error("Role assignment failed")
      );

      await expect(register(createRegisterInput())).rejects.toThrow(
        "Role assignment failed"
      );

      expect(client.query).toHaveBeenCalledWith("BEGIN");

      expect(client.query).toHaveBeenCalledWith("ROLLBACK");

      expect(client.query).not.toHaveBeenCalledWith("COMMIT");

      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("should rollback when building the authenticated user fails", async () => {
      const client = createMockClient();

      mockPoolConnect.mockResolvedValue(client);

      mockedRepository.findUserById.mockResolvedValue(null);

      await expect(register(createRegisterInput())).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found."
      });

      expect(client.query).toHaveBeenCalledWith("BEGIN");

      expect(client.query).toHaveBeenCalledWith("ROLLBACK");

      expect(client.query).not.toHaveBeenCalledWith("COMMIT");

      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });

  /*
  |--------------------------------------------------------------------------
  | LOGIN
  |--------------------------------------------------------------------------
  */

  describe("login", () => {
    it("should login successfully", async () => {
      const result = await login(
        "test.user",
        "Password@123",
        "127.0.0.1",
        "Vitest"
      );

      expect(result).toEqual(createLoginResult());

      expect(mockedRepository.findUserByUsername).toHaveBeenCalledWith(
        "test.user"
      );

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        "Password@123",
        "hashed-password"
      );

      /*
      |----------------------------------------------------------------------
      | FIX:
      | buildAuthUser() calls these repository methods with the optional
      | client argument omitted, which Vitest records as undefined.
      |----------------------------------------------------------------------
      */

      expect(mockedRepository.findUserById).toHaveBeenCalledWith(
        101,
        undefined
      );

      expect(mockedRepository.findRolesByUserId).toHaveBeenCalledWith(
        101,
        undefined
      );

      expect(mockedCreateAccessToken).toHaveBeenCalledWith(createAuthUser());

      expect(mockedCreateRefreshToken).toHaveBeenCalledTimes(1);

      expect(mockedHashRefreshToken).toHaveBeenCalledWith("refresh-token");

      expect(mockedGetRefreshTokenExpiry).toHaveBeenCalledTimes(1);

      expect(mockedRepository.updateSuccessfulLogin).toHaveBeenCalledWith(101);

      expect(mockedRepository.createSession).toHaveBeenCalledWith({
        userId: 101,
        refreshTokenHash: "refresh-token-hash",
        expiresAt: new Date("2026-10-01T00:00:00.000Z"),
        ipAddress: "127.0.0.1",
        userAgent: "Vitest"
      });

      expect(mockedGetAccessTokenExpiresIn).toHaveBeenCalledTimes(1);

      expect(mockedRepository.updateFailedLogin).not.toHaveBeenCalled();
    });

    it("should reject an unknown username", async () => {
      mockedRepository.findUserByUsername.mockResolvedValue(null);

      await expect(
        login("unknown", "Password@123", null, null)
      ).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid username or password."
      });

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();

      expect(mockedRepository.updateFailedLogin).not.toHaveBeenCalled();

      expect(mockedRepository.createSession).not.toHaveBeenCalled();
    });

    it("should reject an inactive account", async () => {
      mockedRepository.findUserByUsername.mockResolvedValue(
        createUserRow({
          status: "INACTIVE"
        })
      );

      await expect(
        login("test.user", "Password@123", null, null)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Your account is not active."
      });

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();

      expect(mockedRepository.updateFailedLogin).not.toHaveBeenCalled();

      expect(mockedRepository.createSession).not.toHaveBeenCalled();
    });

    it("should reject an expired password", async () => {
      mockedRepository.findUserByUsername.mockResolvedValue(
        createUserRow({
          password_expires_at: new Date("2020-01-01T00:00:00.000Z")
        })
      );

      await expect(
        login("test.user", "Password@123", null, null)
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Your password has expired."
      });

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();

      expect(mockedRepository.updateFailedLogin).not.toHaveBeenCalled();

      expect(mockedRepository.createSession).not.toHaveBeenCalled();
    });

    it("should reject an incorrect password", async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        login("test.user", "WrongPassword", null, null)
      ).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid username or password."
      });

      expect(mockedRepository.updateFailedLogin).toHaveBeenCalledWith(101);

      expect(mockedRepository.updateSuccessfulLogin).not.toHaveBeenCalled();

      expect(mockedRepository.createSession).not.toHaveBeenCalled();

      expect(mockedCreateAccessToken).not.toHaveBeenCalled();
    });

    it("should accept a null IP address and user agent", async () => {
      const result = await login("test.user", "Password@123", null, null);

      expect(result).toEqual(createLoginResult());

      expect(mockedRepository.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: null,
          userAgent: null
        })
      );
    });

    it("should not update failed login count for inactive accounts", async () => {
      mockedRepository.findUserByUsername.mockResolvedValue(
        createUserRow({
          status: "LOCKED"
        })
      );

      await expect(
        login("test.user", "Password@123", null, null)
      ).rejects.toMatchObject({
        statusCode: 403
      });

      expect(mockedRepository.updateFailedLogin).not.toHaveBeenCalled();
    });

    it("should reject login when the authenticated user cannot be loaded", async () => {
      mockedRepository.findUserById.mockResolvedValue(null);

      await expect(
        login("test.user", "Password@123", null, null)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found."
      });

      expect(mockedCreateAccessToken).not.toHaveBeenCalled();

      expect(mockedRepository.createSession).not.toHaveBeenCalled();
    });
  });

  /*
  |--------------------------------------------------------------------------
  | REFRESH
  |--------------------------------------------------------------------------
  */

  describe("refresh", () => {
    const createSession = (overrides = {}) => {
      return {
        id: 501,
        user_id: 101,
        refresh_token_hash: "old-token-hash",
        expires_at: new Date("2099-10-01T00:00:00.000Z"),
        created_at: new Date("2026-09-01T00:00:00.000Z"),
        last_used_at: null,
        revoked_at: null,
        ...overrides
      };
    };

    it("should refresh a valid session successfully", async () => {
      mockedHashRefreshToken
        .mockReturnValueOnce("old-token-hash")
        .mockReturnValueOnce("new-token-hash");

      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(
        createSession()
      );

      const result = await refresh("old-refresh-token");

      expect(result).toEqual({
        user: createAuthUser(),
        tokens: {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresIn: "15m"
        }
      });

      expect(mockedHashRefreshToken).toHaveBeenNthCalledWith(
        1,
        "old-refresh-token"
      );

      expect(
        mockedRepository.findSessionByRefreshTokenHash
      ).toHaveBeenCalledWith("old-token-hash");

      expect(mockedRepository.findUserById).toHaveBeenCalledWith(101);

      expect(mockedCreateAccessToken).toHaveBeenCalledWith(createAuthUser());

      expect(mockedCreateRefreshToken).toHaveBeenCalledTimes(1);

      expect(mockedHashRefreshToken).toHaveBeenNthCalledWith(
        2,
        "refresh-token"
      );

      expect(mockedRepository.rotateSession).toHaveBeenCalledWith(
        501,
        "new-token-hash",
        new Date("2026-10-01T00:00:00.000Z")
      );

      expect(mockedRepository.createSession).not.toHaveBeenCalled();

      expect(mockedRepository.revokeSession).not.toHaveBeenCalled();
    });

    it("should reject an unknown refresh token", async () => {
      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(null);

      await expect(refresh("unknown-token")).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid refresh token."
      });

      expect(mockedRepository.revokeSession).not.toHaveBeenCalled();

      expect(mockedRepository.findUserById).not.toHaveBeenCalled();

      expect(mockedCreateAccessToken).not.toHaveBeenCalled();
    });

    it("should reject a revoked refresh token", async () => {
      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(
        createSession({
          revoked_at: new Date("2026-09-02T00:00:00.000Z")
        })
      );

      await expect(refresh("revoked-token")).rejects.toMatchObject({
        statusCode: 401,
        message: "Refresh token has been revoked."
      });

      expect(mockedRepository.revokeSession).not.toHaveBeenCalled();

      expect(mockedRepository.findUserById).not.toHaveBeenCalled();
    });

    it("should reject and revoke an expired refresh token", async () => {
      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(
        createSession({
          expires_at: new Date("2020-01-01T00:00:00.000Z")
        })
      );

      await expect(refresh("expired-token")).rejects.toMatchObject({
        statusCode: 401,
        message: "Refresh token has expired."
      });

      expect(mockedRepository.revokeSession).toHaveBeenCalledWith(501);

      expect(mockedRepository.findUserById).not.toHaveBeenCalled();

      expect(mockedRepository.rotateSession).not.toHaveBeenCalled();
    });

    it("should reject and revoke the session when the user no longer exists", async () => {
      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(
        createSession()
      );

      mockedRepository.findUserById.mockResolvedValue(null);

      await expect(refresh("valid-token")).rejects.toMatchObject({
        statusCode: 401,
        message: "User account no longer exists."
      });

      expect(mockedRepository.revokeSession).toHaveBeenCalledWith(501);

      expect(mockedRepository.rotateSession).not.toHaveBeenCalled();
    });

    it("should reject and revoke the session when the user is inactive", async () => {
      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(
        createSession()
      );

      mockedRepository.findUserById.mockResolvedValue(
        createUserRow({
          status: "INACTIVE"
        })
      );

      await expect(refresh("valid-token")).rejects.toMatchObject({
        statusCode: 403,
        message: "Your account is not active."
      });

      expect(mockedRepository.revokeSession).toHaveBeenCalledWith(501);

      expect(mockedRepository.rotateSession).not.toHaveBeenCalled();
    });

    it("should create a new access token during refresh", async () => {
      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(
        createSession()
      );

      await refresh("valid-token");

      expect(mockedCreateAccessToken).toHaveBeenCalledWith(createAuthUser());
    });

    it("should generate and hash a new refresh token", async () => {
      mockedHashRefreshToken
        .mockReturnValueOnce("old-token-hash")
        .mockReturnValueOnce("new-token-hash");

      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(
        createSession()
      );

      await refresh("valid-token");

      expect(mockedCreateRefreshToken).toHaveBeenCalledTimes(1);

      expect(mockedHashRefreshToken).toHaveBeenNthCalledWith(1, "valid-token");

      expect(mockedHashRefreshToken).toHaveBeenNthCalledWith(
        2,
        "refresh-token"
      );

      expect(mockedHashRefreshToken).toHaveBeenCalledTimes(2);
    });

    it("should rotate the existing session instead of creating a new session", async () => {
      mockedHashRefreshToken
        .mockReturnValueOnce("old-token-hash")
        .mockReturnValueOnce("new-token-hash");

      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(
        createSession()
      );

      await refresh("valid-token");

      expect(mockedRepository.rotateSession).toHaveBeenCalledTimes(1);

      expect(mockedRepository.createSession).not.toHaveBeenCalled();
    });

    it("should propagate an error when session rotation fails", async () => {
      mockedHashRefreshToken
        .mockReturnValueOnce("old-token-hash")
        .mockReturnValueOnce("new-token-hash");

      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(
        createSession()
      );

      mockedRepository.rotateSession.mockRejectedValue(
        new Error("Session rotation failed")
      );

      await expect(refresh("valid-token")).rejects.toThrow(
        "Session rotation failed"
      );
    });
  });

  /*
  |--------------------------------------------------------------------------
  | LOGOUT
  |--------------------------------------------------------------------------
  */

  describe("logout", () => {
    it("should revoke an existing session", async () => {
      mockedHashRefreshToken.mockReturnValue("refresh-hash");

      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue({
        id: 501,
        user_id: 101,
        refresh_token_hash: "refresh-hash",
        expires_at: new Date("2099-10-01T00:00:00.000Z"),
        created_at: new Date("2026-09-01T00:00:00.000Z"),
        last_used_at: null,
        revoked_at: null
      });

      await logout("refresh-token");

      expect(mockedHashRefreshToken).toHaveBeenCalledWith("refresh-token");

      expect(
        mockedRepository.findSessionByRefreshTokenHash
      ).toHaveBeenCalledWith("refresh-hash");

      expect(mockedRepository.revokeSession).toHaveBeenCalledWith(501);
    });

    it("should do nothing when the refresh token session does not exist", async () => {
      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(null);

      await expect(logout("unknown-token")).resolves.toBeUndefined();

      expect(mockedRepository.revokeSession).not.toHaveBeenCalled();
    });

    it("should hash the supplied refresh token before searching", async () => {
      mockedHashRefreshToken.mockReturnValue("hashed-token");

      mockedRepository.findSessionByRefreshTokenHash.mockResolvedValue(null);

      await logout("plain-refresh-token");

      expect(mockedHashRefreshToken).toHaveBeenCalledWith(
        "plain-refresh-token"
      );

      expect(
        mockedRepository.findSessionByRefreshTokenHash
      ).toHaveBeenCalledWith("hashed-token");
    });
  });

  /*
  |--------------------------------------------------------------------------
  | CURRENT USER
  |--------------------------------------------------------------------------
  */

  describe("getCurrentUser", () => {
    it("should return the authenticated user", async () => {
      const result = await getCurrentUser(101);

      expect(result).toEqual(createAuthUser());

      expect(mockedRepository.findUserById).toHaveBeenCalledWith(
        101,
        undefined
      );

      expect(mockedRepository.findRolesByUserId).toHaveBeenCalledWith(
        101,
        undefined
      );
    });

    it("should throw when the user does not exist", async () => {
      mockedRepository.findUserById.mockResolvedValue(null);

      await expect(getCurrentUser(999)).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found."
      });

      expect(mockedRepository.findRolesByUserId).not.toHaveBeenCalled();
    });

    it("should map database user fields to AuthUser fields", async () => {
      mockedRepository.findUserById.mockResolvedValue(
        createUserRow({
          id: 777,
          full_name: "John Doe",
          display_name: "John",
          username: "john.doe",
          email: "john@example.com",
          mobile: "9999999999",
          status: "ACTIVE"
        })
      );

      mockedRepository.findRolesByUserId.mockResolvedValue([
        {
          id: 10,
          code: "ADMIN",
          display_name: "Administrator"
        },
        {
          id: 20,
          code: "EDITOR",
          display_name: "Editor"
        }
      ]);

      const result = await getCurrentUser(777);

      expect(result).toEqual({
        id: 777,
        fullName: "John Doe",
        displayName: "John",
        username: "john.doe",
        email: "john@example.com",
        mobile: "9999999999",
        status: "ACTIVE",
        roles: [
          {
            id: 10,
            code: "ADMIN",
            displayName: "Administrator"
          },
          {
            id: 20,
            code: "EDITOR",
            displayName: "Editor"
          }
        ]
      });
    });

    it("should return an empty roles array when the user has no roles", async () => {
      mockedRepository.findRolesByUserId.mockResolvedValue([]);

      const result = await getCurrentUser(101);

      expect(result.roles).toEqual([]);

      expect(mockedRepository.findRolesByUserId).toHaveBeenCalledWith(
        101,
        undefined
      );
    });
  });
});
