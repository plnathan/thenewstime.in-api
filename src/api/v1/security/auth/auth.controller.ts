import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import * as authService from "./auth.service.js";

import type { LoginInput, RegisterInput } from "./auth.types.js";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = req.body as RegisterInput;

    const user = await authService.register(payload);

    sendSuccess(res, "Registration successful.", user, 201);
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = req.body as LoginInput;

    const result = await authService.login(
      payload.username,
      payload.password,
      req.ip ?? null,
      req.get("user-agent") ?? null
    );

    sendSuccess(res, "Login successful.", result);
  } catch (error) {
    next(error);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body as {
      refreshToken: string;
    };

    const result = await authService.refresh(refreshToken);

    sendSuccess(res, "Token refreshed successfully.", result);
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body as {
      refreshToken: string;
    };

    await authService.logout(refreshToken);

    sendSuccess(res, "Logout successful.");
  } catch (error) {
    next(error);
  }
};

export const me = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await authService.getCurrentUser(req.user.id);

    sendSuccess(res, "Current user retrieved successfully.", user);
  } catch (error) {
    next(error);
  }
};
