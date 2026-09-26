import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Financial Approval Partial Refund Integration", () => {
  let creatorAccessToken = "";
  let financeAccessToken = "";

  let creatorUserId = 0;
  let financeUserId = 0;

  let superAdminRoleId = 0;
  let creatorRoleId = 0;
  let financeRoleId = 0;

  let testClientId = 0;
  let testAdvertisementId = 0;
  let testPaymentId = 0;

  const createdApprovalIds: number[] = [];

  const timestamp = Date.now();

  const creatorUsername = `financial_partial_refund_creator_${timestamp}`;
  const creatorEmail = `financial-partial-refund-creator-${timestamp}@example.com`;

  const financeUsername = `financial_partial_refund_finance_${timestamp}`;
  const financeEmail = `financial-partial-refund-finance-${timestamp}@example.com`;

  const creatorRoleCode = `TEST_AD_FA_PARTIAL_REFUND_CREATOR_${timestamp}`;
  const financeRoleCode = `TEST_AD_FA_PARTIAL_REFUND_FINANCE_${timestamp}`;

  const testClientCode = `TFA-PR-${timestamp}`;

  const creatorPassword = "Financial_Partial_Refund_Creator@123";
  const financePassword = "Financial_Partial_Refund_Finance@123";

  const FINANCIAL_APPROVAL_RESOURCE = "advertisements.financial_approvals";

  const ADVERTISEMENT_RESOURCE = "advertisements";

  /*
   * ==========================================================================
   * PRODUCTION PERMISSIONS
   * ==========================================================================
   *
   * Financial approval creation is intentionally controlled by
   * advertisements.submit.
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
        "Financial Partial Refund Creator Test User",
        "Financial Partial Refund Creator",
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
        "Financial Partial Refund Finance Test User",
        "Financial Partial Refund Finance",
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
        `FA Partial Refund Ad Creator ${timestamp}`,
        "Partial refund financial approval integration-test Ad Creator role.",
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
        `FA Partial Refund Finance Approver ${timestamp}`,
        "Partial refund financial approval integration-test Finance Approver role.",
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
     * Resolve production Ad Creator permissions.
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
     * Resolve production Finance Approver permissions.
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
     * Verify creator permissions.
     * ------------------------------------------------------------------------
     */

    const creatorRequiredPermissionIds = Object.values(creatorPermissionIds);

    expect(creatorRequiredPermissionIds).toHaveLength(4);

    const creatorVerification = await pool.query(
      `
      SELECT
        rp.permission_id
      FROM role_permissions rp
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE rp.role_id = $1
        AND rp.permission_id = ANY($2::INTEGER[])
        AND p.status = 'ACTIVE'
      `,
      [creatorRoleId, creatorRequiredPermissionIds]
    );

    expect(
      new Set(creatorVerification.rows.map((row) => Number(row.permission_id)))
        .size
    ).toBe(4);

    /*
     * ------------------------------------------------------------------------
     * Verify finance permissions.
     * ------------------------------------------------------------------------
     */

    const financeRequiredPermissionIds = Object.values(financePermissionIds);

    expect(financeRequiredPermissionIds).toHaveLength(4);

    const financeVerification = await pool.query(
      `
      SELECT
        rp.permission_id
      FROM role_permissions rp
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE rp.role_id = $1
        AND rp.permission_id = ANY($2::INTEGER[])
        AND p.status = 'ACTIVE'
      `,
      [financeRoleId, financeRequiredPermissionIds]
    );

    expect(
      new Set(financeVerification.rows.map((row) => Number(row.permission_id)))
        .size
    ).toBe(4);

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
        `Financial Partial Refund Client ${timestamp}`,
        `Financial Partial Refund Client ${timestamp}`,
        creatorUserId
      ]
    );

    testClientId = Number(clientResult.rows[0]?.id ?? 0);

    expect(testClientId).toBeGreaterThan(0);

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

    if (testPaymentId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_payment_refunds
          WHERE payment_id = $1
          `,
          [testPaymentId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }

      try {
        await pool.query(
          `
          DELETE FROM advertisement_payments
          WHERE id = $1
          `,
          [testPaymentId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

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

  it("should create the advertisement used by partial refund tests", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId: testClientId,
        name: `Financial Partial Refund Advertisement ${timestamp}`,
        internalName: `financial-partial-refund-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/financial-partial-refund-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes:
          "Temporary advertisement for financial partial refund integration tests.",
        advertisementAmount: 50000,
        currencyCode: "INR"
      });

    //expect(response.status).toBe(201);
    expect(response.status, JSON.stringify(response.body, null, 2)).toBe(201);
    expect(response.body.success).toBe(true);

    testAdvertisementId = Number(response.body.data.id);

    expect(testAdvertisementId).toBeGreaterThan(0);
    expect(response.body.data.workflowStatus).toBe("DRAFT");
  });

  /*
   * ==========================================================================
   * CREATE VERIFIED PAYMENT FIXTURE
   * ==========================================================================
   *
   * The payment is inserted directly because this suite tests the financial
   * approval workflow. The payment module already has its own integration
   * tests for payment creation and verification.
   */

  it("should create a verified payment fixture for the partial refund request", async () => {
    const paymentResult = await pool.query(
      `
  INSERT INTO advertisement_payments
  (
    advertisement_id,
    amount,
    payment_type,
    payment_date,
    payment_method,
    payment_status,
    transaction_reference,
    notes,
    recorded_by,
    recorded_at,
    verified_by,
    verified_at
  )
  VALUES
  (
    $1,
    $2,
    $3,
    $4,
    $5,
    'VERIFIED',
    $6,
    $7,
    $8,
    $9,
    $10,
    $11
  )
  RETURNING id
  `,
      [
        testAdvertisementId,
        25000,
        "ADVANCE",
        new Date(),
        "UPI",
        `TFA-PR-PAY-${timestamp}`,
        "Verified payment fixture for partial refund testing.",
        creatorUserId,
        new Date(),
        financeUserId,
        new Date()
      ]
    );

    testPaymentId = Number(paymentResult.rows[0]?.id ?? 0);

    expect(testPaymentId).toBeGreaterThan(0);

    const verificationResult = await pool.query(
      `
      SELECT
        id,
        advertisement_id,
        amount,
        payment_status
      FROM advertisement_payments
      WHERE id = $1
      LIMIT 1
      `,
      [testPaymentId]
    );

    expect(verificationResult.rows.length).toBe(1);
    expect(Number(verificationResult.rows[0]?.advertisement_id)).toBe(
      testAdvertisementId
    );
    expect(Number(verificationResult.rows[0]?.amount)).toBe(25000);
    expect(verificationResult.rows[0]?.payment_status).toBe("VERIFIED");
  });

  /*
   * ==========================================================================
   * CREATE PARTIAL REFUND BY PERCENTAGE
   * ==========================================================================
   */

  it("should create a PARTIAL_REFUND approval using requestedPercentage", async () => {
    const requestedPercentage = 25;

    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedPercentage,
        remarks: "Partial refund requested for verified payment."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(response.body.data.approvalType).toBe("PARTIAL_REFUND");

    expect(Number(response.body.data.paymentId)).toBe(testPaymentId);

    expect(Number(response.body.data.requestedPercentage)).toBe(
      requestedPercentage
    );

    expect(response.body.data.requestedAmount).toBeNull();

    expect(response.body.data.status).toBe("SUBMITTED");

    expect(Number(response.body.data.requestedBy)).toBe(creatorUserId);
  });

  /*
   * ==========================================================================
   * GET PARTIAL REFUND APPROVAL
   * ==========================================================================
   */

  it("should allow Finance Approver to read the PARTIAL_REFUND approval", async () => {
    const approvalId = createdApprovalIds[createdApprovalIds.length - 1];

    const response = await request(app)
      .get(`/api/v1/advertisements/payments/financial-approval/${approvalId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(Number(response.body.data.id)).toBe(approvalId);

    expect(response.body.data.approvalType).toBe("PARTIAL_REFUND");

    expect(Number(response.body.data.paymentId)).toBe(testPaymentId);

    expect(Number(response.body.data.requestedPercentage)).toBe(25);
  });

  /*
   * ==========================================================================
   * INITIAL HISTORY
   * ==========================================================================
   */

  it("should persist the initial SUBMITTED history for PARTIAL_REFUND", async () => {
    const approvalId = createdApprovalIds[createdApprovalIds.length - 1];

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/history`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const history = response.body.data;

    expect(
      history.some(
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
  });

  /*
   * ==========================================================================
   * FINANCE APPROVER → APPROVED
   * ==========================================================================
   */

  it("should allow Finance Approver to approve the PARTIAL_REFUND request", async () => {
    const approvalId = createdApprovalIds[createdApprovalIds.length - 1];

    const approvalRemarks =
      "Partial refund percentage approved after financial verification.";

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

    expect(response.body.data.approvalType).toBe("PARTIAL_REFUND");

    expect(response.body.data.status).toBe("APPROVED");

    expect(Number(response.body.data.paymentId)).toBe(testPaymentId);

    expect(Number(response.body.data.requestedPercentage)).toBe(25);

    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);

    expect(response.body.data.approvalRemarks).toBe(approvalRemarks);
  });

  /*
   * ==========================================================================
   * APPROVAL HISTORY AFTER APPROVAL
   * ==========================================================================
   */

  it("should record the PARTIAL_REFUND approval transition in history", async () => {
    const approvalId = createdApprovalIds[createdApprovalIds.length - 1];

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/history`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const history = response.body.data;

    expect(
      history.some(
        (item: {
          fromStatus: string | null;
          toStatus: string;
          actionBy: number | string;
          remarks: string | null;
        }) =>
          item.fromStatus === "SUBMITTED" &&
          item.toStatus === "APPROVED" &&
          Number(item.actionBy) === financeUserId &&
          item.remarks ===
            "Partial refund percentage approved after financial verification."
      )
    ).toBe(true);
  });

  /*
   * ==========================================================================
   * ZERO PERCENTAGE
   * ==========================================================================
   */

  it("should accept a PARTIAL_REFUND requestedPercentage of zero", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedPercentage: 0,
        remarks: "Zero percentage partial refund boundary test."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(Number(response.body.data.requestedPercentage)).toBe(0);

    expect(response.body.data.requestedAmount).toBeNull();

    const approveResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Zero percentage partial refund approved."
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  /*
   * ==========================================================================
   * ONE HUNDRED PERCENTAGE
   * ==========================================================================
   */

  it("should accept a PARTIAL_REFUND requestedPercentage of 100", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedPercentage: 100,
        remarks: "Maximum percentage partial refund boundary test."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(Number(response.body.data.requestedPercentage)).toBe(100);

    const approveResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Maximum percentage partial refund approved."
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  /*
   * ==========================================================================
   * PERCENTAGE ABOVE MAXIMUM
   * ==========================================================================
   */

  it("should reject a PARTIAL_REFUND requestedPercentage greater than 100", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedPercentage: 100.01,
        remarks: "Partial refund percentage above maximum."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * NEGATIVE PERCENTAGE
   * ==========================================================================
   */

  it("should reject a PARTIAL_REFUND requestedPercentage below zero", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedPercentage: -1,
        remarks: "Negative partial refund percentage."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * AMOUNT AND PERCENTAGE MUTUALLY EXCLUSIVE
   * ==========================================================================
   */

  it("should reject a PARTIAL_REFUND request containing both amount and percentage", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedAmount: 5000,
        requestedPercentage: 20,
        remarks: "Partial refund supplied with both amount and percentage."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * MISSING AMOUNT AND PERCENTAGE
   * ==========================================================================
   */

  it("should reject a PARTIAL_REFUND request without amount or percentage", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        remarks: "Partial refund missing amount and percentage."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * ZERO AMOUNT
   * ==========================================================================
   */

  it("should reject a PARTIAL_REFUND requestedAmount of zero", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedAmount: 0,
        remarks: "Zero partial refund amount validation."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * NEGATIVE AMOUNT
   * ==========================================================================
   */

  it("should reject a PARTIAL_REFUND requestedAmount below zero", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedAmount: -500,
        remarks: "Negative partial refund amount validation."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * FINANCE AUTHORITY
   * ==========================================================================
   */

  it("should deny Ad Creator from approving a PARTIAL_REFUND request", async () => {
    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedPercentage: 30,
        remarks: "Creator approval authorization test."
      });

    expect(createResponse.status).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        approvalRemarks: "Ad Creator should not approve financial requests."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);

    const approveResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Finance authorization test approved."
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  /*
   * ==========================================================================
   * DUPLICATE PENDING APPROVAL
   * ==========================================================================
   */

  it("should reject a second pending PARTIAL_REFUND approval for the same advertisement", async () => {
    const firstResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedPercentage: 35,
        remarks: "First pending partial refund approval."
      });

    expect(firstResponse.status).toBe(201);

    const firstApprovalId = Number(firstResponse.body.data.id);

    expect(firstApprovalId).toBeGreaterThan(0);

    createdApprovalIds.push(firstApprovalId);

    const secondResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedPercentage: 40,
        remarks: "Second pending partial refund approval."
      });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.success).toBe(false);

    const approveResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${firstApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "First pending partial refund approved."
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  /*
   * ==========================================================================
   * APPROVED REQUEST CANNOT BE APPROVED AGAIN
   * ==========================================================================
   */

  it("should reject approval of an already APPROVED PARTIAL_REFUND request", async () => {
    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedPercentage: 45,
        remarks: "Already approved partial refund test."
      });

    expect(createResponse.status).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    createdApprovalIds.push(approvalId);

    const firstApproveResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Initial partial refund approval."
      });

    expect(firstApproveResponse.status).toBe(200);
    expect(firstApproveResponse.body.data.status).toBe("APPROVED");

    const secondApproveResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Second approval should not be permitted."
      });

    expect(secondApproveResponse.status).toBe(400);
    expect(secondApproveResponse.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * DATABASE VALIDATION
   * ==========================================================================
   */

  it("should persist PARTIAL_REFUND approval data correctly", async () => {
    const result = await pool.query(
      `
      SELECT
        id,
        advertisement_id,
        client_id,
        payment_id,
        approval_type,
        requested_amount,
        requested_percentage,
        status,
        requested_by,
        reviewed_by
      FROM advertisement_financial_approvals
      WHERE id = ANY($1::INTEGER[])
        AND approval_type = 'PARTIAL_REFUND'
      ORDER BY id
      `,
      [createdApprovalIds]
    );

    expect(result.rows.length).toBeGreaterThan(0);

    for (const row of result.rows) {
      expect(Number(row.advertisement_id)).toBe(testAdvertisementId);

      expect(Number(row.client_id)).toBe(testClientId);

      expect(Number(row.payment_id)).toBe(testPaymentId);

      expect(row.approval_type).toBe("PARTIAL_REFUND");

      expect(Number(row.requested_by)).toBe(creatorUserId);

      expect(row.status).toBe("APPROVED");

      expect(Number(row.reviewed_by)).toBe(financeUserId);

      const hasAmount = row.requested_amount !== null;

      const hasPercentage = row.requested_percentage !== null;

      expect(hasAmount !== hasPercentage).toBe(true);
    }
  });

  /*
   * ==========================================================================
   * PAYMENT MUST REMAIN VERIFIED
   * ==========================================================================
   *
   * Financial approval itself does not execute the refund. The payment
   * remains a VERIFIED payment until the payment/refund operation is
   * explicitly performed by its own workflow.
   */

  it("should keep the linked payment VERIFIED after financial approval", async () => {
    const result = await pool.query(
      `
      SELECT
        id,
        payment_status,
        amount
      FROM advertisement_payments
      WHERE id = $1
      LIMIT 1
      `,
      [testPaymentId]
    );

    expect(result.rows.length).toBe(1);

    expect(Number(result.rows[0]?.id)).toBe(testPaymentId);

    expect(result.rows[0]?.payment_status).toBe("VERIFIED");

    expect(Number(result.rows[0]?.amount)).toBe(25000);
  });
});
