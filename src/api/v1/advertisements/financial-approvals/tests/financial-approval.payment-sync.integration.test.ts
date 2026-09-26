import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Financial Approval Payment Sync API Integration", () => {
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
  let testApprovalId = 0;

  const timestamp = Date.now();

  const creatorUsername = `fa_payment_sync_creator_${timestamp}`;
  const creatorEmail = `fa-payment-sync-creator-${timestamp}@example.com`;

  const financeUsername = `fa_payment_sync_finance_${timestamp}`;
  const financeEmail = `fa-payment-sync-finance-${timestamp}@example.com`;

  const creatorRoleCode = `TEST_FA_PAYMENT_SYNC_CREATOR_${timestamp}`;
  const financeRoleCode = `TEST_FA_PAYMENT_SYNC_FINANCE_${timestamp}`;

  const testClientCode = `TFA-PS-${timestamp}`;

  const creatorPassword = "Financial_Payment_Sync_Creator@123";
  const financePassword = "Financial_Payment_Sync_Finance@123";

  const paymentAmount = 25000;

  const FINANCIAL_APPROVAL_RESOURCE = "advertisements.financial_approvals";

  const ADVERTISEMENT_RESOURCE = "advertisements";

  const creatorPermissionCodes = {
    read: "advertisements.read",
    create: "advertisements.create",
    update: "advertisements.update",
    submit: "advertisements.submit"
  } as const;

  const financePermissionCodes = {
    read: `${FINANCIAL_APPROVAL_RESOURCE}.read`,
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
    approve: 0
  };

  beforeAll(async () => {
    /*
     * ========================================================================
     * SUPER ADMIN ROLE
     * ========================================================================
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
     * ========================================================================
     * CREATOR USER
     * ========================================================================
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
        "Financial Payment Sync Creator",
        "Payment Sync Creator",
        superAdminRoleId
      ]
    );

    creatorUserId = Number(creatorUserResult.rows[0]?.id ?? 0);

    expect(creatorUserId).toBeGreaterThan(0);

    /*
     * ========================================================================
     * FINANCE USER
     * ========================================================================
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
        "Financial Payment Sync Finance",
        "Payment Sync Finance",
        superAdminRoleId
      ]
    );

    financeUserId = Number(financeUserResult.rows[0]?.id ?? 0);

    expect(financeUserId).toBeGreaterThan(0);

    /*
     * ========================================================================
     * CREATOR ROLE
     * ========================================================================
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
        `FA Payment Sync Creator ${timestamp}`,
        "Temporary role for financial approval payment synchronization tests.",
        creatorUserId
      ]
    );

    creatorRoleId = Number(creatorRoleResult.rows[0]?.id ?? 0);

    expect(creatorRoleId).toBeGreaterThan(0);

    /*
     * ========================================================================
     * FINANCE ROLE
     * ========================================================================
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
        `FA Payment Sync Finance ${timestamp}`,
        "Temporary finance role for financial approval payment synchronization tests.",
        financeUserId
      ]
    );

    financeRoleId = Number(financeRoleResult.rows[0]?.id ?? 0);

    expect(financeRoleId).toBeGreaterThan(0);

    /*
     * ========================================================================
     * ASSIGN CREATOR ROLE
     * ========================================================================
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
     * ========================================================================
     * ASSIGN FINANCE ROLE
     * ========================================================================
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
     * ========================================================================
     * CREATOR PERMISSIONS
     * ========================================================================
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
     * ========================================================================
     * FINANCE PERMISSIONS
     * ========================================================================
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
     * ========================================================================
     * TEST CLIENT
     * ========================================================================
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
        `Financial Payment Sync Client ${timestamp}`,
        `Payment Sync Client ${timestamp}`,
        creatorUserId
      ]
    );

    testClientId = Number(clientResult.rows[0]?.id ?? 0);

    expect(testClientId).toBeGreaterThan(0);

    /*
     * ========================================================================
     * CREATOR LOGIN
     * ========================================================================
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
     * ========================================================================
     * FINANCE LOGIN
     * ========================================================================
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

    const creatorPermissionValues = Object.values(creatorPermissionIds);

    const financePermissionValues = Object.values(financePermissionIds);

    expect(creatorPermissionValues).toHaveLength(4);
    expect(financePermissionValues).toHaveLength(2);

    await pool.query(
      `
      UPDATE permissions
      SET status = 'ACTIVE'
      WHERE id = ANY($1::INTEGER[])
      `,
      [[...creatorPermissionValues, ...financePermissionValues]]
    );

    for (const permissionId of creatorPermissionValues) {
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

    for (const permissionId of financePermissionValues) {
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

    for (const roleId of [creatorRoleId, financeRoleId]) {
      if (roleId > 0) {
        try {
          await pool.query(
            `
            DELETE FROM role_permissions
            WHERE role_id = $1
            `,
            [roleId]
          );
        } catch {
          // Cleanup should not fail the suite.
        }
      }
    }

    for (const userId of [creatorUserId, financeUserId]) {
      if (userId > 0) {
        try {
          await pool.query(
            `
            DELETE FROM user_sessions
            WHERE user_id = $1
            `,
            [userId]
          );
        } catch {
          // Cleanup should not fail the suite.
        }
      }
    }

    for (const userId of [creatorUserId, financeUserId]) {
      if (userId > 0) {
        try {
          await pool.query(
            `
            DELETE FROM user_roles
            WHERE user_id = $1
            `,
            [userId]
          );
        } catch {
          // Cleanup should not fail the suite.
        }
      }
    }

    for (const roleId of [creatorRoleId, financeRoleId]) {
      if (roleId > 0) {
        try {
          await pool.query(
            `
            DELETE FROM roles
            WHERE id = $1
            `,
            [roleId]
          );
        } catch {
          // Cleanup should not fail the suite.
        }
      }
    }

    for (const userId of [creatorUserId, financeUserId]) {
      if (userId > 0) {
        try {
          await pool.query(
            `
            DELETE FROM users
            WHERE id = $1
            `,
            [userId]
          );
        } catch {
          // Cleanup should not fail the suite.
        }
      }
    }
  });

  /*
   * ==========================================================================
   * AUTHENTICATION
   * ==========================================================================
   */

  it("should have valid Creator and Finance authentication tokens", () => {
    expect(creatorAccessToken).toBeTruthy();
    expect(financeAccessToken).toBeTruthy();
  });

  /*
   * ==========================================================================
   * CREATE ADVERTISEMENT
   * ==========================================================================
   */

  it("POST /api/v1/advertisements - should create the advertisement used for payment synchronization", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId: testClientId,
        name: `Financial Payment Sync Advertisement ${timestamp}`,
        internalName: `financial-payment-sync-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/financial-payment-sync-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes:
          "Temporary advertisement for financial approval payment synchronization tests.",
        advertisementAmount: 50000,
        currencyCode: "INR"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    testAdvertisementId = Number(response.body.data.id);

    expect(testAdvertisementId).toBeGreaterThan(0);
    expect(Number(response.body.data.clientId)).toBe(testClientId);
    expect(response.body.data.workflowStatus).toBe("DRAFT");
  });

  /*
   * ==========================================================================
   * CREATE VERIFIED PAYMENT
   * ==========================================================================
   */

  it("should create a VERIFIED payment ledger entry for synchronization testing", async () => {
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
        CURRENT_TIMESTAMP,
        $4,
        'VERIFIED',
        $5,
        $6,
        $7,
        CURRENT_TIMESTAMP,
        $7,
        CURRENT_TIMESTAMP
      )
      RETURNING
        id,
        advertisement_id,
        amount,
        payment_type,
        payment_method,
        payment_status,
        transaction_reference,
        verified_by,
        verified_at
      `,
      [
        testAdvertisementId,
        paymentAmount,
        "ADVANCE",
        "BANK_TRANSFER",
        `FA-PS-TXN-${timestamp}`,
        "Verified payment for financial approval synchronization test.",
        creatorUserId
      ]
    );

    expect(paymentResult.rows.length).toBe(1);

    const payment = paymentResult.rows[0];

    testPaymentId = Number(payment?.id ?? 0);

    expect(testPaymentId).toBeGreaterThan(0);
    expect(Number(payment?.advertisement_id)).toBe(testAdvertisementId);
    expect(Number(payment?.amount)).toBe(paymentAmount);
    expect(payment?.payment_type).toBe("ADVANCE");
    expect(payment?.payment_status).toBe("VERIFIED");
    expect(payment?.transaction_reference).toBe(`FA-PS-TXN-${timestamp}`);
    expect(Number(payment?.verified_by)).toBe(creatorUserId);
    expect(payment?.verified_at).toBeDefined();
  });

  /*
   * ==========================================================================
   * CREATE FINANCIAL APPROVAL
   * ==========================================================================
   */

  it("POST /financial-approval - should create a financial approval linked to the payment", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "PARTIAL_REFUND",
        requestedPercentage: 20,
        remarks:
          "Financial approval linked to verified payment for synchronization testing."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    testApprovalId = Number(response.body.data.id);

    expect(testApprovalId).toBeGreaterThan(0);
    expect(Number(response.body.data.advertisementId)).toBe(
      testAdvertisementId
    );
    expect(Number(response.body.data.clientId)).toBe(testClientId);
    expect(Number(response.body.data.paymentId)).toBe(testPaymentId);
    expect(response.body.data.approvalType).toBe("PARTIAL_REFUND");
    expect(Number(response.body.data.requestedPercentage)).toBe(20);
    expect(response.body.data.status).toBe("SUBMITTED");
    expect(Number(response.body.data.requestedBy)).toBe(creatorUserId);
  });

  /*
   * ==========================================================================
   * GET FINANCIAL APPROVAL BY ID
   * ==========================================================================
   */

  it("GET /financial-approval/:id - should return the payment-linked financial approval", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    expect(Number(response.body.data.id)).toBe(testApprovalId);
    expect(Number(response.body.data.advertisementId)).toBe(
      testAdvertisementId
    );
    expect(Number(response.body.data.clientId)).toBe(testClientId);
    expect(Number(response.body.data.paymentId)).toBe(testPaymentId);
    expect(response.body.data.status).toBe("SUBMITTED");
  });

  /*
   * ==========================================================================
   * LIST BY PAYMENT
   * ==========================================================================
   */

  it("GET /financial-approval - should filter financial approvals by paymentId", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .query({
        page: 1,
        pageSize: 20,
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.meta).toBeDefined();

    const matchingApproval = response.body.data.find(
      (item: { id: number | string; paymentId: number | string | null }) =>
        Number(item.id) === testApprovalId &&
        Number(item.paymentId) === testPaymentId
    );

    expect(matchingApproval).toBeDefined();
  });

  /*
   * ==========================================================================
   * PAYMENT MUST REMAIN VERIFIED BEFORE APPROVAL
   * ==========================================================================
   *
   * The Creator role in this test intentionally does not receive payment
   * permissions. Therefore this synchronization assertion reads the payment
   * ledger directly rather than weakening RBAC by granting payment READ.
   */

  it("should confirm the linked payment remains VERIFIED before financial approval", async () => {
    const paymentResult = await pool.query(
      `
      SELECT
        id,
        advertisement_id,
        amount,
        payment_status,
        refunded_by,
        refunded_at
      FROM advertisement_payments
      WHERE id = $1
      LIMIT 1
      `,
      [testPaymentId]
    );

    expect(paymentResult.rows.length).toBe(1);

    const payment = paymentResult.rows[0];

    expect(Number(payment?.id)).toBe(testPaymentId);
    expect(Number(payment?.advertisement_id)).toBe(testAdvertisementId);
    expect(Number(payment?.amount)).toBe(paymentAmount);
    expect(payment?.payment_status).toBe("VERIFIED");
    expect(payment?.refunded_by).toBeNull();
    expect(payment?.refunded_at).toBeNull();
  });

  /*
   * ==========================================================================
   * APPROVE FINANCIAL APPROVAL
   * ==========================================================================
   */

  it("POST /financial-approval/:id/approve - should approve the payment-linked financial approval", async () => {
    const approvalRemarks =
      "Verified payment reviewed and financial approval approved.";

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        remarks: approvalRemarks
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    expect(Number(response.body.data.id)).toBe(testApprovalId);
    expect(response.body.data.status).toBe("APPROVED");
    expect(Number(response.body.data.paymentId)).toBe(testPaymentId);
    expect(Number(response.body.data.advertisementId)).toBe(
      testAdvertisementId
    );
    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);
    expect(response.body.data.reviewedAt).toBeDefined();
    expect(response.body.data.approvalRemarks).toBe(approvalRemarks);
  });

  /*
   * ==========================================================================
   * PAYMENT MUST NOT BE REFUNDED BY APPROVAL
   * ==========================================================================
   */

  it("should keep the linked payment VERIFIED after financial approval", async () => {
    const paymentResult = await pool.query(
      `
      SELECT
        id,
        advertisement_id,
        amount,
        payment_status,
        refunded_by,
        refunded_at
      FROM advertisement_payments
      WHERE id = $1
      LIMIT 1
      `,
      [testPaymentId]
    );

    expect(paymentResult.rows.length).toBe(1);

    const payment = paymentResult.rows[0];

    expect(Number(payment?.id)).toBe(testPaymentId);
    expect(Number(payment?.advertisement_id)).toBe(testAdvertisementId);
    expect(Number(payment?.amount)).toBe(paymentAmount);
    expect(payment?.payment_status).toBe("VERIFIED");
    expect(payment?.refunded_by).toBeNull();
    expect(payment?.refunded_at).toBeNull();
  });

  /*
   * ==========================================================================
   * PAYMENT LEDGER DIRECT VERIFICATION
   * ==========================================================================
   */

  it("should preserve the verified payment ledger after financial approval approval", async () => {
    const paymentResult = await pool.query(
      `
      SELECT
        id,
        advertisement_id,
        amount,
        payment_status,
        transaction_reference,
        verified_by,
        verified_at,
        refunded_by,
        refunded_at
      FROM advertisement_payments
      WHERE id = $1
      LIMIT 1
      `,
      [testPaymentId]
    );

    expect(paymentResult.rows.length).toBe(1);

    const payment = paymentResult.rows[0];

    expect(Number(payment?.id)).toBe(testPaymentId);
    expect(Number(payment?.advertisement_id)).toBe(testAdvertisementId);
    expect(Number(payment?.amount)).toBe(paymentAmount);
    expect(payment?.payment_status).toBe("VERIFIED");
    expect(payment?.transaction_reference).toBe(`FA-PS-TXN-${timestamp}`);
    expect(Number(payment?.verified_by)).toBe(creatorUserId);
    expect(payment?.verified_at).toBeDefined();
    expect(payment?.refunded_by).toBeNull();
    expect(payment?.refunded_at).toBeNull();
  });

  /*
   * ==========================================================================
   * APPROVAL HISTORY
   * ==========================================================================
   */

  it("GET /financial-approval/:id/history - should record the payment-linked approval workflow", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}/history`
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

    expect(history.length).toBeGreaterThanOrEqual(2);

    const submittedHistory = history.find(
      (item) => item.fromStatus === null && item.toStatus === "SUBMITTED"
    );

    const approvedHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "APPROVED"
    );

    expect(submittedHistory).toBeDefined();
    expect(approvedHistory).toBeDefined();

    expect(Number(submittedHistory?.actionBy)).toBe(creatorUserId);

    expect(Number(approvedHistory?.actionBy)).toBe(financeUserId);

    expect(submittedHistory?.actionAt).toBeDefined();
    expect(approvedHistory?.actionAt).toBeDefined();
  });

  /*
   * ==========================================================================
   * APPROVED APPROVAL RETAINS PAYMENT LINK
   * ==========================================================================
   */

  it("GET /financial-approval/:id - should retain payment linkage after approval", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    expect(Number(response.body.data.id)).toBe(testApprovalId);
    expect(response.body.data.status).toBe("APPROVED");
    expect(Number(response.body.data.paymentId)).toBe(testPaymentId);
    expect(Number(response.body.data.advertisementId)).toBe(
      testAdvertisementId
    );
    expect(Number(response.body.data.clientId)).toBe(testClientId);
  });

  /*
   * ==========================================================================
   * PAYMENT / APPROVAL SEPARATION
   * ==========================================================================
   */

  it("should confirm financial approval and payment remain separate workflow states", async () => {
    const approvalResult = await pool.query(
      `
      SELECT
        id,
        payment_id,
        advertisement_id,
        status,
        approval_type
      FROM advertisement_financial_approvals
      WHERE id = $1
      LIMIT 1
      `,
      [testApprovalId]
    );

    expect(approvalResult.rows.length).toBe(1);

    const approval = approvalResult.rows[0];

    expect(Number(approval?.id)).toBe(testApprovalId);
    expect(Number(approval?.payment_id)).toBe(testPaymentId);
    expect(Number(approval?.advertisement_id)).toBe(testAdvertisementId);
    expect(approval?.status).toBe("APPROVED");
    expect(approval?.approval_type).toBe("PARTIAL_REFUND");

    const paymentResult = await pool.query(
      `
      SELECT
        id,
        advertisement_id,
        payment_status,
        refunded_by,
        refunded_at
      FROM advertisement_payments
      WHERE id = $1
      LIMIT 1
      `,
      [testPaymentId]
    );

    expect(paymentResult.rows.length).toBe(1);

    const payment = paymentResult.rows[0];

    expect(Number(payment?.id)).toBe(testPaymentId);
    expect(Number(payment?.advertisement_id)).toBe(testAdvertisementId);
    expect(payment?.payment_status).toBe("VERIFIED");
    expect(payment?.refunded_by).toBeNull();
    expect(payment?.refunded_at).toBeNull();
  });

  /*
   * ==========================================================================
   * APPROVED FINANCIAL APPROVAL CANNOT BE APPROVED AGAIN
   * ==========================================================================
   */

  it("POST /financial-approval/:id/approve - should reject approving the already approved payment-linked approval", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        remarks: "Second approval attempt for payment synchronization test."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * FINANCIAL APPROVAL EXISTS BY ID
   * ==========================================================================
   *
   * The current exists controller accepts the financial approval id as a
   * route parameter. It is not an advertisement/payment query endpoint.
   */
  /*
  it("GET /financial-approval/exists/:id - should confirm that the financial approval exists", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/exists/${testApprovalId}`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.exists).toBe(true);
  });
