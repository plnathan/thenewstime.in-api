import { beforeEach, describe, expect, it, vi } from "vitest";

import bcrypt from "bcrypt";

import { ApiError } from "../../../../../shared/utils/apiErrorInfo.js";

import * as roleRepository from "../../roles/role.repository.js";
import * as repository from "../user.repository.js";

import {
  create,
  deactivate,
  getAll,
  getById,
  update
} from "../user.service.js";

import type {
  CreateUserInput,
  UpdateUserInput,
  User,
  UserListItem
} from "../user.types.js";

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn()
  }
}));

vi.mock("../../roles/role.repository.js", () => ({
  findById: vi.fn(),
  findUserRoles: vi.fn()
}));

vi.mock("../user.repository.js", () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByUsername: vi.fn(),
  findByEmail: vi.fn(),
  findByMobile: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn()
}));

const mockUser: User = {
  id: 101,
  roleId: 3,
  fullName: "Test User",
  displayName: "Test",
  username: "test.user",
  email: "test@example.com",
  mobile: "9876543210",
  profileImageUrl: null,
  lastLoginAt: null,
  passwordChangedAt: null,
  mustChangePassword: true,
  passwordExpiresAt: null,
  failedLoginCount: 0,
  status: "ACTIVE",
  createdBy: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedBy: 1,
  updatedAt: new Date("2026-01-01T00:00:00.000Z")
};

const mockUserList: UserListItem[] = [
  {
    ...mockUser,
    roleCode: "REPORTER",
    roleDisplayName: "Reporter"
  }
];

const activeRole = {
  id: 3,
  code: "REPORTER",
  displayName: "Reporter",
  status: "ACTIVE"
};

const superAdminRole = {
  id: 1,
  code: "SUPER_ADMIN",
  displayName: "Super Admin",
  status: "ACTIVE"
};

const inactiveRole = {
  id: 5,
  code: "REPORTER",
  displayName: "Reporter",
  status: "INACTIVE"
};

const createInput: CreateUserInput = {
  fullName: "Test User",
  displayName: "Test",
  username: "test.user",
  email: "test@example.com",
  mobile: "9876543210",
  password: "Password123!",
  roleId: 3
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("user.service - getAll()", () => {
  it("should return all users", async () => {
    vi.mocked(repository.findAll).mockResolvedValue(mockUserList);

    const result = await getAll();

    expect(result).toEqual(mockUserList);
    expect(repository.findAll).toHaveBeenCalledOnce();
  });

  it("should propagate repository errors", async () => {
    const error = new Error("Database failure.");

    vi.mocked(repository.findAll).mockRejectedValue(error);

    await expect(getAll()).rejects.toBe(error);
  });
});

describe("user.service - getById()", () => {
  it("should return the user when found", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);

    const result = await getById(101);

    expect(result).toEqual(mockUser);
    expect(repository.findById).toHaveBeenCalledWith(101);
  });

  it("should throw 404 when user is not found", async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(getById(999)).rejects.toMatchObject({
      statusCode: 404,
      message: "User not found."
    });
  });

  it("should propagate repository errors", async () => {
    const error = new Error("Database failure.");

    vi.mocked(repository.findById).mockRejectedValue(error);

    await expect(getById(101)).rejects.toBe(error);
  });
});

