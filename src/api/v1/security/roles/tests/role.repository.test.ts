import bcrypt from "bcrypt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../role.repository.js";

import type { CreateRoleInput, UpdateRoleInput } from "../role.types.js";

describe("Role Repository", () => {
  let adminUserId = 0;
  let testUserId = 0;

  let superAdminRoleId = 0;
  let adminRoleId = 0;

  let roleOneId = 0;
  let roleTwoId = 0;

  const timestamp = Date.now();

  const adminUsername = `role_repo_admin_${timestamp}`;
  const adminEmail = `role-repo-admin-${timestamp}@example.com`;

  const testUsername = `role_repo_user_${timestamp}`;
  const testEmail = `role-repo-user-${timestamp}@example.com`;

  const roleOneCode = `ROLE_REPO_ONE_${timestamp}`;
  const roleTwoCode = `ROLE_REPO_TWO_${timestamp}`;

  const roleOneDisplayName = `Repository Role One ${timestamp}`;
  const roleTwoDisplayName = `Repository Role Two ${timestamp}`;

  beforeAll(async () => {
    /*
     * ------------------------------------------------------------------------
     * Find required system roles.
     * ------------------------------------------------------------------------
     */

    const rolesResult = await pool.query(
      `
      SELECT id, code
      FROM roles
      WHERE code IN ('SUPER_ADMIN', 'ADMIN')
      `
    );

    const superAdmin = rolesResult.rows.find(
      (row) => row.code === "SUPER_ADMIN"
    );

    const adminRole = rolesResult.rows.find((row) => row.code === "ADMIN");

    expect(superAdmin).toBeDefined();
    expect(adminRole).toBeDefined();

    superAdminRoleId = Number(superAdmin.id);
    adminRoleId = Number(adminRole.id);

    /*
     * ------------------------------------------------------------------------
     * Create admin user.
     *
     * Used as created_by / updated_by.
     * ------------------------------------------------------------------------
     */

    const passwordHash = await bcrypt.hash("Repository@Test123", 10);

    const adminUserResult = await pool.query(
      `
      INSERT INTO users
      (
        username,
        email,
        password_hash,
        full_name,
        display_name,
        status,
        role_id
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        'ACTIVE',
        $6
      )
      RETURNING id
      `,
      [
        adminUsername,
        adminEmail,
        passwordHash,
        "Role Repository Admin",
        "Role Repo Admin",
        adminRoleId
      ]
    );

    adminUserId = Number(adminUserResult.rows[0].id);

    expect(adminUserId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create normal user.
     * ------------------------------------------------------------------------
     */

    const testUserResult = await pool.query(
      `
      INSERT INTO users
      (
        username,
        email,
        password_hash,
        full_name,
        display_name,
        status,
        role_id
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        'ACTIVE',
        $6
      )
      RETURNING id
      `,
      [
        testUsername,
        testEmail,
        passwordHash,
        "Role Repository User",
        "Role Repo User",
        adminRoleId
      ]
    );

    testUserId = Number(testUserResult.rows[0].id);

    expect(testUserId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    /*
     * ------------------------------------------------------------------------
     * Cleanup user-role relationships.
     * ------------------------------------------------------------------------
     */

    if (testUserId > 0) {
      await pool.query(
        `
        DELETE FROM user_roles
        WHERE user_id = $1
        `,
        [testUserId]
      );
    }

    if (adminUserId > 0) {
      await pool.query(
        `
        DELETE FROM user_roles
        WHERE user_id = $1
        `,
        [adminUserId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Cleanup test roles.
     * ------------------------------------------------------------------------
     */

    if (roleOneId > 0) {
      await pool.query(
        `
        DELETE FROM roles
        WHERE id = $1
        `,
        [roleOneId]
      );
    }

    if (roleTwoId > 0) {
      await pool.query(
        `
        DELETE FROM roles
        WHERE id = $1
        `,
        [roleTwoId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Cleanup sessions.
     * ------------------------------------------------------------------------
     */

    if (testUserId > 0) {
      await pool.query(
        `
        DELETE FROM user_sessions
        WHERE user_id = $1
        `,
        [testUserId]
      );
    }

    if (adminUserId > 0) {
      await pool.query(
        `
        DELETE FROM user_sessions
        WHERE user_id = $1
        `,
        [adminUserId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Cleanup users.
     * ------------------------------------------------------------------------
     */

    if (testUserId > 0) {
      await pool.query(
        `
        DELETE FROM users
        WHERE id = $1
        `,
        [testUserId]
      );
    }

    if (adminUserId > 0) {
      await pool.query(
        `
        DELETE FROM users
        WHERE id = $1
        `,
        [adminUserId]
      );
    }

    await pool.end();
  });

  /*
   * ==========================================================================
   * CREATE
   * ==========================================================================
   */

  it("create() - should create the first role", async () => {
    const input: CreateRoleInput = {
      code: roleOneCode,
      displayName: roleOneDisplayName,
      description: "First repository test role",
      displayOrder: 500
    };

    const role = await repository.create(input, adminUserId);

    expect(role.id).toBeGreaterThan(0);
    expect(role.code).toBe(roleOneCode);
    expect(role.displayName).toBe(roleOneDisplayName);
    expect(role.description).toBe("First repository test role");
    expect(role.displayOrder).toBe(500);
    expect(role.status).toBe("ACTIVE");
    expect(role.createdBy).toBe(adminUserId);
    expect(role.updatedBy).toBe(adminUserId);

    roleOneId = role.id;
  });

  it("create() - should create the second role", async () => {
    const input: CreateRoleInput = {
      code: roleTwoCode,
      displayName: roleTwoDisplayName,
      description: "Second repository test role",
      displayOrder: 600
    };

    const role = await repository.create(input, adminUserId);

    expect(role.id).toBeGreaterThan(0);
    expect(role.code).toBe(roleTwoCode);
    expect(role.displayName).toBe(roleTwoDisplayName);
    expect(role.displayOrder).toBe(600);

    roleTwoId = role.id;
  });

  /*
   * ==========================================================================
   * FIND BY ID
   * ==========================================================================
   */

  it("findById() - should return an existing role", async () => {
    const role = await repository.findById(roleOneId);

    expect(role).not.toBeNull();

    expect(role?.id).toBe(roleOneId);
    expect(role?.code).toBe(roleOneCode);
    expect(role?.displayName).toBe(roleOneDisplayName);
  });

  it("findById() - should return null for unknown role", async () => {
    const role = await repository.findById(999999999);

    expect(role).toBeNull();
  });

  /*
   * ==========================================================================
   * FIND BY CODE
   * ==========================================================================
   */

  it("findByCode() - should return an existing role", async () => {
    const role = await repository.findByCode(roleOneCode);

    expect(role).not.toBeNull();

    expect(role?.id).toBe(roleOneId);
    expect(role?.code).toBe(roleOneCode);
  });

  it("findByCode() - should return null for unknown code", async () => {
    const role = await repository.findByCode(`UNKNOWN_ROLE_${timestamp}`);

    expect(role).toBeNull();
  });

  /*
   * ==========================================================================
   * UPDATE
   * ==========================================================================
   */

  it("update() - should update all editable fields", async () => {
    const input: UpdateRoleInput = {
      displayName: `${roleOneDisplayName} Updated`,
      description: "Updated repository description",
      displayOrder: 550,
      status: "INACTIVE"
    };

    const role = await repository.update(roleOneId, input, adminUserId);

    expect(role).not.toBeNull();

    expect(role?.id).toBe(roleOneId);
    expect(role?.displayName).toBe(`${roleOneDisplayName} Updated`);
    expect(role?.description).toBe("Updated repository description");
    expect(role?.displayOrder).toBe(550);
    expect(role?.status).toBe("INACTIVE");
    expect(role?.updatedBy).toBe(adminUserId);
  });

  it("update() - should preserve fields not provided", async () => {
    const input: UpdateRoleInput = {
      status: "ACTIVE"
    };

    const role = await repository.update(roleOneId, input, adminUserId);

    expect(role).not.toBeNull();

    expect(role?.displayName).toBe(`${roleOneDisplayName} Updated`);

    expect(role?.description).toBe("Updated repository description");

    expect(role?.displayOrder).toBe(550);

    expect(role?.status).toBe("ACTIVE");
  });

  it("update() - should return null for unknown role", async () => {
    const role = await repository.update(
      999999999,
      {
        displayName: "Unknown"
      },
      adminUserId
    );

    expect(role).toBeNull();
  });

  /*
   * ==========================================================================
   * FIND ALL
   * ==========================================================================
   */

  it("findAll() - should return roles ordered by displayOrder then id", async () => {
    const roles = await repository.findAll();

    expect(Array.isArray(roles)).toBe(true);

    const first = roles.find((role) => role.id === roleOneId);

    const second = roles.find((role) => role.id === roleTwoId);

    expect(first).toBeDefined();
    expect(second).toBeDefined();

    const firstIndex = roles.findIndex((role) => role.id === roleOneId);

    const secondIndex = roles.findIndex((role) => role.id === roleTwoId);

    expect(firstIndex).toBeLessThan(secondIndex);
  });

  /*
   * ==========================================================================
   * USER ROLE ASSIGNMENT
   * ==========================================================================
   */

  it("assignUserRole() - should assign a role to the user", async () => {
    await repository.assignUserRole(testUserId, roleOneId, adminUserId);

    const roles = await repository.findUserRoles(testUserId);

    const assigned = roles.find((role) => role.id === roleOneId);

    expect(assigned).toBeDefined();
    expect(assigned?.code).toBe(roleOneCode);
  });

  it("assignUserRole() - should safely ignore duplicate assignment", async () => {
    await repository.assignUserRole(testUserId, roleOneId, adminUserId);

    const roles = await repository.findUserRoles(testUserId);

    const duplicates = roles.filter((role) => role.id === roleOneId);

    expect(duplicates).toHaveLength(1);
  });

  /*
   * ==========================================================================
   * MULTIPLE ROLE ASSIGNMENT
   * ==========================================================================
   */

  it("assignUserRole() - should assign the second role", async () => {
    await repository.assignUserRole(testUserId, roleTwoId, adminUserId);

    const roles = await repository.findUserRoles(testUserId);

    expect(roles.some((role) => role.id === roleOneId)).toBe(true);

    expect(roles.some((role) => role.id === roleTwoId)).toBe(true);
  });

  /*
   * ==========================================================================
   * FIND USER ROLES
   * ==========================================================================
   */

  it("findUserRoles() - should return user roles ordered by displayOrder", async () => {
    const roles = await repository.findUserRoles(testUserId);

    expect(roles).toHaveLength(2);

    expect(roles[0]?.id).toBe(roleOneId);
    expect(roles[1]?.id).toBe(roleTwoId);

    expect(roles[0]!.displayOrder).toBeLessThan(roles[1]!.displayOrder);
  });

  it("findUserRoles() - should return an empty array for unknown user", async () => {
    const roles = await repository.findUserRoles(999999999);

    expect(roles).toEqual([]);
  });

  /*
   * ==========================================================================
   * REMOVE USER ROLE
   * ==========================================================================
   */

  it("removeUserRole() - should remove one assigned role", async () => {
    await repository.removeUserRole(testUserId, roleOneId);

    const roles = await repository.findUserRoles(testUserId);

    expect(roles.some((role) => role.id === roleOneId)).toBe(false);

    expect(roles.some((role) => role.id === roleTwoId)).toBe(true);
  });

  it("removeUserRole() - should safely succeed when relationship does not exist", async () => {
    await repository.removeUserRole(testUserId, roleOneId);

    const roles = await repository.findUserRoles(testUserId);

    expect(roles.some((role) => role.id === roleOneId)).toBe(false);
  });

  /*
   * ==========================================================================
   * FINAL DATABASE VERIFICATION
   * ==========================================================================
   */

  it("final verification - should preserve the second role in database", async () => {
    const role = await repository.findById(roleTwoId);

    expect(role).not.toBeNull();

    expect(role?.code).toBe(roleTwoCode);
    expect(role?.displayName).toBe(roleTwoDisplayName);
    expect(role?.status).toBe("ACTIVE");
  });
});
