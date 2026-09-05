import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import { verifyAccessToken } from "../auth/auth.token.js";

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authorization = req.header("Authorization");

    if (!authorization) {
      throw new ApiError(401, "Authentication required.");
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new ApiError(401, "Invalid authorization header.");
    }

    const payload = verifyAccessToken(token);

    req.user = {
      id: Number(payload.sub),
      username: payload.username,
      roles: payload.roles
    };

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }

    next(new ApiError(401, "Invalid or expired access token."));
  }
};
