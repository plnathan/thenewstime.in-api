import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Financial Approval Financial Workflow API Integration", () => {
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

  let holdApprovalId = 0;
  let rejectApprovalId = 0;
  let directRejectApprovalId = 0;

  const timestamp = Date.now();

  const creatorUsername = `financial_approval_creator_${timestamp}`;
  const creatorEmail = `financial-approval-creator-${timestamp}@example.com`;

  const financeUsername = `financial_approval_finance_${timestamp}`;
  const financeEmail = `financial-approval-finance-${timestamp}@example.com`;

  const creatorRoleCode = `TEST_AD_FA_CREATOR_WF_${timestamp}`;
  const financeRoleCode = `TEST_AD_FA_FINANCE_WF_${timestamp}`;

  const testClientCode = `TEST-FA-WF-${timestamp}`;
  const testPlacementCode = `TEST-FA-WF-PLACEMENT-${timestamp}`;

  const creatorPassword = "Financial_Approval_Creator@123";
  const financePassword = "Financial_Approval_Finance@123";

  /*
   * Financial approval RBAC resource.
   *
   * This must match the production permission resource used by
   * financial-approval.routes.ts.
   */
  const FINANCIAL_APPROVAL_RESOURCE = "advertisements.financial_approvals";

  const ADVERTISEMENT_RESOURCE = "advertisements";

  /*
   * --------------------------------------------------------------------------
   * Production permission codes
   * --------------------------------------------------------------------------
   *
   * IMPORTANT:
   *
   * These are resolved from the production permissions table.
   *
   * This test intentionally does NOT create:
   *
   *   advertisements.financial_approvals.create
   *   advertisements.financial_approvals.update
   *   advertisements.financial_approvals.resubmit
   *
   * Creation/resubmission are controlled by advertisements.submit and
   * remarks update is controlled by advertisements.update.
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
     *
     * Both users are initially created with SUPER_ADMIN as role_id so the
     * insert remains compatible with schemas where users.role_id is required.
     * They are immediately moved to their dedicated test roles below.
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
        "Financial Approval Creator Test User",
        "Financial Approval Creator",
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
        "Financial Approval Finance Test User",
        "Financial Approval Finance",
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
        `FA Workflow Ad Creator ${timestamp}`,
        "Financial approval workflow integration-test Ad Creator role.",
        creatorUserId
      ]
    );

    creatorRoleId = Number(creatorRoleResult.rows[0]?.id ?? 0);

    expect(creatorRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary Ad Finance Approver role.
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
        `FA Workflow Finance Approver ${timestamp}`,
        "Financial approval workflow integration-test Finance Approver role.",
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
     * Assign Ad Finance Approver role.
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
     * Resolve production Ad Creator permissions.
     *
     * These permission records must already exist in the production security
     * module. The integration test must not create fake production permissions.
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
     * Resolve production Ad Finance Approver permissions.
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
     * Verify Ad Creator role permissions.
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
     * Verify Finance Approver role permissions.
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
        `Financial Approval Workflow Client ${timestamp}`,
        `Financial Approval Workflow Client ${timestamp}`,
        creatorUserId
      ]
    );

    testClientId = Number(clientResult.rows[0]?.id ?? 0);

    expect(testClientId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary active advertisement placement.
     *
     * Advertisement creation now requires a persisted runtime placement.
     * The placement itself must therefore exist before any advertisement is
     * created by this suite.
     *
     * IMPORTANT:
     *
     * advertisement_placement_rules does not contain an is_active column.
     * Runtime placement is represented by the rule row itself.
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
        `Financial Approval Workflow Placement ${timestamp}`,
        "Temporary placement for financial approval workflow integration tests.",
        creatorUserId
      ]
    );

    testPlacementId = Number(placementResult.rows[0]?.id ?? 0);

    expect(testPlacementId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Verify the temporary placement is active and enabled.
     * ------------------------------------------------------------------------
     */

    const placementVerification = await pool.query(
      `
      SELECT
        id,
        code,
        is_enabled,
        status
      FROM advertisement_placements
      WHERE id = $1
      LIMIT 1
      `,
      [testPlacementId]
    );

    expect(placementVerification.rows.length).toBe(1);
    expect(placementVerification.rows[0]?.code).toBe(testPlacementCode);
    expect(placementVerification.rows[0]?.is_enabled).toBe(true);
    expect(placementVerification.rows[0]?.status).toBe("ACTIVE");

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
     * Login as Ad Finance Approver.
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
     * Ensure Ad Creator role and user remain active.
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
     * Ensure Finance Approver role and user remain active.
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

    /*
     * ------------------------------------------------------------------------
     * Verify Ad Creator permissions.
     * ------------------------------------------------------------------------
     */

    const creatorVerification = await pool.query(
      `
      SELECT
        p.id,
        p.code
      FROM role_permissions rp
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE rp.role_id = $1
        AND p.status = 'ACTIVE'
        AND p.id = ANY($2::INTEGER[])
      ORDER BY p.id
      `,
      [creatorRoleId, Object.values(creatorPermissionIds)]
    );

    const creatorAttachedPermissionIds = new Set(
      creatorVerification.rows.map((row) => Number(row.id))
    );

    expect(creatorAttachedPermissionIds.size).toBe(4);

    for (const permissionId of Object.values(creatorPermissionIds)) {
      expect(creatorAttachedPermissionIds.has(permissionId)).toBe(true);
    }

    /*
     * ------------------------------------------------------------------------
     * Verify Finance Approver permissions.
     * ------------------------------------------------------------------------
     */

    const financeVerification = await pool.query(
      `
      SELECT
        p.id,
        p.code
      FROM role_permissions rp
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE rp.role_id = $1
        AND p.status = 'ACTIVE'
        AND p.id = ANY($2::INTEGER[])
      ORDER BY p.id
      `,
      [financeRoleId, Object.values(financePermissionIds)]
    );

    const financeAttachedPermissionIds = new Set(
      financeVerification.rows.map((row) => Number(row.id))
    );

    expect(financeAttachedPermissionIds.size).toBe(4);

    for (const permissionId of Object.values(financePermissionIds)) {
      expect(financeAttachedPermissionIds.has(permissionId)).toBe(true);
    }
  };

  beforeEach(async () => {
    /*
     * Vitest integration suites can run concurrently and other suites may
     * modify shared application permission records.
     *
     * Re-establish the exact production permissions required by this workflow
     * test without creating or modifying the permission definitions themselves.
     */
    await ensureRequiredPermissions();
  });

  /*
   * ========================================================================== 
   * CLEANUP
   * ========================================================================== 
   */

  afterAll(async () => {
    const approvalIds = [
      holdApprovalId,
      rejectApprovalId,
      directRejectApprovalId
    ].filter((id, index, array) => id > 0 && array.indexOf(id) === index);

    /*
     * ------------------------------------------------------------------------
     * Remove financial approval history.
     * ------------------------------------------------------------------------
     */

    for (const approvalId of approvalIds) {
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

    for (const approvalId of approvalIds) {
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
     * Remove runtime placement rules for the main advertisement.
     *
     * advertisement_placement_rules does not contain is_active.
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
     * Remove temporary placement.
     *
     * This is done after runtime placement rules and advertisements have been
     * removed because advertisement_placement_rules references the placement.
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

  /*
   * ========================================================================== 
   * CREATE TEST ADVERTISEMENT
   * ========================================================================== 
   */

  it("should create the advertisement used by workflow tests", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId: testClientId,
        placementId: testPlacementId,
        name: `Financial Approval Workflow Advertisement ${timestamp}`,
        internalName: `financial-approval-workflow-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl:
          "https://example.com/financial-approval-workflow-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes: "Temporary advertisement for financial approval workflow tests.",
        advertisementAmount: 50000,
        currencyCode: "INR"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    testAdvertisementId = Number(response.body.data.id);

    expect(testAdvertisementId).toBeGreaterThan(0);
    expect(response.body.data.workflowStatus).toBe("DRAFT");

    /*
     * Verify that advertisement creation persisted the runtime placement.
     *
     * Do not check for an is_active column because the current
     * advertisement_placement_rules schema does not contain one.
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
    expect(
      Number(placementRuleResult.rows[0]?.advertisement_id ?? 0)
    ).toBe(testAdvertisementId);
    expect(Number(placementRuleResult.rows[0]?.placement_id ?? 0)).toBe(
      testPlacementId
    );
  });

  /*
   * ========================================================================== 
   * CREATOR → FINANCIAL APPROVAL
   * ========================================================================== 
   */

  it("POST /financial-approval - should allow Ad Creator to create an approval", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 5000,
        remarks: "Initial workflow approval."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    holdApprovalId = Number(response.body.data.id);

    expect(holdApprovalId).toBeGreaterThan(0);
    expect(response.body.data.status).toBe("SUBMITTED");
    expect(Number(response.body.data.requestedBy)).toBe(creatorUserId);
  });

  it("PATCH /financial-approval/:id/remarks - should allow Ad Creator to update approval remarks", async () => {
    const approvalRemarks = "Updated workflow approval remarks.";

    const response = await request(app)
      .patch(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/remarks`
      )
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        approvalRemarks
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.approvalRemarks).toBe(approvalRemarks);
  });

  /*
   * ========================================================================== 
   * RBAC BOUNDARY
   * ========================================================================== 
   */

  it("POST /financial-approval - should deny Finance Approver from creating a financial approval", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 1000,
        remarks: "Finance creator authorization test."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("PATCH /financial-approval/:id/remarks - should deny Finance Approver from updating creator remarks", async () => {
    const response = await request(app)
      .patch(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/remarks`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Finance should not update creator remarks."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("GET /financial-approval/:id/history - should deny Ad Creator from reading financial approval history", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/history`
      )
      .set("Authorization", `Bearer ${creatorAccessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  /*
   * ========================================================================== 
   * INITIAL HISTORY
   * ========================================================================== 
   */

  it("GET /financial-approval/:id/history - should allow Finance Approver to read initial workflow history", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/history`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const initialHistory = response.body.data.find(
      (item: { fromStatus: string | null; toStatus: string }) =>
        item.fromStatus === null && item.toStatus === "SUBMITTED"
    );

    expect(initialHistory).toBeDefined();
  });

  /*
   * ========================================================================== 
   * SUBMITTED → HOLD
   * ========================================================================== 
   */

  it("POST /financial-approval/:id/hold - should allow Finance Approver to transition SUBMITTED to HOLD", async () => {
    const holdReason =
      "Payment verification is pending before financial approval.";

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/hold`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        holdReason
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    expect(Number(response.body.data.id)).toBe(holdApprovalId);
    expect(response.body.data.status).toBe("HOLD");
    expect(response.body.data.holdReason).toBe(holdReason);
    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);
    expect(response.body.data.reviewedAt).toBeDefined();

    /*
     * Verify that the HOLD transition was persisted immediately.
     */

    const historyResponse = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/history`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.success).toBe(true);

    const history = historyResponse.body.data as Array<{
      fromStatus: string | null;
      toStatus: string;
      holdReason: string | null;
      actionBy: number | string;
      actionAt: string;
    }>;

    expect(
      history.some(
        (item) => item.fromStatus === null && item.toStatus === "SUBMITTED"
      )
    ).toBe(true);

    const holdHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "HOLD"
    );

    expect(holdHistory).toBeDefined();
    expect(holdHistory?.holdReason).toBe(holdReason);
    expect(Number(holdHistory?.actionBy)).toBe(financeUserId);
    expect(holdHistory?.actionAt).toBeDefined();
    expect(Number.isNaN(new Date(holdHistory?.actionAt ?? "").getTime())).toBe(
      false
    );
  });

  /*
   * ========================================================================== 
   * HOLD → APPROVED
   * ========================================================================== 
   */

  it("POST /financial-approval/:id/approve - should allow Finance Approver to transition HOLD to APPROVED", async () => {
    const approvalRemarks = "Financial amount verified and approved.";

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        remarks: approvalRemarks
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(Number(response.body.data.id)).toBe(holdApprovalId);
    expect(response.body.data.status).toBe("APPROVED");
    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);
    expect(response.body.data.reviewedAt).toBeDefined();
    expect(response.body.data.approvalRemarks).toBe(approvalRemarks);

    /*
     * Verify that the APPROVED transition was persisted immediately.
     */

    const historyResponse = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/history`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.success).toBe(true);

    const history = historyResponse.body.data as Array<{
      fromStatus: string | null;
      toStatus: string;
      holdReason: string | null;
      actionBy: number | string;
      actionAt: string;
    }>;

    expect(history.length).toBeGreaterThanOrEqual(3);

    const approvalHistory = history.find(
      (item) => item.fromStatus === "HOLD" && item.toStatus === "APPROVED"
    );

    expect(approvalHistory).toBeDefined();
    expect(Number(approvalHistory?.actionBy)).toBe(financeUserId);
    expect(approvalHistory?.actionAt).toBeDefined();
    expect(
      Number.isNaN(new Date(approvalHistory?.actionAt ?? "").getTime())
    ).toBe(false);
  });

  /*
   * ========================================================================== 
   * APPROVED TERMINAL STATE
   * ========================================================================== 
   */

  it("POST /financial-approval/:id/approve - should reject approval of an already APPROVED approval", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        remarks: "Second approval attempt."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /financial-approval/:id/hold - should reject placing an APPROVED approval on hold", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/hold`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        holdReason: "Attempted hold after approval."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /financial-approval/:id/reject - should reject rejecting an APPROVED approval", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason: "Attempted rejection after approval."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /financial-approval/:id/resubmit - should deny Finance Approver from resubmitting an APPROVED approval", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/resubmit`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        remarks: "Finance should not resubmit approvals."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("POST /financial-approval/:id/resubmit - should deny Ad Creator from resubmitting an APPROVED approval", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/resubmit`
      )
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        remarks: "Attempted resubmission after approval."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ========================================================================== 
   * HISTORY FOR APPROVED WORKFLOW
   * ========================================================================== 
   */

  it("GET /financial-approval/:id/history - should return the complete approval history to Finance Approver", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${holdApprovalId}/history`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const history = response.body.data as Array<{
      fromStatus: string | null;
      toStatus: string;
      holdReason: string | null;
      actionBy: number | string;
      actionAt: string;
    }>;

    expect(history.length).toBeGreaterThanOrEqual(3);

    const initialHistory = history.find(
      (item) => item.fromStatus === null && item.toStatus === "SUBMITTED"
    );

    const holdHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "HOLD"
    );

    const approvalHistory = history.find(
      (item) => item.fromStatus === "HOLD" && item.toStatus === "APPROVED"
    );

    expect(initialHistory).toBeDefined();
    expect(holdHistory).toBeDefined();
    expect(approvalHistory).toBeDefined();

    expect(holdHistory?.holdReason).toBe(
      "Payment verification is pending before financial approval."
    );

    expect(Number(initialHistory?.actionBy)).toBe(creatorUserId);
    expect(Number(holdHistory?.actionBy)).toBe(financeUserId);
    expect(Number(approvalHistory?.actionBy)).toBe(financeUserId);

    expect(initialHistory?.actionAt).toBeDefined();
    expect(holdHistory?.actionAt).toBeDefined();
    expect(approvalHistory?.actionAt).toBeDefined();
  });

  /*
   * ========================================================================== 
   * SUBMITTED → REJECTED
   * ========================================================================== 
   */

  it("POST /financial-approval - should allow Ad Creator to create another SUBMITTED approval for rejection workflow", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "REFUND",
        requestedAmount: 3000,
        remarks: "Refund workflow test."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    rejectApprovalId = Number(response.body.data.id);

    expect(rejectApprovalId).toBeGreaterThan(0);
    expect(response.body.data.status).toBe("SUBMITTED");
    expect(Number(response.body.data.requestedBy)).toBe(creatorUserId);
  });

  it("POST /financial-approval/:id/reject - should allow Finance Approver to transition SUBMITTED to REJECTED", async () => {
    const rejectionReason = "Requested financial adjustment was not accepted.";

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${rejectApprovalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(Number(response.body.data.id)).toBe(rejectApprovalId);
    expect(response.body.data.status).toBe("REJECTED");
    expect(response.body.data.rejectionReason).toBe(rejectionReason);
    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);
    expect(response.body.data.reviewedAt).toBeDefined();
  });

  /*
   * ========================================================================== 
   * REJECTED PERSISTENCE
   * ========================================================================== 
   */

  it("GET /financial-approval/:id - should persist the REJECTED financial approval state", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${rejectApprovalId}`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(Number(response.body.data.id)).toBe(rejectApprovalId);
    expect(response.body.data.status).toBe("REJECTED");
    expect(response.body.data.rejectionReason).toBe(
      "Requested financial adjustment was not accepted."
    );
    expect(response.body.data.holdReason).toBeNull();
    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);
    expect(response.body.data.reviewedAt).toBeDefined();
  });

  /*
   * ========================================================================== 
   * REJECTED → SUBMITTED
   * ========================================================================== 
   */

  it("POST /financial-approval/:id/resubmit - should allow Ad Creator to transition REJECTED to SUBMITTED", async () => {
    const remarks = "Corrected the financial request and resubmitted.";

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${rejectApprovalId}/resubmit`
      )
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        remarks
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(Number(response.body.data.id)).toBe(rejectApprovalId);
    expect(response.body.data.status).toBe("SUBMITTED");
    expect(response.body.data.approvalRemarks).toBe(remarks);
  });

  /*
   * ========================================================================== 
   * RESUBMISSION PERSISTENCE
   * ========================================================================== 
   */

  it("GET /financial-approval/:id - should persist the resubmitted SUBMITTED state", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${rejectApprovalId}`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(Number(response.body.data.id)).toBe(rejectApprovalId);
    expect(response.body.data.status).toBe("SUBMITTED");
    expect(response.body.data.approvalRemarks).toBe(
      "Corrected the financial request and resubmitted."
    );
  });

  it("GET /financial-approval/:id/history - should persist the REJECTED to SUBMITTED resubmission transition", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${rejectApprovalId}/history`
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
    }>;

    const rejectionHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "REJECTED"
    );

    const resubmissionHistory = history.find(
      (item) => item.fromStatus === "REJECTED" && item.toStatus === "SUBMITTED"
    );

    expect(rejectionHistory).toBeDefined();
    expect(resubmissionHistory).toBeDefined();

    expect(Number(rejectionHistory?.actionBy)).toBe(financeUserId);
    expect(Number(resubmissionHistory?.actionBy)).toBe(creatorUserId);

    expect(rejectionHistory?.actionAt).toBeDefined();
    expect(resubmissionHistory?.actionAt).toBeDefined();
  });

  it("POST /financial-approval/:id/resubmit - should deny Finance Approver from resubmitting a REJECTED approval", async () => {
    /*
     * rejectApprovalId was already resubmitted by the Ad Creator in the
     * previous test, so it is currently SUBMITTED and cannot be used here.
     *
     * Create a separate temporary advertisement so this authorization test
     * can create and reject its own financial approval without conflicting
     * with the pending approval on the main test advertisement.
     */

    const temporaryAdvertisementResponse = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId: testClientId,
        placementId: testPlacementId,
        name: `Financial Approval Resubmit Authorization Advertisement ${timestamp}`,
        internalName: `financial-approval-resubmit-auth-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl:
          "https://example.com/financial-approval-resubmit-authorization-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes:
          "Temporary advertisement for financial approval resubmit authorization test.",
        advertisementAmount: 50000,
        currencyCode: "INR"
      });

    expect(temporaryAdvertisementResponse.status).toBe(201);
    expect(temporaryAdvertisementResponse.body.success).toBe(true);

    const temporaryAdvertisementId = Number(
      temporaryAdvertisementResponse.body.data.id
    );

    expect(temporaryAdvertisementId).toBeGreaterThan(0);

    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: temporaryAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 1750,
        remarks: "Finance resubmit authorization test."
      });

    expect(createResponse.status).toBe(201);

    const temporaryApprovalId = Number(createResponse.body.data.id);

    expect(temporaryApprovalId).toBeGreaterThan(0);

    const rejectResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${temporaryApprovalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason: "Temporary rejection for authorization testing."
      });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.data.status).toBe("REJECTED");

    const resubmitResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${temporaryApprovalId}/resubmit`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        remarks: "Finance should not resubmit."
      });

    expect(resubmitResponse.status).toBe(403);
    expect(resubmitResponse.body.success).toBe(false);

    /*
     * Cleanup temporary approval immediately.
     */

    await pool.query(
      `
      DELETE FROM advertisement_financial_approval_history
      WHERE approval_id = $1
      `,
      [temporaryApprovalId]
    );

    await pool.query(
      `
      DELETE FROM advertisement_financial_approvals
      WHERE id = $1
      `,
      [temporaryApprovalId]
    );

    /*
     * Cleanup temporary advertisement runtime placement rule before deleting
     * the advertisement itself.
     */

    await pool.query(
      `
      DELETE FROM advertisement_placement_rules
      WHERE advertisement_id = $1
      `,
      [temporaryAdvertisementId]
    );

    /*
     * Cleanup temporary advertisement immediately.
     */

    await pool.query(
      `
      DELETE FROM advertisements
      WHERE id = $1
      `,
      [temporaryAdvertisementId]
    );
  });

  /*
   * ========================================================================== 
   * RESUBMITTED → APPROVED
   * ========================================================================== 
   */

  it("POST /financial-approval/:id/approve - should allow Finance Approver to approve a resubmitted approval", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${rejectApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        remarks: "Approved after resubmission."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(Number(response.body.data.id)).toBe(rejectApprovalId);
    expect(response.body.data.status).toBe("APPROVED");
    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);
    expect(response.body.data.reviewedAt).toBeDefined();
    expect(response.body.data.approvalRemarks).toBe(
      "Approved after resubmission."
    );
  });

  /*
   * ========================================================================== 
   * RESUBMITTED → APPROVED HISTORY
   * ========================================================================== 
   */

  it("GET /financial-approval/:id/history - should contain the complete reject, resubmit and approve lifecycle", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${rejectApprovalId}/history`
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
    }>;

    expect(history.length).toBeGreaterThanOrEqual(4);

    const initialHistory = history.find(
      (item) => item.fromStatus === null && item.toStatus === "SUBMITTED"
    );

    const rejectionHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "REJECTED"
    );

    const resubmissionHistory = history.find(
      (item) => item.fromStatus === "REJECTED" && item.toStatus === "SUBMITTED"
    );

    const approvalHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "APPROVED"
    );

    expect(initialHistory).toBeDefined();
    expect(rejectionHistory).toBeDefined();
    expect(resubmissionHistory).toBeDefined();
    expect(approvalHistory).toBeDefined();

    expect(Number(initialHistory?.actionBy)).toBe(creatorUserId);
    expect(Number(rejectionHistory?.actionBy)).toBe(financeUserId);
    expect(Number(resubmissionHistory?.actionBy)).toBe(creatorUserId);
    expect(Number(approvalHistory?.actionBy)).toBe(financeUserId);

    for (const item of history) {
      expect(item.actionAt).toBeDefined();
      expect(Number.isNaN(new Date(item.actionAt).getTime())).toBe(false);
    }
  });

  /*
   * ========================================================================== 
   * APPROVED TERMINAL STATE AFTER RESUBMISSION
   * ========================================================================== 
   */

  it("POST /financial-approval/:id/reject - should reject rejecting an approval that was approved after resubmission", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${rejectApprovalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason: "Attempted rejection after final approval."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /financial-approval/:id/hold - should reject putting a finally APPROVED approval on hold", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${rejectApprovalId}/hold`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        holdReason: "Attempted hold after final approval."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /financial-approval/:id/resubmit - should reject resubmission of a finally APPROVED approval", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${rejectApprovalId}/resubmit`
      )
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        remarks: "Attempted resubmission after final approval."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ========================================================================== 
   * DIRECT SUBMITTED → REJECTED HISTORY
   * ========================================================================== 
   */

  it("POST /financial-approval - should allow Ad Creator to create an approval for direct rejection history testing", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "PARTIAL_REFUND",
        requestedPercentage: 25,
        remarks: "Direct rejection history test."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    directRejectApprovalId = Number(response.body.data.id);

    expect(directRejectApprovalId).toBeGreaterThan(0);
    expect(response.body.data.status).toBe("SUBMITTED");
  });

  it("POST /financial-approval/:id/reject - should allow Finance Approver to reject the direct SUBMITTED approval", async () => {
    const rejectionReason = "Partial refund percentage was not approved.";

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${directRejectApprovalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.status).toBe("REJECTED");
    expect(response.body.data.rejectionReason).toBe(rejectionReason);
    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);
    expect(response.body.data.reviewedAt).toBeDefined();
  });

  it("GET /financial-approval/:id/history - should persist the direct SUBMITTED to REJECTED transition", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${directRejectApprovalId}/history`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const history = response.body.data as Array<{
      fromStatus: string | null;
      toStatus: string;
      actionBy: number | string;
      actionAt: string;
      rejectionReason: string | null;
    }>;

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

    expect(rejectionHistory?.rejectionReason).toBe(
      "Partial refund percentage was not approved."
    );
  });

  /*
   * ========================================================================== 
   * REJECTED TERMINAL UNTIL RESUBMIT
   * ========================================================================== 
   */

  it("POST /financial-approval/:id/approve - should reject approval of a REJECTED approval", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${directRejectApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        remarks: "Attempted approval without resubmission."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /financial-approval/:id/hold - should reject putting a REJECTED approval on hold", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${directRejectApprovalId}/hold`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        holdReason: "Attempted hold on rejected approval."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ========================================================================== 
   * HOLD → REJECTED
   * ========================================================================== 
   */

  it("POST /financial-approval - should create an approval for HOLD to REJECTED workflow", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "ADJUSTMENT",
        requestedAmount: 2000,
        remarks: "Hold to reject workflow test."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    const holdResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/hold`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        holdReason: "Additional client information is required."
      });

    expect(holdResponse.status).toBe(200);
    expect(holdResponse.body.data.status).toBe("HOLD");
    expect(Number(holdResponse.body.data.reviewedBy)).toBe(financeUserId);

    const rejectResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason: "Required client information was not received."
      });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.success).toBe(true);
    expect(rejectResponse.body.data.status).toBe("REJECTED");
    expect(rejectResponse.body.data.rejectionReason).toBe(
      "Required client information was not received."
    );
    expect(rejectResponse.body.data.holdReason).toBeNull();
    expect(Number(rejectResponse.body.data.reviewedBy)).toBe(financeUserId);

    /*
     * Verify the persisted history.
     */

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
      holdReason: string | null;
      rejectionReason: string | null;
    }>;

    expect(
      history.some(
        (item) => item.fromStatus === null && item.toStatus === "SUBMITTED"
      )
    ).toBe(true);

    const holdHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "HOLD"
    );

    const rejectionHistory = history.find(
      (item) => item.fromStatus === "HOLD" && item.toStatus === "REJECTED"
    );

    expect(holdHistory).toBeDefined();
    expect(rejectionHistory).toBeDefined();

    expect(holdHistory?.holdReason).toBe(
      "Additional client information is required."
    );

    expect(rejectionHistory?.rejectionReason).toBe(
      "Required client information was not received."
    );

    expect(Number(holdHistory?.actionBy)).toBe(financeUserId);
    expect(Number(rejectionHistory?.actionBy)).toBe(financeUserId);

    expect(holdHistory?.actionAt).toBeDefined();
    expect(rejectionHistory?.actionAt).toBeDefined();

    expect(
      new Date(rejectionHistory?.actionAt ?? "").getTime()
    ).toBeGreaterThanOrEqual(new Date(holdHistory?.actionAt ?? "").getTime());

    /*
     * Verify the current persisted record after HOLD → REJECTED.
     */

    const persistedResponse = await request(app)
      .get(`/api/v1/advertisements/payments/financial-approval/${approvalId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(persistedResponse.status).toBe(200);
    expect(persistedResponse.body.success).toBe(true);
    expect(persistedResponse.body.data.status).toBe("REJECTED");
    expect(persistedResponse.body.data.holdReason).toBeNull();
    expect(persistedResponse.body.data.rejectionReason).toBe(
      "Required client information was not received."
    );

    /*
     * Clean this temporary approval immediately.
     */

    await pool.query(
      `
      DELETE FROM advertisement_financial_approval_history
      WHERE approval_id = $1
      `,
      [approvalId]
    );

    await pool.query(
      `
      DELETE FROM advertisement_financial_approvals
      WHERE id = $1
      `,
      [approvalId]
    );
  });

  /*
   * ========================================================================== 
   * REQUIRED HOLD REASON
   * ========================================================================== 
   */

  it("POST /financial-approval/:id/hold - should reject an empty hold reason", async () => {
    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "DISCOUNT",
        requestedAmount: 1500,
        remarks: "Hold validation test."
      });

    expect(createResponse.status).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/hold`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        holdReason: "   "
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    await pool.query(
      `
      DELETE FROM advertisement_financial_approval_history
      WHERE approval_id = $1
      `,
      [approvalId]
    );

    await pool.query(
      `
      DELETE FROM advertisement_financial_approvals
      WHERE id = $1
      `,
      [approvalId]
    );
  });

  /*
   * ========================================================================== 
   * REQUIRED REJECTION REASON
   * ========================================================================== 
   */

  it("POST /financial-approval/:id/reject - should reject an empty rejection reason", async () => {
    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "REFUND",
        requestedAmount: 1250,
        remarks: "Rejection validation test."
      });

    expect(createResponse.status).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason: "   "
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    await pool.query(
      `
      DELETE FROM advertisement_financial_approval_history
      WHERE approval_id = $1
      `,
      [approvalId]
    );

    await pool.query(
      `
      DELETE FROM advertisement_financial_approvals
      WHERE id = $1
      `,
      [approvalId]
    );
  });

  /*
   * ========================================================================== 
   * HISTORY ORDER / DATA VALIDATION
   * ========================================================================== 
   */

  it("GET /financial-approval/:id/history - should preserve chronological workflow history", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${rejectApprovalId}/history`
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
    }>;

    expect(history.length).toBeGreaterThanOrEqual(4);

    expect(history[0]).toBeDefined();
    expect(history[0]?.fromStatus).toBeNull();
    expect(history[0]?.toStatus).toBe("SUBMITTED");

    expect(
      history.some(
        (item) =>
          item.fromStatus === "SUBMITTED" && item.toStatus === "REJECTED"
      )
    ).toBe(true);

    expect(
      history.some(
        (item) =>
          item.fromStatus === "REJECTED" && item.toStatus === "SUBMITTED"
      )
    ).toBe(true);

    expect(
      history.some(
        (item) =>
          item.fromStatus === "SUBMITTED" && item.toStatus === "APPROVED"
      )
    ).toBe(true);

    /*
     * Validate the actor for every workflow transition.
     *
     * Ad Creator:
     *   NULL → SUBMITTED
     *   REJECTED → SUBMITTED
     *
     * Finance Approver:
     *   SUBMITTED → REJECTED
     *   SUBMITTED → APPROVED
     */

    for (const item of history) {
      const expectedActionBy =
        item.fromStatus === null || item.fromStatus === "REJECTED"
          ? creatorUserId
          : financeUserId;

      expect(Number(item.actionBy)).toBe(expectedActionBy);
      expect(item.actionAt).toBeDefined();

      expect(Number.isNaN(new Date(item.actionAt).getTime())).toBe(false);
    }

    /*
     * Verify that the history is returned in chronological order.
     */

    for (let index = 1; index < history.length; index += 1) {
      const previous = history[index - 1];
      const current = history[index];

      expect(previous).toBeDefined();
      expect(current).toBeDefined();

      expect(
        new Date(current?.actionAt ?? "").getTime()
      ).toBeGreaterThanOrEqual(new Date(previous?.actionAt ?? "").getTime());
    }
  });
});