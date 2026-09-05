import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import * as service from "./permission.service.js";

import type {
  CreatePermissionInput,
  UpdatePermissionInput
} from "./permission.types.js";

export const getAll = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const permissions = await service.getAll();

    sendSuccess(res, "Permissions retrieved successfully.", permissions);
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
    const permission = await service.getById(Number(req.params.id));

    sendSuccess(res, "Permission retrieved successfully.", permission);
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
    const input = req.body as CreatePermissionInput;

    const permission = await service.create(input, req.user.id);

    sendSuccess(res, "Permission created successfully.", permission, 201);
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
    const input = req.body as UpdatePermissionInput;

    const permission = await service.update(
      Number(req.params.id),
      input,
      req.user.id
    );

    sendSuccess(res, "Permission updated successfully.", permission);
  } catch (error) {
    next(error);
  }
};

export const getRolePermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const permissions = await service.getRolePermissions(
      Number(req.params.roleId)
    );

    sendSuccess(res, "Role permissions retrieved successfully.", permissions);
  } catch (error) {
    next(error);
  }
};

export const assignToRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await service.assignToRole(
      Number(req.params.roleId),
      Number(req.params.permissionId),
      req.user.id
    );

    sendSuccess(res, "Permission assigned to role successfully.");
  } catch (error) {
    next(error);
  }
};

export const removeFromRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await service.removeFromRole(
      Number(req.params.roleId),
      Number(req.params.permissionId)
    );

    sendSuccess(res, "Permission removed from role successfully.");
  } catch (error) {
    next(error);
  }
};
