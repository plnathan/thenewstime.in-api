import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createAccessToken,
  createRefreshToken,
  getAccessTokenExpiresIn,
  getRefreshTokenExpiry,
  hashRefreshToken,
  verifyAccessToken
} from "../auth.token.js";

import type { AuthUser } from "../auth.types.js";

const TEST_ACCESS_SECRET = "test-access-secret";

const createTestUser = (): AuthUser => ({
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
      code: "ADMIN",
      displayName: "Administrator"
    },
    {
      id: 2,
      code: "REPORTER",
      displayName: "Reporter"
    }
  ]
});

describe("Auth Token Utilities", () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = TEST_ACCESS_SECRET;
    process.env.JWT_ACCESS_EXPIRES_IN = "15m";
    process.env.REFRESH_TOKEN_EXPIRES_DAYS = "30";
  });

  describe("createAccessToken", () => {
    it("should create a valid JWT access token", () => {
      const user = createTestUser();

      const token = createAccessToken(user);

      expect(token).toEqual(expect.any(String));
      expect(token.split(".")).toHaveLength(3);
    });

    it("should include the expected payload", () => {
      const user = createTestUser();

      const token = createAccessToken(user);

      const decoded = jwt.verify(
        token,
        TEST_ACCESS_SECRET
      ) as jwt.JwtPayload & {
        sub: string;
        username: string;
        roles: AuthUser["roles"];
        type: string;
      };

      expect(decoded.sub).toBe("101");
      expect(decoded.username).toBe("test.user");
      expect(decoded.type).toBe("access");
      expect(decoded.roles).toEqual(user.roles);
    });

    it("should use the configured access-token expiry", () => {
      process.env.JWT_ACCESS_EXPIRES_IN = "1h";

      const user = createTestUser();

      const token = createAccessToken(user);

      const decoded = jwt.verify(
        token,
        TEST_ACCESS_SECRET
      ) as jwt.JwtPayload;

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();

      expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toBe(3600);
    });

    it("should use the default expiry when JWT_ACCESS_EXPIRES_IN is not configured", () => {
      delete process.env.JWT_ACCESS_EXPIRES_IN;

      const user = createTestUser();

      const token = createAccessToken(user);

      const decoded = jwt.verify(
        token,
        TEST_ACCESS_SECRET
      ) as jwt.JwtPayload;

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();

      expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toBe(15 * 60);
    });

    it("should throw when JWT_ACCESS_SECRET is not configured", () => {
      delete process.env.JWT_ACCESS_SECRET;

      const user = createTestUser();

      expect(() => createAccessToken(user)).toThrow(
        "JWT_ACCESS_SECRET is not configured."
      );
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify a valid access token", () => {
      const user = createTestUser();

      const token = createAccessToken(user);

      const payload = verifyAccessToken(token);

      expect(payload).toEqual(
        expect.objectContaining({
          sub: "101",
          username: "test.user",
          type: "access",
          roles: user.roles
        })
      );
    });

    it("should reject a token signed with the wrong secret", () => {
      const user = createTestUser();

      const token = jwt.sign(
        {
          sub: String(user.id),
          username: user.username,
          roles: user.roles,
          type: "access"
        },
        "wrong-secret",
        {
          expiresIn: "15m"
        }
      );

      expect(() => verifyAccessToken(token)).toThrow();
    });

    it("should reject an invalid token", () => {
      expect(() => verifyAccessToken("invalid-token")).toThrow();
    });

    it("should reject an expired token", () => {
      const token = jwt.sign(
        {
          sub: "101",
          username: "test.user",
          roles: createTestUser().roles,
          type: "access"
        },
        TEST_ACCESS_SECRET,
        {
          expiresIn: -1
        }
      );

      expect(() => verifyAccessToken(token)).toThrow();
    });

    it("should reject a token with an invalid type", () => {
      const token = jwt.sign(
        {
          sub: "101",
          username: "test.user",
          roles: createTestUser().roles,
          type: "refresh"
        },
        TEST_ACCESS_SECRET,
        {
          expiresIn: "15m"
        }
      );

      expect(() => verifyAccessToken(token)).toThrow(
        "Invalid access token."
      );
    });

    it("should reject a token with a missing subject", () => {
      const token = jwt.sign(
        {
          username: "test.user",
          roles: createTestUser().roles,
          type: "access"
        },
        TEST_ACCESS_SECRET,
        {
          expiresIn: "15m"
        }
      );

      expect(() => verifyAccessToken(token)).toThrow(
        "Invalid access token."
      );
    });

    it("should reject a token with an invalid username", () => {
      const token = jwt.sign(
        {
          sub: "101",
          username: 123,
          roles: createTestUser().roles,
          type: "access"
        },
        TEST_ACCESS_SECRET,
        {
          expiresIn: "15m"
        }
      );

      expect(() => verifyAccessToken(token)).toThrow(
        "Invalid access token."
      );
    });

    it("should reject a token with non-array roles", () => {
      const token = jwt.sign(
        {
          sub: "101",
          username: "test.user",
          roles: "ADMIN",
          type: "access"
        },
        TEST_ACCESS_SECRET,
        {
          expiresIn: "15m"
        }
      );

      expect(() => verifyAccessToken(token)).toThrow(
        "Invalid access token."
      );
    });

    it("should throw when JWT_ACCESS_SECRET is not configured", () => {
      delete process.env.JWT_ACCESS_SECRET;

      expect(() => verifyAccessToken("some-token")).toThrow(
        "JWT_ACCESS_SECRET is not configured."
      );
    });
  });

  describe("createRefreshToken", () => {
    it("should create a refresh token", () => {
      const token = createRefreshToken();

      expect(token).toEqual(expect.any(String));
      expect(token.length).toBe(128);
    });

    it("should create a hexadecimal refresh token", () => {
      const token = createRefreshToken();

      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it("should generate different refresh tokens", () => {
      const token1 = createRefreshToken();
      const token2 = createRefreshToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe("hashRefreshToken", () => {
    it("should return a SHA-256 hash", () => {
      const token = "test-refresh-token";

      const hash = hashRefreshToken(token);

      expect(hash).toEqual(expect.any(String));
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it("should return the same hash for the same token", () => {
      const token = "test-refresh-token";

      const hash1 = hashRefreshToken(token);
      const hash2 = hashRefreshToken(token);

      expect(hash1).toBe(hash2);
    });

    it("should return different hashes for different tokens", () => {
      const hash1 = hashRefreshToken("refresh-token-1");
      const hash2 = hashRefreshToken("refresh-token-2");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("getRefreshTokenExpiry", () => {
    it("should return a Date", () => {
      const expiry = getRefreshTokenExpiry();

      expect(expiry).toBeInstanceOf(Date);
    });

    it("should calculate the expiry using REFRESH_TOKEN_EXPIRES_DAYS", () => {
      process.env.REFRESH_TOKEN_EXPIRES_DAYS = "30";

      const before = Date.now();
      const expiry = getRefreshTokenExpiry();
      const after = Date.now();

      const expectedMinimum =
        before + 30 * 24 * 60 * 60 * 1000;

      const expectedMaximum =
        after + 30 * 24 * 60 * 60 * 1000;

      expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedMinimum);
      expect(expiry.getTime()).toBeLessThanOrEqual(expectedMaximum);
    });

    it("should handle a one-day expiry", () => {
      process.env.REFRESH_TOKEN_EXPIRES_DAYS = "1";

      const before = Date.now();
      const expiry = getRefreshTokenExpiry();
      const after = Date.now();

      const expectedMinimum =
        before + 24 * 60 * 60 * 1000;

      const expectedMaximum =
        after + 24 * 60 * 60 * 1000;

      expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedMinimum);
      expect(expiry.getTime()).toBeLessThanOrEqual(expectedMaximum);
    });

    it("should throw when REFRESH_TOKEN_EXPIRES_DAYS is zero", () => {
      process.env.REFRESH_TOKEN_EXPIRES_DAYS = "0";

      expect(() => getRefreshTokenExpiry()).toThrow(
        "REFRESH_TOKEN_EXPIRES_DAYS must be a positive integer."
      );
    });

    it("should throw when REFRESH_TOKEN_EXPIRES_DAYS is negative", () => {
      process.env.REFRESH_TOKEN_EXPIRES_DAYS = "-5";

      expect(() => getRefreshTokenExpiry()).toThrow(
        "REFRESH_TOKEN_EXPIRES_DAYS must be a positive integer."
      );
    });

    it("should throw when REFRESH_TOKEN_EXPIRES_DAYS is not an integer", () => {
      process.env.REFRESH_TOKEN_EXPIRES_DAYS = "1.5";

      expect(() => getRefreshTokenExpiry()).toThrow(
        "REFRESH_TOKEN_EXPIRES_DAYS must be a positive integer."
      );
    });

    it("should throw when REFRESH_TOKEN_EXPIRES_DAYS is not numeric", () => {
      process.env.REFRESH_TOKEN_EXPIRES_DAYS = "invalid";

      expect(() => getRefreshTokenExpiry()).toThrow(
        "REFRESH_TOKEN_EXPIRES_DAYS must be a positive integer."
      );
    });

    it("should use the default of 30 days when the environment variable is missing", () => {
      delete process.env.REFRESH_TOKEN_EXPIRES_DAYS;

      const before = Date.now();
      const expiry = getRefreshTokenExpiry();
      const after = Date.now();

      const expectedMinimum =
        before + 30 * 24 * 60 * 60 * 1000;

      const expectedMaximum =
        after + 30 * 24 * 60 * 60 * 1000;

      expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedMinimum);
      expect(expiry.getTime()).toBeLessThanOrEqual(expectedMaximum);
    });
  });

  describe("getAccessTokenExpiresIn", () => {
    it("should return the configured access-token expiry", () => {
      process.env.JWT_ACCESS_EXPIRES_IN = "30m";

      expect(getAccessTokenExpiresIn()).toBe("30m");
    });

    it("should return the default expiry when not configured", () => {
      delete process.env.JWT_ACCESS_EXPIRES_IN;

      expect(getAccessTokenExpiresIn()).toBe("15m");
    });
  });
});