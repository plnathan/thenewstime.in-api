import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import * as service from "./role.service.js";

import type { CreateRoleInput, UpdateRoleInput } from "./role.types.js";

export const getAll = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roles = await service.getAll();

    sendSuccess(res, "Roles retrieved successfully.", roles);
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
    const role = await service.getById(Number(req.params.id));

    sendSuccess(res, "Role retrieved successfully.", role);
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
    const role = await service.create(req.body as CreateRoleInput, req.user.id);

    sendSuccess(res, "Role created successfully.", role, 201);
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
    const role = await service.update(
      Number(req.params.id),
      req.body as UpdateRoleInput,
      req.user.id
    );

    sendSuccess(res, "Role updated successfully.", role);
  } catch (error) {
    next(error);
  }
};

export const getUserRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const roles = await service.getUserRoles(Number(req.params.userId));

    sendSuccess(res, "User roles retrieved successfully.", roles);
  } catch (error) {
    next(error);
  }
};

export const assignUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await service.assignUserRole(
      Number(req.params.userId),
      Number(req.params.roleId),
      req.user.id
    );

    sendSuccess(res, "Role assigned to user successfully.");
  } catch (error) {
    next(error);
  }
};

export const removeUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await service.removeUserRole(
      Number(req.params.userId),
      Number(req.params.roleId)
    );

    sendSuccess(res, "Role removed from user successfully.");
  } catch (error) {
    next(error);
  }
};
