import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Placement API Integration", () => {
  let accessToken = "";

  let testUserId = 0;
  let superAdminRoleId = 0;
  let testRoleId = 0;

  let placementId = 0;

  const timestamp = Date.now();

  const testUsername = `placement_test_user_${timestamp}`;
  const testEmail = `placement-test-user-${timestamp}@example.com`;
  const testRoleCode = `TEST_AD_PLACEMENT_ROLE_${timestamp}`;

  const password = "Placement_Test@123";

  const permissionCodes = {
    read: "advertisements.placements.read",
    create: "advertisements.placements.create",
    update: "advertisements.placements.update",
    delete: "advertisements.placements.delete"
  };

  const permissionIds: Record<keyof typeof permissionCodes, number> = {
    read: 0,
    create: 0,
    update: 0,
    delete: 0
  };

  const createdPermissionIds: number[] = [];

  beforeAll(async () => {
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
        "Placement Integration Test User",
        "Placement Test User",
        superAdminRoleId
      ]
    );

    testUserId = Number(userResult.rows[0].id);

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
        `Advertisement Placement Test Role ${timestamp}`,
        "Temporary role for Advertisement Placement API integration tests.",
        testUserId
      ]
    );

    testRoleId = Number(roleResult.rows[0].id);

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
        AND role_id = $2
      `,
      [testUserId, superAdminRoleId]
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

    for (const [key, code] of Object.entries(permissionCodes) as Array<
      [keyof typeof permissionCodes, string]
    >) {
      const existing = await pool.query(
        `
        SELECT id
        FROM permissions
        WHERE code = $1
        LIMIT 1
        `,
        [code]
      );

      if (existing.rows[0]) {
        permissionIds[key] = Number(existing.rows[0].id);
      } else {
        const created = await pool.query(
          `
          INSERT INTO permissions
          (
            code,
            display_name,
            description,
            module,
            resource,
            action,
            display_order,
            is_system_permission,
            status,
            created_by,
            updated_by
          )
          VALUES
          (
            $1,
            $2,
            $3,
            'ADVERTISEMENT',
            'advertisements.placements',
            $4,
            999,
            TRUE,
            'ACTIVE',
            $5,
            $5
          )
          RETURNING id
          `,
          [
            code,
            `Advertisement Placement ${key} permission`,
            `Integration-test permission for ${code}.`,
            key,
            testUserId
          ]
        );

        permissionIds[key] = Number(created.rows[0].id);
        createdPermissionIds.push(permissionIds[key]);
      }

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
        [testRoleId, permissionIds[key], testUserId]
      );
    }

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username: testUsername,
      password
    });

    expect(loginResponse.status).toBe(200);

    accessToken = loginResponse.body.data.tokens.accessToken;

    expect(accessToken).toBeTruthy();
  });

  afterAll(async () => {
    if (placementId > 0) {
      await pool.query(
        `
        DELETE FROM advertisement_placements
        WHERE id = $1
        `,
        [placementId]
      );
    }

    if (testRoleId > 0) {
      await pool.query(
        `
        DELETE FROM role_permissions
        WHERE role_id = $1
        `,
        [testRoleId]
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

    if (testRoleId > 0) {
      await pool.query(
        `
        DELETE FROM roles
        WHERE id = $1
        `,
        [testRoleId]
      );
    }

    for (const permissionId of createdPermissionIds) {
      await pool.query(
        `
        DELETE FROM permissions
        WHERE id = $1
        `,
        [permissionId]
      );
    }
  });

  it("should have a valid authentication token", () => {
    expect(accessToken).toBeTruthy();
  });

  it("POST /api/v1/advertisements/placements - should create a placement", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/placements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: `HOME_TOP_${timestamp}`,
        displayName: `Home Top Placement ${timestamp}`,
        description: "Integration test placement.",
        pageType: "HOME",
        placementType: "HOME_TOP",
        insertionType: "FIXED",
        displayOrder: 10,
        isEnabled: true,
        collapseWhenEmpty: true,
        fallbackBehavior: "HIDE",
        displayFrequency: "ONCE_PER_DAY",
        autoCloseEnabled: false,
        closeButtonEnabled: true,
        closeOnOverlayClick: true,
        status: "ACTIVE"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    placementId = Number(response.body.data.id);

    expect(placementId).toBeGreaterThan(0);
    expect(response.body.data.code).toBe(`HOME_TOP_${timestamp}`);
    expect(response.body.data.pageType).toBe("HOME");
    expect(response.body.data.placementType).toBe("HOME_TOP");
    expect(response.body.data.insertionType).toBe("FIXED");
    expect(response.body.data.status).toBe("ACTIVE");
    expect(response.body.data.isEnabled).toBe(true);
  });

  it("GET /api/v1/advertisements/placements/:id - should retrieve the placement", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/placements/${placementId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.id)).toBe(placementId);
  });

  it("GET /api/v1/advertisements/placements - should list placements", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/placements")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const createdPlacement = response.body.data.find(
      (item: { id: number | string }) => Number(item.id) === placementId
    );

    expect(createdPlacement).toBeDefined();
  });

  it("PATCH /api/v1/advertisements/placements/:id - should update the placement", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/placements/${placementId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: `Updated Home Top Placement ${timestamp}`,
        displayOrder: 20,
        isEnabled: true
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.displayName).toBe(
      `Updated Home Top Placement ${timestamp}`
    );
    expect(response.body.data.displayOrder).toBe(20);
  });

  it("POST /api/v1/advertisements/placements/:id/disable - should disable the placement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/placements/${placementId}/disable`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("INACTIVE");
    expect(response.body.data.isEnabled).toBe(false);
  });

  it("POST /api/v1/advertisements/placements/:id/disable - should reject a second disable", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/placements/${placementId}/disable`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/placements/:id/enable - should enable the disabled placement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/placements/${placementId}/enable`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ACTIVE");
    expect(response.body.data.isEnabled).toBe(true);
  });

  it("POST /api/v1/advertisements/placements/:id/enable - should reject a second enable", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/placements/${placementId}/enable`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/placements/:id/disable - should disable the placement again", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/placements/${placementId}/disable`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("INACTIVE");
    expect(response.body.data.isEnabled).toBe(false);
  });

  it("POST /api/v1/advertisements/placements/:id/enable - should restore the placement before deactivation", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/placements/${placementId}/enable`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ACTIVE");
    expect(response.body.data.isEnabled).toBe(true);
  });

  it("POST /api/v1/advertisements/placements/:id/enable - should require authentication", async () => {
    const response = await request(app).post(
      `/api/v1/advertisements/placements/${placementId}/enable`
    );

    expect(response.status).toBe(401);
  });

  it("POST /api/v1/advertisements/placements/:id/disable - should require authentication", async () => {
    const response = await request(app).post(
      `/api/v1/advertisements/placements/${placementId}/disable`
    );

    expect(response.status).toBe(401);
  });

  it("POST /api/v1/advertisements/placements/:id/enable - should deny access without UPDATE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, permissionIds.update]
    );

    const response = await request(app)
      .post(`/api/v1/advertisements/placements/${placementId}/enable`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);

    await pool.query(
      `
      INSERT INTO role_permissions
      (
        role_id,
        permission_id,
        created_by
      )
      VALUES
      ($1, $2, $3)
      ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionIds.update, testUserId]
    );
  });

  it("POST /api/v1/advertisements/placements/:id/disable - should deny access without UPDATE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, permissionIds.update]
    );

    const response = await request(app)
      .post(`/api/v1/advertisements/placements/${placementId}/disable`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);

    await pool.query(
      `
      INSERT INTO role_permissions
      (
        role_id,
        permission_id,
        created_by
      )
      VALUES
      ($1, $2, $3)
      ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionIds.update, testUserId]
    );
  });

  it("POST /api/v1/advertisements/placements - should reject duplicate placement code", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/placements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: `HOME_TOP_${timestamp}`,
        displayName: "Duplicate Placement",
        pageType: "HOME",
        placementType: "HOME_TOP"
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/placements - should reject invalid placement values", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/placements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: `INVALID_PLACEMENT_${timestamp}`,
        displayName: "Invalid Placement",
        pageType: "INVALID",
        placementType: "INVALID"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/placements - should reject ONCE_PER_PERIOD without frequencyValue", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/placements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: `PERIOD_PLACEMENT_${timestamp}`,
        displayName: "Period Placement",
        pageType: "HOME",
        placementType: "HOME_TOP",
        displayFrequency: "ONCE_PER_PERIOD"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/placements - should reject auto-close without seconds", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/placements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: `AUTO_CLOSE_PLACEMENT_${timestamp}`,
        displayName: "Auto Close Placement",
        pageType: "NEWS_DETAIL",
        placementType: "NEWS_DETAIL_MODAL",
        autoCloseEnabled: true
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("DELETE /api/v1/advertisements/placements/:id - should deactivate the placement", async () => {
    const response = await request(app)
      .delete(`/api/v1/advertisements/placements/${placementId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("INACTIVE");
    expect(response.body.data.isEnabled).toBe(false);
  });

  it("DELETE /api/v1/advertisements/placements/:id - should reject a second deactivation", async () => {
    const response = await request(app)
      .delete(`/api/v1/advertisements/placements/${placementId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/placements/:id - should still return a deactivated placement", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/placements/${placementId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("INACTIVE");
  });

  it("GET /api/v1/advertisements/placements/:id - should require authentication", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/placements/${placementId}`
    );

    expect(response.status).toBe(401);
  });

  it("GET /api/v1/advertisements/placements/:id - should deny access without READ permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, permissionIds.read]
    );

    const response = await request(app)
      .get(`/api/v1/advertisements/placements/${placementId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);

    await pool.query(
      `
      INSERT INTO role_permissions
      (
        role_id,
        permission_id,
        created_by
      )
      VALUES
      ($1, $2, $3)
      ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionIds.read, testUserId]
    );
  });

  it("POST /api/v1/advertisements/placements - should deny access without CREATE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, permissionIds.create]
    );

    const response = await request(app)
      .post("/api/v1/advertisements/placements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: `DENIED_CREATE_${timestamp}`,
        displayName: "Denied Create Placement",
        pageType: "HOME",
        placementType: "HOME_TOP"
      });

    expect(response.status).toBe(403);

    await pool.query(
      `
      INSERT INTO role_permissions
      (
        role_id,
        permission_id,
        created_by
      )
      VALUES
      ($1, $2, $3)
      ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionIds.create, testUserId]
    );
  });

  it("PATCH /api/v1/advertisements/placements/:id - should deny access without UPDATE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, permissionIds.update]
    );

    const response = await request(app)
      .patch(`/api/v1/advertisements/placements/${placementId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayName: "Denied Update Placement"
      });

    expect(response.status).toBe(403);

    await pool.query(
      `
      INSERT INTO role_permissions
      (
        role_id,
        permission_id,
        created_by
      )
      VALUES
      ($1, $2, $3)
      ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionIds.update, testUserId]
    );
  });

  it("DELETE /api/v1/advertisements/placements/:id - should deny access without DELETE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, permissionIds.delete]
    );

    const response = await request(app)
      .delete(`/api/v1/advertisements/placements/${placementId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);

    await pool.query(
      `
      INSERT INTO role_permissions
      (
        role_id,
        permission_id,
        created_by
      )
      VALUES
      ($1, $2, $3)
      ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionIds.delete, testUserId]
    );
  });
});
