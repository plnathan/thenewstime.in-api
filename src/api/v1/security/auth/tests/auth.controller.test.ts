import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as authController from "../auth.controller.js";
import * as authService from "../auth.service.js";

import { sendSuccess } from "../../../../../shared/utils/response.js";

import type { AuthUser, LoginResult } from "../auth.types.js";

/*
 * ---------------------------------------------------------------------------
 * Mocks
 * ---------------------------------------------------------------------------
 */

vi.mock("../auth.service.js");

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: vi.fn()
}));

/*
 * ---------------------------------------------------------------------------
 * Test fixtures
 * ---------------------------------------------------------------------------
 */

const mockUser: AuthUser = {
  id: 101,
  fullName: "Test Reporter",
  displayName: "Test Reporter",
  username: "test.reporter",
  email: "reporter@test.com",
  mobile: "9876543210",
  status: "ACTIVE",
  roles: [
    {
      id: 3,
      code: "REPORTER",
      displayName: "Reporter"
    }
  ]
};

const mockLoginResult: LoginResult = {
  user: mockUser,
  tokens: {
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    expiresIn: "15m"
  }
};

/*
 * Authenticated user fixture.
 *
 * Express Request.user in this project uses AuthenticatedUser,
 * which requires username and roles in addition to id.
 */
const mockAuthenticatedUser = {
  id: 101,
  username: "test.reporter",
  roles: [
    {
      id: 3,
      code: "REPORTER",
      displayName: "Reporter"
    }
  ]
};

/*
 * ---------------------------------------------------------------------------
 * Express mocks
 * ---------------------------------------------------------------------------
 */

const req = {} as Request;

const res = {} as Response;

const next: NextFunction = vi.fn();

/*
 * ---------------------------------------------------------------------------
 * Reset
 * ---------------------------------------------------------------------------
 */

beforeEach(() => {
  vi.clearAllMocks();

  req.body = undefined;

  /*
   * Express Request.ip is readonly.
   * Define it instead of assigning to req.ip.
   */
  Object.defineProperty(req, "ip", {
    configurable: true,
    value: undefined
  });

  /*
   * Mock req.get().
   */
  Object.defineProperty(req, "get", {
    configurable: true,
    value: vi.fn()
  });

  /*
   * Authenticated user required by Express Request extension.
   */
  Object.defineProperty(req, "user", {
    configurable: true,
    value: mockAuthenticatedUser
  });
});

/*
 * ===========================================================================
 * register()
 * ===========================================================================
 */

