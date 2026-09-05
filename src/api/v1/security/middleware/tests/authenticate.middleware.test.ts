import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authenticate } from "../authenticate.middleware.js";

import { ApiError } from "../../../../../shared/utils/apiErrorInfo.js";
import { verifyAccessToken } from "../../auth/auth.token.js";

vi.mock("../../auth/auth.token.js", () => ({
  verifyAccessToken: vi.fn()
}));

const req = {} as Request;
const res = {} as Response;
const next: NextFunction = vi.fn();

const mockPayload = {
  sub: "101",
  username: "test.reporter",
  type: "access" as const,
  roles: [
    {
      id: 3,
      code: "REPORTER",
      displayName: "Reporter"
    }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();

  Object.defineProperty(req, "header", {
    configurable: true,
    value: vi.fn()
  });

  Object.defineProperty(req, "user", {
    configurable: true,
    value: undefined,
    writable: true
  });
});

describe("authenticate()", () => {
  it("should reject a request without an Authorization header", () => {
    vi.mocked(req.header).mockReturnValue(undefined);

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    const error = vi.mocked(next).mock.calls[0]?.[0];

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 401,
      message: "Authentication required."
    });

    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("should reject an invalid authorization scheme", () => {
    vi.mocked(req.header).mockReturnValue("Basic abc123");

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    const error = vi.mocked(next).mock.calls[0]?.[0];

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 401,
      message: "Invalid authorization header."
    });

    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("should reject a Bearer header without a token", () => {
    vi.mocked(req.header).mockReturnValue("Bearer");

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    const error = vi.mocked(next).mock.calls[0]?.[0];

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 401,
      message: "Invalid authorization header."
    });

    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("should reject an authorization header with an incorrect scheme and token", () => {
    vi.mocked(req.header).mockReturnValue("Basic abc123");

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    const error = vi.mocked(next).mock.calls[0]?.[0];

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 401,
      message: "Invalid authorization header."
    });

    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it("should reject an invalid access token", () => {
    vi.mocked(req.header).mockReturnValue(
      "Bearer invalid-access-token"
    );

    vi.mocked(verifyAccessToken).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    authenticate(req, res, next);

    expect(verifyAccessToken).toHaveBeenCalledOnce();
    expect(verifyAccessToken).toHaveBeenCalledWith(
      "invalid-access-token"
    );

    expect(next).toHaveBeenCalledOnce();

    const error = vi.mocked(next).mock.calls[0]?.[0];

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 401,
      message: "Invalid or expired access token."
    });
  });

  it("should forward an ApiError thrown by token verification", () => {
    const tokenError = new ApiError(
      401,
      "Invalid or expired access token."
    );

    vi.mocked(req.header).mockReturnValue(
      "Bearer invalid-access-token"
    );

    vi.mocked(verifyAccessToken).mockImplementation(() => {
      throw tokenError;
    });

    authenticate(req, res, next);

    expect(verifyAccessToken).toHaveBeenCalledWith(
      "invalid-access-token"
    );

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(tokenError);
  });

  it("should authenticate a valid access token", () => {
    vi.mocked(req.header).mockReturnValue(
      "Bearer valid-access-token"
    );

    vi.mocked(verifyAccessToken).mockReturnValue(mockPayload);

    authenticate(req, res, next);

    expect(verifyAccessToken).toHaveBeenCalledOnce();
    expect(verifyAccessToken).toHaveBeenCalledWith(
      "valid-access-token"
    );

    expect(req.user).toEqual({
      id: 101,
      username: "test.reporter",
      roles: [
        {
          id: 3,
          code: "REPORTER",
          displayName: "Reporter"
        }
      ]
    });

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("should convert the JWT subject to a numeric user id", () => {
    vi.mocked(req.header).mockReturnValue(
      "Bearer valid-access-token"
    );

    vi.mocked(verifyAccessToken).mockReturnValue({
      sub: "250",
      username: "test.admin",
      type: "access",
      roles: [
        {
          id: 2,
          code: "ADMIN",
          displayName: "Administrator"
        }
      ]
    });

    authenticate(req, res, next);

    expect(req.user).toEqual({
      id: 250,
      username: "test.admin",
      roles: [
        {
          id: 2,
          code: "ADMIN",
          displayName: "Administrator"
        }
      ]
    });

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("should preserve multiple roles from the access token", () => {
    const roles = [
      {
        id: 2,
        code: "ADMIN",
        displayName: "Administrator"
      },
      {
        id: 3,
        code: "REPORTER",
        displayName: "Reporter"
      }
    ];

    vi.mocked(req.header).mockReturnValue(
      "Bearer valid-access-token"
    );

    vi.mocked(verifyAccessToken).mockReturnValue({
      sub: "101",
      username: "test.user",
      type: "access",
      roles
    });

    authenticate(req, res, next);

    expect(req.user).toEqual({
      id: 101,
      username: "test.user",
      roles
    });

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("should not call next() twice when token verification fails", () => {
    vi.mocked(req.header).mockReturnValue(
      "Bearer invalid-access-token"
    );

    vi.mocked(verifyAccessToken).mockImplementation(() => {
      throw new Error("Token expired");
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});