import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorize } from "../authorize.middleware.js";

import { ApiError } from "../../../../../shared/utils/apiErrorInfo.js";
import { pool } from "../../../../../shared/config/db.js";
import { userHasPermission } from "../../permissions/permission.repository.js";

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

vi.mock("../../permissions/permission.repository.js", () => ({
  userHasPermission: vi.fn()
}));

const res = {} as Response;
const next: NextFunction = vi.fn();

const mockAuthenticatedUser = {
  id: 101,
  username: "test.user",
  roles: [
    {
      id: 3,
      code: "REPORTER",
      displayName: "Reporter"
    }
  ]
};

const createRequest = (): Request => {
  const request = {} as Request;

  Object.defineProperty(request, "user", {
    configurable: true,
    writable: true,
    value: mockAuthenticatedUser
  });

  return request;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authorize()", () => {
  it("should reject an unauthenticated request", async () => {
    const req = {} as Request;

    Object.defineProperty(req, "user", {
      configurable: true,
      writable: true,
      value: undefined
    });

    await authorize("SECURITY", "users", "read")(req, res, next);

    expect(next).toHaveBeenCalledOnce();

    const error = vi.mocked(next).mock.calls[0]?.[0];

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 401,
      message: "Authentication required."
    });

    expect(pool.query).not.toHaveBeenCalled();
    expect(userHasPermission).not.toHaveBeenCalled();
  });

  it("should query the database using the authenticated user id", async () => {
    const req = createRequest();

    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ is_super_admin: false }]
    } as never);

    vi.mocked(userHasPermission).mockResolvedValue(true);

    await authorize("SECURITY", "users", "read")(req, res, next);

    expect(pool.query).toHaveBeenCalledOnce();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("r.code = 'SUPER_ADMIN'"),
      [101]
    );

    expect(userHasPermission).toHaveBeenCalledWith(
      101,
      "SECURITY",
      "users",
      "read"
    );
  });

  it("should allow an active SUPER_ADMIN without checking permissions", async () => {
    const req = createRequest();

    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ is_super_admin: true }]
    } as never);

    await authorize("SECURITY", "users", "delete")(req, res, next);

    expect(pool.query).toHaveBeenCalledOnce();

    expect(userHasPermission).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("should not grant SUPER_ADMIN access when the database result is false", async () => {
    const req = createRequest();

    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ is_super_admin: false }]
    } as never);

    vi.mocked(userHasPermission).mockResolvedValue(true);

    await authorize("SECURITY", "users", "create")(req, res, next);

    expect(userHasPermission).toHaveBeenCalledOnce();

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("should allow a user who has the required permission", async () => {
    const req = createRequest();

    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ is_super_admin: false }]
    } as never);

    vi.mocked(userHasPermission).mockResolvedValue(true);

    await authorize("SECURITY", "users", "read")(req, res, next);

    expect(userHasPermission).toHaveBeenCalledOnce();
    expect(userHasPermission).toHaveBeenCalledWith(
      101,
      "SECURITY",
      "users",
      "read"
    );

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("should deny a user who does not have the required permission", async () => {
    const req = createRequest();

    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ is_super_admin: false }]
    } as never);

    vi.mocked(userHasPermission).mockResolvedValue(false);

    await authorize("SECURITY", "users", "delete")(req, res, next);

    expect(userHasPermission).toHaveBeenCalledWith(
      101,
      "SECURITY",
      "users",
      "delete"
    );

    expect(next).toHaveBeenCalledOnce();

    const error = vi.mocked(next).mock.calls[0]?.[0];

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 403,
      message: "You do not have permission to perform this action."
    });
  });

  it("should correctly authorize different actions", async () => {
    const req = createRequest();

    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ is_super_admin: false }]
    } as never);

    vi.mocked(userHasPermission).mockResolvedValue(true);

    await authorize("SECURITY", "users", "update")(req, res, next);

    expect(userHasPermission).toHaveBeenCalledWith(
      101,
      "SECURITY",
      "users",
      "update"
    );

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("should correctly authorize the supplied module and resource", async () => {
    const req = createRequest();

    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ is_super_admin: false }]
    } as never);

    vi.mocked(userHasPermission).mockResolvedValue(true);

    await authorize("CONTENT", "news", "publish")(req, res, next);

    expect(userHasPermission).toHaveBeenCalledWith(
      101,
      "CONTENT",
      "news",
      "publish"
    );

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("should forward an ApiError thrown during authorization", async () => {
    const req = createRequest();

    const authorizationError = new ApiError(
      403,
      "Authorization check failed."
    );

    vi.mocked(pool.query).mockRejectedValue(authorizationError);

    await authorize("SECURITY", "users", "read")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(authorizationError);
  });

  it("should forward unexpected database errors", async () => {
    const req = createRequest();

    const databaseError = new Error("Database connection failed.");

    vi.mocked(pool.query).mockRejectedValue(databaseError);

    await authorize("SECURITY", "users", "read")(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(databaseError);
  });

  it("should forward errors thrown by userHasPermission", async () => {
    const req = createRequest();

    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ is_super_admin: false }]
    } as never);

    const permissionError = new Error(
      "Permission repository failure."
    );

    vi.mocked(userHasPermission).mockRejectedValue(permissionError);

    await authorize("SECURITY", "users", "read")(req, res, next);

    expect(userHasPermission).toHaveBeenCalledOnce();

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(permissionError);
  });

  it("should deny access when the SUPER_ADMIN query returns no rows", async () => {
    const req = createRequest();

    vi.mocked(pool.query).mockResolvedValue({
      rows: []
    } as never);

    vi.mocked(userHasPermission).mockResolvedValue(false);

    await authorize("SECURITY", "users", "read")(req, res, next);

    expect(userHasPermission).toHaveBeenCalledWith(
      101,
      "SECURITY",
      "users",
      "read"
    );

    expect(next).toHaveBeenCalledOnce();

    const error = vi.mocked(next).mock.calls[0]?.[0];

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 403,
      message: "You do not have permission to perform this action."
    });
  });
});