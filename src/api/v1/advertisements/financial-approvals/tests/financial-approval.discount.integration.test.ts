import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Financial Approval Discount Integration", () => {
  let creatorAccessToken = "";
  let financeAccessToken = "";

  let creatorUserId = 0;
  let financeUserId = 0;

  let superAdminRoleId = 0;
  let creatorRoleId = 0;
  let financeRoleId = 0;

  let testClientId = 0;
  let testAdvertisementId = 0;
  let testPlacementId = 0;

  const createdApprovalIds: number[] = [];

  const timestamp = Date.now();

  const creatorUsername = `financial_discount_creator_${timestamp}`;
  const creatorEmail = `financial-discount-creator-${timestamp}@example.com`;

  const financeUsername = `financial_discount_finance_${timestamp}`;
  const financeEmail = `financial-discount-finance-${timestamp}@example.com`;

  const creatorRoleCode = `TEST_AD_FA_DISCOUNT_CREATOR_${timestamp}`;
  const financeRoleCode = `TEST_AD_FA_DISCOUNT_FINANCE_${timestamp}`;

  const testClientCode = `TEST-FA-DISCOUNT-${timestamp}`;
  const testPlacementCode = `TEST-FA-DISCOUNT-PLACEMENT-${timestamp}`;

  const creatorPassword = "Financial_Discount_Creator@123";
  const financePassword = "Financial_Discount_Finance@123";

  const FINANCIAL_APPROVAL_RESOURCE = "advertisements.financial_approvals";

  const ADVERTISEMENT_RESOURCE = "advertisements";

  /*
   * --------------------------------------------------------------------------
   * Production permission codes
   * --------------------------------------------------------------------------
   *
   * Discount approval creation is controlled by advertisements.submit.
   *
   * Financial approval decision actions are controlled by the dedicated
   * financial approval permissions.
   *
   * There are intentionally no:
   *
   *   advertisements.financial_approvals.create
   *   advertisements.financial_approvals.update
   *   advertisements.financial_approvals.resubmit
   */
  const creatorPermissionCodes = {
    read: "advertisements.read",
    create: "advertisements.create",
    update: "advertisements.update",
    submit: "advertisements.submit"
  } as const;

  const financePermissionCodes = {
    read: `${FINANCIAL_APPROVAL_RESOURCE}.read`,
    hold: `${FINANCIAL_APPROVAL_RESOURCE}.hold`,
    reject: `${FINANCIAL_APPROVAL_RESOURCE}.reject`,
    approve: `${FINANCIAL_APPROVAL_RESOURCE}.approve`
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

  const financePermissionIds: Record<
    keyof typeof financePermissionCodes,
    number
  > = {
    read: 0,
    hold: 0,
    reject: 0,
    approve: 0
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

    expect(superAdminResult.rows.length).toBe(1);

    superAdminRoleId = Number(superAdminResult.rows[0]?.id ?? 0);

    expect(superAdminRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary users.
     * ------------------------------------------------------------------------
     */

    const creatorPasswordHash = await bcrypt.hash(creatorPassword, 12);

    const financePasswordHash = await bcrypt.hash(financePassword, 12);

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
        "Financial Discount Creator Test User",
        "Financial Discount Creator",
        superAdminRoleId
      ]
    );

    creatorUserId = Number(creatorUserResult.rows[0]?.id ?? 0);

    expect(creatorUserId).toBeGreaterThan(0);

    const financeUserResult = await pool.query(
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
        financeUsername,
        financeEmail,
        financePasswordHash,
        "Financial Discount Finance Test User",
        "Financial Discount Finance",
        superAdminRoleId
      ]
    );

    financeUserId = Number(financeUserResult.rows[0]?.id ?? 0);

    expect(financeUserId).toBeGreaterThan(0);

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
        `FA Discount Creator ${timestamp}`,
        "Discount financial approval integration-test Ad Creator role.",
        creatorUserId
      ]
    );

    creatorRoleId = Number(creatorRoleResult.rows[0]?.id ?? 0);

    expect(creatorRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary Finance Approver role.
     * ------------------------------------------------------------------------
     */

    const financeRoleResult = await pool.query(
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
        financeRoleCode,
        `FA Discount Finance ${timestamp}`,
        "Discount financial approval integration-test Finance Approver role.",
        financeUserId
      ]
    );

    financeRoleId = Number(financeRoleResult.rows[0]?.id ?? 0);

    expect(financeRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Assign Ad Creator role.
     * ------------------------------------------------------------------------
     */

    await pool.query(
      `
      UPDATE users
      SET role_id = $2
      WHERE id = $1
      `,
      [creatorUserId, creatorRoleId]
    );

    await pool.query(
      `
      DELETE FROM user_roles
      WHERE user_id = $1
      `,
      [creatorUserId]
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
     * Assign Finance Approver role.
     * ------------------------------------------------------------------------
     */

    await pool.query(
      `
      UPDATE users
      SET role_id = $2
      WHERE id = $1
      `,
      [financeUserId, financeRoleId]
    );

    await pool.query(
      `
      DELETE FROM user_roles
      WHERE user_id = $1
      `,
      [financeUserId]
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
      [financeUserId, financeRoleId]
    );

    /*
     * ------------------------------------------------------------------------
     * Resolve Ad Creator production permissions.
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
     * Resolve Finance Approver production permissions.
     * ------------------------------------------------------------------------
     */

    for (const [key, code] of Object.entries(financePermissionCodes) as Array<
      [keyof typeof financePermissionCodes, string]
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
      expect(permission?.resource).toBe(FINANCIAL_APPROVAL_RESOURCE);
      expect(permission?.action).toBe(key);

      const permissionId = Number(permission?.id ?? 0);

      expect(permissionId).toBeGreaterThan(0);

      financePermissionIds[key] = permissionId;

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
        [financeRoleId, permissionId, financeUserId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Verify Ad Creator permissions.
     * ------------------------------------------------------------------------
     */

    const creatorRequiredPermissionIds = Object.values(creatorPermissionIds);

    expect(creatorRequiredPermissionIds).toHaveLength(4);

    const creatorVerification = await pool.query(
      `
      SELECT
        rp.permission_id,
        p.code,
        p.status,
        p.module,
        p.resource,
        p.action
      FROM role_permissions rp
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE rp.role_id = $1
        AND rp.permission_id = ANY($2::INTEGER[])
        AND p.status = 'ACTIVE'
      ORDER BY rp.permission_id
      `,
      [creatorRoleId, creatorRequiredPermissionIds]
    );

    const creatorAttachedPermissionIds = new Set(
      creatorVerification.rows.map((row) => Number(row.permission_id))
    );

    expect(creatorAttachedPermissionIds.size).toBe(4);

    for (const permissionId of creatorRequiredPermissionIds) {
      expect(creatorAttachedPermissionIds.has(permissionId)).toBe(true);
    }

    /*
     * ------------------------------------------------------------------------
     * Verify Finance Approver permissions.
     * ------------------------------------------------------------------------
     */

    const financeRequiredPermissionIds = Object.values(financePermissionIds);

    expect(financeRequiredPermissionIds).toHaveLength(4);

    const financeVerification = await pool.query(
      `
      SELECT
        rp.permission_id,
        p.code,
        p.status,
        p.module,
        p.resource,
        p.action
      FROM role_permissions rp
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE rp.role_id = $1
        AND rp.permission_id = ANY($2::INTEGER[])
        AND p.status = 'ACTIVE'
      ORDER BY rp.permission_id
      `,
      [financeRoleId, financeRequiredPermissionIds]
    );

    const financeAttachedPermissionIds = new Set(
      financeVerification.rows.map((row) => Number(row.permission_id))
    );

    expect(financeAttachedPermissionIds.size).toBe(4);

    for (const permissionId of financeRequiredPermissionIds) {
      expect(financeAttachedPermissionIds.has(permissionId)).toBe(true);
    }

    /*
     * ------------------------------------------------------------------------
     * Create test client.
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
        `Financial Discount Client ${timestamp}`,
        `Financial Discount Client ${timestamp}`,
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
     * The advertisement service persists the runtime relationship through
     * advertisement_placement_rules.
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
        `Financial Discount Test Placement ${timestamp}`,
        "Temporary placement for financial discount integration tests.",
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
     * Login as Finance Approver.
     * ------------------------------------------------------------------------
     */

    const financeLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: financeUsername,
        password: financePassword
      });

    expect(financeLoginResponse.status).toBe(200);

    financeAccessToken = financeLoginResponse.body.data.tokens.accessToken;

    expect(financeAccessToken).toBeTruthy();
  });

  /*
   * ==========================================================================
   * PERMISSION RE-VALIDATION
   * ==========================================================================
   */

  const ensureRequiredPermissions = async (): Promise<void> => {
    /*
     * ------------------------------------------------------------------------
     * Ensure creator role/user remain active.
     * ------------------------------------------------------------------------
     */

    await pool.query(
      `
      UPDATE roles
      SET status = 'ACTIVE'
      WHERE id = $1
      `,
      [creatorRoleId]
    );

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
     * Ensure finance role/user remain active.
     * ------------------------------------------------------------------------
     */

    await pool.query(
      `
      UPDATE roles
      SET status = 'ACTIVE'
      WHERE id = $1
      `,
      [financeRoleId]
    );

    await pool.query(
      `
      UPDATE users
      SET
        role_id = $2,
        status = 'ACTIVE'
      WHERE id = $1
      `,
      [financeUserId, financeRoleId]
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
      [financeUserId, financeRoleId]
    );

    /*
     * ------------------------------------------------------------------------
     * Re-enable required production permissions.
     * ------------------------------------------------------------------------
     */

    const requiredPermissionIds = [
      ...Object.values(creatorPermissionIds),
      ...Object.values(financePermissionIds)
    ];

    expect(requiredPermissionIds).toHaveLength(8);

    await pool.query(
      `
      UPDATE permissions
      SET status = 'ACTIVE'
      WHERE id = ANY($1::INTEGER[])
      `,
      [requiredPermissionIds]
    );

    /*
     * ------------------------------------------------------------------------
     * Reattach creator permissions.
     * ------------------------------------------------------------------------
     */

    for (const permissionId of Object.values(creatorPermissionIds)) {
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
     * Reattach finance permissions.
     * ------------------------------------------------------------------------
     */

    for (const permissionId of Object.values(financePermissionIds)) {
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
        [financeRoleId, permissionId, financeUserId]
      );
    }
  };

  /**
   * Approve a financial approval and handle the legitimate HOLD transition.
   *
   * A first approval attempt can return HOLD when the request requires
   * threshold verification. The Finance Approver must explicitly perform
   * a second approval action to resolve that HOLD.
   *
   * This helper does not bypass threshold enforcement or duplicate-pending
   * validation in the production service.
   */
  const approveFinancialApproval = async (
    approvalId: number,
    approvalRemarks: string
  ) => {
    expect(approvalId).toBeGreaterThan(0);

    const url = `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`;

    let response = await request(app)
      .post(url)
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({ approvalRemarks });

    expect(
      response.status,
      `Initial financial approval attempt failed for approval ${approvalId}: ${JSON.stringify(response.body)}`
    ).toBe(200);

    expect(response.body.success).toBe(true);

    if (response.body.data.status === "HOLD") {
      response = await request(app)
        .post(url)
        .set("Authorization", `Bearer ${financeAccessToken}`)
        .send({ approvalRemarks });

      expect(
        response.status,
        `Resolving HOLD failed for approval ${approvalId}: ${JSON.stringify(response.body)}`
      ).toBe(200);

      expect(response.body.success).toBe(true);
    }

    expect(
      response.body.data.status,
      `Approval ${approvalId} did not reach APPROVED: ${JSON.stringify(response.body.data)}`
    ).toBe("APPROVED");

    expect(Number(response.body.data.id)).toBe(approvalId);
    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);

    return response;
  };

  beforeEach(async () => {
    await ensureRequiredPermissions();
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

    for (const approvalId of createdApprovalIds) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_financial_approval_history
          WHERE approval_id = $1
          `,
          [approvalId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove financial approvals.
     * ------------------------------------------------------------------------
     */

    for (const approvalId of createdApprovalIds) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_financial_approvals
          WHERE id = $1
          `,
          [approvalId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove runtime placement rules.
     *
     * advertisement_placement_rules has no is_active column.
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
    }

    /*
     * ------------------------------------------------------------------------
     * Remove advertisement.
     * ------------------------------------------------------------------------
     */

    if (testAdvertisementId > 0) {
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
     * Remove temporary advertisement placement.
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
     * Remove user roles.
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

    if (financeUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM user_roles
          WHERE user_id = $1
          `,
          [financeUserId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove role permissions.
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

    if (financeRoleId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM role_permissions
          WHERE role_id = $1
          `,
          [financeRoleId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove temporary roles.
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

    if (financeRoleId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM roles
          WHERE id = $1
          `,
          [financeRoleId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove sessions.
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

    if (financeUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM user_sessions
          WHERE user_id = $1
          `,
          [financeUserId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    /*
     * ------------------------------------------------------------------------
     * Remove temporary users.
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

    if (financeUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM users
          WHERE id = $1
          `,
          [financeUserId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }
  });

  /*
   * ==========================================================================
   * AUTHENTICATION
   * ==========================================================================
   */

  it("should authenticate the Ad Creator and Finance Approver", () => {
    expect(creatorAccessToken).toBeTruthy();
    expect(financeAccessToken).toBeTruthy();
  });

  /*
   * ==========================================================================
   * CREATE TEST ADVERTISEMENT
   * ==========================================================================
   */

  it("should create the advertisement used by discount approval tests", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId: testClientId,
        name: `Financial Discount Advertisement ${timestamp}`,
        internalName: `financial-discount-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/financial-discount-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes:
          "Temporary advertisement for financial discount integration tests.",
        advertisementAmount: 50000,
        currencyCode: "INR",
        placementId: testPlacementId
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    testAdvertisementId = Number(response.body.data.id);

    expect(testAdvertisementId).toBeGreaterThan(0);
    expect(response.body.data.workflowStatus).toBe("DRAFT");

    /*
     * ------------------------------------------------------------------------
     * Verify that advertisement creation persisted the runtime placement.
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
  });

  /*
   * ==========================================================================
   * DISCOUNT BY AMOUNT
   * ==========================================================================
   */

  it("should create a DISCOUNT approval using requestedAmount", async () => {
    const requestedAmount = 5000;

    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount,
        remarks: "Discount requested as a fixed amount."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(response.body.data.approvalType).toBe("DISCOUNT");

    expect(Number(response.body.data.requestedAmount)).toBe(requestedAmount);

    expect(response.body.data.requestedPercentage).toBeNull();

    expect(response.body.data.status).toBe("SUBMITTED");

    expect(Number(response.body.data.requestedBy)).toBe(creatorUserId);
  });

  /*
   * ==========================================================================
   * APPROVE AMOUNT DISCOUNT
   * ==========================================================================
   */

  it("should allow Finance Approver to approve a DISCOUNT amount request", async () => {
    const approvalId = createdApprovalIds[createdApprovalIds.length - 1];

    expect(approvalId).toBeGreaterThan(0);

    const approvalRemarks = "Fixed discount amount approved.";

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(Number(response.body.data.id)).toBe(approvalId);

    expect(response.body.data.approvalType).toBe("DISCOUNT");

    expect(response.body.data.status).toBe("APPROVED");

    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);

    expect(response.body.data.approvalRemarks).toBe(approvalRemarks);
  });

  /*
   * ==========================================================================
   * DISCOUNT BY PERCENTAGE
   * ==========================================================================
   */

  it("should create a DISCOUNT approval using requestedPercentage", async () => {
    const requestedPercentage = 15;

    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedPercentage,
        remarks: "Discount requested as a percentage."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(response.body.data.approvalType).toBe("DISCOUNT");

    expect(Number(response.body.data.requestedPercentage)).toBe(
      requestedPercentage
    );

    expect(response.body.data.requestedAmount).toBeNull();

    expect(response.body.data.status).toBe("SUBMITTED");
  });

  /*
   * ==========================================================================
   * APPROVE PERCENTAGE DISCOUNT
   * ==========================================================================
   */

  it("should allow Finance Approver to approve a DISCOUNT percentage request", async () => {
    const approvalId = createdApprovalIds.at(-1);

    if (approvalId === undefined) {
      throw new Error(
        "No financial approval ID is available for the percentage approval test."
      );
    }

    expect(approvalId).toBeGreaterThan(0);

    const approvalRemarks = "Percentage discount approved.";

    const response = await approveFinancialApproval(
      approvalId,
      approvalRemarks
    );

    expect(response.body.data.approvalType).toBe("DISCOUNT");
    expect(response.body.data.approvalRemarks).toBe(approvalRemarks);
  });

  /*
   * ==========================================================================
   * ZERO PERCENTAGE
   * ==========================================================================
   */

  it("should accept a DISCOUNT requestedPercentage of zero", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedPercentage: 0,
        remarks: "Zero percentage boundary validation."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(Number(response.body.data.requestedPercentage)).toBe(0);

    expect(response.body.data.requestedAmount).toBeNull();

    /*
     * Approve the request so the advertisement does not retain
     * a pending financial approval for subsequent tests.
     */
    const approveResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Zero percentage boundary approved."
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  /*
   * ==========================================================================
   * ONE HUNDRED PERCENTAGE
   * ==========================================================================
   */

  it("should accept a DISCOUNT requestedPercentage of 100", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedPercentage: 100,
        remarks: "Maximum percentage boundary validation."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(Number(response.body.data.requestedPercentage)).toBe(100);

    await approveFinancialApproval(
      approvalId,
      "Maximum percentage boundary approved."
    );
  });

  /*
   * ==========================================================================
   * PERCENTAGE ABOVE MAXIMUM
   * ==========================================================================
   */

  it("should reject a DISCOUNT requestedPercentage greater than 100", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedPercentage: 100.01,
        remarks: "Percentage above allowed maximum."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * NEGATIVE PERCENTAGE
   * ==========================================================================
   */

  it("should reject a DISCOUNT requestedPercentage below zero", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedPercentage: -1,
        remarks: "Negative discount percentage validation."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * ZERO AMOUNT
   * ==========================================================================
   */

  it("should reject a DISCOUNT requestedAmount of zero", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 0,
        remarks: "Zero discount amount validation."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * NEGATIVE AMOUNT
   * ==========================================================================
   */

  it("should reject a DISCOUNT requestedAmount below zero", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: -500,
        remarks: "Negative discount amount validation."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * BOTH AMOUNT AND PERCENTAGE
   * ==========================================================================
   */

  it("should reject a DISCOUNT request containing both amount and percentage", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 5000,
        requestedPercentage: 10,
        remarks: "Both amount and percentage supplied."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * NEITHER AMOUNT NOR PERCENTAGE
   * ==========================================================================
   */

  it("should reject a DISCOUNT request without amount or percentage", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        remarks: "Missing discount amount and percentage."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * OPTIONAL PAYMENT ID
   * ==========================================================================
   */

  it("should allow a DISCOUNT approval without paymentId", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 2500,
        remarks: "Discount approval without payment linkage."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(response.body.data.paymentId).toBeNull();

    const approveResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Discount approved without payment linkage."
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  /*
   * ==========================================================================
   * REMARKS NORMALIZATION
   * ==========================================================================
   */

  it("should trim DISCOUNT approval remarks", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 1500,
        remarks: "   Discount remarks with surrounding whitespace.   "
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(response.body.data.approvalRemarks).toBeNull();

    const remarksResponse = await request(app)
      .patch(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/remarks`
      )
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        approvalRemarks: "   Discount remarks with surrounding whitespace.   "
      });

    expect(remarksResponse.status).toBe(200);
    expect(remarksResponse.body.success).toBe(true);
    expect(remarksResponse.body.data.approvalRemarks).toBe(
      "Discount remarks with surrounding whitespace."
    );

    const approvalResult = await pool.query(
      `
        SELECT approval_remarks
        FROM advertisement_financial_approvals
        WHERE id = $1
        LIMIT 1
      `,
      [approvalId]
    );

    expect(approvalResult.rows.length).toBe(1);
    expect(approvalResult.rows[0]?.approval_remarks).toBe(
      "Discount remarks with surrounding whitespace."
    );

    const approveResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Discount remarks normalization approved."
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  /*
   * ==========================================================================
   * DUPLICATE PENDING DISCOUNT
   * ==========================================================================
   */

  it("should reject a second pending DISCOUNT approval for the same advertisement", async () => {
    const firstResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 3000,
        remarks: "First pending discount approval."
      });

    expect(firstResponse.status).toBe(201);
    expect(firstResponse.body.success).toBe(true);

    const firstApprovalId = Number(firstResponse.body.data.id);

    expect(firstApprovalId).toBeGreaterThan(0);

    createdApprovalIds.push(firstApprovalId);

    expect(firstResponse.body.data.status).toBe("SUBMITTED");

    const secondResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedPercentage: 20,
        remarks: "Second pending discount approval."
      });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.success).toBe(false);

    /*
     * Approve the first request so later tests can continue.
     */
    const approveResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${firstApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "First pending discount approved."
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  /*
   * ==========================================================================
   * FINANCE APPROVER AUTHORITY
   * ==========================================================================
   */

  it("should allow Finance Approver to read a DISCOUNT approval", async () => {
    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedPercentage: 25,
        remarks: "Discount approval read authorization test."
      });

    expect(
      createResponse.status,
      `Could not create the read-test approval: ${JSON.stringify(createResponse.body)}`
    ).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    expect(approvalId).toBeGreaterThan(0);
    createdApprovalIds.push(approvalId);

    const response = await request(app)
      .get(`/api/v1/advertisements/payments/financial-approval/${approvalId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.id)).toBe(approvalId);
    expect(response.body.data.approvalType).toBe("DISCOUNT");
    expect(Number(response.body.data.requestedPercentage)).toBe(25);

    // Resolve SUBMITTED/HOLD before the next test reuses this advertisement.
    const approveResponse = await approveFinancialApproval(
      approvalId,
      "Discount read authorization test approved."
    );

    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  /*
   * ==========================================================================
   * CREATOR CANNOT FINANCIALLY APPROVE
   * ==========================================================================
   */

  it("should deny Ad Creator from approving a DISCOUNT request", async () => {
    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 4000,
        remarks: "Creator financial approval authorization test."
      });

    expect(createResponse.status).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    createdApprovalIds.push(approvalId);

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        approvalRemarks: "Ad Creator must not approve financial discount."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);

    /*
     * Finance Approver approves the request so the test does not leave
     * a pending financial approval behind.
     */
    const financeResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Creator authorization boundary test completed."
      });

    expect(financeResponse.status).toBe(200);
  });

  /*
   * ==========================================================================
   * FINANCIAL APPROVAL HISTORY
   * ==========================================================================
   */

  it("should record SUBMITTED and APPROVED history for a DISCOUNT approval", async () => {
    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 4500,
        remarks: "Discount history integration test."
      });

    expect(
      createResponse.status,
      `Could not create the history-test approval: ${JSON.stringify(createResponse.body)}`
    ).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    expect(approvalId).toBeGreaterThan(0);
    createdApprovalIds.push(approvalId);

    const historyUrl = `/api/v1/advertisements/payments/financial-approval/${approvalId}/history`;

    const submittedHistoryResponse = await request(app)
      .get(historyUrl)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(submittedHistoryResponse.status).toBe(200);
    expect(submittedHistoryResponse.body.success).toBe(true);
    expect(Array.isArray(submittedHistoryResponse.body.data)).toBe(true);

    const submittedHistory = submittedHistoryResponse.body.data;

    expect(
      submittedHistory.some(
        (item: {
          fromStatus: string | null;
          toStatus: string;
          actionBy: number | string;
        }) =>
          item.fromStatus === null &&
          item.toStatus === "SUBMITTED" &&
          Number(item.actionBy) === creatorUserId
      )
    ).toBe(true);

    // Use the existing helper so a legitimate HOLD transition is resolved.
    const approveResponse = await approveFinancialApproval(
      approvalId,
      "Discount history approval."
    );

    expect(approveResponse.body.data.status).toBe("APPROVED");

    const finalHistoryResponse = await request(app)
      .get(historyUrl)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(finalHistoryResponse.status).toBe(200);
    expect(finalHistoryResponse.body.success).toBe(true);

    const finalHistory = finalHistoryResponse.body.data;

    expect(
      finalHistory.some(
        (item: {
          fromStatus: string | null;
          toStatus: string;
          actionBy: number | string;
          remarks: string | null;
        }) =>
          item.fromStatus === "SUBMITTED" &&
          item.toStatus === "APPROVED" &&
          Number(item.actionBy) === financeUserId &&
          item.remarks === "Discount history approval."
      )
    ).toBe(true);
  });

  /*
   * ==========================================================================
   * FINAL DATABASE VALIDATION
   * ==========================================================================
   */

  it("should persist DISCOUNT approval records with correct final status", async () => {
    const approvalIds = [...new Set(createdApprovalIds)];

    expect(approvalIds.length).toBeGreaterThan(0);

    // Resolve any approvals left pending by earlier test cases.
    const pendingResult = await pool.query(
      `
      SELECT id, status
      FROM advertisement_financial_approvals
      WHERE id = ANY($1::INTEGER[])
        AND approval_type = 'DISCOUNT'
        AND status IN ('SUBMITTED', 'HOLD')
      ORDER BY id
    `,
      [approvalIds]
    );

    for (const row of pendingResult.rows) {
      const approvalId = Number(row.id);

      await approveFinancialApproval(
        approvalId,
        "Final database validation approval."
      );
    }

    const result = await pool.query(
      `
      SELECT
        id,
        advertisement_id,
        client_id,
        approval_type,
        requested_amount,
        requested_percentage,
        status,
        requested_by,
        reviewed_by
      FROM advertisement_financial_approvals
      WHERE id = ANY($1::INTEGER[])
        AND approval_type = 'DISCOUNT'
      ORDER BY id
    `,
      [approvalIds]
    );

    expect(result.rows.length).toBeGreaterThan(0);

    for (const row of result.rows) {
      expect(Number(row.advertisement_id)).toBe(testAdvertisementId);
      expect(Number(row.client_id)).toBe(testClientId);
      expect(row.approval_type).toBe("DISCOUNT");
      expect(Number(row.requested_by)).toBe(creatorUserId);
      expect(row.status).toBe("APPROVED");
      expect(Number(row.reviewed_by)).toBe(financeUserId);

      const hasAmount = row.requested_amount !== null;
      const hasPercentage = row.requested_percentage !== null;

      expect(hasAmount !== hasPercentage).toBe(true);
    }
  });
});
