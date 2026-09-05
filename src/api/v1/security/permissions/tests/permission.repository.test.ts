import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pool } from "../../../../../shared/config/db.js";

import * as repository from "../permission.repository.js";

describe("Permission Repository", () => {
  let testUserId: number;
  let testRoleId: number;
  let secondRoleId: number;

  const timestamp = Date.now();

  const permissionCode = `TEST_REPO_PERMISSION_${timestamp}`;
  const secondPermissionCode = `TEST_REPO_PERMISSION_2_${timestamp}`;
  const inactivePermissionCode = `TEST_REPO_PERMISSION_INACTIVE_${timestamp}`;
  const systemPermissionCode = `TEST_REPO_SYSTEM_PERMISSION_${timestamp}`;

  let permissionId: number;
  let secondPermissionId: number;
  let inactivePermissionId: number;
  let systemPermissionId: number;

  beforeAll(async () => {
    // -------------------------------------------------------------------------
    // Create test user
    // -------------------------------------------------------------------------

    const userResult = await pool.query(
      `
      INSERT INTO users
      (
        username,
        email,
        password_hash,
        full_name,
        display_name,
        status
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        'ACTIVE'
      )
      RETURNING id
      `,
      [
        `permission_repo_test_user_${timestamp}`,
        `permission_repo_test_${timestamp}@example.com`,
        "test-password-hash",
        "Permission Repository Test User",
        "Permission Repository Test User"
      ]
    );

    testUserId = Number(userResult.rows[0].id);

    // -------------------------------------------------------------------------
    // Create first test role
    // -------------------------------------------------------------------------

    const roleResult = await pool.query(
      `
      INSERT INTO roles
      (
        code,
        display_name,
        description,
        display_order,
        status,
        created_by,
        updated_by
      )
      VALUES
      (
        $1,
        $2,
        $3,
        900,
        'ACTIVE',
        $4,
        $4
      )
      RETURNING id
      `,
      [
        `TEST_REPO_ROLE_${timestamp}`,
        `Permission Repository Test Role ${timestamp}`,
        "Role used for permission repository tests",
        testUserId
      ]
    );

    testRoleId = Number(roleResult.rows[0].id);

    // -------------------------------------------------------------------------
    // Create second test role
    // -------------------------------------------------------------------------

    const secondRoleResult = await pool.query(
      `
      INSERT INTO roles
      (
        code,
        display_name,
        description,
        display_order,
        status,
        created_by,
        updated_by
      )
      VALUES
      (
        $1,
        $2,
        $3,
        901,
        'ACTIVE',
        $4,
        $4
      )
      RETURNING id
      `,
      [
        `TEST_REPO_ROLE_2_${timestamp}`,
        `Permission Repository Test Role 2 ${timestamp}`,
        "Second role used for permission repository tests",
        testUserId
      ]
    );

    secondRoleId = Number(secondRoleResult.rows[0].id);

    // -------------------------------------------------------------------------
    // Create permissions
    // -------------------------------------------------------------------------

    const permissionResult = await repository.create(
      {
        code: permissionCode,
        displayName: "Repository Test Permission",
        description: "Permission repository test permission",
        module: "TEST",
        resource: "repository",
        action: "read",
        displayOrder: 900,
        isSystemPermission: false
      },
      testUserId
    );

    permissionId = permissionResult.id;

    const secondPermissionResult = await repository.create(
      {
        code: secondPermissionCode,
        displayName: "Repository Test Permission 2",
        description: "Second permission repository test permission",
        module: "TEST",
        resource: "repository",
        action: "create",
        displayOrder: 901,
        isSystemPermission: false
      },
      testUserId
    );

    secondPermissionId = secondPermissionResult.id;

    const inactivePermissionResult = await repository.create(
      {
        code: inactivePermissionCode,
        displayName: "Inactive Repository Permission",
        description: "Inactive permission for authorization tests",
        module: "TEST",
        resource: "repository",
        action: "inactive",
        displayOrder: 902,
        isSystemPermission: false
      },
      testUserId
    );

    inactivePermissionId = inactivePermissionResult.id;

    // Make the permission inactive.
    await pool.query(
      `
      UPDATE permissions
      SET
        status = 'INACTIVE',
        updated_by = $1,
        updated_at = NOW()
      WHERE id = $2
      `,
      [testUserId, inactivePermissionId]
    );

    const systemPermissionResult = await repository.create(
      {
        code: systemPermissionCode,
        displayName: "System Repository Permission",
        description: "System permission for repository tests",
        module: "TEST",
        resource: "repository",
        action: "system",
        displayOrder: 903,
        isSystemPermission: true
      },
      testUserId
    );

    systemPermissionId = systemPermissionResult.id;
  });

  afterAll(async () => {
    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id IN ($1, $2)
      `,
      [testRoleId, secondRoleId]
    );

    await pool.query(
      `
      DELETE FROM user_roles
      WHERE user_id = $1
      `,
      [testUserId]
    );

    await pool.query(
      `
      DELETE FROM permissions
      WHERE id IN ($1, $2, $3, $4)
      `,
      [
        permissionId,
        secondPermissionId,
        inactivePermissionId,
        systemPermissionId
      ]
    );

    await pool.query(
      `
      DELETE FROM roles
      WHERE id IN ($1, $2)
      `,
      [testRoleId, secondRoleId]
    );

    await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      `,
      [testUserId]
    );

    await pool.end();
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------

  describe("findById", () => {
    it("should return a permission by ID", async () => {
      const result = await repository.findById(permissionId);

      expect(result).not.toBeNull();

      expect(result).toMatchObject({
        id: permissionId,
        code: permissionCode,
        displayName: "Repository Test Permission",
        description: "Permission repository test permission",
        module: "TEST",
        resource: "repository",
        action: "read",
        displayOrder: 900,
        isSystemPermission: false,
        status: "ACTIVE",
        createdBy: testUserId,
        updatedBy: testUserId
      });
    });

    it("should return null for an unknown permission ID", async () => {
      const result = await repository.findById(999999999);

      expect(result).toBeNull();
    });

    it("should map database numeric IDs to numbers", async () => {
      const result = await repository.findById(permissionId);

      expect(result).not.toBeNull();

      if (result) {
        expect(typeof result.id).toBe("number");
        expect(typeof result.displayOrder).toBe("number");
        expect(typeof result.createdBy).toBe("number");
        expect(typeof result.updatedBy).toBe("number");
      }
    });
  });

  // -------------------------------------------------------------------------
  // findByCode
  // -------------------------------------------------------------------------

  describe("findByCode", () => {
    it("should return a permission by code", async () => {
      const result = await repository.findByCode(permissionCode);

      expect(result).not.toBeNull();

      expect(result?.id).toBe(permissionId);
      expect(result?.code).toBe(permissionCode);
    });

    it("should return null for an unknown permission code", async () => {
      const result = await repository.findByCode(
        `UNKNOWN_PERMISSION_${timestamp}`
      );

      expect(result).toBeNull();
    });

    it("should distinguish different permission codes", async () => {
      const result = await repository.findByCode(secondPermissionCode);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(secondPermissionId);
      expect(result?.id).not.toBe(permissionId);
    });
  });

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  describe("findAll", () => {
    it("should return permissions", async () => {
      const result = await repository.findAll();

      expect(Array.isArray(result)).toBe(true);

      const permission = result.find((item) => item.id === permissionId);

      expect(permission).toBeDefined();
    });

    it("should return mapped permission properties", async () => {
      const result = await repository.findAll();

      const permission = result.find((item) => item.id === permissionId);

      expect(permission).toMatchObject({
        id: permissionId,
        code: permissionCode,
        displayName: "Repository Test Permission",
        module: "TEST",
        resource: "repository",
        action: "read"
      });
    });

    it("should order permissions by module, displayOrder and ID", async () => {
      const result = await repository.findAll();

      const testPermissions = result.filter(
        (item) =>
          item.id === permissionId ||
          item.id === secondPermissionId ||
          item.id === inactivePermissionId ||
          item.id === systemPermissionId
      );

      expect(testPermissions.length).toBe(4);

      for (let index = 1; index < testPermissions.length; index += 1) {
        const previous = testPermissions[index - 1];
        const current = testPermissions[index];

        if (
          previous?.module === current?.module &&
          previous?.displayOrder === current?.displayOrder
        ) {
          expect(previous?.id).toBeLessThanOrEqual(current!.id);
        } else if (previous?.module === current?.module) {
          expect(previous?.displayOrder).toBeLessThanOrEqual(
            current!.displayOrder
          );
        } else {
          expect(
            (previous?.module ?? "").localeCompare(current?.module ?? "")
          ).toBeLessThanOrEqual(0);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  describe("create", () => {
    it("should create a permission with all supplied fields", async () => {
      const code = `TEST_REPO_CREATE_${timestamp}`;

      const result = await repository.create(
        {
          code,
          displayName: "Created Repository Permission",
          description: "Created through repository test",
          module: "TEST_CREATE",
          resource: "repository",
          action: "create",
          displayOrder: 910,
          isSystemPermission: false
        },
        testUserId
      );

      expect(result).toMatchObject({
        code,
        displayName: "Created Repository Permission",
        description: "Created through repository test",
        module: "TEST_CREATE",
        resource: "repository",
        action: "create",
        displayOrder: 910,
        isSystemPermission: false,
        status: "ACTIVE",
        createdBy: testUserId,
        updatedBy: testUserId
      });

      await pool.query(
        `
        DELETE FROM permissions
        WHERE id = $1
        `,
        [result.id]
      );
    });

    it("should use default displayOrder when omitted", async () => {
      const code = `TEST_REPO_DEFAULT_ORDER_${timestamp}`;

      const result = await repository.create(
        {
          code,
          displayName: "Default Order Permission"
        },
        testUserId
      );

      expect(result.displayOrder).toBe(0);
      expect(result.status).toBe("ACTIVE");
      expect(result.isSystemPermission).toBe(false);

      await pool.query(
        `
        DELETE FROM permissions
        WHERE id = $1
        `,
        [result.id]
      );
    });

    it("should use null for optional text fields when omitted", async () => {
      const code = `TEST_REPO_NULL_FIELDS_${timestamp}`;

      const result = await repository.create(
        {
          code,
          displayName: "Null Fields Permission"
        },
        testUserId
      );

      expect(result.description).toBeNull();
      expect(result.module).toBeNull();
      expect(result.resource).toBeNull();
      expect(result.action).toBeNull();

      await pool.query(
        `
        DELETE FROM permissions
        WHERE id = $1
        `,
        [result.id]
      );
    });

    it("should default isSystemPermission to false", async () => {
      const code = `TEST_REPO_SYSTEM_DEFAULT_${timestamp}`;

      const result = await repository.create(
        {
          code,
          displayName: "Default System Flag Permission"
        },
        testUserId
      );

      expect(result.isSystemPermission).toBe(false);

      await pool.query(
        `
        DELETE FROM permissions
        WHERE id = $1
        `,
        [result.id]
      );
    });

    it("should create a system permission when explicitly requested", async () => {
      const code = `TEST_REPO_EXPLICIT_SYSTEM_${timestamp}`;

      const result = await repository.create(
        {
          code,
          displayName: "Explicit System Permission",
          isSystemPermission: true
        },
        testUserId
      );

      expect(result.isSystemPermission).toBe(true);
      expect(result.status).toBe("ACTIVE");

      await pool.query(
        `
        DELETE FROM permissions
        WHERE id = $1
        `,
        [result.id]
      );
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  describe("update", () => {
    it("should update permission fields", async () => {
      const result = await repository.update(
        permissionId,
        {
          displayName: "Updated Repository Permission",
          description: "Updated repository description",
          module: "UPDATED_TEST",
          resource: "updated_repository",
          action: "update",
          displayOrder: 950,
          status: "ACTIVE"
        },
        testUserId
      );

      expect(result).not.toBeNull();

      expect(result).toMatchObject({
        id: permissionId,
        displayName: "Updated Repository Permission",
        description: "Updated repository description",
        module: "UPDATED_TEST",
        resource: "updated_repository",
        action: "update",
        displayOrder: 950,
        status: "ACTIVE",
        updatedBy: testUserId
      });
    });

    it("should update only supplied fields", async () => {
      const result = await repository.update(
        permissionId,
        {
          displayName: "Partially Updated Permission"
        },
        testUserId
      );

      expect(result).not.toBeNull();

      expect(result?.displayName).toBe("Partially Updated Permission");

      expect(result?.module).toBe("UPDATED_TEST");
      expect(result?.resource).toBe("updated_repository");
      expect(result?.action).toBe("update");
      expect(result?.displayOrder).toBe(950);
    });

    it("should return null when updating an unknown permission", async () => {
      const result = await repository.update(
        999999999,
        {
          displayName: "Unknown Permission"
        },
        testUserId
      );

      expect(result).toBeNull();
    });

    it("should update status to INACTIVE", async () => {
      const result = await repository.update(
        permissionId,
        {
          status: "INACTIVE"
        },
        testUserId
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBe("INACTIVE");

      // Restore for subsequent tests.
      await repository.update(
        permissionId,
        {
          status: "ACTIVE"
        },
        testUserId
      );
    });

    it("should preserve the permission code during update", async () => {
      const before = await repository.findById(permissionId);

      expect(before).not.toBeNull();

      const result = await repository.update(
        permissionId,
        {
          displayName: "Code Preservation Test"
        },
        testUserId
      );

      expect(result).not.toBeNull();
      expect(result?.code).toBe(permissionCode);
    });
  });

  // -------------------------------------------------------------------------
  // assignToRole
  // -------------------------------------------------------------------------

  describe("assignToRole", () => {
    it("should assign a permission to a role", async () => {
      await repository.assignToRole(testRoleId, permissionId, testUserId);

      const result = await repository.findByRoleId(testRoleId);

      expect(result.some((item) => item.id === permissionId)).toBe(true);
    });

    it("should be idempotent when assigning the same permission twice", async () => {
      await repository.assignToRole(testRoleId, permissionId, testUserId);

      await repository.assignToRole(testRoleId, permissionId, testUserId);

      const result = await pool.query(
        `
        SELECT COUNT(*)::int AS count
        FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
        `,
        [testRoleId, permissionId]
      );

      expect(result.rows[0].count).toBe(1);
    });

    it("should allow the same permission to be assigned to another role", async () => {
      await repository.assignToRole(secondRoleId, permissionId, testUserId);

      const result = await pool.query(
        `
        SELECT COUNT(*)::int AS count
        FROM role_permissions
        WHERE permission_id = $1
        `,
        [permissionId]
      );

      expect(result.rows[0].count).toBe(2);
    });

    it("should allow multiple permissions for the same role", async () => {
      await repository.assignToRole(testRoleId, secondPermissionId, testUserId);

      const result = await repository.findByRoleId(testRoleId);

      const ids = result.map((item) => item.id);

      expect(ids).toContain(permissionId);
      expect(ids).toContain(secondPermissionId);
    });
  });

  // -------------------------------------------------------------------------
  // removeFromRole
  // -------------------------------------------------------------------------

  describe("removeFromRole", () => {
    it("should remove a permission from a role", async () => {
      await repository.removeFromRole(testRoleId, secondPermissionId);

      const result = await repository.findByRoleId(testRoleId);

      expect(result.some((item) => item.id === secondPermissionId)).toBe(false);
    });

    it("should be idempotent when the assignment does not exist", async () => {
      await expect(
        repository.removeFromRole(testRoleId, 999999999)
      ).resolves.toBeUndefined();
    });

    it("should not remove the permission from another role", async () => {
      const before = await repository.findByRoleId(secondRoleId);

      expect(before.some((item) => item.id === permissionId)).toBe(true);

      await repository.removeFromRole(testRoleId, permissionId);

      const after = await repository.findByRoleId(secondRoleId);

      expect(after.some((item) => item.id === permissionId)).toBe(true);

      // Re-establish assignment for later tests if needed.
      await repository.assignToRole(testRoleId, permissionId, testUserId);
    });
  });

  // -------------------------------------------------------------------------
  // findByRoleId
  // -------------------------------------------------------------------------

  describe("findByRoleId", () => {
    it("should return permissions assigned to a role", async () => {
      const result = await repository.findByRoleId(testRoleId);

      expect(Array.isArray(result)).toBe(true);

      expect(result.some((item) => item.id === permissionId)).toBe(true);
    });

    it("should return an empty array for a role with no permissions", async () => {
      const result = await repository.findByRoleId(999999999);

      expect(result).toEqual([]);
    });

    it("should return only permissions belonging to the requested role", async () => {
      const result = await repository.findByRoleId(testRoleId);

      expect(
        result.every((item) =>
          [
            permissionId,
            secondPermissionId,
            inactivePermissionId,
            systemPermissionId
          ].includes(item.id)
        )
      ).toBe(true);
    });

    it("should order permissions by module, displayOrder and ID", async () => {
      const result = await repository.findByRoleId(testRoleId);

      for (let index = 1; index < result.length; index += 1) {
        const previous = result[index - 1];
        const current = result[index];

        if (
          previous?.module === current?.module &&
          previous?.displayOrder === current?.displayOrder
        ) {
          expect(previous?.id).toBeLessThanOrEqual(current!.id);
        } else if (previous?.module === current?.module) {
          expect(previous?.displayOrder).toBeLessThanOrEqual(
            current!.displayOrder
          );
        } else {
          expect(
            (previous?.module ?? "").localeCompare(current?.module ?? "")
          ).toBeLessThanOrEqual(0);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // userHasPermission
  // -------------------------------------------------------------------------

  describe("userHasPermission", () => {
    beforeAll(async () => {
      // -----------------------------------------------------------------------
      // Restore the permission fields changed by the update tests.
      // The authorization tests below expect:
      // TEST / repository / read
      // -----------------------------------------------------------------------

      await repository.update(
        permissionId,
        {
          displayName: "Repository Test Permission",
          description: "Permission repository test permission",
          module: "TEST",
          resource: "repository",
          action: "read",
          displayOrder: 900,
          status: "ACTIVE"
        },
        testUserId
      );

      // Make sure the test user has the test role.
      await pool.query(
        `
      INSERT INTO user_roles
      (
        user_id,
        role_id,
        created_by
      )
      VALUES
      (
        $1,
        $2,
        $1
      )
      ON CONFLICT
      (
        user_id,
        role_id
      )
      DO NOTHING
      `,
        [testUserId, testRoleId]
      );

      // Ensure the active permission is assigned.
      await repository.assignToRole(testRoleId, permissionId, testUserId);
    });

    it("should return true when the user has an active matching permission", async () => {
      const result = await repository.userHasPermission(
        testUserId,
        "TEST",
        "repository",
        "read"
      );

      expect(result).toBe(true);
    });

    it("should match module, resource and action case-insensitively", async () => {
      const result = await repository.userHasPermission(
        testUserId,
        "test",
        "REPOSITORY",
        "READ"
      );

      expect(result).toBe(true);
    });

    it("should return false when the permission does not exist", async () => {
      const result = await repository.userHasPermission(
        testUserId,
        "TEST",
        "repository",
        "delete"
      );

      expect(result).toBe(false);
    });

    it("should return false when the user does not have the permission", async () => {
      const result = await repository.userHasPermission(
        testUserId,
        "OTHER",
        "resource",
        "read"
      );

      expect(result).toBe(false);
    });

    it("should return false for an unknown user", async () => {
      const result = await repository.userHasPermission(
        999999999,
        "TEST",
        "repository",
        "read"
      );

      expect(result).toBe(false);
    });

    it("should return false when the permission is inactive", async () => {
      await repository.assignToRole(
        testRoleId,
        inactivePermissionId,
        testUserId
      );

      const result = await repository.userHasPermission(
        testUserId,
        "TEST",
        "repository",
        "inactive"
      );

      expect(result).toBe(false);
    });

    it("should return false when the role is inactive", async () => {
      await pool.query(
        `
        UPDATE roles
        SET
          status = 'INACTIVE',
          updated_by = $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [testUserId, testRoleId]
      );

      const result = await repository.userHasPermission(
        testUserId,
        "TEST",
        "repository",
        "read"
      );

      expect(result).toBe(false);

      // Restore role for cleanup consistency.
      await pool.query(
        `
        UPDATE roles
        SET
          status = 'ACTIVE',
          updated_by = $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [testUserId, testRoleId]
      );
    });

    it("should return true when another active role grants the permission", async () => {
      // Ensure second role belongs to the user.
      await pool.query(
        `
        INSERT INTO user_roles
        (
          user_id,
          role_id,
          created_by
        )
        VALUES
        (
          $1,
          $2,
          $1
        )
        ON CONFLICT
        (
          user_id,
          role_id
        )
        DO NOTHING
        `,
        [testUserId, secondRoleId]
      );

      // First role remains active and has the permission.
      const result = await repository.userHasPermission(
        testUserId,
        "TEST",
        "repository",
        "read"
      );

      expect(result).toBe(true);
    });

    it("should return false when module does not match", async () => {
      const result = await repository.userHasPermission(
        testUserId,
        "WRONG_MODULE",
        "repository",
        "read"
      );

      expect(result).toBe(false);
    });

    it("should return false when resource does not match", async () => {
      const result = await repository.userHasPermission(
        testUserId,
        "TEST",
        "wrong_resource",
        "read"
      );

      expect(result).toBe(false);
    });

    it("should return false when action does not match", async () => {
      const result = await repository.userHasPermission(
        testUserId,
        "TEST",
        "repository",
        "wrong_action"
      );

      expect(result).toBe(false);
    });
  });
});
