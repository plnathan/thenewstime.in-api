import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../app.js";
import { pool } from "../../../../shared/config/db.js";

describe("RBAC Authorization API", () => {
  let accessToken = "";

  let testUserId = 0;
  let superAdminRoleId = 0;
  let testRoleId = 0;

  let readPermissionId = 0;
  let createPermissionId = 0;

  const timestamp = Date.now();

  const testUsername = `rbac_test_user_${timestamp}`;
  const testEmail = `rbac-test-user-${timestamp}@example.com`;

  /*
   * Use unique role code and display name for every test run.
   *
   * The roles table has unique constraints on both fields.
   */
  const testRoleCode = `TEST_RBAC_ROLE_${timestamp}`;
  const testRoleDisplayName = `RBAC Integration Test Role ${timestamp}`;

  const password = "RBAC_Test@123";

  /*
   * ==========================================================================
   * TEST SETUP
   * ==========================================================================
   */

  beforeAll(async () => {
    /*
     * ------------------------------------------------------------------------
     * Find SUPER_ADMIN role dynamically.
     * ------------------------------------------------------------------------
     *
     * The users table requires role_id.
     *
     * SUPER_ADMIN is therefore used only during initial user creation.
     * Before login, the user's role is changed to the temporary RBAC role.
     */

    const superAdminResult = await pool.query(
      `
      SELECT id
      FROM roles
      WHERE code = 'SUPER_ADMIN'
      LIMIT 1
      `
    );

    expect(superAdminResult.rows.length).toBe(1);

    superAdminRoleId = Number(superAdminResult.rows[0].id);

    expect(superAdminRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary RBAC test user.
     * ------------------------------------------------------------------------
     */

    const passwordHash = await bcrypt.hash(password, 12);

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
        testUsername,
        testEmail,
        passwordHash,
        "RBAC Integration Test User",
        "RBAC Test User",
        superAdminRoleId
      ]
    );

    testUserId = Number(userResult.rows[0].id);

    expect(testUserId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary RBAC role.
     * ------------------------------------------------------------------------
     *
     * Both code and display_name are unique for this test run.
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
        testRoleDisplayName,
        "Temporary role for RBAC authorization integration tests.",
        testUserId
      ]
    );

    testRoleId = Number(roleResult.rows[0].id);

    expect(testRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Replace temporary SUPER_ADMIN role with TEST_RBAC_ROLE.
     * ------------------------------------------------------------------------
     *
     * This is critical.
     *
     * The RBAC tests must evaluate ONLY the temporary test role.
     * Otherwise SUPER_ADMIN would continue granting access even after
     * READ/CREATE permissions are removed.
     */

    await pool.query(
      `
      UPDATE users
      SET
        role_id = $2
      WHERE id = $1
      `,
      [testUserId, testRoleId]
    );

    /*
     * ------------------------------------------------------------------------
     * Remove temporary SUPER_ADMIN user_roles relation.
     * ------------------------------------------------------------------------
     */

    await pool.query(
      `
      DELETE FROM user_roles
      WHERE
        user_id = $1
        AND role_id = $2
      `,
      [testUserId, superAdminRoleId]
    );

    /*
     * ------------------------------------------------------------------------
     * Insert authoritative TEST_RBAC_ROLE relation.
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
      [testUserId, testRoleId]
    );

    /*
     * ------------------------------------------------------------------------
     * Find required permissions dynamically.
     * ------------------------------------------------------------------------
     *
     * SECURITY / permissions / read
     * SECURITY / permissions / create
     */

    const permissionsResult = await pool.query(
      `
      SELECT
        id,
        action
      FROM permissions
      WHERE
        LOWER(module) = LOWER('SECURITY')
        AND LOWER(resource) = LOWER('permissions')
        AND LOWER(action) IN (
          LOWER('read'),
          LOWER('create')
        )
        AND status = 'ACTIVE'
      ORDER BY id ASC
      `
    );

    const readPermission = permissionsResult.rows.find(
      (row) => String(row.action).toLowerCase() === "read"
    );

    const createPermission = permissionsResult.rows.find(
      (row) => String(row.action).toLowerCase() === "create"
    );

    expect(readPermission).toBeDefined();
    expect(createPermission).toBeDefined();

    readPermissionId = Number(readPermission.id);
    createPermissionId = Number(createPermission.id);

    expect(readPermissionId).toBeGreaterThan(0);
    expect(createPermissionId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Assign READ permission to TEST_RBAC_ROLE.
     * ------------------------------------------------------------------------
     */

    await pool.query(
      `
      INSERT INTO role_permissions
      (
        role_id,
        permission_id,
        created_by
      )
      VALUES
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
      (
        role_id,
        permission_id
      )
      DO NOTHING
      `,
      [testRoleId, readPermissionId, testUserId]
    );

    /*
     * ------------------------------------------------------------------------
     * Assign CREATE permission to TEST_RBAC_ROLE.
     * ------------------------------------------------------------------------
     */

    await pool.query(
      `
      INSERT INTO role_permissions
      (
        role_id,
        permission_id,
        created_by
      )
      VALUES
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
      (
        role_id,
        permission_id
      )
      DO NOTHING
      `,
      [testRoleId, createPermissionId, testUserId]
    );

    /*
     * ------------------------------------------------------------------------
     * Login through the real Auth API.
     * ------------------------------------------------------------------------
     *
     * Auth login uses username + password.
     */

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username: testUsername,
      password
    });

    expect(loginResponse.status).toBe(200);

    accessToken = loginResponse.body.data.tokens.accessToken;

    expect(accessToken).toBeTruthy();
  });

  /*
   * ==========================================================================
   * TEST CLEANUP
   * ==========================================================================
   */

  afterAll(async () => {
    /*
     * ------------------------------------------------------------------------
     * Remove role-permission relationships first.
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
     * Remove temporary user's sessions and role relationships.
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

      await pool.query(
        `
        DELETE FROM user_roles
        WHERE user_id = $1
        `,
        [testUserId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Remove temporary role.
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
     * Remove temporary user.
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

    /*
     * Close PostgreSQL connection pool.
     */

    await pool.end();
  });

  /*
   * ==========================================================================
   * AUTHENTICATION BASELINE
   * ==========================================================================
   */

  it("should have a valid authentication token", () => {
    expect(accessToken).toBeTruthy();
  });

  /*
   * ==========================================================================
   * RBAC READ AUTHORIZATION
   * ==========================================================================
   */

  it("GET /api/v1/security/permissions - should allow a user with READ permission", async () => {
    const response = await request(app)
      .get("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
  });

  /*
   * ==========================================================================
   * RBAC CREATE AUTHORIZATION
   * ==========================================================================
   */

  it("POST /api/v1/security/permissions - should allow a user with CREATE permission", async () => {
    const response = await request(app)
      .post("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: `TEST_RBAC_PERMISSION_${timestamp}`,
        displayName: `RBAC Authorization Test Permission ${timestamp}`,
        description: "Temporary permission created during RBAC testing.",
        module: "SECURITY",
        resource: "permissions",
        action: "test",
        displayOrder: 999,
        isSystemPermission: false
      });

    expect(response.status).toBe(201);

    const createdPermissionId = Number(response.body.data.id);

    expect(createdPermissionId).toBeGreaterThan(0);

    /*
     * Direct database cleanup is acceptable here because this test is
     * specifically validating the HTTP authorization + service path.
     */

    await pool.query(
      `
      DELETE FROM permissions
      WHERE id = $1
      `,
      [createdPermissionId]
    );
  });

  /*
   * ==========================================================================
   * REMOVE CREATE PERMISSION
   * ==========================================================================
   */

  it("should remove CREATE permission from the test role", async () => {
    const result = await pool.query(
      `
      DELETE FROM role_permissions
      WHERE
        role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, createPermissionId]
    );

    expect(result.rowCount).toBe(1);
  });

  /*
   * ==========================================================================
   * CREATE AUTHORIZATION DENIAL
   * ==========================================================================
   */

  it("POST /api/v1/security/permissions - should deny access without CREATE permission", async () => {
    const response = await request(app)
      .post("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: `TEST_RBAC_DENIED_${timestamp}`,
        displayName: `Should Not Be Created ${timestamp}`
      });

    expect(response.status).toBe(403);
  });

  /*
   * ==========================================================================
   * REMOVE READ PERMISSION
   * ==========================================================================
   */

  it("should remove READ permission from the test role", async () => {
    const result = await pool.query(
      `
      DELETE FROM role_permissions
      WHERE
        role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, readPermissionId]
    );

    expect(result.rowCount).toBe(1);
  });

  /*
   * ==========================================================================
   * READ AUTHORIZATION DENIAL
   * ==========================================================================
   */

  it("GET /api/v1/security/permissions - should deny access without READ permission", async () => {
    const response = await request(app)
      .get("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  /*
   * ==========================================================================
   * RESTORE READ PERMISSION
   * ==========================================================================
   */

  it("should restore READ permission to the test role", async () => {
    const result = await pool.query(
      `
      INSERT INTO role_permissions
      (
        role_id,
        permission_id,
        created_by
      )
      VALUES
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
      (
        role_id,
        permission_id
      )
      DO NOTHING
      `,
      [testRoleId, readPermissionId, testUserId]
    );

    expect(result.rowCount).toBe(1);
  });

  /*
   * ==========================================================================
   * INACTIVE ROLE
   * ==========================================================================
   */

  it("should deactivate the test role", async () => {
    const result = await pool.query(
      `
      UPDATE roles
      SET
        status = 'INACTIVE',
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [testRoleId, testUserId]
    );

    expect(result.rowCount).toBe(1);
  });

  it("GET /api/v1/security/permissions - should deny access when role is inactive", async () => {
    const response = await request(app)
      .get("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  /*
   * ==========================================================================
   * RESTORE TEST ROLE
   * ==========================================================================
   */

  it("should reactivate the test role", async () => {
    const result = await pool.query(
      `
      UPDATE roles
      SET
        status = 'ACTIVE',
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [testRoleId, testUserId]
    );

    expect(result.rowCount).toBe(1);
  });

  /*
   * ==========================================================================
   * INACTIVE PERMISSION
   * ==========================================================================
   */

  it("should deactivate the READ permission", async () => {
    const result = await pool.query(
      `
      UPDATE permissions
      SET
        status = 'INACTIVE',
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [readPermissionId, testUserId]
    );

    expect(result.rowCount).toBe(1);
  });

  it("GET /api/v1/security/permissions - should deny access when permission is inactive", async () => {
    const response = await request(app)
      .get("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  /*
   * ==========================================================================
   * RESTORE PERMISSION
   * ==========================================================================
   */

  it("should reactivate the READ permission", async () => {
    const result = await pool.query(
      `
      UPDATE permissions
      SET
        status = 'ACTIVE',
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [readPermissionId, testUserId]
    );

    expect(result.rowCount).toBe(1);
  });

  it("GET /api/v1/security/permissions - should allow access after permission restoration", async () => {
    const response = await request(app)
      .get("/api/v1/security/permissions")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
  });

  /*
   * ==========================================================================
   * FINAL VERIFICATION
   * ==========================================================================
   */

  it("should leave the test role active", async () => {
    const result = await pool.query(
      `
      SELECT status
      FROM roles
      WHERE id = $1
      `,
      [testRoleId]
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].status).toBe("ACTIVE");
  });

  it("should leave the READ permission active", async () => {
    const result = await pool.query(
      `
      SELECT status
      FROM permissions
      WHERE id = $1
      `,
      [readPermissionId]
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].status).toBe("ACTIVE");
  });
});
