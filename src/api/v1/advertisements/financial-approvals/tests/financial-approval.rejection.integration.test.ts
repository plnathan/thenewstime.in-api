import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Financial Approval Rejection API Integration", () => {
  let creatorAccessToken = "";
  let financeAccessToken = "";

  let creatorUserId = 0;
  let financeUserId = 0;

  let superAdminRoleId = 0;
  let creatorRoleId = 0;
  let financeRoleId = 0;

  let testClientId = 0;
  let testPlacementId = 0;
  let testAdvertisementId = 0;

  let submittedApprovalId = 0;
  let holdApprovalId = 0;
  let rejectedApprovalId = 0;

  const timestamp = Date.now();

  const creatorUsername = `financial_approval_rejection_creator_${timestamp}`;
  const creatorEmail = `financial-approval-rejection-creator-${timestamp}@example.com`;

  const financeUsername = `financial_approval_rejection_finance_${timestamp}`;
  const financeEmail = `financial-approval-rejection-finance-${timestamp}@example.com`;

  const creatorRoleCode = `TEST_AD_FA_REJECTION_CREATOR_${timestamp}`;
  const financeRoleCode = `TEST_AD_FA_REJECTION_FINANCE_${timestamp}`;

  const testClientCode = `FAR-${timestamp}`;
  const testPlacementCode = `FAR_REJECTION_${timestamp}`;

  const creatorPassword = "Financial_Approval_Rejection_Creator@123";
  const financePassword = "Financial_Approval_Rejection_Finance@123";

  const FINANCIAL_APPROVAL_RESOURCE = "advertisements.financial_approvals";

  const ADVERTISEMENT_RESOURCE = "advertisements";

  /*
   * ==========================================================================
   * PRODUCTION PERMISSION CODES
   * ==========================================================================
   *
   * Financial approval creation is controlled by advertisements.submit.
   *
   * Financial approval rejection is controlled by:
   *
   *   advertisements.financial_approvals.reject
   *
   * The test intentionally does not create production permission definitions.
   * It only resolves the existing production permissions and attaches them to
   * temporary test roles.
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
   * HELPERS
   * ==========================================================================
   */

  const cleanupApproval = async (approvalId: number): Promise<void> => {
    if (approvalId <= 0) {
      return;
    }

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
  };

  const createFinancialApproval = async (
    approvalType: string,
    requestedAmount: number,
    remarks: string
  ): Promise<number> => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType,
        requestedAmount,
        remarks
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);
    expect(response.body.data.status).toBe("SUBMITTED");

    return approvalId;
  };

  const rejectApproval = async (
    approvalId: number,
    rejectionReason: string
  ) => {
    return request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason
      });
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
        "Financial Approval Rejection Creator Test User",
        "Financial Approval Rejection Creator",
        superAdminRoleId
      ]
    );

    creatorUserId = Number(creatorUserResult.rows[0]?.id ?? 0);

    expect(creatorUserId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary Finance Approver user.
     * ------------------------------------------------------------------------
     */

    const financePasswordHash = await bcrypt.hash(financePassword, 12);

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
        "Financial Approval Rejection Finance Test User",
        "Financial Approval Rejection Finance",
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
        `FA Rejection Ad Creator ${timestamp}`,
        "Financial approval rejection integration-test Ad Creator role.",
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
        `FA Rejection Finance Approver ${timestamp}`,
        "Financial approval rejection integration-test Finance Approver role.",
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
     * Resolve and attach Ad Creator permissions.
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
     * Resolve and attach Finance Approver permissions.
     * ------------------------------------------------------------------------
     *
     * The Finance Approver role requires all four production permissions:
     *
     *   advertisements.financial_approvals.read
     *   advertisements.financial_approvals.hold
     *   advertisements.financial_approvals.reject
     *   advertisements.financial_approvals.approve
     *
     * HOLD is required because this rejection suite explicitly tests:
     *
     *   SUBMITTED -> HOLD -> REJECTED
     *
     * APPROVE is also retained because the Finance Approver role fixture
     * mirrors the production financial-approval permission set.
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

    /*
     * FIX:
     *
     * Finance Approver now has four required permissions:
     *
     *   read
     *   hold
     *   reject
     *   approve
     */
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
     * Create test advertisement client.
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
        `Financial Approval Rejection Client ${timestamp}`,
        `Financial Approval Rejection Client ${timestamp}`,
        creatorUserId
      ]
    );

    testClientId = Number(clientResult.rows[0]?.id ?? 0);

    expect(testClientId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary advertisement placement.
     * ------------------------------------------------------------------------
     *
     * Advertisement creation now requires a persisted runtime placement.
     * The placement is intentionally created as an isolated test fixture and
     * is assigned to the advertisement through placementId below.
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
        `Financial Approval Rejection Placement ${timestamp}`,
        "Temporary placement for financial approval rejection integration tests.",
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
     * Ensure temporary roles and users remain active.
     * ------------------------------------------------------------------------
     */

    await pool.query(
      `
      UPDATE roles
      SET status = 'ACTIVE'
      WHERE id IN ($1, $2)
      `,
      [creatorRoleId, financeRoleId]
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
      UPDATE users
      SET
        role_id = $2,
        status = 'ACTIVE'
      WHERE id = $1
      `,
      [financeUserId, financeRoleId]
    );

    /*
     * ------------------------------------------------------------------------
     * Ensure required production permissions remain active.
     * ------------------------------------------------------------------------
     *
     * 4 Ad Creator permissions
     * +
     * 4 Finance Approver permissions
     * =
     * 8 total permissions.
     */

    const requiredPermissionIds = [
      ...Object.values(creatorPermissionIds),
      ...Object.values(financePermissionIds)
    ];

    /*
     * FIX:
     *
     * The previous assertion expected 6 permissions even though the Finance
     * Approver fixture now contains four permissions.
     */
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
     * Reattach Ad Creator permissions.
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
     * Reattach Finance Approver permissions.
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
     * Remove all financial approvals created by this suite.
     * ------------------------------------------------------------------------
     */

    const approvalIds = [
      submittedApprovalId,
      holdApprovalId,
      rejectedApprovalId
    ].filter((id, index, array) => id > 0 && array.indexOf(id) === index);

    for (const approvalId of approvalIds) {
      await cleanupApproval(approvalId);
    }

    /*
     * ------------------------------------------------------------------------
     * Remove advertisement.
     * ------------------------------------------------------------------------
     *
     * The advertisement owns a runtime placement rule, so the rule must be
     * removed before deleting the advertisement placement.
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
     * Remove test advertisement placement.
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
     * Remove creator role permissions.
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
     * Remove finance role permissions.
     * ------------------------------------------------------------------------
     */

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
     * Remove creator sessions.
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
     * Remove finance sessions.
     * ------------------------------------------------------------------------
     */

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
     * Remove creator user roles.
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
     * Remove finance user roles.
     * ------------------------------------------------------------------------
     */

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
     * Remove creator role.
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
     * Remove finance role.
     * ------------------------------------------------------------------------
     */

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
     * Remove creator user.
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
     * Remove finance user.
     * ------------------------------------------------------------------------
     */

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

  it("should have valid Ad Creator and Finance Approver authentication tokens", () => {
    expect(creatorAccessToken).toBeTruthy();
    expect(financeAccessToken).toBeTruthy();
  });

  it("POST /financial-approval/:id/reject - should require authentication", async () => {
    const response = await request(app).post(
      "/api/v1/advertisements/payments/financial-approval/1/reject"
    );

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * CREATE TEST ADVERTISEMENT
   * ==========================================================================
   */

  it("should create the advertisement used by rejection tests", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId: testClientId,
        name: `Financial Approval Rejection Advertisement ${timestamp}`,
        internalName: `financial-approval-rejection-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl:
          "https://example.com/financial-approval-rejection-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes:
          "Temporary advertisement for financial approval rejection tests.",
        advertisementAmount: 50000,
        currencyCode: "INR",
        placementId: testPlacementId
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    testAdvertisementId = Number(response.body.data.id);

    expect(testAdvertisementId).toBeGreaterThan(0);
    expect(response.body.data.workflowStatus).toBe("DRAFT");
  });

  /*
   * ==========================================================================
   * SUBMITTED → REJECTED
   * ==========================================================================
   */

  it("POST /financial-approval - should create a SUBMITTED approval for rejection", async () => {
    submittedApprovalId = await createFinancialApproval(
      "REFUND",
      3000,
      "Refund rejection workflow test."
    );

    expect(submittedApprovalId).toBeGreaterThan(0);
  });

  it("POST /financial-approval/:id/reject - should allow Finance Approver to reject a SUBMITTED approval", async () => {
    const rejectionReason =
      "Requested financial adjustment was not accepted.";

    const response = await rejectApproval(
      submittedApprovalId,
      rejectionReason
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    expect(Number(response.body.data.id)).toBe(submittedApprovalId);

    expect(response.body.data.status).toBe("REJECTED");

    expect(response.body.data.rejectionReason).toBe(rejectionReason);

    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);

    expect(response.body.data.reviewedAt).toBeDefined();

    rejectedApprovalId = submittedApprovalId;
  });

  it("POST /financial-approval/:id/reject - should persist the rejection in the database", async () => {
    const result = await pool.query(
      `
      SELECT
        id,
        status,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        hold_reason
      FROM advertisement_financial_approvals
      WHERE id = $1
      `,
      [rejectedApprovalId]
    );

    expect(result.rows.length).toBe(1);

    const approval = result.rows[0];

    expect(approval?.status).toBe("REJECTED");
    expect(Number(approval?.reviewed_by)).toBe(financeUserId);

    expect(approval?.reviewed_at).toBeDefined();

    expect(approval?.rejection_reason).toBe(
      "Requested financial adjustment was not accepted."
    );

    expect(approval?.hold_reason).toBeNull();
  });

  it("GET /financial-approval/:id/history - should record the SUBMITTED to REJECTED transition", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${rejectedApprovalId}/history`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const history = response.body.data as Array<{
      fromStatus: string | null;
      toStatus: string;
      actionBy: number | string;
      actionAt: string;
      rejectionReason: string | null;
    }>;

    const rejectionHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "REJECTED"
    );

    expect(rejectionHistory).toBeDefined();

    expect(Number(rejectionHistory?.actionBy)).toBe(financeUserId);

    expect(rejectionHistory?.rejectionReason).toBe(
      "Requested financial adjustment was not accepted."
    );

    expect(rejectionHistory?.actionAt).toBeDefined();
  });

  /*
   * ==========================================================================
   * REJECTED STATE RESTRICTIONS
   * ==========================================================================
   */

  it("POST /financial-approval/:id/reject - should reject a second rejection attempt", async () => {
    const response = await rejectApproval(
      rejectedApprovalId,
      "Second rejection attempt."
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /financial-approval/:id/reject - should reject rejection from a nonexistent approval", async () => {
    const response = await rejectApproval(
      999999999,
      "Approval does not exist."
    );

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * HOLD → REJECTED
   * ==========================================================================
   */

  it("POST /financial-approval - should create a separate approval for HOLD to REJECTED testing", async () => {
    holdApprovalId = await createFinancialApproval(
      "ADJUSTMENT",
      2000,
      "Hold to rejection workflow test."
    );

    expect(holdApprovalId).toBeGreaterThan(0);
  });

  it("POST /financial-approval/:id/hold - should place the approval on HOLD before rejection", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/hold`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        holdReason: "Additional client information is required."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(Number(response.body.data.id)).toBe(holdApprovalId);

    expect(response.body.data.status).toBe("HOLD");

    expect(response.body.data.holdReason).toBe(
      "Additional client information is required."
    );
  });

  it("POST /financial-approval/:id/reject - should allow Finance Approver to reject a HOLD approval", async () => {
    const rejectionReason =
      "Required client information was not received.";

    const response = await rejectApproval(
      holdApprovalId,
      rejectionReason
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(Number(response.body.data.id)).toBe(holdApprovalId);

    expect(response.body.data.status).toBe("REJECTED");

    expect(response.body.data.rejectionReason).toBe(rejectionReason);

    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);

    expect(response.body.data.reviewedAt).toBeDefined();
  });

  it("GET /financial-approval/:id/history - should record HOLD to REJECTED history", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/history`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const history = response.body.data as Array<{
      fromStatus: string | null;
      toStatus: string;
      actionBy: number | string;
      rejectionReason: string | null;
      holdReason: string | null;
    }>;

    const holdHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "HOLD"
    );

    const rejectionHistory = history.find(
      (item) => item.fromStatus === "HOLD" && item.toStatus === "REJECTED"
    );

    expect(holdHistory).toBeDefined();
    expect(rejectionHistory).toBeDefined();

    expect(Number(holdHistory?.actionBy)).toBe(financeUserId);

    expect(Number(rejectionHistory?.actionBy)).toBe(financeUserId);

    expect(rejectionHistory?.rejectionReason).toBe(
      "Required client information was not received."
    );
  });

  /*
   * ==========================================================================
   * REQUIRED REJECTION REASON
   * ==========================================================================
   */

  it("POST /financial-approval/:id/reject - should reject an empty rejection reason", async () => {
    const approvalId = await createFinancialApproval(
      "REFUND",
      1250,
      "Empty rejection reason validation test."
    );

    const response = await rejectApproval(approvalId, "   ");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    /*
     * Verify that the approval remains SUBMITTED.
     */

    const result = await pool.query(
      `
      SELECT
        status,
        rejection_reason,
        reviewed_by,
        reviewed_at
      FROM advertisement_financial_approvals
      WHERE id = $1
      `,
      [approvalId]
    );

    expect(result.rows.length).toBe(1);

    const approval = result.rows[0];

    expect(approval?.status).toBe("SUBMITTED");
    expect(approval?.rejection_reason).toBeNull();
    expect(approval?.reviewed_by).toBeNull();
    expect(approval?.reviewed_at).toBeNull();

    await cleanupApproval(approvalId);
  });

  it("POST /financial-approval/:id/reject - should reject a missing rejection reason", async () => {
    const approvalId = await createFinancialApproval(
      "REFUND",
      1300,
      "Missing rejection reason validation test."
    );

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    const result = await pool.query(
      `
      SELECT
        status,
        rejection_reason,
        reviewed_by,
        reviewed_at
      FROM advertisement_financial_approvals
      WHERE id = $1
      `,
      [approvalId]
    );

    expect(result.rows.length).toBe(1);

    const approval = result.rows[0];

    expect(approval?.status).toBe("SUBMITTED");
    expect(approval?.rejection_reason).toBeNull();
    expect(approval?.reviewed_by).toBeNull();
    expect(approval?.reviewed_at).toBeNull();

    await cleanupApproval(approvalId);
  });

  /*
   * ==========================================================================
   * REJECTION REASON NORMALIZATION
   * ==========================================================================
   */

  it("POST /financial-approval/:id/reject - should trim surrounding whitespace from the rejection reason", async () => {
    const approvalId = await createFinancialApproval(
      "DISCOUNT",
      1800,
      "Rejection reason normalization test."
    );

    const response = await rejectApproval(
      approvalId,
      "   Discount request is not acceptable.   "
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.rejectionReason).toBe(
      "Discount request is not acceptable."
    );

    const result = await pool.query(
      `
      SELECT rejection_reason
      FROM advertisement_financial_approvals
      WHERE id = $1
      `,
      [approvalId]
    );

    expect(result.rows.length).toBe(1);

    expect(result.rows[0]?.rejection_reason).toBe(
      "Discount request is not acceptable."
    );

    await cleanupApproval(approvalId);
  });

  /*
   * ==========================================================================
   * RBAC
   * ==========================================================================
   */

  it("POST /financial-approval/:id/reject - should deny Ad Creator from rejecting a financial approval", async () => {
    const approvalId = await createFinancialApproval(
      "DISCOUNT",
      1500,
      "Creator rejection authorization test."
    );

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/reject`
      )
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        rejectionReason: "Ad Creator should not reject financial approvals."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);

    const result = await pool.query(
      `
      SELECT status
      FROM advertisement_financial_approvals
      WHERE id = $1
      `,
      [approvalId]
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.status).toBe("SUBMITTED");

    await cleanupApproval(approvalId);
  });

  it("POST /financial-approval/:id/reject - should require the dedicated reject permission", async () => {
    const approvalId = await createFinancialApproval(
      "DISCOUNT",
      1600,
      "Dedicated rejection permission test."
    );

    /*
     * Temporarily remove only the rejection permission from the Finance
     * Approver test role.
     */
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [financeRoleId, financePermissionIds.reject]
    );

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason: "Finance rejection permission boundary test."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);

    /*
     * Restore the permission immediately.
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
      [financeRoleId, financePermissionIds.reject, financeUserId]
    );

    await cleanupApproval(approvalId);
  });

  /*
   * ==========================================================================
   * REJECTED APPROVAL CANNOT BE REJECTED AGAIN
   * ==========================================================================
   */

  it("POST /financial-approval/:id/reject - should preserve the original rejection after a second rejection attempt", async () => {
    const approvalId = await createFinancialApproval(
      "ADJUSTMENT",
      2200,
      "Repeated rejection persistence test."
    );

    const firstReason =
      "First rejection reason must remain unchanged.";

    const firstResponse = await rejectApproval(
      approvalId,
      firstReason
    );

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.data.status).toBe("REJECTED");

    const secondResponse = await rejectApproval(
      approvalId,
      "Second rejection reason must not overwrite the first."
    );

    expect(secondResponse.status).toBe(400);
    expect(secondResponse.body.success).toBe(false);

    const result = await pool.query(
      `
      SELECT
        status,
        rejection_reason,
        reviewed_by
      FROM advertisement_financial_approvals
      WHERE id = $1
      `,
      [approvalId]
    );

    expect(result.rows.length).toBe(1);

    expect(result.rows[0]?.status).toBe("REJECTED");

    expect(result.rows[0]?.rejection_reason).toBe(firstReason);

    expect(Number(result.rows[0]?.reviewed_by)).toBe(financeUserId);

    await cleanupApproval(approvalId);
  });

  /*
   * ==========================================================================
   * FINAL REJECTION HISTORY VALIDATION
   * ==========================================================================
   */

  it("GET /financial-approval/:id/history - should preserve chronological history for a rejected approval", async () => {
    const approvalId = await createFinancialApproval(
      "REFUND",
      2750,
      "Chronological rejection history test."
    );

    const rejectionReason =
      "Refund request failed financial verification.";

    const rejectResponse = await rejectApproval(
      approvalId,
      rejectionReason
    );

    expect(rejectResponse.status).toBe(200);

    const historyResponse = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/history`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.success).toBe(true);

    const history = historyResponse.body.data as Array<{
      fromStatus: string | null;
      toStatus: string;
      actionBy: number | string;
      actionAt: string;
      rejectionReason: string | null;
    }>;

    expect(history.length).toBeGreaterThanOrEqual(2);

    const initialHistory = history.find(
      (item) => item.fromStatus === null && item.toStatus === "SUBMITTED"
    );

    const rejectionHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "REJECTED"
    );

    expect(initialHistory).toBeDefined();
    expect(rejectionHistory).toBeDefined();

    expect(Number(initialHistory?.actionBy)).toBe(creatorUserId);

    expect(Number(rejectionHistory?.actionBy)).toBe(financeUserId);

    expect(rejectionHistory?.rejectionReason).toBe(rejectionReason);

    expect(initialHistory?.actionAt).toBeDefined();

    expect(rejectionHistory?.actionAt).toBeDefined();

    expect(
      new Date(rejectionHistory?.actionAt ?? "").getTime()
    ).toBeGreaterThanOrEqual(
      new Date(initialHistory?.actionAt ?? "").getTime()
    );

    await cleanupApproval(approvalId);
  });
});