describe("register()", () => {
  it("should register a user successfully", async () => {
    req.body = {
      fullName: "Test Reporter",
      displayName: "Test Reporter",
      username: "test.reporter",
      password: "Password@123",
      email: "reporter@test.com",
      mobile: "9876543210"
    };

    vi.mocked(authService.register).mockResolvedValue(mockUser);

    await authController.register(req, res, next);

    expect(authService.register).toHaveBeenCalledOnce();

    expect(authService.register).toHaveBeenCalledWith(req.body);

    expect(sendSuccess).toHaveBeenCalledOnce();

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Registration successful.",
      mockUser,
      201
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("should forward service error to next()", async () => {
    const error = new Error("Registration failed.");

    req.body = {
      fullName: "Test Reporter",
      displayName: "Test Reporter",
      username: "test.reporter",
      password: "Password@123"
    };

    vi.mocked(authService.register).mockRejectedValue(error);

    await authController.register(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    expect(next).toHaveBeenCalledWith(error);

    expect(sendSuccess).not.toHaveBeenCalled();
  });
});

/*
 * ===========================================================================
 * login()
 * ===========================================================================
 */

describe("login()", () => {
  it("should login successfully", async () => {
    req.body = {
      username: "test.reporter",
      password: "Password@123"
    };

    Object.defineProperty(req, "ip", {
      configurable: true,
      value: "127.0.0.1"
    });

    vi.mocked(req.get as ReturnType<typeof vi.fn>).mockReturnValue(
      "Mozilla/5.0"
    );

    vi.mocked(authService.login).mockResolvedValue(mockLoginResult);

    await authController.login(req, res, next);

    expect(authService.login).toHaveBeenCalledOnce();

    expect(authService.login).toHaveBeenCalledWith(
      "test.reporter",
      "Password@123",
      "127.0.0.1",
      "Mozilla/5.0"
    );

    expect(sendSuccess).toHaveBeenCalledOnce();

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Login successful.",
      mockLoginResult
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("should pass null IP and user-agent when they are unavailable", async () => {
    req.body = {
      username: "test.reporter",
      password: "Password@123"
    };

    Object.defineProperty(req, "ip", {
      configurable: true,
      value: undefined
    });

    vi.mocked(req.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    vi.mocked(authService.login).mockResolvedValue(mockLoginResult);

    await authController.login(req, res, next);

    expect(authService.login).toHaveBeenCalledWith(
      "test.reporter",
      "Password@123",
      null,
      null
    );

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Login successful.",
      mockLoginResult
    );
  });

  it("should forward service error to next()", async () => {
    const error = new Error("Invalid username or password.");

    req.body = {
      username: "test.reporter",
      password: "WrongPassword"
    };

    Object.defineProperty(req, "ip", {
      configurable: true,
      value: "127.0.0.1"
    });

    vi.mocked(req.get as ReturnType<typeof vi.fn>).mockReturnValue(
      "Mozilla/5.0"
    );

    vi.mocked(authService.login).mockRejectedValue(error);

    await authController.login(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    expect(next).toHaveBeenCalledWith(error);

    expect(sendSuccess).not.toHaveBeenCalled();
  });
});

/*
 * ===========================================================================
 * refresh()
 * ===========================================================================
 */

describe("refresh()", () => {
  it("should refresh tokens successfully", async () => {
    req.body = {
      refreshToken: "mock-refresh-token"
    };

    vi.mocked(authService.refresh).mockResolvedValue(mockLoginResult);

    await authController.refresh(req, res, next);

    expect(authService.refresh).toHaveBeenCalledOnce();

    expect(authService.refresh).toHaveBeenCalledWith("mock-refresh-token");

    expect(sendSuccess).toHaveBeenCalledOnce();

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Token refreshed successfully.",
      mockLoginResult
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("should forward service error to next()", async () => {
    const error = new Error("Invalid refresh token.");

    req.body = {
      refreshToken: "invalid-refresh-token"
    };

    vi.mocked(authService.refresh).mockRejectedValue(error);

    await authController.refresh(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    expect(next).toHaveBeenCalledWith(error);

    expect(sendSuccess).not.toHaveBeenCalled();
  });
});

/*
 * ===========================================================================
 * logout()
 * ===========================================================================
 */

describe("logout()", () => {
  it("should logout successfully", async () => {
    req.body = {
      refreshToken: "mock-refresh-token"
    };

    vi.mocked(authService.logout).mockResolvedValue(undefined);

    await authController.logout(req, res, next);

    expect(authService.logout).toHaveBeenCalledOnce();

    expect(authService.logout).toHaveBeenCalledWith("mock-refresh-token");

    expect(sendSuccess).toHaveBeenCalledOnce();

    expect(sendSuccess).toHaveBeenCalledWith(res, "Logout successful.");

    expect(next).not.toHaveBeenCalled();
  });

  it("should forward service error to next()", async () => {
    const error = new Error("Logout failed.");

    req.body = {
      refreshToken: "mock-refresh-token"
    };

    vi.mocked(authService.logout).mockRejectedValue(error);

    await authController.logout(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    expect(next).toHaveBeenCalledWith(error);

    expect(sendSuccess).not.toHaveBeenCalled();
  });
});

/*
 * ===========================================================================
 * me()
 * ===========================================================================
 */

describe("me()", () => {
  it("should return the current authenticated user", async () => {
    Object.defineProperty(req, "user", {
      configurable: true,
      value: mockAuthenticatedUser
    });

    vi.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);

    await authController.me(req, res, next);

    expect(authService.getCurrentUser).toHaveBeenCalledOnce();

    expect(authService.getCurrentUser).toHaveBeenCalledWith(101);

    expect(sendSuccess).toHaveBeenCalledOnce();

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Current user retrieved successfully.",
      mockUser
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("should forward service error to next()", async () => {
    const error = new Error("User not found.");

    Object.defineProperty(req, "user", {
      configurable: true,
      value: mockAuthenticatedUser
    });

    vi.mocked(authService.getCurrentUser).mockRejectedValue(error);

    await authController.me(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    expect(next).toHaveBeenCalledWith(error);

    expect(sendSuccess).not.toHaveBeenCalled();
  });
});