*/
  /*
   * ==========================================================================
   * ADVERTISEMENT APPROVAL EXISTENCE
   * ==========================================================================
   *
   * This uses the dedicated advertisement existence endpoint exposed by the
   * controller rather than attempting to combine advertisementId/paymentId
   * into the generic /exists endpoint.
   */
  /*
  it("GET /financial-approval/exists/advertisement/:advertisementId - should confirm an approval exists for the advertisement", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/exists/advertisement/${testAdvertisementId}`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.exists).toBe(true);
  });
*/
  /*
   * ==========================================================================
   * AUTHENTICATION
   * ==========================================================================
   */

  it("GET /financial-approval/:id - should reject an unauthenticated request", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/payments/financial-approval/${testApprovalId}`
    );

    expect(response.status).toBe(401);
  });

  /*
   * ==========================================================================
   * FINANCE READ PERMISSION
   * ==========================================================================
   */

  it("GET /financial-approval/:id - should deny access without financial approval READ permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [financeRoleId, financePermissionIds.read]
    );

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

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
      [financeRoleId, financePermissionIds.read, financeUserId]
    );
  });

  /*
   * ==========================================================================
   * FINANCE APPROVE PERMISSION
   * ==========================================================================
   */

  it("POST /financial-approval/:id/approve - should deny access without financial approval APPROVE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [financeRoleId, financePermissionIds.approve]
    );

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${testApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        remarks: "Permission boundary test."
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
      [financeRoleId, financePermissionIds.approve, financeUserId]
    );
  });
});
