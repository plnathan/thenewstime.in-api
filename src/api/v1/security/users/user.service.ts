import bcrypt from "bcrypt";

import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as roleRepository from "../roles/role.repository.js";

import * as repository from "./user.repository.js";

import type {
  CreateUserInput,
  UpdateUserInput,
  User,
  UserListItem
} from "./user.types.js";

const BCRYPT_ROUNDS = 12;

export const getAll = async (): Promise<UserListItem[]> => {
  return repository.findAll();
};

export const getById = async (id: number): Promise<User> => {
  const user = await repository.findById(id);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  return user;
};

/*
|--------------------------------------------------------------------------
| Validate Roles
|--------------------------------------------------------------------------
*/

const validateRoleIds = async (
  roleIds: number[],
  actorId: number,
  action: "create" | "update"
): Promise<void> => {
  const uniqueRoleIds = [...new Set(roleIds)];

  if (uniqueRoleIds.length !== roleIds.length) {
    throw new ApiError(400, "Duplicate roles are not allowed.");
  }

  if (!roleIds.length) {
    throw new ApiError(400, "At least one role must be assigned.");
  }

  const roles = await Promise.all(
    roleIds.map((roleId) => roleRepository.findById(roleId))
  );

  for (let index = 0; index < roles.length; index += 1) {
    const role = roles[index];

    if (!role) {
      throw new ApiError(404, `Role ${roleIds[index]} not found.`);
    }

    if (role.status !== "ACTIVE") {
      throw new ApiError(
        400,
        `Role "${role.displayName}" is not active and cannot be assigned.`
      );
    }

    if (role.code === "SUPER_ADMIN") {
      const actorRoles = await roleRepository.findUserRoles(actorId);

      const actorIsSuperAdmin = actorRoles.some(
        (item) => item.code === "SUPER_ADMIN" && item.status === "ACTIVE"
      );

      if (!actorIsSuperAdmin) {
        throw new ApiError(
          403,
          `Only SUPER_ADMIN can ${action} a SUPER_ADMIN user.`
        );
      }
    }
  }
};

/*
|--------------------------------------------------------------------------
| CREATE
|--------------------------------------------------------------------------
*/

export const create = async (
  input: CreateUserInput,
  createdBy: number
): Promise<User> => {
  const existingUsername = await repository.findByUsername(input.username);

  if (existingUsername) {
    throw new ApiError(409, "Username already exists.");
  }

  if (input.email) {
    const existingEmail = await repository.findByEmail(input.email);

    if (existingEmail) {
      throw new ApiError(409, "Email already exists.");
    }
  }

  if (input.mobile) {
    const existingMobile = await repository.findByMobile(input.mobile);

    if (existingMobile) {
      throw new ApiError(409, "Mobile number already exists.");
    }
  }

  await validateRoleIds(input.roleIds, createdBy, "create");

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  return repository.create(input, passwordHash, createdBy);
};

/*
|--------------------------------------------------------------------------
| UPDATE
|--------------------------------------------------------------------------
*/

export const update = async (
  id: number,
  input: UpdateUserInput,
  updatedBy: number
): Promise<User> => {
  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "User not found.");
  }

  if (id === updatedBy && input.status && input.status !== "ACTIVE") {
    throw new ApiError(400, "You cannot deactivate or lock your own account.");
  }

  if (input.status && input.status !== "ACTIVE") {
    const targetRoles = await roleRepository.findUserRoles(id);

    const targetIsSuperAdmin = targetRoles.some(
      (item) => item.code === "SUPER_ADMIN" && item.status === "ACTIVE"
    );

    if (targetIsSuperAdmin) {
      throw new ApiError(
        400,
        "The SUPER_ADMIN account cannot be deactivated or locked."
      );
    }
  }

  if (input.email) {
    const existingEmail = await repository.findByEmail(input.email);

    if (existingEmail && existingEmail.id !== id) {
      throw new ApiError(409, "Email already exists.");
    }
  }

  if (input.mobile) {
    const existingMobile = await repository.findByMobile(input.mobile);

    if (existingMobile && existingMobile.id !== id) {
      throw new ApiError(409, "Mobile number already exists.");
    }
  }

  if (input.roleIds) {
    await validateRoleIds(input.roleIds, updatedBy, "update");
  }

  let passwordHash: string | null = null;

  if (input.password) {
    passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  }

  const updated = await repository.update(id, input, passwordHash, updatedBy);

  if (!updated) {
    throw new ApiError(404, "User not found.");
  }

  return updated;
};

/*
|--------------------------------------------------------------------------
| DEACTIVATE
|--------------------------------------------------------------------------
*/

export const deactivate = async (
  id: number,
  updatedBy: number
): Promise<User> => {
  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "User not found.");
  }

  if (existing.status === "INACTIVE") {
    throw new ApiError(400, "User is already inactive.");
  }

  if (id === updatedBy) {
    throw new ApiError(400, "You cannot deactivate your own account.");
  }

  const targetRoles = await roleRepository.findUserRoles(id);

  const targetIsSuperAdmin = targetRoles.some(
    (item) => item.code === "SUPER_ADMIN" && item.status === "ACTIVE"
  );

  if (targetIsSuperAdmin) {
    throw new ApiError(400, "The SUPER_ADMIN account cannot be deactivated.");
  }

  const user = await repository.deactivate(id, updatedBy);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  return user;
};
