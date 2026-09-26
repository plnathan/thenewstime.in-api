import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Agreed Amount Route Integration", () => {
  let accessToken = "";

  let testUserId = 0;
  let superAdminRoleId = 0;
  let testRoleId = 0;
  let permissionId = 0;

  const timestamp = Date.now();

  const testUsername = `agreed_amount_route_${timestamp}`;
  const testEmail = `agreed-amount-route-${timestamp}@example.com`;
  const testRoleCode = `TEST_AD_AGREED_AMOUNT_ROUTE_${timestamp}`;

  const password = "Agreed_Amount_Route@123";

  const permissionCode = "advertisements.read";

  beforeAll(async () => {
    /*
     * ------------------------------------------------------------------------
     * Resolve SUPER_ADMIN role.
     * ------------------------------------------------------------------------
     */

    const superAdminResult = await pool.query(
      `
      SELECT id
      FROM roles
      WHERE code = 'SUPER_ADMIN'
        AND status = 'ACTIVE'
      LIMIT 1
      `
    );

    expect(superAdminResult.rows.length).toBe(1);

    superAdminRoleId = Number(superAdminResult.rows[0]?.id ?? 0);

    expect(superAdminRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary test user.
     *
     * SUPER_ADMIN is used only during the initial INSERT because some
     * schemas require users.role_id to be non-null.
     * The user is immediately moved to the dedicated test role.
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
        "Advertisement Agreed Amount Route Test User",
        "Agreed Amount Route Test",
        superAdminRoleId
      ]
    );

    testUserId = Number(userResult.rows[0]?.id ?? 0);

    expect(testUserId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create dedicated test role.
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
        `Agreed Amount Route Test ${timestamp}`,
        "Advertisement agreed amount route integration-test role.",
        testUserId
      ]
    );

    testRoleId = Number(roleResult.rows[0]?.id ?? 0);

    expect(testRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Move test user to dedicated role.
     * ------------------------------------------------------------------------
     */

    await pool.query(
      `
      UPDATE users
      SET role_id = $2
      WHERE id = $1
      `,
      [testUserId, testRoleId]
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
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [testUserId, testRoleId]
    );

    /*
     * ------------------------------------------------------------------------
     * Resolve production advertisements.read permission.
     *
     * The route intentionally uses the existing:
     *
     *   ADVERTISEMENT / advertisements / read
     *
     * permission.
     *
     * No new permission is required for a calculation-only endpoint.
     * ------------------------------------------------------------------------
     */

    const permissionResult = await pool.query(
      `
      SELECT
        id,
        code,
        status,
        module,
        resource,
        action
      FROM permissions
      WHERE code = $1
      LIMIT 1
      `,
      [permissionCode]
    );

    expect(
      permissionResult.rows.length,
      `Required production permission '${permissionCode}' was not found.`
    ).toBe(1);

    const permission = permissionResult.rows[0];

    expect(
      permission?.status,
      `Required production permission '${permissionCode}' must be ACTIVE.`
    ).toBe("ACTIVE");

    expect(permission?.module).toBe("ADVERTISEMENT");
    expect(permission?.resource).toBe("advertisements");
    expect(permission?.action).toBe("read");

    permissionId = Number(permission?.id ?? 0);

    expect(permissionId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Attach production permission to test role.
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
      ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionId, testUserId]
    );

    /*
     * ------------------------------------------------------------------------
     * Login.
     * ------------------------------------------------------------------------
     */

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username: testUsername,
      password
    });

    expect(loginResponse.status).toBe(200);

    accessToken = loginResponse.body.data.tokens.accessToken;

    expect(accessToken).toBeTruthy();
  });

  beforeEach(async () => {
    /*
     * Integration suites can affect shared permission records.
     *
     * Re-establish only the exact permission required by this test.
     * The permission definition itself is never created or modified.
     */

    await pool.query(
      `
      UPDATE users
      SET
        role_id = $2,
        status = 'ACTIVE'
      WHERE id = $1
      `,
      [testUserId, testRoleId]
    );

    await pool.query(
      `
      UPDATE roles
      SET status = 'ACTIVE'
      WHERE id = $1
      `,
      [testRoleId]
    );

    await pool.query(
      `
      UPDATE permissions
      SET status = 'ACTIVE'
      WHERE id = $1
      `,
      [permissionId]
    );

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
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [testUserId, testRoleId]
    );

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
      ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionId, testUserId]
    );
  });

  afterAll(async () => {
    /*
     * ------------------------------------------------------------------------
     * Remove role permission.
     * ------------------------------------------------------------------------
     */

    if (testRoleId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM role_permissions
          WHERE role_id = $1
          `,
          [testRoleId]
        );
      } catch {
        // Cleanup should not fail the test suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove user-role mappings.
     * ------------------------------------------------------------------------
     */

    if (testUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM user_roles
          WHERE user_id = $1
          `,
          [testUserId]
        );
      } catch {
        // Cleanup should not fail the test suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove test user.
     * ------------------------------------------------------------------------
     */

    if (testUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM users
          WHERE id = $1
          `,
          [testUserId]
        );
      } catch {
        // Cleanup should not fail the test suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove test role.
     * ------------------------------------------------------------------------
     */

    if (testRoleId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM roles
          WHERE id = $1
          `,
          [testRoleId]
        );
      } catch {
        // Cleanup should not fail the test suite.
      }
    }

    await pool.end();
  });

  describe("POST /api/v1/advertisements/agreed-amount/calculate", () => {
    it("should calculate an agreed amount successfully", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          standardAmount: 10000,
          agreedAmount: 8500,
          currencyCode: "INR"
        });

      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);

      expect(response.body.data).toEqual({
        standardAmount: 10000,
        agreedAmount: 8500,
        varianceAmount: -1500,
        variancePercentage: -15,
        currencyCode: "INR"
      });
    });

    it("should normalize the currency code", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          standardAmount: 10000,
          agreedAmount: 9000,
          currencyCode: "inr"
        });

      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);

      expect(response.body.data.currencyCode).toBe("INR");
    });

    it("should support an agreed amount equal to the standard amount", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          standardAmount: 10000,
          agreedAmount: 10000,
          currencyCode: "INR"
        });

      expect(response.status).toBe(200);

      expect(response.body.data).toEqual({
        standardAmount: 10000,
        agreedAmount: 10000,
        varianceAmount: 0,
        variancePercentage: 0,
        currencyCode: "INR"
      });
    });

    it("should support an agreed amount above the standard amount", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          standardAmount: 10000,
          agreedAmount: 12500,
          currencyCode: "INR"
        });

      expect(response.status).toBe(200);

      expect(response.body.data).toEqual({
        standardAmount: 10000,
        agreedAmount: 12500,
        varianceAmount: 2500,
        variancePercentage: 25,
        currencyCode: "INR"
      });
    });

    it("should return null variance percentage when standard amount is zero", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          standardAmount: 0,
          agreedAmount: 500,
          currencyCode: "INR"
        });

      expect(response.status).toBe(200);

      expect(response.body.data).toEqual({
        standardAmount: 0,
        agreedAmount: 500,
        varianceAmount: 500,
        variancePercentage: null,
        currencyCode: "INR"
      });
    });

    it("should reject a negative standard amount", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          standardAmount: -1,
          agreedAmount: 500,
          currencyCode: "INR"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject a negative agreed amount", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          standardAmount: 1000,
          agreedAmount: -1,
          currencyCode: "INR"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject an invalid currency code", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          standardAmount: 1000,
          agreedAmount: 900,
          currencyCode: "US"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject a missing standard amount", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          agreedAmount: 900,
          currencyCode: "INR"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject a missing agreed amount", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          standardAmount: 1000,
          currencyCode: "INR"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should reject a missing currency code", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          standardAmount: 1000,
          agreedAmount: 900
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .send({
          standardAmount: 10000,
          agreedAmount: 8500,
          currencyCode: "INR"
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should deny access without the advertisements.read permission", async () => {
      await pool.query(
        `
          DELETE FROM role_permissions
          WHERE role_id = $1
            AND permission_id = $2
          `,
        [testRoleId, permissionId]
      );

      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          standardAmount: 10000,
          agreedAmount: 8500,
          currencyCode: "INR"
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it("should not require advertisement creation permission", async () => {
      await pool.query(
        `
          DELETE FROM role_permissions
          WHERE role_id = $1
            AND permission_id = $2
          `,
        [testRoleId, permissionId]
      );

      const response = await request(app)
        .post("/api/v1/advertisements/agreed-amount/calculate")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          standardAmount: 10000,
          agreedAmount: 8500,
          currencyCode: "INR"
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});