describe("user.service - create()", () => {
  it("should create a user successfully", async () => {
    vi.mocked(repository.findByUsername).mockResolvedValue(null);
    vi.mocked(repository.findByEmail).mockResolvedValue(null);
    vi.mocked(repository.findByMobile).mockResolvedValue(null);

    vi.mocked(roleRepository.findById).mockResolvedValue(activeRole as never);

    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);

    vi.mocked(repository.create).mockResolvedValue(mockUser);

    const result = await create(createInput, 1);

    expect(result).toEqual(mockUser);

    expect(repository.findByUsername).toHaveBeenCalledWith(
      createInput.username
    );

    expect(repository.findByEmail).toHaveBeenCalledWith(createInput.email);

    expect(repository.findByMobile).toHaveBeenCalledWith(createInput.mobile);

    expect(roleRepository.findById).toHaveBeenCalledWith(createInput.roleId);

    expect(bcrypt.hash).toHaveBeenCalledWith(createInput.password, 12);

    expect(repository.create).toHaveBeenCalledWith(
      createInput,
      "hashed-password",
      1
    );
  });

  it("should reject a duplicate username", async () => {
    vi.mocked(repository.findByUsername).mockResolvedValue(mockUser);

    await expect(create(createInput, 1)).rejects.toMatchObject({
      statusCode: 409,
      message: "Username already exists."
    });

    expect(repository.findByEmail).not.toHaveBeenCalled();
    expect(repository.findByMobile).not.toHaveBeenCalled();
    expect(roleRepository.findById).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("should reject a duplicate email", async () => {
    vi.mocked(repository.findByUsername).mockResolvedValue(null);
    vi.mocked(repository.findByEmail).mockResolvedValue(mockUser);

    await expect(create(createInput, 1)).rejects.toMatchObject({
      statusCode: 409,
      message: "Email already exists."
    });

    expect(repository.findByMobile).not.toHaveBeenCalled();
    expect(roleRepository.findById).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("should reject a duplicate mobile number", async () => {
    vi.mocked(repository.findByUsername).mockResolvedValue(null);
    vi.mocked(repository.findByEmail).mockResolvedValue(null);
    vi.mocked(repository.findByMobile).mockResolvedValue(mockUser);

    await expect(create(createInput, 1)).rejects.toMatchObject({
      statusCode: 409,
      message: "Mobile number already exists."
    });

    expect(roleRepository.findById).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("should reject a non-existent role", async () => {
    vi.mocked(repository.findByUsername).mockResolvedValue(null);
    vi.mocked(repository.findByEmail).mockResolvedValue(null);
    vi.mocked(repository.findByMobile).mockResolvedValue(null);
    vi.mocked(roleRepository.findById).mockResolvedValue(null);

    await expect(create(createInput, 1)).rejects.toMatchObject({
      statusCode: 404,
      message: "Role not found."
    });

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("should reject an inactive role", async () => {
    vi.mocked(repository.findByUsername).mockResolvedValue(null);
    vi.mocked(repository.findByEmail).mockResolvedValue(null);
    vi.mocked(repository.findByMobile).mockResolvedValue(null);
    vi.mocked(roleRepository.findById).mockResolvedValue(inactiveRole as never);

    await expect(create(createInput, 1)).rejects.toMatchObject({
      statusCode: 400,
      message: "Only active roles can be assigned."
    });

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("should reject SUPER_ADMIN creation by a non-SUPER_ADMIN", async () => {
    const input: CreateUserInput = {
      ...createInput,
      roleId: 1
    };

    vi.mocked(repository.findByUsername).mockResolvedValue(null);
    vi.mocked(repository.findByEmail).mockResolvedValue(null);
    vi.mocked(repository.findByMobile).mockResolvedValue(null);

    vi.mocked(roleRepository.findById).mockResolvedValue(
      superAdminRole as never
    );

    vi.mocked(roleRepository.findUserRoles).mockResolvedValue([
      {
        code: "REPORTER",
        status: "ACTIVE"
      }
    ] as never);

    await expect(create(input, 1)).rejects.toMatchObject({
      statusCode: 403,
      message: "Only SUPER_ADMIN can create a SUPER_ADMIN user."
    });

    expect(roleRepository.findUserRoles).toHaveBeenCalledWith(1);
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("should allow an active SUPER_ADMIN to create another SUPER_ADMIN", async () => {
    const input: CreateUserInput = {
      ...createInput,
      roleId: 1
    };

    vi.mocked(repository.findByUsername).mockResolvedValue(null);
    vi.mocked(repository.findByEmail).mockResolvedValue(null);
    vi.mocked(repository.findByMobile).mockResolvedValue(null);

    vi.mocked(roleRepository.findById).mockResolvedValue(
      superAdminRole as never
    );

    vi.mocked(roleRepository.findUserRoles).mockResolvedValue([
      {
        code: "SUPER_ADMIN",
        status: "ACTIVE"
      }
    ] as never);

    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
    vi.mocked(repository.create).mockResolvedValue(mockUser);

    const result = await create(input, 1);

    expect(result).toEqual(mockUser);

    expect(roleRepository.findUserRoles).toHaveBeenCalledWith(1);

    expect(bcrypt.hash).toHaveBeenCalledWith(input.password, 12);

    expect(repository.create).toHaveBeenCalledWith(input, "hashed-password", 1);
  });

  it("should reject SUPER_ADMIN creation when the actor has no roles", async () => {
    const input: CreateUserInput = {
      ...createInput,
      roleId: 1
    };

    vi.mocked(repository.findByUsername).mockResolvedValue(null);
    vi.mocked(repository.findByEmail).mockResolvedValue(null);
    vi.mocked(repository.findByMobile).mockResolvedValue(null);

    vi.mocked(roleRepository.findById).mockResolvedValue(
      superAdminRole as never
    );

    vi.mocked(roleRepository.findUserRoles).mockResolvedValue([]);

    await expect(create(input, 1)).rejects.toMatchObject({
      statusCode: 403,
      message: "Only SUPER_ADMIN can create a SUPER_ADMIN user."
    });
  });

  it("should allow creation without optional email", async () => {
    const input: CreateUserInput = {
      ...createInput,
      email: undefined
    };

    vi.mocked(repository.findByUsername).mockResolvedValue(null);
    vi.mocked(repository.findByMobile).mockResolvedValue(null);
    vi.mocked(roleRepository.findById).mockResolvedValue(activeRole as never);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
    vi.mocked(repository.create).mockResolvedValue(mockUser);

    await create(input, 1);

    expect(repository.findByEmail).not.toHaveBeenCalled();

    expect(repository.create).toHaveBeenCalledWith(input, "hashed-password", 1);
  });

  it("should allow creation without optional mobile", async () => {
    const input: CreateUserInput = {
      ...createInput,
      mobile: undefined
    };

    vi.mocked(repository.findByUsername).mockResolvedValue(null);
    vi.mocked(repository.findByEmail).mockResolvedValue(null);
    vi.mocked(roleRepository.findById).mockResolvedValue(activeRole as never);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);
    vi.mocked(repository.create).mockResolvedValue(mockUser);

    await create(input, 1);

    expect(repository.findByMobile).not.toHaveBeenCalled();

    expect(repository.create).toHaveBeenCalledWith(input, "hashed-password", 1);
  });

  it("should propagate role repository errors", async () => {
    vi.mocked(repository.findByUsername).mockResolvedValue(null);
    vi.mocked(repository.findByEmail).mockResolvedValue(null);
    vi.mocked(repository.findByMobile).mockResolvedValue(null);

    const error = new Error("Role database failure.");

    vi.mocked(roleRepository.findById).mockRejectedValue(error);

    await expect(create(createInput, 1)).rejects.toBe(error);

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("should propagate repository create errors", async () => {
    vi.mocked(repository.findByUsername).mockResolvedValue(null);
    vi.mocked(repository.findByEmail).mockResolvedValue(null);
    vi.mocked(repository.findByMobile).mockResolvedValue(null);
    vi.mocked(roleRepository.findById).mockResolvedValue(activeRole as never);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password" as never);

    const error = new Error("Create failed.");

    vi.mocked(repository.create).mockRejectedValue(error);

    await expect(create(createInput, 1)).rejects.toBe(error);
  });
});

describe("user.service - update()", () => {
  const updateInput: UpdateUserInput = {
    fullName: "Updated User",
    displayName: "Updated",
    email: "updated@example.com",
    mobile: "9876501234"
  };

  it("should update a user successfully", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);
    vi.mocked(repository.findByEmail).mockResolvedValue(null);
    vi.mocked(repository.findByMobile).mockResolvedValue(null);
    vi.mocked(repository.update).mockResolvedValue(mockUser);

    const result = await update(101, updateInput, 1);

    expect(result).toEqual(mockUser);

    expect(repository.findById).toHaveBeenCalledWith(101);

    expect(repository.findByEmail).toHaveBeenCalledWith(updateInput.email);

    expect(repository.findByMobile).toHaveBeenCalledWith(updateInput.mobile);

    expect(repository.update).toHaveBeenCalledWith(101, updateInput, null, 1);
  });

  it("should throw 404 when the target user does not exist", async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(update(999, updateInput, 1)).rejects.toMatchObject({
      statusCode: 404,
      message: "User not found."
    });

    expect(repository.findByEmail).not.toHaveBeenCalled();
    expect(repository.findByMobile).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should prevent a user from deactivating their own account", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);

    await expect(
      update(101, { status: "INACTIVE" }, 101)
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "You cannot deactivate or lock your own account."
    });

    expect(roleRepository.findUserRoles).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should prevent a user from locking their own account", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);

    await expect(update(101, { status: "LOCKED" }, 101)).rejects.toMatchObject({
      statusCode: 400,
      message: "You cannot deactivate or lock your own account."
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should prevent deactivation of an active SUPER_ADMIN", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);

    vi.mocked(roleRepository.findUserRoles).mockResolvedValue([
      {
        code: "SUPER_ADMIN",
        status: "ACTIVE"
      }
    ] as never);

    await expect(update(101, { status: "INACTIVE" }, 1)).rejects.toMatchObject({
      statusCode: 400,
      message: "The SUPER_ADMIN account cannot be deactivated or locked."
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should prevent locking of an active SUPER_ADMIN", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);

    vi.mocked(roleRepository.findUserRoles).mockResolvedValue([
      {
        code: "SUPER_ADMIN",
        status: "ACTIVE"
      }
    ] as never);

    await expect(update(101, { status: "LOCKED" }, 1)).rejects.toMatchObject({
      statusCode: 400,
      message: "The SUPER_ADMIN account cannot be deactivated or locked."
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should allow status change for a normal user", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);

    vi.mocked(roleRepository.findUserRoles).mockResolvedValue([
      {
        code: "REPORTER",
        status: "ACTIVE"
      }
    ] as never);

    vi.mocked(repository.update).mockResolvedValue({
      ...mockUser,
      status: "INACTIVE"
    });

    const result = await update(101, { status: "INACTIVE" }, 1);

    expect(result.status).toBe("INACTIVE");

    expect(roleRepository.findUserRoles).toHaveBeenCalledWith(101);
    expect(repository.update).toHaveBeenCalledWith(
      101,
      { status: "INACTIVE" },
      null,
      1
    );
  });

  it("should reject a duplicate email belonging to another user", async () => {
    const anotherUser = {
      ...mockUser,
      id: 202,
      email: "updated@example.com"
    };

    vi.mocked(repository.findById).mockResolvedValue(mockUser);
    vi.mocked(repository.findByEmail).mockResolvedValue(anotherUser);

    await expect(
      update(101, { email: "updated@example.com" }, 1)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Email already exists."
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should allow the same email when it belongs to the same user", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);
    vi.mocked(repository.findByEmail).mockResolvedValue(mockUser);
    vi.mocked(repository.update).mockResolvedValue(mockUser);

    await update(101, { email: mockUser.email! }, 1);

    expect(repository.update).toHaveBeenCalled();
  });

  it("should reject a duplicate mobile belonging to another user", async () => {
    const anotherUser = {
      ...mockUser,
      id: 202,
      mobile: "9876501234"
    };

    vi.mocked(repository.findById).mockResolvedValue(mockUser);
    vi.mocked(repository.findByMobile).mockResolvedValue(anotherUser);

    await expect(
      update(101, { mobile: "9876501234" }, 1)
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Mobile number already exists."
    });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("should hash a new password before updating", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);
    vi.mocked(bcrypt.hash).mockResolvedValue("new-password-hash" as never);
    vi.mocked(repository.update).mockResolvedValue(mockUser);

    const input: UpdateUserInput = {
      password: "NewPassword123!"
    };

    await update(101, input, 1);

    expect(bcrypt.hash).toHaveBeenCalledWith("NewPassword123!", 12);

    expect(repository.update).toHaveBeenCalledWith(
      101,
      input,
      "new-password-hash",
      1
    );
  });

  it("should not hash a password when password is not supplied", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);
    vi.mocked(repository.update).mockResolvedValue(mockUser);

    await update(101, { displayName: "New Display Name" }, 1);

    expect(bcrypt.hash).not.toHaveBeenCalled();

    expect(repository.update).toHaveBeenCalledWith(
      101,
      { displayName: "New Display Name" },
      null,
      1
    );
  });

  it("should throw 404 when repository update returns null", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);
    vi.mocked(repository.update).mockResolvedValue(null);

    await expect(
      update(101, { displayName: "Updated" }, 1)
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "User not found."
    });
  });
});

describe("user.service - deactivate()", () => {
  it("should deactivate a normal active user", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);

    vi.mocked(roleRepository.findUserRoles).mockResolvedValue([
      {
        code: "REPORTER",
        status: "ACTIVE"
      }
    ] as never);

    const inactiveUser: User = {
      ...mockUser,
      status: "INACTIVE"
    };

    vi.mocked(repository.deactivate).mockResolvedValue(inactiveUser);

    const result = await deactivate(101, 1);

    expect(result).toEqual(inactiveUser);

    expect(roleRepository.findUserRoles).toHaveBeenCalledWith(101);

    expect(repository.deactivate).toHaveBeenCalledWith(101, 1);
  });

  it("should throw 404 when user does not exist", async () => {
    vi.mocked(repository.findById).mockResolvedValue(null);

    await expect(deactivate(999, 1)).rejects.toMatchObject({
      statusCode: 404,
      message: "User not found."
    });

    expect(roleRepository.findUserRoles).not.toHaveBeenCalled();
    expect(repository.deactivate).not.toHaveBeenCalled();
  });

  it("should reject an already inactive user", async () => {
    vi.mocked(repository.findById).mockResolvedValue({
      ...mockUser,
      status: "INACTIVE"
    });

    await expect(deactivate(101, 1)).rejects.toMatchObject({
      statusCode: 400,
      message: "User is already inactive."
    });

    expect(roleRepository.findUserRoles).not.toHaveBeenCalled();
    expect(repository.deactivate).not.toHaveBeenCalled();
  });

  it("should prevent a user from deactivating their own account", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);

    await expect(deactivate(101, 101)).rejects.toMatchObject({
      statusCode: 400,
      message: "You cannot deactivate your own account."
    });

    expect(roleRepository.findUserRoles).not.toHaveBeenCalled();
    expect(repository.deactivate).not.toHaveBeenCalled();
  });

  it("should protect an active SUPER_ADMIN", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);

    vi.mocked(roleRepository.findUserRoles).mockResolvedValue([
      {
        code: "SUPER_ADMIN",
        status: "ACTIVE"
      }
    ] as never);

    await expect(deactivate(101, 1)).rejects.toMatchObject({
      statusCode: 400,
      message: "The SUPER_ADMIN account cannot be deactivated."
    });

    expect(repository.deactivate).not.toHaveBeenCalled();
  });

  it("should allow deactivation when SUPER_ADMIN role is inactive", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);

    vi.mocked(roleRepository.findUserRoles).mockResolvedValue([
      {
        code: "SUPER_ADMIN",
        status: "INACTIVE"
      }
    ] as never);

    vi.mocked(repository.deactivate).mockResolvedValue({
      ...mockUser,
      status: "INACTIVE"
    });

    const result = await deactivate(101, 1);

    expect(result.status).toBe("INACTIVE");

    expect(repository.deactivate).toHaveBeenCalledWith(101, 1);
  });

  it("should throw 404 when repository deactivate returns null", async () => {
    vi.mocked(repository.findById).mockResolvedValue(mockUser);

    vi.mocked(roleRepository.findUserRoles).mockResolvedValue([
      {
        code: "REPORTER",
        status: "ACTIVE"
      }
    ] as never);

    vi.mocked(repository.deactivate).mockResolvedValue(null);

    await expect(deactivate(101, 1)).rejects.toMatchObject({
      statusCode: 404,
      message: "User not found."
    });
  });
});
