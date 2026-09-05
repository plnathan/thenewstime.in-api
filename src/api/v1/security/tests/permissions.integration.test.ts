import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../app.js";
import { pool } from "../../../../shared/config/db.js";

describe("Permissions API", () => {
  let accessToken = "";

  let adminUserId = 0;
  let superAdminRoleId = 0;
  let adminRoleId = 0;

  let testPermissionId = 0;
  let testRoleId = 0;

  const timestamp = Date.now();

  const adminEmail = `permissions-test-admin-${timestamp}@example.com`;
  const adminUsername = `permissions_test_admin_${timestamp}`;

  const testRoleCode = `TEST_PERMISSION_ROLE_${timestamp}`;
  const testPermissionCode = `TEST_PERMISSION_${timestamp}`;

  beforeAll(async () => {
    /*
     * ------------------------------------------------------------------------
     * Find required roles dynamically.
     * Never hard-code role IDs.
     * ------------------------------------------------------------------------
     */

    const rolesResult = await pool.query(
      `
      SELECT
        id,
        code
      FROM roles
      WHERE code IN ('SUPER_ADMIN', 'ADMIN')
      `
    );

    const superAdminRole = rolesResult.rows.find(
      (row) => row.code === "SUPER_ADMIN"
    );

    const adminRole = rolesResult.rows.find((row) => row.code === "ADMIN");

    expect(superAdminRole).toBeDefined();
    expect(adminRole).toBeDefined();

    superAdminRoleId = Number(superAdminRole.id);
    adminRoleId = Number(adminRole.id);

    expect(superAdminRoleId).toBeGreaterThan(0);
    expect(adminRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary SUPER_ADMIN user.
     * ------------------------------------------------------------------------
     */

    const passwordHash = await bcrypt.hash("PermissionsTest@123", 12);

    const userResult = await pool.query(
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
        "Permissions Integration Test Admin",
        "Permissions Integration Test Admin",
        superAdminRoleId
      ]
    );

    adminUserId = Number(userResult.rows[0].id);

    expect(adminUserId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Insert authoritative user_roles relation.
     * ------------------------------------------------------------------------
     */

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
      [adminUserId, superAdminRoleId]
    );

    /*
     * ------------------------------------------------------------------------
     * Login through the real Auth API.
     * ------------------------------------------------------------------------
     */

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username: adminUsername,
      password: "PermissionsTest@123"
    });

    expect(loginResponse.status).toBe(200);

    accessToken = loginResponse.body.data.tokens.accessToken;

    expect(accessToken).toBeTruthy();

    /*
     * ------------------------------------------------------------------------
     * Create a temporary role directly in the database.
     *
     * This role is only a fixture for role-permission assignment tests.
     * The Permissions API itself is still being tested through HTTP.
     * ------------------------------------------------------------------------
     */

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
        999,
        'ACTIVE',
        $4,
        $4
      )
      RETURNING id
      `,
      [
        testRoleCode,
        "Permissions Integration Test Role",
        "Temporary role for Permissions integration tests.",
        adminUserId
      ]
    );

    testRoleId = Number(roleResult.rows[0].id);

    expect(testRoleId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    /*
     * ------------------------------------------------------------------------
     * Cleanup role-permission relationships.
     * ------------------------------------------------------------------------
     */

    if (testRoleId > 0) {
      await pool.query(
        `
        DELETE FROM role_permissions
        WHERE role_id = $1
        `,
        [testRoleId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Cleanup temporary permission.
     * ------------------------------------------------------------------------
     */

    if (testPermissionId > 0) {
      await pool.query(
        `
        DELETE FROM role_permissions
        WHERE permission_id = $1
        `,
        [testPermissionId]
      );

      await pool.query(
        `
        DELETE FROM permissions
        WHERE id = $1
        `,
        [testPermissionId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Cleanup temporary role.
     * ------------------------------------------------------------------------
     */

    if (testRoleId > 0) {
      await pool.query(
        `
        DELETE FROM roles
        WHERE id = $1
        `,
        [testRoleId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Cleanup temporary user's sessions and role relationships.
     * ------------------------------------------------------------------------
     */

    if (adminUserId > 0) {
      await pool.query(
        `
        DELETE FROM user_sessions
        WHERE user_id = $1
        `,
        [adminUserId]
      );

      await pool.query(
        `
        DELETE FROM user_roles
        WHERE user_id = $1
        `,
        [adminUserId]
      );

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
   * AUTHENTICATION
   * ==========================================================================
   */

  it("GET /api/v1/security/permissions - should return 401 without authentication", async () => {
    const response = await request(app).get("/api/v1/security/permissions");

    expect(response.status).toBe(401);
  });

  /*
   * ==========================================================================
   * LIST
   * ==========================================================================
   */

  it("GET /api/v1/security/permissions - should return all permissions", async () => {
    const response = await request(app)
      .get("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  /*
   * ==========================================================================
   * GET BY ID
   * ==========================================================================
   */

  it("GET /api/v1/security/permissions/:id - should return a permission by ID", async () => {
    const listResponse = await request(app)
      .get("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.length).toBeGreaterThan(0);

    const permission = listResponse.body.data[0];

    const response = await request(app)
      .get(`/api/v1/security/permissions/${permission.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.id).toBe(permission.id);
    expect(response.body.data.code).toBe(permission.code);
  });

  it("GET /api/v1/security/permissions/:id - should return 400 for invalid permission ID", async () => {
    const response = await request(app)
      .get("/api/v1/security/permissions/invalid")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  it("GET /api/v1/security/permissions/:id - should return 404 for unknown permission", async () => {
    const response = await request(app)
      .get("/api/v1/security/permissions/999999999")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  /*
   * ==========================================================================
   * CREATE
   * ==========================================================================
   */

  it("POST /api/v1/security/permissions - should create a permission", async () => {
    const response = await request(app)
      .post("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: testPermissionCode,
        displayName: "Permissions Integration Test",
        description: "Temporary permission for integration testing.",
        module: "SECURITY",
        resource: "permissions",
        action: "test",
        displayOrder: 999,
        isSystemPermission: false
      });

    expect(response.status).toBe(201);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.id).toBeGreaterThan(0);
    expect(response.body.data.code).toBe(testPermissionCode);
    expect(response.body.data.displayName).toBe("Permissions Integration Test");
    expect(response.body.data.module).toBe("SECURITY");
    expect(response.body.data.resource).toBe("permissions");
    expect(response.body.data.action).toBe("test");
    expect(response.body.data.isSystemPermission).toBe(false);
    expect(response.body.data.status).toBe("ACTIVE");

    testPermissionId = Number(response.body.data.id);

    expect(testPermissionId).toBeGreaterThan(0);
  });

  it("POST /api/v1/security/permissions - should return 409 for duplicate permission code", async () => {
    expect(testPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .post("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: testPermissionCode,
        displayName: "Duplicate Permission"
      });

    expect(response.status).toBe(409);
  });

  it("POST /api/v1/security/permissions - should return 400 for invalid payload", async () => {
    const response = await request(app)
      .post("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: "X",
        displayName: "X"
      });

    expect(response.status).toBe(400);
  });

  it("POST /api/v1/security/permissions - should return 400 for invalid permission code", async () => {
    const response = await request(app)
      .post("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: "invalid permission code",
        displayName: "Invalid Permission"
      });

    expect(response.status).toBe(400);
  });

  it("POST /api/v1/security/permissions - should return 400 for lowercase permission code", async () => {
    const response = await request(app)
      .post("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: "security:permissions:read",
        displayName: "Invalid Permission"
      });

    expect(response.status).toBe(400);
  });

  /*
   * ==========================================================================
   * UPDATE
   * ==========================================================================
   */

  it("PATCH /api/v1/security/permissions/:id - should update a permission", async () => {
    expect(testPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/permissions/${testPermissionId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "Updated Permissions Test Permission",
        description: "Updated permission description.",
        module: "SECURITY",
        resource: "permissions",
        action: "updated",
        displayOrder: 1000
      });

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.id).toBe(testPermissionId);
    expect(response.body.data.displayName).toBe(
      "Updated Permissions Test Permission"
    );
    expect(response.body.data.description).toBe(
      "Updated permission description."
    );
    expect(response.body.data.action).toBe("updated");
    expect(response.body.data.displayOrder).toBe(1000);
  });

  it("PATCH /api/v1/security/permissions/:id - should return 400 for invalid permission ID", async () => {
    const response = await request(app)
      .patch("/api/v1/security/permissions/invalid")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "Invalid ID Update"
      });

    expect(response.status).toBe(400);
  });

  it("PATCH /api/v1/security/permissions/:id - should return 404 for unknown permission", async () => {
    const response = await request(app)
      .patch("/api/v1/security/permissions/999999999")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "Unknown Permission"
      });

    expect(response.status).toBe(404);
  });

  it("PATCH /api/v1/security/permissions/:id - should return 400 for invalid update payload", async () => {
    expect(testPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/permissions/${testPermissionId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "X",
        status: "INVALID"
      });

    expect(response.status).toBe(400);
  });

  /*
   * ==========================================================================
   * SYSTEM PERMISSION PROTECTION
   * ==========================================================================
   */

  it("PATCH /api/v1/security/permissions/:id - should prevent deactivation of a system permission", async () => {
    const systemPermissionResult = await pool.query(
      `
      SELECT id
      FROM permissions
      WHERE is_system_permission = true
      ORDER BY id ASC
      LIMIT 1
      `
    );

    expect(systemPermissionResult.rows.length).toBeGreaterThan(0);

    const systemPermissionId = Number(systemPermissionResult.rows[0].id);

    expect(systemPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/permissions/${systemPermissionId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "INACTIVE"
      });

    expect(response.status).toBe(400);
  });

  /*
   * ==========================================================================
   * ROLE-PERMISSION
   * ==========================================================================
   */

  it("GET /api/v1/security/permissions/role/:roleId - should return role permissions", async () => {
    expect(testRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .get(`/api/v1/security/permissions/role/${testRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("POST /api/v1/security/permissions/role/:roleId/:permissionId - should assign permission to role", async () => {
    expect(testRoleId).toBeGreaterThan(0);
    expect(testPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .post(
        `/api/v1/security/permissions/role/${testRoleId}/${testPermissionId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
  });

  it("GET /api/v1/security/permissions/role/:roleId - should return assigned permission", async () => {
    expect(testRoleId).toBeGreaterThan(0);
    expect(testPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .get(`/api/v1/security/permissions/role/${testRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(Array.isArray(response.body.data)).toBe(true);

    const assignedPermission = response.body.data.find(
      (permission: { id: number }) => Number(permission.id) === testPermissionId
    );

    expect(assignedPermission).toBeDefined();
  });

  it("POST /api/v1/security/permissions/role/:roleId/:permissionId - should safely ignore duplicate assignment", async () => {
    expect(testRoleId).toBeGreaterThan(0);
    expect(testPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .post(
        `/api/v1/security/permissions/role/${testRoleId}/${testPermissionId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    /*
     * Repository uses ON CONFLICT DO NOTHING.
     * Therefore duplicate assignment remains successful.
     */
    expect(response.status).toBe(200);

    const checkResponse = await request(app)
      .get(`/api/v1/security/permissions/role/${testRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(checkResponse.status).toBe(200);

    const assignedPermissions = checkResponse.body.data.filter(
      (permission: { id: number }) => Number(permission.id) === testPermissionId
    );

    expect(assignedPermissions).toHaveLength(1);
  });

  it("DELETE /api/v1/security/permissions/role/:roleId/:permissionId - should remove permission from role", async () => {
    expect(testRoleId).toBeGreaterThan(0);
    expect(testPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .delete(
        `/api/v1/security/permissions/role/${testRoleId}/${testPermissionId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
  });

  it("GET /api/v1/security/permissions/role/:roleId - should not return removed permission", async () => {
    expect(testRoleId).toBeGreaterThan(0);
    expect(testPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .get(`/api/v1/security/permissions/role/${testRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    const removedPermission = response.body.data.find(
      (permission: { id: number }) => Number(permission.id) === testPermissionId
    );

    expect(removedPermission).toBeUndefined();
  });

  /*
   * ==========================================================================
   * INACTIVE PERMISSION
   * ==========================================================================
   */

  it("PATCH /api/v1/security/permissions/:id - should deactivate a non-system permission", async () => {
    expect(testPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/permissions/${testPermissionId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "INACTIVE"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("INACTIVE");
  });

  it("POST /api/v1/security/permissions/role/:roleId/:permissionId - should reject inactive permission assignment", async () => {
    expect(testRoleId).toBeGreaterThan(0);
    expect(testPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .post(
        `/api/v1/security/permissions/role/${testRoleId}/${testPermissionId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  it("PATCH /api/v1/security/permissions/:id - should reactivate a non-system permission", async () => {
    expect(testPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/permissions/${testPermissionId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "ACTIVE"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("ACTIVE");
  });

  /*
   * ==========================================================================
   * INVALID ROLE-PERMISSION PARAMETERS
   * ==========================================================================
   */

  it("GET /api/v1/security/permissions/role/:roleId - should return an empty array for an unknown role", async () => {
    const response = await request(app)
      .get("/api/v1/security/permissions/role/999999999")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(0);
  });

  it("POST /api/v1/security/permissions/role/:roleId/:permissionId - should return 404 for unknown permission", async () => {
    expect(testRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .post(`/api/v1/security/permissions/role/${testRoleId}/999999999`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  /*
   * ==========================================================================
   * FINAL VERIFICATION
   * ==========================================================================
   */

  it("GET /api/v1/security/permissions/:id - should return the final test permission state", async () => {
    expect(testPermissionId).toBeGreaterThan(0);

    const response = await request(app)
      .get(`/api/v1/security/permissions/${testPermissionId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data.id).toBe(testPermissionId);
    expect(response.body.data.code).toBe(testPermissionCode);
    expect(response.body.data.status).toBe("ACTIVE");
    expect(response.body.data.isSystemPermission).toBe(false);
  });
});
