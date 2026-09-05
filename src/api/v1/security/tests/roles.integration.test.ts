import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../app.js";
import { pool } from "../../../../shared/config/db.js";

describe("Roles API", () => {
  const timestamp = Date.now();

  // ---------------------------------------------------------------------------
  // TEST FIXTURES
  // ---------------------------------------------------------------------------

  const adminUser = {
    fullName: "Roles API Test Administrator",
    displayName: "Roles API Test Admin",
    username: `roles_api_admin_${timestamp}`,
    email: `roles_api_admin_${timestamp}@example.com`,
    mobile: `98765${timestamp.toString().slice(-5)}`,
    password: "Test@12345"
  };

  const testUser = {
    fullName: "Roles API Integration Test User",
    displayName: "Roles API Test User",
    username: `roles_api_test_${timestamp}`,
    email: `roles_api_test_${timestamp}@example.com`,
    mobile: `87654${timestamp.toString().slice(-5)}`,
    password: "Test@12345"
  };

  const testRole = {
    code: `TEST_ROLE_${timestamp}`,
    displayName: "Roles API Test Role",
    description: "Temporary role created by Roles API integration tests.",
    displayOrder: 999
  };

  let adminUserId = 0;
  let testUserId = 0;

  let superAdminRoleId = 0;
  let adminRoleId = 0;
  let testRoleId = 0;

  let accessToken = "";

  // ---------------------------------------------------------------------------
  // TEST SETUP
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    /*
     * Find the existing SUPER_ADMIN role.
     *
     * Role IDs must not be hard-coded because they can differ between
     * development, test and production databases.
     */
    const superAdminResult = await pool.query(
      `
        SELECT id
        FROM roles
        WHERE code = 'SUPER_ADMIN'
        LIMIT 1
      `
    );

    expect(superAdminResult.rows.length).toBeGreaterThan(0);

    superAdminRoleId = Number(superAdminResult.rows[0].id);

    /*
     * Find the existing ADMIN role.
     *
     * This is used as the base role for the temporary test user.
     */
    const adminRoleResult = await pool.query(
      `
        SELECT id
        FROM roles
        WHERE code = 'ADMIN'
          AND status = 'ACTIVE'
        LIMIT 1
      `
    );

    expect(adminRoleResult.rows.length).toBeGreaterThan(0);

    adminRoleId = Number(adminRoleResult.rows[0].id);

    // -------------------------------------------------------------------------
    // CREATE TEMPORARY SUPER_ADMIN TEST USER
    // -------------------------------------------------------------------------

    /*
     * This is test fixture setup.
     *
     * Authentication itself is still tested through:
     *
     * POST /api/v1/auth/login
     */
    const passwordHash = await bcrypt.hash(adminUser.password, 12);

    const adminUserResult = await pool.query(
      `
        INSERT INTO users
        (
          role_id,
          full_name,
          display_name,
          username,
          email,
          mobile,
          password_hash,
          must_change_password,
          created_by,
          updated_by
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          false,
          $8,
          $8
        )
        RETURNING id
      `,
      [
        superAdminRoleId,
        adminUser.fullName,
        adminUser.displayName,
        adminUser.username,
        adminUser.email,
        adminUser.mobile,
        passwordHash,
        1
      ]
    );

    adminUserId = Number(adminUserResult.rows[0].id);

    expect(adminUserId).toBeGreaterThan(0);

    /*
     * user_roles is the authoritative RBAC relationship.
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
        ($1, $2, $3)
      `,
      [adminUserId, superAdminRoleId, adminUserId]
    );

    // -------------------------------------------------------------------------
    // AUTHENTICATE THROUGH REAL API
    // -------------------------------------------------------------------------

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username: adminUser.username,
      password: adminUser.password
    });

    expect(loginResponse.status).toBe(200);

    expect(loginResponse.body.data).toBeDefined();
    expect(loginResponse.body.data.tokens).toBeDefined();

    accessToken = loginResponse.body.data.tokens.accessToken;

    expect(accessToken).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // CLEANUP
  // ---------------------------------------------------------------------------

  afterAll(async () => {
    /*
     * Delete sessions first because user_sessions references users.
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

      await pool.query(
        `
          DELETE FROM users
          WHERE id = $1
        `,
        [testUserId]
      );
    }

    /*
     * Remove permissions assigned to the temporary role, if any.
     *
     * The Roles API tests do not normally create permissions, but this makes
     * cleanup safe if role-permission relationships are introduced later.
     */
    if (testRoleId > 0) {
      await pool.query(
        `
          DELETE FROM role_permissions
          WHERE role_id = $1
        `,
        [testRoleId]
      );

      await pool.query(
        `
          DELETE FROM roles
          WHERE id = $1
        `,
        [testRoleId]
      );
    }
  });

  // ---------------------------------------------------------------------------
  // AUTHENTICATION
  // ---------------------------------------------------------------------------

  it("GET /api/v1/security/roles - should reject unauthenticated request", async () => {
    const response = await request(app).get("/api/v1/security/roles");

    expect(response.status).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // GET ALL ROLES
  // ---------------------------------------------------------------------------

  it("GET /api/v1/security/roles - should return roles for authorized administrator", async () => {
    const response = await request(app)
      .get("/api/v1/security/roles")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // GET ROLE BY ID
  // ---------------------------------------------------------------------------

  it("GET /api/v1/security/roles/:id - should return an existing role", async () => {
    expect(superAdminRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .get(`/api/v1/security/roles/${superAdminRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(superAdminRoleId);
    expect(response.body.data.code).toBe("SUPER_ADMIN");
  });

  it("GET /api/v1/security/roles/:id - should reject invalid role id", async () => {
    const response = await request(app)
      .get("/api/v1/security/roles/invalid-id")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  it("GET /api/v1/security/roles/:id - should return 404 for unknown role", async () => {
    const response = await request(app)
      .get("/api/v1/security/roles/999999999")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // CREATE ROLE
  // ---------------------------------------------------------------------------

  it("POST /api/v1/security/roles - should create a role", async () => {
    const response = await request(app)
      .post("/api/v1/security/roles")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(testRole);

    expect(response.status).toBe(201);

    expect(response.body.data).toBeDefined();

    expect(response.body.data.code).toBe(testRole.code);
    expect(response.body.data.displayName).toBe(testRole.displayName);
    expect(response.body.data.description).toBe(testRole.description);
    expect(Number(response.body.data.displayOrder)).toBe(testRole.displayOrder);
    expect(response.body.data.status).toBe("ACTIVE");

    testRoleId = Number(response.body.data.id);

    expect(testRoleId).toBeGreaterThan(0);
  });

  it("POST /api/v1/security/roles - should reject duplicate role code", async () => {
    const response = await request(app)
      .post("/api/v1/security/roles")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...testRole,
        displayName: "Duplicate Test Role"
      });

    expect(response.status).toBe(409);
  });

  it("POST /api/v1/security/roles - should reject invalid payload", async () => {
    const response = await request(app)
      .post("/api/v1/security/roles")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: "invalid-role",
        displayName: "",
        displayOrder: -1
      });

    expect(response.status).toBe(400);
  });

  it("POST /api/v1/security/roles - should reject invalid role code format", async () => {
    const response = await request(app)
      .post("/api/v1/security/roles")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: `test-role-${timestamp}`,
        displayName: "Invalid Role Code Test"
      });

    expect(response.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // UPDATE ROLE
  // ---------------------------------------------------------------------------

  it("PATCH /api/v1/security/roles/:id - should update role details", async () => {
    expect(testRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/roles/${testRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "Updated Roles API Test Role",
        description: "Updated role description.",
        displayOrder: 998
      });

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.displayName).toBe("Updated Roles API Test Role");
    expect(response.body.data.description).toBe("Updated role description.");
    expect(Number(response.body.data.displayOrder)).toBe(998);
  });

  it("PATCH /api/v1/security/roles/:id - should reject invalid role id", async () => {
    const response = await request(app)
      .patch("/api/v1/security/roles/invalid-id")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "Invalid ID Role"
      });

    expect(response.status).toBe(400);
  });

  it("PATCH /api/v1/security/roles/:id - should return 404 for unknown role", async () => {
    const response = await request(app)
      .patch("/api/v1/security/roles/999999999")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "Unknown Role"
      });

    expect(response.status).toBe(404);
  });

  it("PATCH /api/v1/security/roles/:id - should reject invalid update payload", async () => {
    expect(testRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/roles/${testRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "",
        displayOrder: -1,
        status: "INVALID_STATUS"
      });

    expect(response.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // ROLE STATUS
  // ---------------------------------------------------------------------------

  it("PATCH /api/v1/security/roles/:id - should suspend a role", async () => {
    expect(testRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/roles/${testRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "SUSPENDED"
      });

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.status).toBe("SUSPENDED");
  });

  it("PATCH /api/v1/security/roles/:id - should reactivate a suspended role", async () => {
    expect(testRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/roles/${testRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "ACTIVE"
      });

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.status).toBe("ACTIVE");
  });

  // ---------------------------------------------------------------------------
  // SUPER_ADMIN PROTECTION
  // ---------------------------------------------------------------------------

  it("PATCH /api/v1/security/roles/:id - should not allow SUPER_ADMIN to become INACTIVE", async () => {
    expect(superAdminRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/roles/${superAdminRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "INACTIVE"
      });

    expect(response.status).toBe(400);
  });

  it("PATCH /api/v1/security/roles/:id - should not allow SUPER_ADMIN to become SUSPENDED", async () => {
    expect(superAdminRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/roles/${superAdminRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "SUSPENDED"
      });

    expect(response.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // USER FIXTURE FOR ROLE ASSIGNMENT TESTS
  // ---------------------------------------------------------------------------

  it("POST /api/v1/security/users - should create a temporary user for role assignment tests", async () => {
    /*
     * This user is created directly in the database because this Roles test
     * suite is testing the Roles API, not the Users API.
     *
     * ADMIN is used as the user's initial role so that the user has at least
     * one role before the test role is assigned.
     */
    const passwordHash = await bcrypt.hash(testUser.password, 12);

    const userResult = await pool.query(
      `
        INSERT INTO users
        (
          role_id,
          full_name,
          display_name,
          username,
          email,
          mobile,
          password_hash,
          must_change_password,
          created_by,
          updated_by
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          false,
          $8,
          $8
        )
        RETURNING id
      `,
      [
        adminRoleId,
        testUser.fullName,
        testUser.displayName,
        testUser.username,
        testUser.email,
        testUser.mobile,
        passwordHash,
        adminUserId
      ]
    );

    testUserId = Number(userResult.rows[0].id);

    expect(testUserId).toBeGreaterThan(0);

    /*
     * Create authoritative RBAC relationship.
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
        ($1, $2, $3)
      `,
      [testUserId, adminRoleId, adminUserId]
    );
  });

  // ---------------------------------------------------------------------------
  // GET USER ROLES
  // ---------------------------------------------------------------------------

  it("GET /api/v1/security/roles/user/:userId - should return user roles", async () => {
    expect(testUserId).toBeGreaterThan(0);

    const response = await request(app)
      .get(`/api/v1/security/roles/user/${testUserId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);

    /*
     * The temporary user should initially have ADMIN.
     */
    const adminRole = response.body.data.find(
      (role: { code: string }) => role.code === "ADMIN"
    );

    expect(adminRole).toBeDefined();
  });

  it("GET /api/v1/security/roles/user/:userId - should reject invalid user id", async () => {
    const response = await request(app)
      .get("/api/v1/security/roles/user/invalid-id")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // ASSIGN USER ROLE
  // ---------------------------------------------------------------------------

  it("POST /api/v1/security/roles/user/:userId/:roleId - should assign an active role to a user", async () => {
    expect(testUserId).toBeGreaterThan(0);
    expect(testRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .post(`/api/v1/security/roles/user/${testUserId}/${testRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    /*
     * Verify the authoritative RBAC relationship directly in the database.
     */
    const assignment = await pool.query(
      `
        SELECT user_id, role_id
        FROM user_roles
        WHERE user_id = $1
          AND role_id = $2
      `,
      [testUserId, testRoleId]
    );

    expect(assignment.rows.length).toBe(1);
  });

  it("POST /api/v1/security/roles/user/:userId/:roleId - should reject invalid user id", async () => {
    expect(testRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .post(`/api/v1/security/roles/user/invalid-id/${testRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  it("POST /api/v1/security/roles/user/:userId/:roleId - should reject invalid role id", async () => {
    expect(testUserId).toBeGreaterThan(0);

    const response = await request(app)
      .post(`/api/v1/security/roles/user/${testUserId}/invalid-id`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  it("POST /api/v1/security/roles/user/:userId/:roleId - should return 404 for unknown role", async () => {
    expect(testUserId).toBeGreaterThan(0);

    const response = await request(app)
      .post(`/api/v1/security/roles/user/${testUserId}/999999999`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // REMOVE USER ROLE
  // ---------------------------------------------------------------------------

  //   it("DELETE /api/v1/security/roles/user/:userId/:roleId - should remove an assigned role", async () => {
  //     expect(testUserId).toBeGreaterThan(0);
  //     expect(testRoleId).toBeGreaterThan(0);

  //     /*
  //      * The temporary user currently has:
  //      *
  //      * ADMIN
  //      * TEST_ROLE
  //      *
  //      * Therefore TEST_ROLE can safely be removed.
  //      */
  //     const response = await request(app)
  //       .delete(`/api/v1/security/roles/user/${testUserId}/${testRoleId}`)
  //       .set("Authorization", `Bearer ${accessToken}`);

  //     expect(response.status).toBe(200);

  //     const assignment = await pool.query(
  //       `
  //         SELECT user_id, role_id
  //         FROM user_roles
  //         WHERE user_id = $1
  //           AND role_id = $2
  //       `,
  //       [testUserId, testRoleId]
  //     );

  //     expect(assignment.rows.length).toBe(0);
  //   });

  it("DELETE /api/v1/security/roles/user/:userId/:roleId - should reject invalid user id", async () => {
    expect(testRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .delete(`/api/v1/security/roles/user/invalid-id/${testRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  it("DELETE /api/v1/security/roles/user/:userId/:roleId - should return 404 when role is not assigned", async () => {
    expect(testUserId).toBeGreaterThan(0);
    expect(superAdminRoleId).toBeGreaterThan(0);

    /*
     * At this point the temporary user has:
     *
     * ADMIN
     * TEST_ROLE
     *
     * SUPER_ADMIN is NOT assigned.
     *
     * Therefore this request must return 404 because the requested role
     * does not belong to the user.
     */
    const response = await request(app)
      .delete(`/api/v1/security/roles/user/${testUserId}/${superAdminRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  it("DELETE /api/v1/security/roles/user/:userId/:roleId - should remove an assigned role", async () => {
    expect(testUserId).toBeGreaterThan(0);
    expect(testRoleId).toBeGreaterThan(0);

    /*
     * The temporary user currently has:
     *
     * ADMIN
     * TEST_ROLE
     *
     * Therefore TEST_ROLE can safely be removed.
     */
    const response = await request(app)
      .delete(`/api/v1/security/roles/user/${testUserId}/${testRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    const assignment = await pool.query(
      `
        SELECT user_id, role_id
        FROM user_roles
        WHERE user_id = $1
          AND role_id = $2
      `,
      [testUserId, testRoleId]
    );

    expect(assignment.rows.length).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // LAST ROLE PROTECTION
  // ---------------------------------------------------------------------------

  it("DELETE /api/v1/security/roles/user/:userId/:roleId - should not allow removal of the user's last role", async () => {
    expect(testUserId).toBeGreaterThan(0);
    expect(adminRoleId).toBeGreaterThan(0);

    /*
     * At this point the test user has only:
     *
     * ADMIN
     *
     * Removing it would leave the user without any role.
     */
    const response = await request(app)
      .delete(`/api/v1/security/roles/user/${testUserId}/${adminRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // SUPER_ADMIN ASSIGNMENT PROTECTION
  // ---------------------------------------------------------------------------

  it("POST /api/v1/security/roles/user/:userId/:roleId - should allow SUPER_ADMIN to assign SUPER_ADMIN role", async () => {
    expect(testUserId).toBeGreaterThan(0);
    expect(superAdminRoleId).toBeGreaterThan(0);

    const response = await request(app)
      .post(`/api/v1/security/roles/user/${testUserId}/${superAdminRoleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    const assignment = await pool.query(
      `
        SELECT user_id, role_id
        FROM user_roles
        WHERE user_id = $1
          AND role_id = $2
      `,
      [testUserId, superAdminRoleId]
    );

    expect(assignment.rows.length).toBe(1);

    /*
     * Remove the SUPER_ADMIN assignment immediately so that the final
     * last-role test remains based on the ADMIN role.
     */
    await pool.query(
      `
        DELETE FROM user_roles
        WHERE user_id = $1
          AND role_id = $2
      `,
      [testUserId, superAdminRoleId]
    );
  });

  // ---------------------------------------------------------------------------
  // FINAL VERIFICATION
  // ---------------------------------------------------------------------------

  it("GET /api/v1/security/roles/user/:userId - should return the user's remaining role", async () => {
    expect(testUserId).toBeGreaterThan(0);

    const response = await request(app)
      .get(`/api/v1/security/roles/user/${testUserId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);

    expect(response.body.data.length).toBeGreaterThanOrEqual(1);

    const adminRole = response.body.data.find(
      (role: { code: string }) => role.code === "ADMIN"
    );

    expect(adminRole).toBeDefined();
  });
});
