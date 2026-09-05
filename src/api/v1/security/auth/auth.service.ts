import bcrypt from "bcrypt";
import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./auth.repository.js";

import {
  createAccessToken,
  createRefreshToken,
  getAccessTokenExpiresIn,
  getRefreshTokenExpiry,
  hashRefreshToken
} from "./auth.token.js";

import type {
  AuthRole,
  AuthUser,
  LoginResult,
  RegisterInput
} from "./auth.types.js";

const BCRYPT_ROUNDS = 12;

const DEFAULT_ROLE = process.env.SECURITY_DEFAULT_ROLE ?? "REPORTER";

const buildAuthUser = async (
  userId: number,
  client?: PoolClient
): Promise<AuthUser> => {
  const user = await repository.findUserById(userId, client);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const roles = await repository.findRolesByUserId(user.id, client);

  return {
    id: user.id,
    fullName: user.full_name,
    displayName: user.display_name,
    username: user.username,
    email: user.email,
    mobile: user.mobile,
    status: user.status,

    roles: roles.map((role): AuthRole => ({
      id: role.id,
      code: role.code,
      displayName: role.display_name
    }))
  };
};

/*
|--------------------------------------------------------------------------
| REGISTER
|--------------------------------------------------------------------------
*/

export const register = async (input: RegisterInput): Promise<AuthUser> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const usernameExists = await repository.existsByUsername(
      input.username,
      client
    );

    if (usernameExists) {
      throw new ApiError(409, "Username is already registered.");
    }

    const email = input.email?.trim().toLowerCase();

    if (email) {
      const emailExists = await repository.existsByEmail(email, client);

      if (emailExists) {
        throw new ApiError(409, "Email is already registered.");
      }
    }

    const mobile = input.mobile?.trim();

    if (mobile) {
      const mobileExists = await repository.existsByMobile(mobile, client);

      if (mobileExists) {
        throw new ApiError(409, "Mobile number is already registered.");
      }
    }

    const roleId = await repository.findRoleByCode(DEFAULT_ROLE, client);

    if (!roleId) {
      throw new ApiError(500, `Default role '${DEFAULT_ROLE}' was not found.`);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const userId = await repository.createUser(
      {
        fullName: input.fullName,
        displayName: input.displayName,
        username: input.username,
        email: email ?? null,
        mobile: mobile ?? null,
        passwordHash,
        roleId
      },
      client
    );

    await repository.assignRole(userId, roleId, client);

    const user = await buildAuthUser(userId, client);

    await client.query("COMMIT");

    return user;
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
};

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

export const login = async (
  username: string,
  password: string,
  ipAddress: string | null,
  userAgent: string | null
): Promise<LoginResult> => {
  const user = await repository.findUserByUsername(username);

  if (!user) {
    throw new ApiError(401, "Invalid username or password.");
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "Your account is not active.");
  }

  if (
    user.password_expires_at &&
    new Date(user.password_expires_at) <= new Date()
  ) {
    throw new ApiError(403, "Your password has expired.");
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    await repository.updateFailedLogin(user.id);

    throw new ApiError(401, "Invalid username or password.");
  }

  const authUser = await buildAuthUser(user.id);

  const accessToken = createAccessToken(authUser);

  const refreshToken = createRefreshToken();

  const refreshTokenHash = hashRefreshToken(refreshToken);

  const refreshExpiresAt = getRefreshTokenExpiry();

  await repository.updateSuccessfulLogin(user.id);

  await repository.createSession({
    userId: user.id,
    refreshTokenHash,
    expiresAt: refreshExpiresAt,
    ipAddress,
    userAgent
  });

  return {
    user: authUser,

    tokens: {
      accessToken,
      refreshToken,
      expiresIn: getAccessTokenExpiresIn()
    }
  };
};

/*
|--------------------------------------------------------------------------
| REFRESH
|--------------------------------------------------------------------------
*/

export const refresh = async (refreshToken: string): Promise<LoginResult> => {
  const tokenHash = hashRefreshToken(refreshToken);

  const session = await repository.findSessionByRefreshTokenHash(tokenHash);

  if (!session) {
    throw new ApiError(401, "Invalid refresh token.");
  }

  if (session.revoked_at) {
    throw new ApiError(401, "Refresh token has been revoked.");
  }

  if (new Date(session.expires_at) <= new Date()) {
    await repository.revokeSession(session.id);

    throw new ApiError(401, "Refresh token has expired.");
  }

  const user = await repository.findUserById(session.user_id);

  if (!user) {
    await repository.revokeSession(session.id);

    throw new ApiError(401, "User account no longer exists.");
  }

  if (user.status !== "ACTIVE") {
    await repository.revokeSession(session.id);

    throw new ApiError(403, "Your account is not active.");
  }

  const authUser = await buildAuthUser(user.id);

  const accessToken = createAccessToken(authUser);

  const newRefreshToken = createRefreshToken();

  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

  const newExpiry = getRefreshTokenExpiry();

  await repository.rotateSession(session.id, newRefreshTokenHash, newExpiry);

  return {
    user: authUser,

    tokens: {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: getAccessTokenExpiresIn()
    }
  };
};

/*
|--------------------------------------------------------------------------
| LOGOUT
|--------------------------------------------------------------------------
*/

export const logout = async (refreshToken: string): Promise<void> => {
  const tokenHash = hashRefreshToken(refreshToken);

  const session = await repository.findSessionByRefreshTokenHash(tokenHash);

  if (!session) {
    return;
  }

  await repository.revokeSession(session.id);
};

/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/

export const getCurrentUser = async (userId: number): Promise<AuthUser> => {
  return buildAuthUser(userId);
};
