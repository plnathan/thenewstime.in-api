import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import * as service from "./user.service.js";

import type { CreateUserInput, UpdateUserInput } from "./user.types.js";

export const getAll = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const users = await service.getAll();

    sendSuccess(res, "Users retrieved successfully.", users);
  } catch (error) {
    next(error);
  }
};

export const getById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await service.getById(Number(req.params.id));

    sendSuccess(res, "User retrieved successfully.", user);
  } catch (error) {
    next(error);
  }
};

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as CreateUserInput;

    const user = await service.create(input, req.user.id);

    sendSuccess(res, "User created successfully.", user, 201);
  } catch (error) {
    next(error);
  }
};

export const update = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as UpdateUserInput;

    const user = await service.update(
      Number(req.params.id),
      input,
      req.user.id
    );

    sendSuccess(res, "User updated successfully.", user);
  } catch (error) {
    next(error);
  }
};

export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await service.deactivate(Number(req.params.id), req.user.id);

    sendSuccess(res, "User deactivated successfully.", user);
  } catch (error) {
    next(error);
  }
};
