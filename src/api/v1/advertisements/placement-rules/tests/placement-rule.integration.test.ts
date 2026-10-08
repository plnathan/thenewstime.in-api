import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Placement Rule API Integration", () => {
  let accessToken = "";

  let testUserId = 0;
  let superAdminRoleId = 0;
  let testRoleId = 0;

  let testClientId = 0;
  let advertisementId = 0;

  /*
   * Primary placement:
   *
   * This placement is supplied during advertisement creation.
   * Advertisement creation automatically persists the runtime
   * placement rule for this placement.
   */
  let placementId = 0;

  /*
   * Secondary placement:
   *
   * This placement is intentionally different from the primary
   * placement so the placement-rule CRUD API can explicitly
   * create a rule without violating:
   *
   * UNIQUE (advertisement_id, placement_id)
   */
  let placementRuleCrudPlacementId = 0;

  let testPlacementRuleId = 0;

  const timestamp = Date.now();

  const testUsername = `placement_rule_test_user_${timestamp}`;
  const testEmail = `placement-rule-test-${timestamp}@example.com`;
  const testRoleCode = `TEST_AD_PLACEMENT_RULE_ROLE_${timestamp}`;

  const password = "Placement_Rule_Test@123";

  const permissionCodes = {
    advertisementCreate: "advertisements.create",
    read: "advertisements.placement_rules.read",
    create: "advertisements.placement_rules.create",
    update: "advertisements.placement_rules.update",
    delete: "advertisements.placement_rules.delete"
  } as const;

  const permissionIds: Record<keyof typeof permissionCodes, number> = {
    advertisementCreate: 0,
    read: 0,
    create: 0,
    update: 0,
    delete: 0
  };

  beforeAll(async () => {
    /*
     * --------------------------------------------------
     * SUPER ADMIN ROLE
     * --------------------------------------------------
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
        "Placement Rule Integration Test User",
        "Placement Rule Test User",
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
        `Advertisement Placement Rule Test Role ${timestamp}`,
        "Temporary role for Advertisement Placement Rule API integration tests.",
        testUserId
      ]
    );

    testRoleId = Number(roleResult.rows[0].id);

    expect(testRoleId).toBeGreaterThan(0);

    /*
     * --------------------------------------------------
     * ASSIGN TEST ROLE TO USER
     * --------------------------------------------------
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
     * --------------------------------------------------
     * RESOLVE EXISTING PERMISSIONS
     * --------------------------------------------------
     */
    for (const [key, code] of Object.entries(permissionCodes) as Array<
      [keyof typeof permissionCodes, string]
    >) {
      const permissionResult = await pool.query(
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

      expect(
        permissionResult.rows.length,
        `Required permission "${code}" does not exist`
      ).toBe(1);

      const permission = permissionResult.rows[0];

      expect(permission.status).toBe("ACTIVE");
      expect(permission.module).toBe("ADVERTISEMENT");

      if (key === "advertisementCreate") {
        expect(permission.resource).toBe("advertisements");
        expect(permission.action).toBe("create");
      } else {
        expect(permission.resource).toBe("advertisements.placement_rules");
        expect(permission.action).toBe(key);
      }

      expect(permission.code).toBe(code);

      permissionIds[key] = Number(permission.id);

      expect(permissionIds[key]).toBeGreaterThan(0);
    }

    /*
     * --------------------------------------------------
     * ASSIGN PERMISSIONS TO TEST ROLE
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
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `,
        [testRoleId, permissionIds[key], testUserId]
      );
    }

    /*
     * --------------------------------------------------
     * VERIFY ROLE-PERMISSION ASSIGNMENTS
     * --------------------------------------------------
     */
    const assignedPermissionsResult = await pool.query(
      `
        SELECT
          p.code
        FROM role_permissions rp
        INNER JOIN permissions p
          ON p.id = rp.permission_id
        INNER JOIN roles r
          ON r.id = rp.role_id
        WHERE rp.role_id = $1
          AND r.status = 'ACTIVE'
          AND p.status = 'ACTIVE'
          AND p.code = ANY($2::text[])
        ORDER BY p.code
      `,
      [testRoleId, Object.values(permissionCodes)]
    );

    const assignedPermissionCodes = assignedPermissionsResult.rows.map(
      (row) => row.code
    );

    expect(assignedPermissionCodes).toEqual(
      expect.arrayContaining(Object.values(permissionCodes))
    );

    expect(assignedPermissionCodes).toHaveLength(
      Object.values(permissionCodes).length
    );

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
        `Placement Rule Test Client ${timestamp}`,
        `Placement Rule Test Client ${timestamp}`,
        "Placement Rule Test Contact",
        `placement-rule-client-${timestamp}@example.com`,
        "9000000000",
        `PRTC${timestamp}`
      ]
    );

    testClientId = Number(clientResult.rows[0].id);

    expect(testClientId).toBeGreaterThan(0);

    /*
     * --------------------------------------------------
     * PRIMARY ADVERTISEMENT PLACEMENT
     * --------------------------------------------------
     *
     * This placement is supplied to POST /advertisements.
     *
     * The advertisement repository automatically creates
     * the corresponding active placement rule.
     */
    const primaryPlacementResult = await pool.query(
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
          'HOME',
          'HOME_TOP',
          'FIXED',
          10,
          TRUE,
          TRUE,
          'HIDE',
          'ONCE_PER_DAY',
          NULL,
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
        `PLACEMENT_RULE_HOME_TOP_${timestamp}`,
        "Placement Rule Test Home Top Placement",
        "Primary placement fixture for Advertisement Placement Rule API integration tests.",
        testUserId
      ]
    );

    expect(primaryPlacementResult.rows.length).toBe(1);

    placementId = Number(primaryPlacementResult.rows[0].id);

    expect(placementId).toBeGreaterThan(0);

    /*
     * --------------------------------------------------
     * SECONDARY PLACEMENT FOR CRUD TESTS
     * --------------------------------------------------
     *
     * The advertisement already receives an automatic
     * placement rule for placementId.
     *
     * Therefore the explicit placement-rule POST must use
     * another placement. Otherwise the database's unique
     * constraint:
     *
     * UNIQUE (advertisement_id, placement_id)
     *
     * correctly returns HTTP 409.
     */
    const crudPlacementResult = await pool.query(
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
          'NEWS_LIST',
          'NEWS_LIST_TOP',
          'FIXED',
          20,
          TRUE,
          TRUE,
          'HIDE',
          'EVERY_VISIT',
          NULL,
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
        `PLACEMENT_RULE_NEWS_LIST_TOP_${timestamp}`,
        "Placement Rule CRUD Test News List Placement",
        "Secondary placement fixture used for explicit placement-rule CRUD tests.",
        testUserId
      ]
    );

    expect(crudPlacementResult.rows.length).toBe(1);

    placementRuleCrudPlacementId = Number(crudPlacementResult.rows[0].id);

    expect(placementRuleCrudPlacementId).toBeGreaterThan(0);
    expect(placementRuleCrudPlacementId).not.toBe(placementId);

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
    expect(loginResponse.body.success).toBe(true);

    accessToken = loginResponse.body.data.tokens.accessToken;

    expect(accessToken).toBeTruthy();

    /*
     * --------------------------------------------------
     * VERIFY AUTHORIZATION
     * --------------------------------------------------
     */
    for (const key of Object.keys(permissionCodes) as Array<
      keyof typeof permissionCodes
    >) {
      const resource =
        key === "advertisementCreate"
          ? "advertisements"
          : "advertisements.placement_rules";

      const action = key === "advertisementCreate" ? "create" : key;

      const authorizationResult = await pool.query(
        `
          SELECT EXISTS
          (
            SELECT 1
            FROM user_roles ur
            INNER JOIN roles r
              ON r.id = ur.role_id
            INNER JOIN role_permissions rp
              ON rp.role_id = r.id
            INNER JOIN permissions p
              ON p.id = rp.permission_id
            WHERE ur.user_id = $1
              AND r.status = 'ACTIVE'
              AND p.status = 'ACTIVE'
              AND UPPER(COALESCE(p.module, '')) = UPPER($2)
              AND UPPER(COALESCE(p.resource, '')) = UPPER($3)
              AND UPPER(COALESCE(p.action, '')) = UPPER($4)
          ) AS exists
        `,
        [testUserId, "ADVERTISEMENT", resource, action]
      );

      expect(
        authorizationResult.rows[0]?.exists,
        `User should have ${permissionCodes[key]}`
      ).toBe(true);
    }
  });

  afterAll(async () => {
    /*
     * --------------------------------------------------
     * DELETE EXPLICIT TEST PLACEMENT RULE
     * --------------------------------------------------
     */
    if (testPlacementRuleId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_placement_rules
          WHERE id = $1
        `,
        [testPlacementRuleId]
      );
    }

    /*
     * --------------------------------------------------
     * DELETE ANY REMAINING PLACEMENT RULES FOR TEST AD
     * --------------------------------------------------
     *
     * Advertisement creation automatically creates a
     * placement rule for the primary placement.
     *
     * Delete any remaining rules before deleting the
     * advertisement so the cleanup is explicit and does
     * not depend solely on ON DELETE CASCADE.
     */
    if (advertisementId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_placement_rules
          WHERE advertisement_id = $1
        `,
        [advertisementId]
      );
    }

    /*
     * --------------------------------------------------
     * DELETE ADVERTISEMENT DEPENDENCIES
     * --------------------------------------------------
     */
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

    /*
     * --------------------------------------------------
     * DELETE SECONDARY PLACEMENT
     * --------------------------------------------------
     */
    if (placementRuleCrudPlacementId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_placements
          WHERE id = $1
        `,
        [placementRuleCrudPlacementId]
      );
    }

    /*
     * --------------------------------------------------
     * DELETE PRIMARY PLACEMENT
     * --------------------------------------------------
     */
    if (placementId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_placements
          WHERE id = $1
        `,
        [placementId]
      );
    }

    /*
     * --------------------------------------------------
     * DELETE TEST CLIENT
     * --------------------------------------------------
     */
    if (testClientId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_clients
          WHERE id = $1
        `,
        [testClientId]
      );
    }

    /*
     * --------------------------------------------------
     * REMOVE ROLE PERMISSIONS
     * --------------------------------------------------
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
     * --------------------------------------------------
     * REMOVE USER ROLE ASSIGNMENTS
     * --------------------------------------------------
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
     * --------------------------------------------------
     * REMOVE SESSIONS
     * --------------------------------------------------
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

    /*
     * --------------------------------------------------
     * RESET USER ROLE REFERENCE
     * --------------------------------------------------
     */
    if (testUserId > 0) {
      await pool.query(
        `
          UPDATE users
          SET role_id = NULL
          WHERE id = $1
        `,
        [testUserId]
      );
    }

    /*
     * --------------------------------------------------
     * DELETE TEST ROLE
     * --------------------------------------------------
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
     * --------------------------------------------------
     * DELETE TEST USER
     * --------------------------------------------------
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
  });

  it("should have a valid authentication token", () => {
    expect(accessToken).toBeTruthy();
  });

  it("should have an active advertisement placement", async () => {
    const placementResult = await pool.query(
      `
        SELECT
          id,
          code,
          status,
          is_enabled
        FROM advertisement_placements
        WHERE id = $1
        LIMIT 1
      `,
      [placementId]
    );

    expect(placementResult.rows.length).toBe(1);
    expect(Number(placementResult.rows[0].id)).toBe(placementId);
    expect(placementResult.rows[0].status).toBe("ACTIVE");
    expect(placementResult.rows[0].is_enabled).toBe(true);
  });

  it("POST /api/v1/advertisements - should create an advertisement for the placement rule tests", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: testClientId,

        /*
         * Runtime placement is explicitly supplied because
         * placement is mandatory for advertisement creation.
         *
         * The advertisement repository persists this placement
         * through advertisement_placement_rules.
         */
        placementId,

        name: `Placement Rule Test Advertisement ${timestamp}`,
        internalName: `placement-rule-test-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        currencyCode: "INR",
        advertisementAmount: 1000,
        destinationUrl: "https://example.com/placement-rule-test",
        isClickable: true,
        openInNewTab: true,
        priority: 10
      });

    expect(
      response.status,
      `Advertisement creation failed: ${JSON.stringify(
        response.body,
        null,
        2
      )}`
    ).toBe(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    advertisementId = Number(response.body.data.id);

    expect(advertisementId).toBeGreaterThan(0);

    /*
     * The advertisement creation flow automatically creates
     * an active runtime placement rule for placementId.
     *
     * Therefore the response should contain the selected
     * runtime placement.
     */
    expect(response.body.data.placement).toBeDefined();
    expect(Number(response.body.data.placement.id)).toBe(placementId);
  });

  it("POST /api/v1/advertisements/placement-rules - should create a FIXED placement rule", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/placement-rules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId: placementRuleCrudPlacementId,
        displayOrder: 1,
        insertionType: "FIXED",
        insertionPosition: null,
        maxImpressions: 100,
        status: "ACTIVE"
      });

    expect(
      response.status,
      `Placement rule creation failed: ${JSON.stringify(
        response.body,
        null,
        2
      )}`
    ).toBe(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    testPlacementRuleId = Number(response.body.data.id);

    expect(testPlacementRuleId).toBeGreaterThan(0);
    expect(Number(response.body.data.advertisementId)).toBe(advertisementId);
    expect(Number(response.body.data.placementId)).toBe(
      placementRuleCrudPlacementId
    );
    expect(response.body.data.displayOrder).toBe(1);
    expect(response.body.data.insertionType).toBe("FIXED");
    expect(response.body.data.insertionPosition).toBeNull();
    expect(response.body.data.maxImpressions).toBe(100);
    expect(response.body.data.status).toBe("ACTIVE");
  });

  it("GET /api/v1/advertisements/placement-rules/:id - should retrieve the placement rule", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/placement-rules/${testPlacementRuleId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(testPlacementRuleId);
    expect(Number(response.body.data.advertisementId)).toBe(advertisementId);
    expect(Number(response.body.data.placementId)).toBe(
      placementRuleCrudPlacementId
    );
  });

  it("GET /api/v1/advertisements/placement-rules - should list placement rules", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/placement-rules")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const createdRule = response.body.data.find(
      (item: { id: number | string }) =>
        Number(item.id) === testPlacementRuleId
    );

    expect(createdRule).toBeDefined();
  });

  it("GET /api/v1/advertisements/placement-rules - should filter by advertisementId", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/placement-rules?advertisementId=${advertisementId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    expect(response.body.data.length).toBeGreaterThan(0);

    for (const item of response.body.data) {
      expect(Number(item.advertisementId)).toBe(advertisementId);
    }

    const createdRule = response.body.data.find(
      (item: { id: number | string }) =>
        Number(item.id) === testPlacementRuleId
    );

    expect(createdRule).toBeDefined();
  });

  it("GET /api/v1/advertisements/placement-rules - should filter by placementId", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/placement-rules?placementId=${placementRuleCrudPlacementId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    expect(response.body.data.length).toBeGreaterThan(0);

    for (const item of response.body.data) {
      expect(Number(item.placementId)).toBe(
        placementRuleCrudPlacementId
      );
    }

    const createdRule = response.body.data.find(
      (item: { id: number | string }) =>
        Number(item.id) === testPlacementRuleId
    );

    expect(createdRule).toBeDefined();
  });

  it("GET /api/v1/advertisements/placement-rules - should filter by status", async () => {
    const response = await request(app)
      .get(
        "/api/v1/advertisements/placement-rules?status=ACTIVE"
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const createdRule = response.body.data.find(
      (item: { id: number | string }) =>
        Number(item.id) === testPlacementRuleId
    );

    expect(createdRule).toBeDefined();
    expect(createdRule.status).toBe("ACTIVE");
  });

  it("PATCH /api/v1/advertisements/placement-rules/:id - should update the placement rule", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/placement-rules/${testPlacementRuleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayOrder: 5,
        insertionType: "AFTER_N_ITEMS",
        insertionPosition: 3,
        maxImpressions: 250,
        status: "ACTIVE"
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(testPlacementRuleId);
    expect(response.body.data.displayOrder).toBe(5);
    expect(response.body.data.insertionType).toBe("AFTER_N_ITEMS");
    expect(response.body.data.insertionPosition).toBe(3);
    expect(response.body.data.maxImpressions).toBe(250);
  });

  it("PATCH /api/v1/advertisements/placement-rules/:id - should reject FIXED with insertionPosition", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/placement-rules/${testPlacementRuleId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        insertionType: "FIXED",
        insertionPosition: 2
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/placement-rules - should reject duplicate advertisement and placement", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/placement-rules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId: placementRuleCrudPlacementId,
        displayOrder: 10,
        insertionType: "FIXED",
        insertionPosition: null,
        status: "ACTIVE"
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/placement-rules - should reject missing insertionPosition", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/placement-rules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId: placementRuleCrudPlacementId,
        displayOrder: 10,
        insertionType: "AFTER_N_ITEMS",
        status: "ACTIVE"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/placement-rules - should reject invalid maxImpressions", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/placement-rules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId: placementRuleCrudPlacementId,
        displayOrder: 10,
        insertionType: "FIXED",
        insertionPosition: null,
        maxImpressions: 0,
        status: "ACTIVE"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/placement-rules/:id - should return 404 for an unknown rule", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/placement-rules/999999999")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("DELETE /api/v1/advertisements/placement-rules/:id - should deactivate the placement rule", async () => {
    const response = await request(app)
      .delete(
        `/api/v1/advertisements/placement-rules/${testPlacementRuleId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.status).toBe("INACTIVE");
  });

  it("should verify the placement rule is inactive in the database", async () => {
    const result = await pool.query(
      `
        SELECT
          id,
          status
        FROM advertisement_placement_rules
        WHERE id = $1
        LIMIT 1
      `,
      [testPlacementRuleId]
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].status).toBe("INACTIVE");
  });

  it("DELETE /api/v1/advertisements/placement-rules/:id - should reject a second deactivation", async () => {
    const response = await request(app)
      .delete(
        `/api/v1/advertisements/placement-rules/${testPlacementRuleId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/placement-rules/:id - should still return the inactive rule", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/placement-rules/${testPlacementRuleId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("INACTIVE");
  });

  it("GET /api/v1/advertisements/placement-rules/:id - should require authentication", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/placement-rules/${testPlacementRuleId}`
    );

    expect(response.status).toBe(401);
  });

  it("GET /api/v1/advertisements/placement-rules/:id - should deny access without READ permission", async () => {
    await pool.query(
      `
        DELETE FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, permissionIds.read]
    );

    const response = await request(app)
      .get(
        `/api/v1/advertisements/placement-rules/${testPlacementRuleId}`
      )
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
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionIds.read, testUserId]
    );
  });

  it("GET /api/v1/advertisements/placement-rules - should deny access without READ permission", async () => {
    await pool.query(
      `
        DELETE FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, permissionIds.read]
    );

    const response = await request(app)
      .get("/api/v1/advertisements/placement-rules")
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
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionIds.read, testUserId]
    );
  });

  it("POST /api/v1/advertisements/placement-rules - should deny access without CREATE permission", async () => {
    await pool.query(
      `
        DELETE FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, permissionIds.create]
    );

    const response = await request(app)
      .post("/api/v1/advertisements/placement-rules")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId,
        placementId: placementRuleCrudPlacementId,
        displayOrder: 10,
        insertionType: "FIXED",
        insertionPosition: null,
        status: "ACTIVE"
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
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionIds.create, testUserId]
    );
  });

  it("PATCH /api/v1/advertisements/placement-rules/:id - should deny access without UPDATE permission", async () => {
    await pool.query(
      `
        DELETE FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, permissionIds.update]
    );

    const response = await request(app)
      .patch(
        `/api/v1/advertisements/placement-rules/${testPlacementRuleId}`
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        displayOrder: 10
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
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionIds.update, testUserId]
    );
  });

  it("DELETE /api/v1/advertisements/placement-rules/:id - should deny access without DELETE permission", async () => {
    await pool.query(
      `
        DELETE FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, permissionIds.delete]
    );

    const response = await request(app)
      .delete(
        `/api/v1/advertisements/placement-rules/${testPlacementRuleId}`
      )
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
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `,
      [testRoleId, permissionIds.delete, testUserId]
    );
  });
});