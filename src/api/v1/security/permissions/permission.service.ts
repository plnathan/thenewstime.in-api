import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./permission.repository.js";

import type {
  CreatePermissionInput,
  Permission,
  UpdatePermissionInput
} from "./permission.types.js";

export const getAll = async (): Promise<Permission[]> => {
  return repository.findAll();
};

export const getById = async (id: number): Promise<Permission> => {
  const permission = await repository.findById(id);

  if (!permission) {
    throw new ApiError(404, "Permission not found.");
  }

  return permission;
};

export const create = async (
  input: CreatePermissionInput,
  userId: number
): Promise<Permission> => {
  const existing = await repository.findByCode(input.code);

  if (existing) {
    throw new ApiError(409, "Permission code already exists.");
  }

  return repository.create(input, userId);
};

export const update = async (
  id: number,
  input: UpdatePermissionInput,
  userId: number
): Promise<Permission> => {
  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "Permission not found.");
  }

  if (existing.isSystemPermission && input.status === "INACTIVE") {
    throw new ApiError(400, "System permissions cannot be deactivated.");
  }

  return (await repository.update(id, input, userId)) as Permission;
};

export const assignToRole = async (
  roleId: number,
  permissionId: number,
  userId: number
): Promise<void> => {
  const permission = await repository.findById(permissionId);

  if (!permission) {
    throw new ApiError(404, "Permission not found.");
  }

  if (permission.status !== "ACTIVE") {
    throw new ApiError(400, "Inactive permissions cannot be assigned.");
  }

  await repository.assignToRole(roleId, permissionId, userId);
};

export const removeFromRole = async (
  roleId: number,
  permissionId: number
): Promise<void> => {
  await repository.removeFromRole(roleId, permissionId);
};

export const getRolePermissions = async (
  roleId: number
): Promise<Permission[]> => {
  return repository.findByRoleId(roleId);
};
