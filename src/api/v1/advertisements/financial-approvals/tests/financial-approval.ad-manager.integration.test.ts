import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Financial Approval - Ad Manager RBAC Boundary", () => {
  let creatorAccessToken = "";
  let managerAccessToken = "";

  let creatorUserId = 0;
  let managerUserId = 0;

  let superAdminRoleId = 0;
  let creatorRoleId = 0;
  let managerRoleId = 0;

  let testClientId = 0;
  let testPlacementId = 0;
  let testAdvertisementId = 0;
  let testApprovalId = 0;

  const timestamp = Date.now();

  const creatorUsername = `financial_approval_ad_manager_creator_${timestamp}`;
  const creatorEmail = `financial-approval-ad-manager-creator-${timestamp}@example.com`;

  const managerUsername = `financial_approval_ad_manager_${timestamp}`;
  const managerEmail = `financial-approval-ad-manager-${timestamp}@example.com`;

  const creatorRoleCode = `TEST_AD_FA_AM_CREATOR_${timestamp}`;
  const managerRoleCode = `TEST_AD_FA_MANAGER_${timestamp}`;

  const testClientCode = `TEST-FA-AM-${timestamp}`;
  const testPlacementCode = `FA_AM_BOUNDARY_${timestamp}`;

  const creatorPassword = "Financial_Approval_Creator@123";
  const managerPassword = "Financial_Approval_Ad_Manager@123";

  const ADVERTISEMENT_RESOURCE = "advertisements";
  const FINANCIAL_APPROVAL_RESOURCE = "advertisements.financial_approvals";

  const creatorPermissionCodes = {
    read: "advertisements.read",
    create: "advertisements.create",
    update: "advertisements.update",
    submit: "advertisements.submit"
  } as const;

  const managerPermissionCodes = {
    read: "advertisements.read"
  } as const;

  const creatorPermissionIds: Record<
    keyof typeof creatorPermissionCodes,
    number
  > = {
    read: 0,
    create: 0,
    update: 0,
    submit: 0
  };

  const managerPermissionIds: Record<
    keyof typeof managerPermissionCodes,
    number
  > = {
    read: 0
  };

  /*
   * ==========================================================================
   * TEST SETUP
   * ==========================================================================
   */

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

    expect(
      superAdminResult.rows.length,
      "Active SUPER_ADMIN role is required for integration-test setup."
    ).toBe(1);

    superAdminRoleId = Number(superAdminResult.rows[0]?.id ?? 0);

    expect(superAdminRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary Ad Creator user.
     * ------------------------------------------------------------------------
     */

    const creatorPasswordHash = await bcrypt.hash(creatorPassword, 12);

    const creatorUserResult = await pool.query(
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
        creatorUsername,
        creatorEmail,
        creatorPasswordHash,
        "Financial Approval Ad Manager Boundary Creator",
        "FA Boundary Creator",
        superAdminRoleId
      ]
    );

    creatorUserId = Number(creatorUserResult.rows[0]?.id ?? 0);

    expect(creatorUserId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary Ad Manager user.
     * ------------------------------------------------------------------------
     */

    const managerPasswordHash = await bcrypt.hash(managerPassword, 12);

    const managerUserResult = await pool.query(
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
        managerUsername,
        managerEmail,
        managerPasswordHash,
        "Financial Approval Ad Manager Boundary User",
        "FA Boundary Ad Manager",
        superAdminRoleId
      ]
    );

    managerUserId = Number(managerUserResult.rows[0]?.id ?? 0);

    expect(managerUserId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary Ad Creator role.
     * ------------------------------------------------------------------------
     */

    const creatorRoleResult = await pool.query(
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
        creatorRoleCode,
        `FA Boundary Ad Creator ${timestamp}`,
        "Financial approval Ad Creator boundary integration-test role.",
        creatorUserId
      ]
    );

    creatorRoleId = Number(creatorRoleResult.rows[0]?.id ?? 0);

    expect(creatorRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary Ad Manager role.
     *
     * This role intentionally receives only advertisements.read.
     *
     * No advertisements.financial_approvals.* permission is attached.
     * ------------------------------------------------------------------------
     */

    const managerRoleResult = await pool.query(
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
        managerRoleCode,
        `FA Boundary Ad Manager ${timestamp}`,
        "Financial approval Ad Manager boundary integration-test role.",
        managerUserId
      ]
    );

    managerRoleId = Number(managerRoleResult.rows[0]?.id ?? 0);

    expect(managerRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Assign Ad Creator role.
     * ------------------------------------------------------------------------
     */

    await pool.query(
      `
      UPDATE users
      SET
        role_id = $2,
        status = 'ACTIVE'
      WHERE id = $1
      `,
      [creatorUserId, creatorRoleId]
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
      [creatorUserId, creatorRoleId]
    );

    /*
     * ------------------------------------------------------------------------
     * Assign Ad Manager role.
     * ------------------------------------------------------------------------
     */

    await pool.query(
      `
      UPDATE users
      SET
        role_id = $2,
        status = 'ACTIVE'
      WHERE id = $1
      `,
      [managerUserId, managerRoleId]
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
      [managerUserId, managerRoleId]
    );

    /*
     * ------------------------------------------------------------------------
     * Resolve existing production Ad Creator permissions.
     *
     * Do not create permission definitions in this test.
     * ------------------------------------------------------------------------
     */

    for (const [key, code] of Object.entries(creatorPermissionCodes) as Array<
      [keyof typeof creatorPermissionCodes, string]
    >) {
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
        [code]
      );

      expect(
        permissionResult.rows.length,
        `Required production permission '${code}' was not found.`
      ).toBe(1);

      const permission = permissionResult.rows[0];

      expect(
        permission?.status,
        `Required production permission '${code}' must be ACTIVE.`
      ).toBe("ACTIVE");

      expect(permission?.module).toBe("ADVERTISEMENT");
      expect(permission?.resource).toBe(ADVERTISEMENT_RESOURCE);
      expect(permission?.action).toBe(key);

      const permissionId = Number(permission?.id ?? 0);

      expect(permissionId).toBeGreaterThan(0);

      creatorPermissionIds[key] = permissionId;

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
        [creatorRoleId, permissionId, creatorUserId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Resolve existing production Ad Manager permission.
     *
     * The manager receives advertisements.read only.
     * ------------------------------------------------------------------------
     */

    for (const [key, code] of Object.entries(managerPermissionCodes) as Array<
      [keyof typeof managerPermissionCodes, string]
    >) {
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
        [code]
      );

      expect(
        permissionResult.rows.length,
        `Required production permission '${code}' was not found.`
      ).toBe(1);

      const permission = permissionResult.rows[0];

      expect(
        permission?.status,
        `Required production permission '${code}' must be ACTIVE.`
      ).toBe("ACTIVE");

      expect(permission?.module).toBe("ADVERTISEMENT");
      expect(permission?.resource).toBe(ADVERTISEMENT_RESOURCE);
      expect(permission?.action).toBe(key);

      const permissionId = Number(permission?.id ?? 0);

      expect(permissionId).toBeGreaterThan(0);

      managerPermissionIds[key] = permissionId;

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
        [managerRoleId, permissionId, managerUserId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Verify the Ad Manager role has exactly the intended production
     * advertisement permission.
     * ------------------------------------------------------------------------
     */

    const managerAdvertisementPermissions = await pool.query(
      `
      SELECT
        p.id,
        p.code,
        p.module,
        p.resource,
        p.action,
        p.status
      FROM role_permissions rp
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE rp.role_id = $1
        AND p.status = 'ACTIVE'
        AND p.resource = $2
      ORDER BY p.id
      `,
      [managerRoleId, ADVERTISEMENT_RESOURCE]
    );

    expect(managerAdvertisementPermissions.rows.length).toBe(1);

    expect(managerAdvertisementPermissions.rows[0]?.code).toBe(
      "advertisements.read"
    );

    /*
     * ------------------------------------------------------------------------
     * Verify the Ad Manager role has no financial approval permissions.
     *
     * This is the core separation-of-duties assertion.
     * ------------------------------------------------------------------------
     */

    const managerFinancialPermissions = await pool.query(
      `
      SELECT
        p.id,
        p.code,
        p.module,
        p.resource,
        p.action,
        p.status
      FROM role_permissions rp
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE rp.role_id = $1
        AND p.status = 'ACTIVE'
        AND p.resource = $2
      ORDER BY p.id
      `,
      [managerRoleId, FINANCIAL_APPROVAL_RESOURCE]
    );

    expect(managerFinancialPermissions.rows.length).toBe(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary advertisement client.
     * ------------------------------------------------------------------------
     */

    const clientResult = await pool.query(
      `
      INSERT INTO advertisement_clients
      (
        client_code,
        name,
        display_name,
        status,
        ad_creation_hold,
        created_by,
        updated_by
      )
      VALUES
      (
        $1,
        $2,
        $3,
        'ACTIVE',
        FALSE,
        $4,
        $4
      )
      RETURNING id
      `,
      [
        testClientCode,
        `Financial Approval Ad Manager Client ${timestamp}`,
        `Financial Approval Ad Manager Client ${timestamp}`,
        creatorUserId
      ]
    );

    testClientId = Number(clientResult.rows[0]?.id ?? 0);

    expect(testClientId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary active advertisement placement.
     *
     * Advertisement creation now requires a valid runtime placement.
     * This placement is intentionally created only for this integration test.
     * ------------------------------------------------------------------------
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
        'HOME',
        'HOME_TOP',
        'FIXED',
        999,
        TRUE,
        TRUE,
        'HIDE',
        NULL,
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
        testPlacementCode,
        `Financial Approval Ad Manager Placement ${timestamp}`,
        "Temporary placement for Ad Manager financial boundary integration tests.",
        creatorUserId
      ]
    );

    testPlacementId = Number(placementResult.rows[0]?.id ?? 0);

    expect(testPlacementId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Login as Ad Creator.
     * ------------------------------------------------------------------------
     */

    const creatorLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: creatorUsername,
        password: creatorPassword
      });

    expect(creatorLoginResponse.status).toBe(200);

    creatorAccessToken = creatorLoginResponse.body.data.tokens.accessToken;

    expect(creatorAccessToken).toBeTruthy();

    /*
     * ------------------------------------------------------------------------
     * Login as Ad Manager.
     * ------------------------------------------------------------------------
     */

    const managerLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: managerUsername,
        password: managerPassword
      });

    expect(managerLoginResponse.status).toBe(200);

    managerAccessToken = managerLoginResponse.body.data.tokens.accessToken;

    expect(managerAccessToken).toBeTruthy();

    /*
     * ------------------------------------------------------------------------
     * Create advertisement through the Ad Creator.
     *
     * placementId is required by the current advertisement creation service.
     * The placement is the runtime delivery placement; it is not a pricing
     * placement and does not bypass the pricing/rate-card rules.
     * ------------------------------------------------------------------------
     */

    const advertisementResponse = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId: testClientId,
        name: `Financial Approval Ad Manager Boundary Advertisement ${timestamp}`,
        internalName: `financial-approval-ad-manager-boundary-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl:
          "https://example.com/financial-approval-ad-manager-boundary-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes:
          "Temporary advertisement for Ad Manager financial boundary tests.",
        advertisementAmount: 50000,
        currencyCode: "INR",
        placementId: testPlacementId
      });

    expect(advertisementResponse.status).toBe(201);
    expect(advertisementResponse.body.success).toBe(true);

    testAdvertisementId = Number(advertisementResponse.body.data.id);

    expect(testAdvertisementId).toBeGreaterThan(0);
    expect(advertisementResponse.body.data.workflowStatus).toBe("DRAFT");

    /*
     * ------------------------------------------------------------------------
     * Verify that the advertisement was persisted against the requested
     * runtime placement.
     *
     * advertisement_placement_rules does not contain an is_active column.
     * The current runtime-placement implementation identifies the persisted
     * rule by advertisement_id + placement_id.
     * ------------------------------------------------------------------------
     */

    const placementRuleResult = await pool.query(
      `
      SELECT
        id,
        advertisement_id,
        placement_id
      FROM advertisement_placement_rules
      WHERE advertisement_id = $1
        AND placement_id = $2
      ORDER BY id DESC
      LIMIT 1
      `,
      [testAdvertisementId, testPlacementId]
    );

    expect(placementRuleResult.rows.length).toBe(1);

    expect(Number(placementRuleResult.rows[0]?.advertisement_id ?? 0)).toBe(
      testAdvertisementId
    );

    expect(Number(placementRuleResult.rows[0]?.placement_id ?? 0)).toBe(
      testPlacementId
    );

    /*
     * ------------------------------------------------------------------------
     * Create a single SUBMITTED financial approval through the Ad Creator.
     *
     * All authorization-boundary tests use this same approval because denied
     * requests must not mutate its workflow state.
     * ------------------------------------------------------------------------
     */

    const approvalResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 5000,
        remarks: "Ad Manager financial boundary integration test."
      });

    expect(approvalResponse.status).toBe(201);
    expect(approvalResponse.body.success).toBe(true);

    testApprovalId = Number(approvalResponse.body.data.id);

    expect(testApprovalId).toBeGreaterThan(0);
    expect(approvalResponse.body.data.status).toBe("SUBMITTED");

    expect(Number(approvalResponse.body.data.requestedBy)).toBe(creatorUserId);
  });

  /*
   * ==========================================================================
   * CLEANUP
   * ==========================================================================
   */

  afterAll(async () => {
    /*
     * ------------------------------------------------------------------------
     * Remove financial approval history.
     * ------------------------------------------------------------------------
     */

    if (testApprovalId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_financial_approval_history
          WHERE approval_id = $1
          `,
          [testApprovalId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove financial approval.
     * ------------------------------------------------------------------------
     */

    if (testApprovalId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_financial_approvals
          WHERE id = $1
          `,
          [testApprovalId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove advertisement.
     *
     * Runtime placement rules are normally removed by the advertisement
     * cascade. They are explicitly removed first as defensive test cleanup.
     * ------------------------------------------------------------------------
     */

    if (testAdvertisementId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_placement_rules
          WHERE advertisement_id = $1
          `,
          [testAdvertisementId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }

      try {
        await pool.query(
          `
          DELETE FROM advertisements
          WHERE id = $1
          `,
          [testAdvertisementId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove temporary placement.
     * ------------------------------------------------------------------------
     */

    if (testPlacementId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_placement_rules
          WHERE placement_id = $1
          `,
          [testPlacementId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }

      try {
        await pool.query(
          `
          DELETE FROM advertisement_placements
          WHERE id = $1
          `,
          [testPlacementId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove client.
     * ------------------------------------------------------------------------
     */

    if (testClientId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_clients
          WHERE id = $1
          `,
          [testClientId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove Ad Creator role permissions.
     * ------------------------------------------------------------------------
     */

    if (creatorRoleId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM role_permissions
          WHERE role_id = $1
          `,
          [creatorRoleId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove Ad Manager role permissions.
     * ------------------------------------------------------------------------
     */

    if (managerRoleId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM role_permissions
          WHERE role_id = $1
          `,
          [managerRoleId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove Ad Creator sessions.
     * ------------------------------------------------------------------------
     */

    if (creatorUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM user_sessions
          WHERE user_id = $1
          `,
          [creatorUserId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove Ad Manager sessions.
     * ------------------------------------------------------------------------
     */

    if (managerUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM user_sessions
          WHERE user_id = $1
          `,
          [managerUserId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove Ad Creator user role assignments.
     * ------------------------------------------------------------------------
     */

    if (creatorUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM user_roles
          WHERE user_id = $1
          `,
          [creatorUserId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove Ad Manager user role assignments.
     * ------------------------------------------------------------------------
     */

    if (managerUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM user_roles
          WHERE user_id = $1
          `,
          [managerUserId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove Ad Creator role.
     * ------------------------------------------------------------------------
     */

    if (creatorRoleId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM roles
          WHERE id = $1
          `,
          [creatorRoleId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove Ad Manager role.
     * ------------------------------------------------------------------------
     */

    if (managerRoleId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM roles
          WHERE id = $1
          `,
          [managerRoleId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove Ad Creator user.
     * ------------------------------------------------------------------------
     */

    if (creatorUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM users
          WHERE id = $1
          `,
          [creatorUserId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove Ad Manager user.
     * ------------------------------------------------------------------------
     */

    if (managerUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM users
          WHERE id = $1
          `,
          [managerUserId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }
  });

  /*
   * ==========================================================================
   * AUTHENTICATION / ACTOR SETUP
   * ==========================================================================
   */

  it("should authenticate the Ad Creator and Ad Manager test actors", () => {
    expect(creatorAccessToken).toBeTruthy();
    expect(managerAccessToken).toBeTruthy();

    expect(creatorUserId).toBeGreaterThan(0);
    expect(managerUserId).toBeGreaterThan(0);
  });

  /*
   * ==========================================================================
   * SEPARATION OF DUTIES
   * ==========================================================================
   */

  it("should deny Ad Manager from creating a financial approval", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 1000,
        remarks: "Ad Manager must not create financial approvals."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("should deny Ad Manager from updating financial approval remarks", async () => {
    const response = await request(app)
      .patch(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}/remarks`
      )
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        approvalRemarks:
          "Ad Manager must not update financial approval remarks."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("should deny Ad Manager from reading financial approval history", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}/history`
      )
      .set("Authorization", `Bearer ${managerAccessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("should deny Ad Manager from placing a financial approval on HOLD", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}/hold`
      )
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        holdReason: "Ad Manager must not place financial approvals on hold."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("should deny Ad Manager from rejecting a financial approval", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}/reject`
      )
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        rejectionReason: "Ad Manager must not reject financial approvals."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("should deny Ad Manager from approving a financial approval", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        approvalRemarks: "Ad Manager must not approve financial approvals."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("should deny Ad Manager from resubmitting a financial approval", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}/resubmit`
      )
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        approvalRemarks: "Ad Manager must not resubmit financial approvals."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * STATE INTEGRITY
   * ==========================================================================
   */

  it("should preserve the financial approval state after all Ad Manager denial attempts", async () => {
    const approvalResult = await pool.query(
      `
        SELECT
          id,
          status,
          requested_by,
          reviewed_by,
          hold_reason,
          rejection_reason
        FROM advertisement_financial_approvals
        WHERE id = $1
        LIMIT 1
        `,
      [testApprovalId]
    );

    expect(approvalResult.rows.length).toBe(1);

    const approval = approvalResult.rows[0];

    expect(Number(approval?.id ?? 0)).toBe(testApprovalId);
    expect(approval?.status).toBe("SUBMITTED");
    expect(Number(approval?.requested_by ?? 0)).toBe(creatorUserId);
    expect(approval?.reviewed_by).toBeNull();
    expect(approval?.hold_reason).toBeNull();
    expect(approval?.rejection_reason).toBeNull();
  });
});