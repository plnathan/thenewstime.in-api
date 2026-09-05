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

  /*
   * A user must always be created with an active role.
   *
   * user_roles is the authoritative RBAC relationship.
   */
  const role = await roleRepository.findById(input.roleId);

  if (!role) {
    throw new ApiError(404, "Role not found.");
  }

  if (role.status !== "ACTIVE") {
    throw new ApiError(400, "Only active roles can be assigned.");
  }

  /*
   * SUPER_ADMIN is a privileged role.
   *
   * Only an existing active SUPER_ADMIN can create
   * another SUPER_ADMIN account.
   */
  if (role.code === "SUPER_ADMIN") {
    const actorRoles = await roleRepository.findUserRoles(createdBy);

    const actorIsSuperAdmin = actorRoles.some(
      (item) => item.code === "SUPER_ADMIN" && item.status === "ACTIVE"
    );

    if (!actorIsSuperAdmin) {
      throw new ApiError(
        403,
        "Only SUPER_ADMIN can create a SUPER_ADMIN user."
      );
    }
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  return repository.create(input, passwordHash, createdBy);
};

export const update = async (
  id: number,
  input: UpdateUserInput,
  updatedBy: number
): Promise<User> => {
  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "User not found.");
  }

  /*
   * Do not allow an administrator to deactivate or lock
   * the currently authenticated account.
   */
  if (id === updatedBy && input.status && input.status !== "ACTIVE") {
    throw new ApiError(400, "You cannot deactivate or lock your own account.");
  }

  /*
   * Prevent deactivation or locking of an active SUPER_ADMIN
   * through the user management API.
   */
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

  /*
   * Never allow a user to deactivate their own account.
   */
  if (id === updatedBy) {
    throw new ApiError(400, "You cannot deactivate your own account.");
  }

  /*
   * Protect SUPER_ADMIN by role, not by username.
   *
   * This is important because the username is not the
   * security boundary; the assigned role is.
   */
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
