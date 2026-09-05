import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../app.js";
import { pool } from "../../../../shared/config/db.js";

describe("Users API", () => {
  const timestamp = Date.now();

  const adminUser = {
    fullName: "Users API Test Administrator",
    displayName: "Users API Test Admin",
    username: `users_api_admin_${timestamp}`,
    email: `users_api_admin_${timestamp}@example.com`,
    mobile: `98765${timestamp.toString().slice(-5)}`,
    password: "Test@12345"
  };

  const testUser = {
    fullName: "Users API Integration Test",
    displayName: "Users API Test",
    username: `users_api_test_${timestamp}`,
    email: `users_api_test_${timestamp}@example.com`,
    mobile: `87654${timestamp.toString().slice(-5)}`,
    password: "Test@12345"
  };

  let adminUserId = 0;
  let testUserId = 0;
  let adminRoleId = 0;
  let accessToken = "";

  // ---------------------------------------------------------------------------
  // TEST SETUP
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    /*
     * Find the existing SUPER_ADMIN role.
     *
     * We intentionally do not hard-code its ID because identity values may
     * differ between local, test and production databases.
     */
    const roleResult = await pool.query(
      `
        SELECT id
        FROM roles
        WHERE code = 'SUPER_ADMIN'
        LIMIT 1
      `
    );

    expect(roleResult.rows.length).toBeGreaterThan(0);

    adminRoleId = Number(roleResult.rows[0].id);

    /*
     * Create a temporary SUPER_ADMIN test account directly in the database.
     *
     * This is test fixture setup. The actual authentication is still tested
     * through POST /api/v1/auth/login.
     */
    const passwordHash = await bcrypt.hash(adminUser.password, 12);

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
        adminUser.fullName,
        adminUser.displayName,
        adminUser.username,
        adminUser.email,
        adminUser.mobile,
        passwordHash,
        1
      ]
    );

    adminUserId = Number(userResult.rows[0].id);

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
      [adminUserId, adminRoleId, adminUserId]
    );

    /*
     * Authenticate through the real API.
     */
    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username: adminUser.username,
      password: adminUser.password
    });

    expect(loginResponse.status).toBe(200);

    accessToken = loginResponse.body.data.tokens.accessToken;

    expect(accessToken).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // CLEANUP
  // ---------------------------------------------------------------------------

  afterAll(async () => {
    /*
     * Remove sessions first because user_sessions references users.
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
  });

  // ---------------------------------------------------------------------------
  // AUTHENTICATION
  // ---------------------------------------------------------------------------

  it("GET /api/v1/security/users - should reject unauthenticated request", async () => {
    const response = await request(app).get("/api/v1/security/users");

    expect(response.status).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // GET ALL USERS
  // ---------------------------------------------------------------------------

  it("GET /api/v1/security/users - should return users for authorized administrator", async () => {
    const response = await request(app)
      .get("/api/v1/security/users")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // GET USER BY ID
  // ---------------------------------------------------------------------------

  it("GET /api/v1/security/users/:id - should reject invalid user id", async () => {
    const response = await request(app)
      .get("/api/v1/security/users/invalid-id")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  it("GET /api/v1/security/users/:id - should return 404 for unknown user", async () => {
    const response = await request(app)
      .get("/api/v1/security/users/999999999")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // CREATE USER
  // ---------------------------------------------------------------------------

  it("POST /api/v1/security/users - should create a user with an active role", async () => {
    const roleResult = await pool.query(
      `
        SELECT id
        FROM roles
        WHERE code = 'ADMIN'
          AND status = 'ACTIVE'
        LIMIT 1
      `
    );

    expect(roleResult.rows.length).toBeGreaterThan(0);

    const roleId = Number(roleResult.rows[0].id);

    const response = await request(app)
      .post("/api/v1/security/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...testUser,
        roleId
      });

    expect(response.status).toBe(201);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.username).toBe(testUser.username);
    expect(response.body.data.fullName).toBe(testUser.fullName);
    expect(response.body.data.displayName).toBe(testUser.displayName);
    expect(Number(response.body.data.roleId)).toBe(roleId);
    expect(response.body.data.status).toBe("ACTIVE");

    testUserId = Number(response.body.data.id);

    expect(testUserId).toBeGreaterThan(0);

    /*
     * Verify the authoritative RBAC relationship was created.
     */
    const roleAssignment = await pool.query(
      `
        SELECT user_id, role_id
        FROM user_roles
        WHERE user_id = $1
          AND role_id = $2
      `,
      [testUserId, roleId]
    );

    expect(roleAssignment.rows.length).toBe(1);
  });

  it("POST /api/v1/security/users - should reject duplicate username", async () => {
    const roleResult = await pool.query(
      `
        SELECT id
        FROM roles
        WHERE code = 'ADMIN'
          AND status = 'ACTIVE'
        LIMIT 1
      `
    );

    const roleId = Number(roleResult.rows[0].id);

    const response = await request(app)
      .post("/api/v1/security/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...testUser,
        roleId,
        email: `duplicate_${timestamp}@example.com`,
        mobile: `76543${timestamp.toString().slice(-5)}`
      });

    expect(response.status).toBe(409);
  });

  it("POST /api/v1/security/users - should reject duplicate email", async () => {
    const roleResult = await pool.query(
      `
        SELECT id
        FROM roles
        WHERE code = 'ADMIN'
          AND status = 'ACTIVE'
        LIMIT 1
      `
    );

    const roleId = Number(roleResult.rows[0].id);

    const response = await request(app)
      .post("/api/v1/security/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...testUser,
        username: `duplicate_email_${timestamp}`,
        mobile: `65432${timestamp.toString().slice(-5)}`,
        roleId
      });

    expect(response.status).toBe(409);
  });

  it("POST /api/v1/security/users - should reject duplicate mobile", async () => {
    const roleResult = await pool.query(
      `
        SELECT id
        FROM roles
        WHERE code = 'ADMIN'
          AND status = 'ACTIVE'
        LIMIT 1
      `
    );

    const roleId = Number(roleResult.rows[0].id);

    const response = await request(app)
      .post("/api/v1/security/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...testUser,
        username: `duplicate_mobile_${timestamp}`,
        email: `duplicate_mobile_${timestamp}@example.com`,
        roleId
      });

    expect(response.status).toBe(409);
  });

  it("POST /api/v1/security/users - should reject invalid payload", async () => {
    const response = await request(app)
      .post("/api/v1/security/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "",
        displayName: "",
        username: "x",
        password: "123"
      });

    expect(response.status).toBe(400);
  });

  it("POST /api/v1/security/users - should reject unknown role", async () => {
    const response = await request(app)
      .post("/api/v1/security/users")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        ...testUser,
        username: `unknown_role_${timestamp}`,
        email: `unknown_role_${timestamp}@example.com`,
        mobile: `54321${timestamp.toString().slice(-5)}`,
        roleId: 999999999
      });

    expect(response.status).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // UPDATE USER
  // ---------------------------------------------------------------------------

  it("PATCH /api/v1/security/users/:id - should update user details", async () => {
    expect(testUserId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/users/${testUserId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Updated Users API Test User",
        displayName: "Updated Users Test"
      });

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.fullName).toBe("Updated Users API Test User");
    expect(response.body.data.displayName).toBe("Updated Users Test");
  });

  it("PATCH /api/v1/security/users/:id - should reject invalid user id", async () => {
    const response = await request(app)
      .patch("/api/v1/security/users/invalid-id")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "Invalid ID Test"
      });

    expect(response.status).toBe(400);
  });

  it("PATCH /api/v1/security/users/:id - should return 404 for unknown user", async () => {
    const response = await request(app)
      .patch("/api/v1/security/users/999999999")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "Unknown User"
      });

    expect(response.status).toBe(404);
  });

  it("PATCH /api/v1/security/users/:id - should update password", async () => {
    expect(testUserId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/users/${testUserId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        password: "NewTest@12345"
      });

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.id).toBeDefined();
  });

  it("PATCH /api/v1/security/users/:id - should reject invalid password", async () => {
    expect(testUserId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/users/${testUserId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        password: "123"
      });

    expect(response.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // SELF-PROTECTION
  // ---------------------------------------------------------------------------

  it("PATCH /api/v1/security/users/:id - should not allow administrator to deactivate own account", async () => {
    expect(adminUserId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/security/users/${adminUserId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        status: "INACTIVE"
      });

    expect(response.status).toBe(400);
  });

  it("DELETE /api/v1/security/users/:id - should not allow administrator to deactivate own account", async () => {
    expect(adminUserId).toBeGreaterThan(0);

    const response = await request(app)
      .delete(`/api/v1/security/users/${adminUserId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // DELETE / DEACTIVATE USER
  // ---------------------------------------------------------------------------

  it("DELETE /api/v1/security/users/:id - should deactivate a user", async () => {
    expect(testUserId).toBeGreaterThan(0);

    const response = await request(app)
      .delete(`/api/v1/security/users/${testUserId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.status).toBe("INACTIVE");
  });

  it("DELETE /api/v1/security/users/:id - should reject already inactive user", async () => {
    expect(testUserId).toBeGreaterThan(0);

    const response = await request(app)
      .delete(`/api/v1/security/users/${testUserId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // FINAL GET
  // ---------------------------------------------------------------------------

  it("GET /api/v1/security/users/:id - should return the deactivated user", async () => {
    expect(testUserId).toBeGreaterThan(0);

    const response = await request(app)
      .get(`/api/v1/security/users/${testUserId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(testUserId);
    expect(response.body.data.status).toBe("INACTIVE");
  });
});
