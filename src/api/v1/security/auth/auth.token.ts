import crypto from "node:crypto";

import jwt from "jsonwebtoken";

import type { AuthRole, AuthUser } from "./auth.types.js";

export interface AccessTokenPayload {
  sub: string;
  username: string;
  roles: AuthRole[];
  type: "access";
}

const getAccessSecret = (): string => {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not configured.");
  }

  return secret;
};

const getAccessExpiresIn = (): string => {
  return process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
};

const getRefreshExpiresDays = (): number => {
  const value = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? "30");

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("REFRESH_TOKEN_EXPIRES_DAYS must be a positive integer.");
  }

  return value;
};

export const createAccessToken = (user: AuthUser): string => {
  const payload: AccessTokenPayload = {
    sub: String(user.id),
    username: user.username,
    roles: user.roles,
    type: "access"
  };

  return jwt.sign(payload, getAccessSecret(), {
    expiresIn: getAccessExpiresIn()
  } as jwt.SignOptions);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, getAccessSecret()) as AccessTokenPayload;

  if (
    decoded.type !== "access" ||
    typeof decoded.sub !== "string" ||
    typeof decoded.username !== "string" ||
    !Array.isArray(decoded.roles)
  ) {
    throw new Error("Invalid access token.");
  }

  return decoded;
};

export const createRefreshToken = (): string => {
  return crypto.randomBytes(64).toString("hex");
};

export const hashRefreshToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const getRefreshTokenExpiry = (): Date => {
  const days = getRefreshExpiresDays();

  const expiresAt = new Date();

  expiresAt.setUTCDate(expiresAt.getUTCDate() + days);

  return expiresAt;
};

export const getAccessTokenExpiresIn = (): string => {
  return getAccessExpiresIn();
};
