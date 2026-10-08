import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Rotation API Integration", () => {
  let accessToken = "";

  let testUserId = 0;
  let testRoleId = 0;
  let superAdminRoleId = 0;

  let placementId = 0;
  let advertisementId = 0;
  let placementRuleId = 0;
  let scheduleId = 0;
  let memberId = 0;

  let testClientId = 0;

  const timestamp = Date.now();

  const username = `rotation_test_user_${timestamp}`;
  const email = `rotation-test-user-${timestamp}@example.com`;

  const roleCode = `TEST_AD_ROTATION_ROLE_${timestamp}`;

  const password = "Rotation_Test@123";

  const permissionCodes = {
    read: "advertisements.rotation.read",
    create: "advertisements.rotation.create",
    update: "advertisements.rotation.update",
    delete: "advertisements.rotation.delete"
  };

  const permissionIds: Record<keyof typeof permissionCodes, number> = {
    read: 0,
    create: 0,
    update: 0,
    delete: 0
  };

  const createdPermissionIds: number[] = [];

  beforeAll(async () => {
    /*
     * ==========================================================================
     * Resolve SUPER_ADMIN role.
     * ==========================================================================
     */

    const superAdminResult = await pool.query(
      `
        SELECT id
        FROM roles
        WHERE code = 'SUPER_ADMIN'
        LIMIT 1
      `
    );

    expect(
      superAdminResult.rows.length,
      "SUPER_ADMIN role must exist for the integration test setup."
    ).toBe(1);

    superAdminRoleId = Number(superAdminResult.rows[0]?.id ?? 0);

    expect(superAdminRoleId).toBeGreaterThan(0);

    /*
     * ==========================================================================
     * Create temporary test user.
     *
     * users.role_id is required by the current schema, so the user is initially
     * created against SUPER_ADMIN and is immediately moved to the test role
     * after that role is created.
     * ==========================================================================
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
        username,
        email,
        passwordHash,
        "Advertisement Rotation Integration Test User",
        "Rotation Test User",
        superAdminRoleId
      ]
    );

    testUserId = Number(userResult.rows[0]?.id ?? 0);

    expect(testUserId).toBeGreaterThan(0);

    /*
     * ==========================================================================
     * Create temporary rotation role.
     * ==========================================================================
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
        roleCode,
        `Advertisement Rotation Test Role ${timestamp}`,
        "Temporary role for Advertisement Rotation API integration tests.",
        testUserId
      ]
    );

    testRoleId = Number(roleResult.rows[0]?.id ?? 0);

    expect(testRoleId).toBeGreaterThan(0);

    /*
     * ==========================================================================
     * Move test user from SUPER_ADMIN to the temporary test role.
     * ==========================================================================
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
     * ==========================================================================
     * Resolve/create required rotation permissions.
     *
     * Existing production permissions are reused.
     * Missing permissions are created specifically for this integration test.
     * ==========================================================================
     */

    for (const [key, code] of Object.entries(permissionCodes) as Array<
      [keyof typeof permissionCodes, string]
    >) {
      const existingPermissionResult = await pool.query(
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
        [code]
      );

      if (existingPermissionResult.rows.length > 0) {
        const permission = existingPermissionResult.rows[0];

        const permissionId = Number(permission?.id ?? 0);

        expect(permissionId).toBeGreaterThan(0);

        /*
         * Re-enable an existing test/production permission if it happens to
         * exist but is inactive.
         */
        if (permission?.status !== "ACTIVE") {
          await pool.query(
            `
              UPDATE permissions
              SET status = 'ACTIVE'
              WHERE id = $1
            `,
            [permissionId]
          );
        }

        permissionIds[key] = permissionId;

        continue;
      }

      const permissionResult = await pool.query(
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
            'advertisements.rotation',
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
          `Advertisement Rotation ${key} permission`,
          `Integration-test permission for ${code}.`,
          key,
          testUserId
        ]
      );

      const permissionId = Number(permissionResult.rows[0]?.id ?? 0);

      expect(permissionId).toBeGreaterThan(0);

      permissionIds[key] = permissionId;

      createdPermissionIds.push(permissionId);
    }

    /*
     * ==========================================================================
     * Attach rotation permissions to the test role.
     * ==========================================================================
     */

    for (const permissionId of Object.values(permissionIds)) {
      expect(permissionId).toBeGreaterThan(0);

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
    }

    /*
     * ==========================================================================
     * Authenticate test user.
     *
     * Current auth API response shape:
     *
     * {
     *   data: {
     *     user: {...},
     *     tokens: {
     *       accessToken: "...",
     *       refreshToken: "...",
     *       expiresIn: ...
     *     }
     *   }
     * }
     * ==========================================================================
     */

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username,
      password
    });

    expect(
      loginResponse.status,
      `Rotation integration login failed: ${JSON.stringify(loginResponse.body)}`
    ).toBe(200);

    expect(loginResponse.body.success).toBe(true);

    expect(loginResponse.body.data).toBeDefined();

    expect(loginResponse.body.data.user).toBeDefined();

    expect(loginResponse.body.data.tokens).toBeDefined();

    expect(loginResponse.body.data.tokens.accessToken).toBeTruthy();

    accessToken = loginResponse.body.data.tokens.accessToken;

    expect(accessToken).toBeTruthy();

    /*
     * ==========================================================================
     * Resolve an ACTIVE and enabled advertisement placement.
     * ==========================================================================
     */

    const placementResult = await pool.query(
      `
        SELECT
          id
        FROM advertisement_placements
        WHERE
          status = 'ACTIVE'
          AND is_enabled = TRUE
        ORDER BY id ASC
        LIMIT 1
      `
    );

    expect(
      placementResult.rows.length,
      "At least one ACTIVE and enabled advertisement placement is required."
    ).toBeGreaterThan(0);

    placementId = Number(placementResult.rows[0]?.id ?? 0);

    expect(placementId).toBeGreaterThan(0);

    /*
     * ==========================================================================
     * Resolve an ACTIVE advertisement client.
     *
     * The test advertisement is created locally so this integration test does
     * not depend on an existing production advertisement being eligible.
     * ==========================================================================
     */

    const clientResult = await pool.query(
      `
        SELECT
          id
        FROM advertisement_clients
        WHERE status = 'ACTIVE'
        ORDER BY id ASC
        LIMIT 1
      `
    );

    expect(
      clientResult.rows.length,
      "At least one ACTIVE advertisement client is required."
    ).toBeGreaterThan(0);

    testClientId = Number(clientResult.rows[0]?.id ?? 0);

    expect(testClientId).toBeGreaterThan(0);

    /*
     * ==========================================================================
     * Create a dedicated ACTIVE / APPROVED advertisement fixture.
     *
     * IMPORTANT:
     *
     * The current advertisements schema uses client_id and does NOT contain
     * advertiser_id. The previous fixture attempted to insert advertiser_id,
     * which caused the entire beforeAll hook to fail and therefore skipped all
     * ten rotation tests.
     *
     * The current delivery eligibility query also requires:
     *
     *   a.is_house_ad = FALSE
     *
     * so that field is explicitly set here.
     *
     * The advertisement is intentionally created by SQL rather than depending
     * on another integration test having already populated an eligible
     * advertisement.
     *
     * The advertisement is valid for the current delivery rules:
     *
     *   - status = ACTIVE
     *   - workflow_status = APPROVED
     *   - submitted_at is populated
     *   - approved_at is populated
     *   - is_house_ad = FALSE
     *   - advertisement-level start/end window covers the current time
     * ==========================================================================
     */

    const advertisementResult = await pool.query(
      `
        INSERT INTO advertisements
        (
          client_id,
          name,
          internal_name,
          advertisement_type,
          destination_url,
          priority,
          status,
          start_at,
          end_at,
          is_clickable,
          open_in_new_tab,
          is_house_ad,
          notes,
          workflow_status,
          submitted_at,
          submitted_by,
          approved_at,
          approved_by,
          created_by,
          updated_by
        )
        VALUES
        (
          $1,
          $2,
          $3,
          'DISPLAY',
          'https://example.com/rotation-test',
          10,
          'ACTIVE',
          CURRENT_TIMESTAMP - INTERVAL '1 hour',
          CURRENT_TIMESTAMP + INTERVAL '1 day',
          TRUE,
          TRUE,
          FALSE,
          'Temporary advertisement created by Advertisement Rotation API integration test.',
          'APPROVED',
          CURRENT_TIMESTAMP - INTERVAL '2 hours',
          $4,
          CURRENT_TIMESTAMP - INTERVAL '1 hour',
          $4,
          $4,
          $4
        )
        RETURNING id
      `,
      [
        testClientId,
        `Rotation Integration Advertisement ${timestamp}`,
        `rotation_integration_${timestamp}`,
        testUserId
      ]
    );

    expect(
      advertisementResult.rows.length,
      "The temporary rotation advertisement must be created."
    ).toBe(1);

    advertisementId = Number(advertisementResult.rows[0]?.id ?? 0);

    expect(advertisementId).toBeGreaterThan(0);

    /*
     * ==========================================================================
     * Create an ACTIVE placement rule for the test advertisement.
     *
     * FIXED insertion type intentionally leaves insertion_position NULL.
     * ==========================================================================
     */

    const placementRuleResult = await pool.query(
      `
        INSERT INTO advertisement_placement_rules
        (
          advertisement_id,
          placement_id,
          insertion_type,
          insertion_position,
          display_order,
          max_impressions,
          status,
          created_by,
          updated_by
        )
        VALUES
        (
          $1,
          $2,
          'FIXED',
          NULL,
          1,
          NULL,
          'ACTIVE',
          $3,
          $3
        )
        RETURNING id
      `,
      [advertisementId, placementId, testUserId]
    );

    expect(
      placementRuleResult.rows.length,
      "The temporary advertisement must have an ACTIVE placement rule."
    ).toBe(1);

    placementRuleId = Number(placementRuleResult.rows[0]?.id ?? 0);

    expect(placementRuleId).toBeGreaterThan(0);

    /*
     * ==========================================================================
     * Create an ACTIVE/current schedule for the test advertisement.
     *
     * This matches the current delivery repository:
     *
     *   s.advertisement_id = a.id
     *   s.placement_id = p.id
     *   s.placement_rule_id IS NULL OR s.placement_rule_id = pr.id
     *   s.status = ACTIVE
     *   s.start_at <= NOW
     *   s.end_at > NOW
     * ==========================================================================
     */

    const scheduleResult = await pool.query(
      `
        INSERT INTO advertisement_schedules
        (
          advertisement_id,
          placement_id,
          placement_rule_id,
          start_at,
          end_at,
          status,
          priority,
          notes,
          created_by,
          updated_by
        )
        VALUES
        (
          $1,
          $2,
          $3,
          CURRENT_TIMESTAMP - INTERVAL '30 minutes',
          CURRENT_TIMESTAMP + INTERVAL '1 day',
          'ACTIVE',
          10,
          'Temporary schedule created by Advertisement Rotation API integration test.',
          $4,
          $4
        )
        RETURNING id
      `,
      [advertisementId, placementId, placementRuleId, testUserId]
    );

    expect(
      scheduleResult.rows.length,
      "The temporary advertisement must have an ACTIVE schedule."
    ).toBe(1);

    scheduleId = Number(scheduleResult.rows[0]?.id ?? 0);

    expect(scheduleId).toBeGreaterThan(0);

    /*
     * ==========================================================================
     * Verify the complete fixture before executing the rotation tests.
     *
     * This query mirrors the current advertisement delivery eligibility rules.
     * ==========================================================================
     */

    const eligibilityResult = await pool.query(
      `
        SELECT
          a.id
        FROM advertisements a
        INNER JOIN advertisement_placement_rules pr
          ON pr.advertisement_id = a.id
         AND pr.placement_id = $1
         AND pr.status = 'ACTIVE'
        INNER JOIN advertisement_placements p
          ON p.id = pr.placement_id
         AND p.status = 'ACTIVE'
         AND p.is_enabled = TRUE
        INNER JOIN advertisement_schedules s
          ON s.advertisement_id = a.id
         AND s.placement_id = p.id
         AND (
           s.placement_rule_id IS NULL
           OR s.placement_rule_id = pr.id
         )
         AND s.status = 'ACTIVE'
         AND s.start_at <= CURRENT_TIMESTAMP
         AND s.end_at > CURRENT_TIMESTAMP
        WHERE
          a.id = $2
          AND a.workflow_status = 'APPROVED'
          AND a.status = 'ACTIVE'
          AND a.is_house_ad = FALSE
          AND (
            a.start_at IS NULL
            OR a.start_at <= CURRENT_TIMESTAMP
          )
          AND (
            a.end_at IS NULL
            OR a.end_at > CURRENT_TIMESTAMP
          )
        LIMIT 1
      `,
      [placementId, advertisementId]
    );

    expect(
      eligibilityResult.rows.length,
      "The temporary advertisement must satisfy the current rotation/delivery eligibility relationship."
    ).toBe(1);
  });

  afterAll(async () => {
    /*
     * ==========================================================================
     * Remove test rotation member.
     * ==========================================================================
     */

    if (memberId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_rotation_members
          WHERE id = $1
        `,
        [memberId]
      );
    }

    /*
     * ==========================================================================
     * Remove the temporary schedule.
     *
     * This is explicitly removed before the placement rule and advertisement
     * because of the foreign-key relationships.
     * ==========================================================================
     */

    if (scheduleId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_schedules
          WHERE id = $1
        `,
        [scheduleId]
      );
    }

    /*
     * ==========================================================================
     * Remove the temporary placement rule.
     * ==========================================================================
     */

    if (placementRuleId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_placement_rules
          WHERE id = $1
        `,
        [placementRuleId]
      );
    }

    /*
     * ==========================================================================
     * Remove the temporary advertisement.
     * ==========================================================================
     */

    if (advertisementId > 0) {
      await pool.query(
        `
          DELETE FROM advertisements
          WHERE id = $1
        `,
        [advertisementId]
      );
    }

    /*
     * ==========================================================================
     * Remove role permissions for the temporary role.
     * ==========================================================================
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
     * ==========================================================================
     * Remove user-role assignments.
     * ==========================================================================
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

    /*
     * ==========================================================================
     * Remove permissions created specifically by this test.
     *
     * Existing production permissions are intentionally preserved.
     * ==========================================================================
     */

    if (createdPermissionIds.length > 0) {
      await pool.query(
        `
          DELETE FROM permissions
          WHERE id = ANY($1::bigint[])
        `,
        [createdPermissionIds]
      );
    }

    /*
     * ==========================================================================
     * Remove temporary role.
     * ==========================================================================
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
     * ==========================================================================
     * Remove temporary user.
     * ==========================================================================
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

    await pool.end();
  });

  it("should have a valid authentication token", () => {
    expect(accessToken).toBeTruthy();
  });

  it("should retrieve rotation configuration", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/rotation/placements/${placementId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.placementId).toBe(placementId);
  });

  it("should update rotation configuration", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/rotation/placements/${placementId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        rotationEnabled: true,
        rotationMode: "TIME_BASED",
        rotationIntervalSeconds: 10,
        rotationStrategy: "ROUND_ROBIN"
      });

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.rotationEnabled).toBe(true);

    expect(response.body.data.rotationIntervalSeconds).toBe(10);
  });

  it("should list rotation members", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/rotation/placements/${placementId}/members`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("should add an advertisement to rotation", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/rotation/placements/${placementId}/members`
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        priority: 100,
        status: "ACTIVE"
      });

    expect(response.status).toBe(201);

    expect(response.body.success).toBe(true);

    expect(response.body.data.placementId).toBe(placementId);

    expect(response.body.data.advertisementId).toBe(advertisementId);

    memberId = Number(response.body.data.id);

    expect(memberId).toBeGreaterThan(0);
  });

  it("should reject duplicate rotation membership", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/rotation/placements/${placementId}/members`
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        priority: 50
      });

    expect(response.status).toBe(409);

    expect(response.body.success).toBe(false);
  });

  it("should update rotation priority", async () => {
    expect(memberId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(
        `/api/v1/advertisements/rotation/placements/${placementId}/members/${memberId}`
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        priority: 200
      });

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.priority).toBe(200);
  });

  it("should deactivate a rotation member", async () => {
    expect(memberId).toBeGreaterThan(0);

    const response = await request(app)
      .delete(
        `/api/v1/advertisements/rotation/placements/${placementId}/members/${memberId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.status).toBe("INACTIVE");
  });

  it("should reject unauthenticated configuration access", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/rotation/placements/${placementId}`
    );

    expect(response.status).toBe(401);
  });

  it("should reject invalid placement id", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/rotation/placements/invalid")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
  });
});