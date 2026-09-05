import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./role.repository.js";

import type { CreateRoleInput, Role, UpdateRoleInput } from "./role.types.js";

export const getAll = async (): Promise<Role[]> => {
  return repository.findAll();
};

export const getById = async (id: number): Promise<Role> => {
  const role = await repository.findById(id);

  if (!role) {
    throw new ApiError(404, "Role not found.");
  }

  return role;
};

export const create = async (
  input: CreateRoleInput,
  userId: number
): Promise<Role> => {
  const existing = await repository.findByCode(input.code);

  if (existing) {
    throw new ApiError(409, "Role code already exists.");
  }

  return repository.create(input, userId);
};

export const update = async (
  id: number,
  input: UpdateRoleInput,
  userId: number
): Promise<Role> => {
  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "Role not found.");
  }

  if (
    existing.code === "SUPER_ADMIN" &&
    input.status &&
    input.status !== "ACTIVE"
  ) {
    throw new ApiError(400, "SUPER_ADMIN cannot be deactivated or suspended.");
  }

  const updated = await repository.update(id, input, userId);

  if (!updated) {
    throw new ApiError(404, "Role not found.");
  }

  return updated;
};

export const assignUserRole = async (
  userId: number,
  roleId: number,
  createdBy: number
): Promise<void> => {
  const role = await repository.findById(roleId);

  if (!role) {
    throw new ApiError(404, "Role not found.");
  }

  if (role.status !== "ACTIVE") {
    throw new ApiError(400, "Only active roles can be assigned.");
  }

  /*
   * SUPER_ADMIN is a privileged role.
   *
   * Only an existing active SUPER_ADMIN can assign
   * the SUPER_ADMIN role to another user.
   */
  if (role.code === "SUPER_ADMIN") {
    const actorRoles = await repository.findUserRoles(createdBy);

    const actorIsSuperAdmin = actorRoles.some(
      (item) => item.code === "SUPER_ADMIN" && item.status === "ACTIVE"
    );

    if (!actorIsSuperAdmin) {
      throw new ApiError(
        403,
        "Only SUPER_ADMIN can assign the SUPER_ADMIN role."
      );
    }
  }

  await repository.assignUserRole(userId, roleId, createdBy);
};

export const removeUserRole = async (
  userId: number,
  roleId: number
): Promise<void> => {
  const roles = await repository.findUserRoles(userId);

  if (roles.length <= 1) {
    throw new ApiError(400, "A user must have at least one role.");
  }

  const role = roles.find((item) => item.id === roleId);

  if (!role) {
    throw new ApiError(404, "User does not have this role.");
  }

  await repository.removeUserRole(userId, roleId);
};

export const getUserRoles = async (userId: number): Promise<Role[]> => {
  return repository.findUserRoles(userId);
};
