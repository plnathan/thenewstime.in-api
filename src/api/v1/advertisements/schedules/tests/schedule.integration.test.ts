import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Schedule API Integration", () => {
  let accessToken = "";

  let testUserId = 0;
  let superAdminRoleId = 0;
  let testRoleId = 0;

  let testClientId = 0;
  let advertisementId = 0;
  let placementId = 0;
  let placementRuleId = 0;

  let scheduleId = 0;
  let cancelScheduleId = 0;
  let activeScheduleId = 0;
  let overlappingScheduleId = 0;

  const timestamp = Date.now();

  const testUsername = `schedule_test_user_${timestamp}`;

  const testEmail = `schedule-test-${timestamp}@example.com`;

  const testRoleCode = `TEST_AD_SCHEDULE_ROLE_${timestamp}`;

  const password = "Advertisement_Schedule_Test@123";

  const permissionCodes = {
    advertisementCreate: "advertisements.create",
    read: "advertisements.schedules.read",
    create: "advertisements.schedules.create",
    update: "advertisements.schedules.update",
    activate: "advertisements.schedules.activate",
    pause: "advertisements.schedules.pause",
    resume: "advertisements.schedules.resume",
    complete: "advertisements.schedules.complete",
    delete: "advertisements.schedules.delete"
  } as const;

  const permissionIds = {
    advertisementCreate: 0,
    read: 0,
    create: 0,
    update: 0,
    activate: 0,
    pause: 0,
    resume: 0,
    complete: 0,
    delete: 0
  };

  const createdPermissionIds: number[] = [];

  beforeAll(async () => {
    /*
     * --------------------------------------------------
     * SUPER ADMIN ROLE
     * --------------------------------------------------
     */
    const superAdminResult = await pool.query(`
      SELECT id
      FROM roles
      WHERE code = 'SUPER_ADMIN'
      LIMIT 1
    `);

    expect(superAdminResult.rows.length).toBe(1);

    superAdminRoleId = Number(superAdminResult.rows[0].id);

    /*
     * --------------------------------------------------
     * TEST USER
     * --------------------------------------------------
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
        "Advertisement Schedule Integration Test User",
        "Advertisement Schedule Test User",
        superAdminRoleId
      ]
    );

    testUserId = Number(userResult.rows[0].id);

    expect(testUserId).toBeGreaterThan(0);

    /*
     * --------------------------------------------------
     * TEST ROLE
     * --------------------------------------------------
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
        `Advertisement Schedule Test Role ${timestamp}`,
        "Temporary role for Advertisement Schedule API integration tests.",
        testUserId
      ]
    );

    testRoleId = Number(roleResult.rows[0].id);

    expect(testRoleId).toBeGreaterThan(0);

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
      ON CONFLICT (user_id, role_id)
      DO NOTHING
    `,
      [testUserId, testRoleId]
    );

    /*
     * --------------------------------------------------
     * RESOLVE / CREATE ADVERTISEMENT PERMISSIONS
     * --------------------------------------------------
     */
    for (const [key, code] of Object.entries(permissionCodes) as Array<
      [keyof typeof permissionCodes, string]
    >) {
      let permissionResult = await pool.query(
        `
        SELECT
          id,
          module,
          resource,
          action,
          code,
          status
        FROM permissions
        WHERE code = $1
        LIMIT 1
      `,
        [code]
      );

      if (permissionResult.rows.length === 0) {
        const action = key === "advertisementCreate" ? "create" : key;

        const resource =
          key === "advertisementCreate"
            ? "advertisements"
            : "advertisements.schedules";

        permissionResult = await pool.query(
          `
          INSERT INTO permissions
          (
            module,
            resource,
            action,
            code,
            display_name,
            description,
            display_order,
            is_system_permission,
            status
          )
          VALUES
          (
            'ADVERTISEMENT',
            $1,
            $2,
            $3,
            $4,
            $5,
            999,
            TRUE,
            'ACTIVE'
          )
          RETURNING
            id,
            module,
            resource,
            action,
            code,
            status
        `,
          [
            resource,
            action,
            code,
            `Advertisement Schedule ${action}`,
            `Advertisement schedule ${action} permission.`
          ]
        );

        createdPermissionIds.push(Number(permissionResult.rows[0].id));
      }

      const permission = permissionResult.rows[0];

      expect(permission.status).toBe("ACTIVE");

      expect(permission.module).toBe("ADVERTISEMENT");

      expect(permission.code).toBe(code);

      permissionIds[key] = Number(permission.id);

      expect(permissionIds[key]).toBeGreaterThan(0);
    }

    /*
     * --------------------------------------------------
     * ASSIGN PERMISSIONS
     * --------------------------------------------------
     */
    for (const key of Object.keys(permissionCodes) as Array<
      keyof typeof permissionCodes
    >) {
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
          (role_id, permission_id)
        DO NOTHING
      `,
        [testRoleId, permissionIds[key], testUserId]
      );
    }

    /*
     * --------------------------------------------------
     * TEST ADVERTISEMENT CLIENT
     * --------------------------------------------------
     */
    const clientResult = await pool.query(
      `
      INSERT INTO advertisement_clients
      (
        name,
        display_name,
        contact_person,
        email,
        mobile,
        client_code,
        ad_creation_hold,
        ad_creation_hold_reason,
        status
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        false,
        NULL,
        'ACTIVE'
      )
      RETURNING id
    `,
      [
        `Schedule Test Client ${timestamp}`,
        `Schedule Test Client ${timestamp}`,
        "Schedule Test Contact",
        `schedule-client-${timestamp}@example.com`,
        "9000000000",
        `SCHED${timestamp}`
      ]
    );

    testClientId = Number(clientResult.rows[0].id);

    expect(testClientId).toBeGreaterThan(0);

    /*
     * --------------------------------------------------
     * LOGIN
     * --------------------------------------------------
     */
    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username: testUsername,
      password
    });

    expect(loginResponse.status).toBe(200);

    accessToken = loginResponse.body.data.tokens.accessToken;

    expect(accessToken).toBeTruthy();

    /*
     * --------------------------------------------------
     * CREATE TEST ADVERTISEMENT
     * --------------------------------------------------
     */
    const advertisementResponse = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: testClientId,
        name: `Schedule Test Advertisement ${timestamp}`,
        advertisementType: "DISPLAY",
        currencyCode: "INR",
        agreedAmount: 1000,
        destinationUrl: "https://example.com/schedule-test",
        isClickable: true,
        openInNewTab: true,
        priority: 10
      });

    expect(advertisementResponse.status).toBe(201);

    advertisementId = Number(advertisementResponse.body.data.id);

    expect(advertisementId).toBeGreaterThan(0);

    /*
     * --------------------------------------------------
     * APPROVE TEST ADVERTISEMENT
     * --------------------------------------------------
     */
    await pool.query(
      `
      UPDATE advertisements
      SET
        workflow_status = 'APPROVED',
        submitted_at = CURRENT_TIMESTAMP,
        submitted_by = $2,
        approved_at = CURRENT_TIMESTAMP,
        approved_by = $2
      WHERE id = $1
    `,
      [advertisementId, testUserId]
    );

    /*
     * --------------------------------------------------
     * TEST ADVERTISEMENT PLACEMENT
     * --------------------------------------------------
     */
    const placementResult = await pool.query(
      `
      INSERT INTO advertisement_placements
      (
        code,
        display_name,
        description,
        page_type,
        placement_type,
        insertion_type,
        display_order,
        is_enabled,
        collapse_when_empty,
        fallback_behavior,
        display_frequency,
        frequency_value,
        auto_close_enabled,
        auto_close_seconds,
        close_button_enabled,
        close_on_overlay_click,
        status,
        created_by,
        updated_by
      )
      VALUES
      (
        $1,
        $2,
        $3,
        'NEWS_DETAIL',
        'NEWS_DETAIL_MODAL',
        'FIXED',
        999,
        TRUE,
        TRUE,
        'HIDE',
        'ONCE_PER_SESSION',
        1,
        FALSE,
        NULL,
        TRUE,
        TRUE,
        'ACTIVE',
        $4,
        $4
      )
      RETURNING id
    `,
      [
        `SCHEDULE_TEST_PLACEMENT_${timestamp}`,
        `Schedule Test Placement ${timestamp}`,
        "Temporary placement for Advertisement Schedule API integration tests.",
        testUserId
      ]
    );

    expect(placementResult.rows.length).toBe(1);

    placementId = Number(placementResult.rows[0].id);

    expect(placementId).toBeGreaterThan(0);

    /*
     * --------------------------------------------------
     * TEST PLACEMENT RULE
     * --------------------------------------------------
     */
    const placementRuleResult = await pool.query(
      `
      INSERT INTO advertisement_placement_rules
      (
        advertisement_id,
        placement_id,
        display_order,
        insertion_type,
        insertion_position,
        max_impressions,
        status,
        created_by,
        updated_by
      )
      VALUES
      (
        $1,
        $2,
        1,
        'FIXED',
        NULL,
        100,
        'ACTIVE',
        $3,
        $3
      )
      RETURNING id
    `,
      [advertisementId, placementId, testUserId]
    );

    placementRuleId = Number(placementRuleResult.rows[0].id);

    expect(placementRuleId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    const scheduleIds = [
      scheduleId,
      cancelScheduleId,
      activeScheduleId,
      overlappingScheduleId
    ].filter((id, index, array) => id > 0 && array.indexOf(id) === index);

    for (const id of scheduleIds) {
      await pool.query(
        `
        DELETE FROM advertisement_schedules
        WHERE id = $1
      `,
        [id]
      );
    }

    if (placementRuleId > 0) {
      await pool.query(
        `
        DELETE FROM advertisement_placement_rules
        WHERE id = $1
      `,
        [placementRuleId]
      );
    }

    if (placementId > 0) {
      await pool.query(
        `
        DELETE FROM advertisement_placements
        WHERE id = $1
      `,
        [placementId]
      );
    }

    if (advertisementId > 0) {
      await pool.query(
        `
        DELETE FROM advertisement_payments
        WHERE advertisement_id = $1
      `,
        [advertisementId]
      );

      await pool.query(
        `
        DELETE FROM advertisement_workflow_history
        WHERE advertisement_id = $1
      `,
        [advertisementId]
      );

      await pool.query(
        `
        DELETE FROM advertisements
        WHERE id = $1
      `,
        [advertisementId]
      );
    }

    if (testClientId > 0) {
      await pool.query(
        `
        DELETE FROM advertisement_clients
        WHERE id = $1
      `,
        [testClientId]
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
        DELETE FROM user_roles
        WHERE user_id = $1
      `,
        [testUserId]
      );

      await pool.query(
        `
        DELETE FROM user_sessions
        WHERE user_id = $1
      `,
        [testUserId]
      );

      await pool.query(
        `
        UPDATE users
        SET role_id = NULL
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

    if (testUserId > 0) {
      await pool.query(
        `
        DELETE FROM users
        WHERE id = $1
      `,
        [testUserId]
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

  it("POST /api/v1/advertisements/schedules - should create a schedule", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/schedules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId,
        placementRuleId,
        startAt: "2026-10-01T10:00:00.000Z",
        endAt: "2026-10-01T12:00:00.000Z",
        priority: 5,
        status: "SCHEDULED",
        notes: "Initial integration test schedule"
      });

    expect(response.status).toBe(201);

    expect(response.body.success).toBe(true);

    scheduleId = Number(response.body.data.id);

    expect(scheduleId).toBeGreaterThan(0);

    expect(Number(response.body.data.advertisementId)).toBe(advertisementId);

    expect(Number(response.body.data.placementId)).toBe(placementId);

    expect(Number(response.body.data.placementRuleId)).toBe(placementRuleId);

    expect(response.body.data.status).toBe("SCHEDULED");

    expect(response.body.data.priority).toBe(5);
  });

  it("GET /api/v1/advertisements/schedules/:id - should retrieve the schedule", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/schedules/${scheduleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(Number(response.body.data.id)).toBe(scheduleId);
  });

  it("GET /api/v1/advertisements/schedules - should list schedules", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/schedules")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(Array.isArray(response.body.data)).toBe(true);

    const createdSchedule = response.body.data.find(
      (item: { id: number | string }) => Number(item.id) === scheduleId
    );

    expect(createdSchedule).toBeDefined();
  });

  it("GET /api/v1/advertisements/schedules - should filter by advertisementId", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/schedules?advertisementId=${advertisementId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    for (const item of response.body.data) {
      expect(Number(item.advertisementId)).toBe(advertisementId);
    }
  });

  it("GET /api/v1/advertisements/schedules - should filter by placementId", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/schedules?placementId=${placementId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    for (const item of response.body.data) {
      expect(Number(item.placementId)).toBe(placementId);
    }
  });

  it("GET /api/v1/advertisements/schedules - should filter by status", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/schedules?status=SCHEDULED")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    const createdSchedule = response.body.data.find(
      (item: { id: number | string }) => Number(item.id) === scheduleId
    );

    expect(createdSchedule).toBeDefined();

    expect(createdSchedule.status).toBe("SCHEDULED");
  });

  it("PATCH /api/v1/advertisements/schedules/:id - should update the schedule", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/schedules/${scheduleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        priority: 25,
        notes: "Updated integration test schedule"
      });

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.priority).toBe(25);

    expect(response.body.data.notes).toBe("Updated integration test schedule");
  });

  it("POST /api/v1/advertisements/schedules - should reject overlapping schedules", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/schedules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId,
        placementRuleId,
        startAt: "2026-10-01T11:00:00.000Z",
        endAt: "2026-10-01T13:00:00.000Z",
        status: "SCHEDULED"
      });

    expect(response.status).toBe(409);

    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/schedules - should reject invalid date range", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/schedules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId,
        startAt: "2026-10-01T13:00:00.000Z",
        endAt: "2026-10-01T11:00:00.000Z",
        status: "SCHEDULED"
      });

    expect(response.status).toBe(400);
  });

  it("POST /api/v1/advertisements/schedules - should reject ACTIVE status during creation", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/schedules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId,
        startAt: "2026-11-01T10:00:00.000Z",
        endAt: "2026-11-01T12:00:00.000Z",
        status: "ACTIVE"
      });

    expect(response.status).toBe(400);
  });

  it("POST /api/v1/advertisements/schedules - should reject non-approved advertisement", async () => {
    const advertisementResult = await pool.query(
      `
      INSERT INTO advertisements
      (
        client_id,
        name,
        advertisement_type,
        destination_url,
        priority,
        status,
        is_clickable,
        open_in_new_tab,
        workflow_status,
        advertisement_amount,
        currency_code,
        created_by,
        updated_by
      )
      VALUES
      (
        $1,
        $2,
        'DISPLAY',
        'https://example.com/non-approved',
        1,
        'DRAFT',
        TRUE,
        TRUE,
        'DRAFT',
        100,
        'INR',
        $3,
        $3
      )
      RETURNING id
    `,
      [
        testClientId,
        `Non Approved Schedule Advertisement ${timestamp}`,
        testUserId
      ]
    );

    const nonApprovedAdvertisementId = Number(advertisementResult.rows[0].id);

    const response = await request(app)
      .post("/api/v1/advertisements/schedules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: nonApprovedAdvertisementId,
        placementId,
        startAt: "2026-11-05T10:00:00.000Z",
        endAt: "2026-11-05T12:00:00.000Z",
        status: "SCHEDULED"
      });

    expect(response.status).toBe(400);

    await pool.query(
      `
      DELETE FROM advertisements
      WHERE id = $1
    `,
      [nonApprovedAdvertisementId]
    );
  });

  /*
   * --------------------------------------------------
   * LIFECYCLE
   * --------------------------------------------------
   */

  it("POST /api/v1/advertisements/schedules/:id/activate - should activate a scheduled schedule", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/schedules/${scheduleId}/activate`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.status).toBe("ACTIVE");
  });

  it("POST /api/v1/advertisements/schedules/:id/pause - should pause an active schedule", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/schedules/${scheduleId}/pause`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.status).toBe("PAUSED");
  });

  it("POST /api/v1/advertisements/schedules/:id/resume - should resume a paused schedule", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/schedules/${scheduleId}/resume`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.status).toBe("ACTIVE");
  });

  it("POST /api/v1/advertisements/schedules/:id/complete - should complete an active schedule", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/schedules/${scheduleId}/complete`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.status).toBe("COMPLETED");
  });

  it("POST /api/v1/advertisements/schedules/:id/pause - should reject an invalid transition from COMPLETED", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/schedules/${scheduleId}/pause`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(409);

    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/schedules - should create a separate schedule for cancellation", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/schedules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId,
        placementRuleId,
        startAt: "2026-12-01T10:00:00.000Z",
        endAt: "2026-12-01T12:00:00.000Z",
        priority: 1,
        status: "SCHEDULED",
        notes: "Cancellation integration test schedule"
      });

    expect(response.status).toBe(201);

    cancelScheduleId = Number(response.body.data.id);

    expect(cancelScheduleId).toBeGreaterThan(0);

    expect(response.body.data.status).toBe("SCHEDULED");
  });

  it("POST /api/v1/advertisements/schedules/:id/cancel - should cancel a scheduled schedule", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/schedules/${cancelScheduleId}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.status).toBe("CANCELLED");
  });

  it("POST /api/v1/advertisements/schedules/:id/cancel - should reject second cancellation", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/schedules/${cancelScheduleId}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(409);

    expect(response.body.success).toBe(false);
  });

  it("DELETE /api/v1/advertisements/schedules/:id - should cancel through the legacy DELETE endpoint", async () => {
    const createResponse = await request(app)
      .post("/api/v1/advertisements/schedules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId,
        placementRuleId,
        startAt: "2026-12-05T10:00:00.000Z",
        endAt: "2026-12-05T12:00:00.000Z",
        status: "SCHEDULED"
      });

    expect(createResponse.status).toBe(201);

    const deleteScheduleId = Number(createResponse.body.data.id);

    expect(deleteScheduleId).toBeGreaterThan(0);

    const response = await request(app)
      .delete(`/api/v1/advertisements/schedules/${deleteScheduleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data.status).toBe("CANCELLED");

    await pool.query(
      `
      DELETE FROM advertisement_schedules
      WHERE id = $1
    `,
      [deleteScheduleId]
    );
  });

  it("POST /api/v1/advertisements/schedules/:id/activate - should reject overlapping active schedules", async () => {
    const activeCreateResponse = await request(app)
      .post("/api/v1/advertisements/schedules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId,
        placementRuleId,
        startAt: "2026-12-10T10:00:00.000Z",
        endAt: "2026-12-10T12:00:00.000Z",
        status: "SCHEDULED"
      });

    expect(activeCreateResponse.status).toBe(201);

    activeScheduleId = Number(activeCreateResponse.body.data.id);

    expect(activeScheduleId).toBeGreaterThan(0);

    const activateResponse = await request(app)
      .post(`/api/v1/advertisements/schedules/${activeScheduleId}/activate`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(activateResponse.status).toBe(200);

    expect(activateResponse.body.data.status).toBe("ACTIVE");

    const overlappingCreateResponse = await request(app)
      .post("/api/v1/advertisements/schedules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId,
        placementRuleId,
        startAt: "2026-12-10T11:00:00.000Z",
        endAt: "2026-12-10T13:00:00.000Z",
        status: "SCHEDULED"
      });

    expect(overlappingCreateResponse.status).toBe(409);

    /*
     * The normal create validation prevents the overlapping schedule
     * from being created while another schedule is ACTIVE.
     *
     * Therefore, insert the test schedule directly as SCHEDULED so
     * the activation overlap rule itself can be tested.
     */
    const directScheduleResult = await pool.query(
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
        rescheduled_from_id,
        notes,
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
        'SCHEDULED',
        0,
        NULL,
        NULL,
        $6,
        $6
      )
      RETURNING id
    `,
      [
        advertisementId,
        placementId,
        placementRuleId,
        "2026-12-10T11:00:00.000Z",
        "2026-12-10T13:00:00.000Z",
        testUserId
      ]
    );

    overlappingScheduleId = Number(directScheduleResult.rows[0].id);

    expect(overlappingScheduleId).toBeGreaterThan(0);

    const response = await request(app)
      .post(
        `/api/v1/advertisements/schedules/${overlappingScheduleId}/activate`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(409);

    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/schedules/:id - should return 404 for an unknown schedule", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/schedules/999999999")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
  });

  it("GET /api/v1/advertisements/schedules/:id - should require authentication", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/schedules/${scheduleId}`
    );

    expect(response.status).toBe(401);
  });

  /*
   * --------------------------------------------------
   * RBAC
   * --------------------------------------------------
   */

  it("GET /api/v1/advertisements/schedules/:id - should deny access without READ permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
    `,
      [testRoleId, permissionIds.read]
    );

    const response = await request(app)
      .get(`/api/v1/advertisements/schedules/${scheduleId}`)
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
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
        (role_id, permission_id)
      DO NOTHING
    `,
      [testRoleId, permissionIds.read, testUserId]
    );
  });

  it("POST /api/v1/advertisements/schedules - should deny access without CREATE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
    `,
      [testRoleId, permissionIds.create]
    );

    const response = await request(app)
      .post("/api/v1/advertisements/schedules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId,
        startAt: "2027-01-10T10:00:00.000Z",
        endAt: "2027-01-10T12:00:00.000Z",
        status: "SCHEDULED"
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
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
        (role_id, permission_id)
      DO NOTHING
    `,
      [testRoleId, permissionIds.create, testUserId]
    );
  });

  it("PATCH /api/v1/advertisements/schedules/:id - should deny access without UPDATE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
    `,
      [testRoleId, permissionIds.update]
    );

    const response = await request(app)
      .patch(`/api/v1/advertisements/schedules/${scheduleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        priority: 50
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
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
        (role_id, permission_id)
      DO NOTHING
    `,
      [testRoleId, permissionIds.update, testUserId]
    );
  });

  it("POST /api/v1/advertisements/schedules/:id/activate - should deny access without ACTIVATE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
    `,
      [testRoleId, permissionIds.activate]
    );

    const response = await request(app)
      .post(`/api/v1/advertisements/schedules/${scheduleId}/activate`)
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
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
        (role_id, permission_id)
      DO NOTHING
    `,
      [testRoleId, permissionIds.activate, testUserId]
    );
  });

  it("POST /api/v1/advertisements/schedules/:id/pause - should deny access without PAUSE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
    `,
      [testRoleId, permissionIds.pause]
    );

    const response = await request(app)
      .post(`/api/v1/advertisements/schedules/${activeScheduleId}/pause`)
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
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
        (role_id, permission_id)
      DO NOTHING
    `,
      [testRoleId, permissionIds.pause, testUserId]
    );
  });

  it("POST /api/v1/advertisements/schedules/:id/resume - should deny access without RESUME permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
    `,
      [testRoleId, permissionIds.resume]
    );

    const response = await request(app)
      .post(`/api/v1/advertisements/schedules/${activeScheduleId}/resume`)
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
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
        (role_id, permission_id)
      DO NOTHING
    `,
      [testRoleId, permissionIds.resume, testUserId]
    );
  });

  it("POST /api/v1/advertisements/schedules/:id/complete - should deny access without COMPLETE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
    `,
      [testRoleId, permissionIds.complete]
    );

    const response = await request(app)
      .post(`/api/v1/advertisements/schedules/${activeScheduleId}/complete`)
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
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
        (role_id, permission_id)
      DO NOTHING
    `,
      [testRoleId, permissionIds.complete, testUserId]
    );
  });

  it("POST /api/v1/advertisements/schedules/:id/cancel - should deny access without DELETE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
    `,
      [testRoleId, permissionIds.delete]
    );

    const response = await request(app)
      .post(`/api/v1/advertisements/schedules/${cancelScheduleId}/cancel`)
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
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
        (role_id, permission_id)
      DO NOTHING
    `,
      [testRoleId, permissionIds.delete, testUserId]
    );
  });

  it("DELETE /api/v1/advertisements/schedules/:id - should deny access without DELETE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
    `,
      [testRoleId, permissionIds.delete]
    );

    const response = await request(app)
      .delete(`/api/v1/advertisements/schedules/${cancelScheduleId}`)
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
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
        (role_id, permission_id)
      DO NOTHING
    `,
      [testRoleId, permissionIds.delete, testUserId]
    );
  });
});
