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
    /*
    console.log("[Cloudinary Cron] Header diagnostic:", {
      authorizationPresent: Boolean(authorization),
      startsWithBearer: authorization?.startsWith("Bearer ") ?? false,
      startsWithBearerCaseInsensitive: /^Bearer /i.test(authorization ?? ""),
      headerLength: authorization?.length ?? 0,
      expectedHeaderLength: 7 + (process.env.CRON_SECRET?.length ?? 0)
    });
    */
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
