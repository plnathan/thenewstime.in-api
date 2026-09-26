import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Financial Approval Threshold Integration", () => {
  let accessToken = "";

  let testUserId = 0;
  let testRoleId = 0;
  let testClientId = 0;
  let testAdvertisementId = 0;

  const timestamp = Date.now();

  const username = `financial_approval_threshold_test_${timestamp}`;

  const email = `financial.approval.threshold.test.${timestamp}@example.com`;

  /*
   * roles.code is VARCHAR(50).
   *
   * Keep this fixture value comfortably below the production limit.
   */
  const roleName = `fat_threshold_role_${timestamp}`;

  const clientCode = `FAT-${timestamp}`;

  const password = "Test@12345";

  const FINANCIAL_APPROVAL_RESOURCE = "advertisements.financial_approvals";

  const permissionCodes = {
    advertisementRead: "advertisements.read",

    advertisementCreate: "advertisements.create",

    advertisementSubmit: "advertisements.submit",

    financialApprovalRead: `${FINANCIAL_APPROVAL_RESOURCE}.read`,

    financialApprovalApprove: `${FINANCIAL_APPROVAL_RESOURCE}.approve`
  } as const;

  const permissionIds = new Map<string, number>();

  const createdApprovalIds: number[] = [];

  const createdPaymentIds: number[] = [];

  const createdThresholdIds: number[] = [];

  const insertRolePermission = async (
    roleId: number,
    permissionId: number,
    createdBy: number
  ): Promise<void> => {
    await pool.query(
      `
        INSERT INTO role_permissions (
          role_id,
          permission_id,
          created_by,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          NOW()
        )
        ON CONFLICT DO NOTHING
      `,
      [roleId, permissionId, createdBy]
    );
  };

  const deleteApproval = async (approvalId: number): Promise<void> => {
    if (approvalId <= 0) {
      return;
    }

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
  };

  const deletePayment = async (paymentId: number): Promise<void> => {
    if (paymentId <= 0) {
      return;
    }

    await pool.query(
      `
        DELETE FROM advertisement_payments
        WHERE id = $1
      `,
      [paymentId]
    );
  };

  /*
   * ========================================================================
   * TEST-ISOLATION CLEANUP
   * ========================================================================
   *
   * The financial approval service intentionally prevents more than one
   * pending financial approval from existing for the same advertisement.
   *
   * A threshold-exceeded approval transitions to HOLD and therefore remains
   * pending. Since this integration suite reuses one advertisement fixture,
   * the HOLD approval must be removed before the next test starts.
   *
   * This cleanup is deliberately scoped to the unique advertisement created
   * by this test suite.
   *
   * Cleanup order:
   *
   *   1. History
   *   2. Financial approvals
   *   3. Payments
   *
   * This preserves foreign-key integrity.
   */
  const resetFinancialApprovalFixtures = async (): Promise<void> => {
    if (testAdvertisementId <= 0) {
      return;
    }

    /*
     * Delete approval history first because it references the approval.
     */
    await pool.query(
      `
        DELETE FROM advertisement_financial_approval_history
        WHERE approval_id IN (
          SELECT id
          FROM advertisement_financial_approvals
          WHERE advertisement_id = $1
        )
      `,
      [testAdvertisementId]
    );

    /*
     * Delete all financial approvals belonging to this test advertisement.
     *
     * This removes SUBMITTED, HOLD, APPROVED, REJECTED, etc. records from
     * previous tests and guarantees that every test starts without a
     * pending approval conflict.
     */
    await pool.query(
      `
        DELETE FROM advertisement_financial_approvals
        WHERE advertisement_id = $1
      `,
      [testAdvertisementId]
    );

    /*
     * Delete payments belonging to this test advertisement.
     *
     * Payments are created only by this integration suite for the dedicated
     * test advertisement.
     */
    await pool.query(
      `
        DELETE FROM advertisement_payments
        WHERE advertisement_id = $1
      `,
      [testAdvertisementId]
    );
  };

  const createThreshold = async (options: {
    approvalType: string;
    amountThreshold?: number | null;
    percentageThreshold?: number | null;
    status?: string;
  }): Promise<number> => {
    const result = await pool.query<{
      id: number | string;
    }>(
      `
        INSERT INTO advertisement_financial_approval_thresholds (
          approval_type,
          amount_threshold,
          percentage_threshold,
          status,
          created_by,
          updated_by,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $5,
          NOW(),
          NOW()
        )
        RETURNING id
      `,
      [
        options.approvalType,
        options.amountThreshold ?? null,
        options.percentageThreshold ?? null,
        options.status ?? "ACTIVE",
        testUserId
      ]
    );

    const threshold = result.rows[0];

    if (threshold === undefined) {
      throw new Error("Failed to create financial approval threshold fixture.");
    }

    const thresholdId = Number(threshold.id);

    expect(thresholdId).toBeGreaterThan(0);

    createdThresholdIds.push(thresholdId);

    return thresholdId;
  };

  const deactivatePartialRefundThresholds = async (): Promise<void> => {
    await pool.query(
      `
        UPDATE advertisement_financial_approval_thresholds
        SET
          status = 'INACTIVE',
          updated_at = NOW()
        WHERE approval_type = 'PARTIAL_REFUND'
      `
    );
  };

  const createPayment = async (amount: number): Promise<number> => {
    const result = await pool.query<{
      id: number | string;
    }>(
      `
        INSERT INTO advertisement_payments (
          advertisement_id,
          amount,
          payment_date,
          payment_method,
          payment_status,
          transaction_reference,
          notes,
          recorded_by,
          created_at,
          updated_at,
          payment_type
        )
        VALUES (
          $1,
          $2,
          NOW(),
          $3,
          'VERIFIED',
          $4,
          $5,
          $6,
          NOW(),
          NOW(),
          'REGULAR'
        )
        RETURNING id
      `,
      [
        testAdvertisementId,
        amount,
        "BANK_TRANSFER",
        `FAT-PAY-${timestamp}-${createdPaymentIds.length + 1}`,
        "Financial approval threshold integration test payment.",
        testUserId
      ]
    );

    const payment = result.rows[0];

    if (payment === undefined) {
      throw new Error("Failed to create payment fixture.");
    }

    const paymentId = Number(payment.id);

    expect(paymentId).toBeGreaterThan(0);

    createdPaymentIds.push(paymentId);

    return paymentId;
  };

  const createApproval = async (input: {
    requestedAmount?: number;
    requestedPercentage?: number;
    paymentId?: number;
  }): Promise<number> => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,

        clientId: testClientId,

        paymentId: input.paymentId,

        approvalType: "PARTIAL_REFUND",

        requestedAmount: input.requestedAmount,

        requestedPercentage: input.requestedPercentage,

        approvalRemarks: "Financial approval threshold integration test."
      });

    expect(
      response.status,
      `Financial approval creation failed: ${JSON.stringify(response.body)}`
    ).toBe(201);

    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    expect(response.body.data.status).toBe("SUBMITTED");

    createdApprovalIds.push(approvalId);

    return approvalId;
  };

  const approveApproval = async (
    approvalId: number
  ): Promise<{
    statusCode: number;
    status: string | undefined;
    body: unknown;
  }> => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        approvalRemarks: "Threshold review performed."
      });

    return {
      statusCode: response.status,

      status: response.body?.data?.status,

      body: response.body
    };
  };

  const getApproval = async (
    approvalId: number
  ): Promise<{
    id: number;
    status: string;
    paymentId: number | null;
  }> => {
    const response = await request(app)
      .get(`/api/v1/advertisements/payments/financial-approval/${approvalId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(
      response.status,
      `Financial approval retrieval failed: ${JSON.stringify(response.body)}`
    ).toBe(200);

    expect(response.body.success).toBe(true);

    return {
      id: Number(response.body.data.id),

      status: response.body.data.status,

      paymentId:
        response.body.data.paymentId === null ||
        response.body.data.paymentId === undefined
          ? null
          : Number(response.body.data.paymentId)
    };
  };

  const getHistory = async (
    approvalId: number
  ): Promise<
    Array<{
      approvalId: number;
      fromStatus: string | null;
      toStatus: string;
      holdReason: string | null;
    }>
  > => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/history`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(
      response.status,
      `Financial approval history retrieval failed: ${JSON.stringify(
        response.body
      )}`
    ).toBe(200);

    expect(response.body.success).toBe(true);

    return response.body.data ?? [];
  };

  beforeAll(async () => {
    /*
     * ======================================================================
     * SUPER ADMIN ROLE
     * ======================================================================
     */

    const superAdminRoleResult = await pool.query<{
      id: number | string;
    }>(
      `
        SELECT id
        FROM roles
        WHERE code = 'SUPER_ADMIN'
          AND status = 'ACTIVE'
        LIMIT 1
      `
    );

    const superAdminRole = superAdminRoleResult.rows[0];

    if (superAdminRole === undefined) {
      throw new Error("SUPER_ADMIN role was not found.");
    }

    const superAdminRoleId = Number(superAdminRole.id);

    expect(superAdminRoleId).toBeGreaterThan(0);

    /*
     * ======================================================================
     * TEST USER
     * ======================================================================
     */

    const passwordHash = await bcrypt.hash(password, 12);

    const userResult = await pool.query<{
      id: number | string;
    }>(
      `
        INSERT INTO users (
          username,
          email,
          password_hash,
          full_name,
          display_name,
          status,
          role_id,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'ACTIVE',
          $6,
          NOW(),
          NOW()
        )
        RETURNING id
      `,
      [
        username,
        email,
        passwordHash,
        "Financial Approval Threshold Integration Test User",
        "Financial Approval Threshold Test User",
        superAdminRoleId
      ]
    );

    const user = userResult.rows[0];

    if (user === undefined) {
      throw new Error(
        "Failed to create financial approval threshold test user."
      );
    }

    testUserId = Number(user.id);

    expect(testUserId).toBeGreaterThan(0);

    /*
     * ======================================================================
     * TEST ROLE
     * ======================================================================
     */

    const roleResult = await pool.query<{
      id: number | string;
    }>(
      `
        INSERT INTO roles (
          code,
          display_name,
          description,
          display_order,
          status,
          created_by,
          updated_by,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          999,
          'ACTIVE',
          $4,
          $4,
          NOW(),
          NOW()
        )
        RETURNING id
      `,
      [
        roleName,
        "Financial Approval Threshold Integration Test Role",
        "Temporary role for financial approval threshold integration tests.",
        testUserId
      ]
    );

    const role = roleResult.rows[0];

    if (role === undefined) {
      throw new Error(
        "Failed to create financial approval threshold test role."
      );
    }

    testRoleId = Number(role.id);

    expect(testRoleId).toBeGreaterThan(0);

    /*
     * Move the test user to the dedicated test role.
     */

    await pool.query(
      `
        UPDATE users
        SET role_id = $2
        WHERE id = $1
      `,
      [testUserId, testRoleId]
    );

    /*
     * Keep many-to-many RBAC mapping consistent.
     */

    await pool.query(
      `
        DELETE FROM user_roles
        WHERE user_id = $1
      `,
      [testUserId]
    );

    await pool.query(
      `
        INSERT INTO user_roles (
          user_id,
          role_id,
          created_by,
          created_at
        )
        VALUES (
          $1,
          $2,
          $1,
          NOW()
        )
        ON CONFLICT DO NOTHING
      `,
      [testUserId, testRoleId]
    );

    /*
     * ======================================================================
     * RESOLVE PRODUCTION PERMISSIONS
     * ======================================================================
     *
     * Threshold evaluation occurs during financial approval approval.
     *
     * The test therefore requires:
     *
     * advertisements.read
     * advertisements.create
     * advertisements.submit
     * advertisements.financial_approvals.read
     * advertisements.financial_approvals.approve
     *
     * No threshold-specific permission is introduced here.
     */

    const requiredPermissionCodes = Object.values(permissionCodes);

    for (const permissionCode of requiredPermissionCodes) {
      const permissionResult = await pool.query<{
        id: number | string;
        code: string;
        module: string;
        resource: string;
        action: string;
        status: string;
      }>(
        `
          SELECT
            id,
            code,
            module,
            resource,
            action,
            status
          FROM permissions
          WHERE code = $1
          LIMIT 1
        `,
        [permissionCode]
      );

      const permission = permissionResult.rows[0];

      if (permission === undefined) {
        throw new Error(
          `Required production permission '${permissionCode}' was not found.`
        );
      }

      expect(
        permission.status,
        `Permission '${permissionCode}' must be ACTIVE.`
      ).toBe("ACTIVE");

      expect(permission.module).toBe("ADVERTISEMENT");

      const parts = permissionCode.split(".");

      const action = parts.at(-1);

      const resource = parts.slice(0, -1).join(".");

      expect(permission.action).toBe(action);

      expect(permission.resource).toBe(resource);

      const permissionId = Number(permission.id);

      expect(permissionId).toBeGreaterThan(0);

      permissionIds.set(permissionCode, permissionId);

      await insertRolePermission(testRoleId, permissionId, testUserId);
    }

    /*
     * ======================================================================
     * VERIFY REQUIRED ROLE PERMISSIONS
     * ======================================================================
     */

    const verificationResult = await pool.query<{
      id: number | string;
      code: string;
    }>(
      `
        SELECT
          p.id,
          p.code
        FROM role_permissions rp
        INNER JOIN permissions p
          ON p.id = rp.permission_id
        WHERE rp.role_id = $1
          AND p.status = 'ACTIVE'
          AND p.code = ANY($2::text[])
        ORDER BY p.code
      `,
      [testRoleId, requiredPermissionCodes]
    );

    const attachedCodes = new Set(
      verificationResult.rows.map((row) => row.code)
    );

    expect(attachedCodes.size).toBe(requiredPermissionCodes.length);

    for (const permissionCode of requiredPermissionCodes) {
      expect(attachedCodes.has(permissionCode)).toBe(true);
    }

    /*
     * ======================================================================
     * TEST CLIENT
     * ======================================================================
     */

    const clientResult = await pool.query<{
      id: number | string;
    }>(
      `
        INSERT INTO advertisement_clients (
          client_code,
          name,
          display_name,
          status,
          ad_creation_hold,
          created_by,
          updated_by,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'ACTIVE',
          FALSE,
          $4,
          $4,
          NOW(),
          NOW()
        )
        RETURNING id
      `,
      [
        clientCode,
        "Financial Approval Threshold Test Client",
        "Financial Approval Threshold Test Client",
        testUserId
      ]
    );

    const client = clientResult.rows[0];

    if (client === undefined) {
      throw new Error(
        "Failed to create financial approval threshold test client."
      );
    }

    testClientId = Number(client.id);

    expect(testClientId).toBeGreaterThan(0);

    /*
     * ======================================================================
     * LOGIN
     * ======================================================================
     *
     * IMPORTANT:
     * The advertisement creation endpoint requires authentication.
     * Therefore the access token must be obtained BEFORE creating the
     * advertisement fixture.
     */

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username,
      password
    });

    expect(
      loginResponse.status,
      `Login failed: ${JSON.stringify(loginResponse.body)}`
    ).toBe(200);

    accessToken = loginResponse.body?.data?.tokens?.accessToken;

    expect(
      accessToken,
      `Login response does not contain an access token: ${JSON.stringify(
        loginResponse.body
      )}`
    ).toBeTruthy();

    /*
     * ======================================================================
     * ADVERTISEMENT FIXTURE
     * ======================================================================
     */

    const advertisementResponse = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: testClientId,

        name: "Financial Approval Threshold Integration Test Advertisement",

        internalName: `financial-approval-threshold-test-ad-${timestamp}`,

        advertisementType: "DISPLAY",

        destinationUrl:
          "https://example.com/financial-approval-threshold-test",

        priority: 10,

        isClickable: true,

        openInNewTab: true,

        notes:
          "Advertisement fixture for financial approval threshold integration tests.",

        advertisementAmount: 100000,

        currencyCode: "INR"
      });

    expect(
      advertisementResponse.status,
      `Advertisement creation failed: ${JSON.stringify(
        advertisementResponse.body
      )}`
    ).toBe(201);

    expect(advertisementResponse.body.success).toBe(true);

    testAdvertisementId = Number(advertisementResponse.body.data.id);

    expect(testAdvertisementId).toBeGreaterThan(0);

    expect(advertisementResponse.body.data.workflowStatus).toBe("DRAFT");
  });

  beforeEach(async () => {
    /*
     * ======================================================================
     * TEST ISOLATION
     * ======================================================================
     *
     * Every test reuses the same advertisement fixture.
     *
     * A threshold-exceeded approval becomes HOLD. HOLD is intentionally a
     * pending financial approval, so the production service correctly
     * rejects a second approval for the same advertisement with HTTP 409.
     *
     * Remove all financial approval records and test payments belonging to
     * this dedicated advertisement before every test.
     */

    await resetFinancialApprovalFixtures();

    /*
     * Threshold tests must also be isolated from one another.
     *
     * Deactivate all existing PARTIAL_REFUND threshold configurations before
     * the current test creates its own threshold.
     */
    await deactivatePartialRefundThresholds();
  });

  afterAll(async () => {
    /*
     * ======================================================================
     * APPROVAL CLEANUP
     * ======================================================================
     */

    const uniqueApprovalIds = [...createdApprovalIds].filter(
      (id, index, array) => id > 0 && array.indexOf(id) === index
    );

    for (const approvalId of uniqueApprovalIds) {
      try {
        await deleteApproval(approvalId);
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * PAYMENT CLEANUP
     * ======================================================================
     */

    const uniquePaymentIds = [...createdPaymentIds].filter(
      (id, index, array) => id > 0 && array.indexOf(id) === index
    );

    for (const paymentId of uniquePaymentIds) {
      try {
        await deletePayment(paymentId);
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * THRESHOLD CLEANUP
     * ======================================================================
     */

    const uniqueThresholdIds = [...createdThresholdIds].filter(
      (id, index, array) => id > 0 && array.indexOf(id) === index
    );

    for (const thresholdId of uniqueThresholdIds) {
      try {
        await pool.query(
          `
            DELETE FROM advertisement_financial_approval_thresholds
            WHERE id = $1
          `,
          [thresholdId]
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * ADVERTISEMENT CLEANUP
     * ======================================================================
     */

    if (testAdvertisementId > 0) {
      try {
        /*
         * Final safety cleanup for any approvals/payments that may still
         * exist if a test failed before beforeEach/after-test cleanup could
         * complete normally.
         */
        await resetFinancialApprovalFixtures();
      } catch {
        // Cleanup must not fail the suite.
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
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * CLIENT CLEANUP
     * ======================================================================
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
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * ROLE PERMISSION CLEANUP
     * ======================================================================
     */

    if (testRoleId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM role_permissions
            WHERE role_id = $1
          `,
          [testRoleId]
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * USER ROLE CLEANUP
     * ======================================================================
     */

    if (testRoleId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM user_roles
            WHERE role_id = $1
          `,
          [testRoleId]
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * ROLE CLEANUP
     * ======================================================================
     */

    if (testRoleId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM roles
            WHERE id = $1
          `,
          [testRoleId]
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * USER CLEANUP
     * ======================================================================
     */

    if (testUserId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM users
            WHERE id = $1
          `,
          [testUserId]
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    await pool.end();
  });

  /*
   * =========================================================================
   * AUTHENTICATION
   * =========================================================================
   */

  it("should authenticate the test user", () => {
    expect(accessToken).toBeTruthy();
  });

  /*
   * =========================================================================
   * AMOUNT THRESHOLD
   * =========================================================================
   */

  it("should approve a requested amount below the configured threshold", async () => {
    await createThreshold({
      approvalType: "PARTIAL_REFUND",

      amountThreshold: 10000
    });

    const approvalId = await createApproval({
      requestedAmount: 9999
    });

    const result = await approveApproval(approvalId);

    expect(result.statusCode, JSON.stringify(result.body)).toBe(200);

    expect(result.status).toBe("APPROVED");
  });

  it("should approve a requested amount exactly equal to the configured threshold", async () => {
    await createThreshold({
      approvalType: "PARTIAL_REFUND",

      amountThreshold: 10000
    });

    const approvalId = await createApproval({
      requestedAmount: 10000
    });

    const result = await approveApproval(approvalId);

    expect(result.statusCode, JSON.stringify(result.body)).toBe(200);

    expect(result.status).toBe("APPROVED");
  });

  it("should place a requested amount above the configured threshold on hold", async () => {
    await createThreshold({
      approvalType: "PARTIAL_REFUND",

      amountThreshold: 10000
    });

    const approvalId = await createApproval({
      requestedAmount: 10001
    });

    const result = await approveApproval(approvalId);

    expect(result.statusCode, JSON.stringify(result.body)).toBe(200);

    expect(result.status).toBe("HOLD");

    const approval = await getApproval(approvalId);

    expect(approval.status).toBe("HOLD");
  });

  /*
   * =========================================================================
   * THRESHOLD HISTORY
   * =========================================================================
   */

  it("should record THRESHOLD_EXCEEDED when a requested amount exceeds the threshold", async () => {
    await createThreshold({
      approvalType: "PARTIAL_REFUND",

      amountThreshold: 10000
    });

    const approvalId = await createApproval({
      requestedAmount: 10001
    });

    const result = await approveApproval(approvalId);

    expect(result.status).toBe("HOLD");

    const history = await getHistory(approvalId);

    const thresholdHistory = history.find(
      (entry) => entry.fromStatus === "SUBMITTED" && entry.toStatus === "HOLD"
    );

    expect(thresholdHistory).toBeDefined();

    expect(thresholdHistory?.approvalId).toBe(approvalId);

    expect(thresholdHistory?.holdReason).toContain("THRESHOLD_EXCEEDED");
  });

  /*
   * =========================================================================
   * HOLD -> APPROVED
   * =========================================================================
   */

  it("should allow a threshold-held approval to be approved without re-evaluating the threshold", async () => {
    await createThreshold({
      approvalType: "PARTIAL_REFUND",

      amountThreshold: 10000
    });

    const approvalId = await createApproval({
      requestedAmount: 10001
    });

    const firstResult = await approveApproval(approvalId);

    expect(firstResult.statusCode, JSON.stringify(firstResult.body)).toBe(200);

    expect(firstResult.status).toBe("HOLD");

    const secondResult = await approveApproval(approvalId);

    expect(secondResult.statusCode, JSON.stringify(secondResult.body)).toBe(
      200
    );

    expect(secondResult.status).toBe("APPROVED");

    const approval = await getApproval(approvalId);

    expect(approval.status).toBe("APPROVED");
  });

  /*
   * =========================================================================
   * PERCENTAGE THRESHOLD
   * =========================================================================
   */

  it("should approve a requested percentage below the configured threshold", async () => {
    await createThreshold({
      approvalType: "PARTIAL_REFUND",

      percentageThreshold: 25
    });

    const approvalId = await createApproval({
      requestedPercentage: 24.99
    });

    const result = await approveApproval(approvalId);

    expect(result.statusCode, JSON.stringify(result.body)).toBe(200);

    expect(result.status).toBe("APPROVED");
  });

  it("should approve a requested percentage exactly equal to the configured threshold", async () => {
    await createThreshold({
      approvalType: "PARTIAL_REFUND",

      percentageThreshold: 25
    });

    const approvalId = await createApproval({
      requestedPercentage: 25
    });

    const result = await approveApproval(approvalId);

    expect(result.statusCode, JSON.stringify(result.body)).toBe(200);

    expect(result.status).toBe("APPROVED");
  });

  it("should place a requested percentage above the configured threshold on hold", async () => {
    await createThreshold({
      approvalType: "PARTIAL_REFUND",

      percentageThreshold: 25
    });

    const approvalId = await createApproval({
      requestedPercentage: 25.01
    });

    const result = await approveApproval(approvalId);

    expect(result.statusCode, JSON.stringify(result.body)).toBe(200);

    expect(result.status).toBe("HOLD");
  });

  /*
   * =========================================================================
   * NO ACTIVE THRESHOLD
   * =========================================================================
   */

  it("should approve normally when no active threshold exists", async () => {
    const approvalId = await createApproval({
      requestedAmount: 50000
    });

    const result = await approveApproval(approvalId);

    expect(result.statusCode, JSON.stringify(result.body)).toBe(200);

    expect(result.status).toBe("APPROVED");
  });

  /*
   * =========================================================================
   * PAYMENT LEDGER IS NOT CHANGED
   * =========================================================================
   */

  it("should not change the payment when threshold approval is placed on hold", async () => {
    await createThreshold({
      approvalType: "PARTIAL_REFUND",

      amountThreshold: 10000
    });

    const paymentId = await createPayment(50000);

    const approvalId = await createApproval({
      requestedAmount: 10001,

      paymentId
    });

    const result = await approveApproval(approvalId);

    expect(result.statusCode, JSON.stringify(result.body)).toBe(200);

    expect(result.status).toBe("HOLD");

    const paymentResult = await pool.query<{
      payment_status: string;
      amount: string;
    }>(
      `
        SELECT
          payment_status,
          amount
        FROM advertisement_payments
        WHERE id = $1
      `,
      [paymentId]
    );

    const payment = paymentResult.rows[0];

    expect(payment).toBeDefined();

    expect(payment?.payment_status).toBe("VERIFIED");

    expect(Number(payment?.amount)).toBe(50000);
  });

  /*
   * =========================================================================
   * CLIENT AD-CREATION HOLD IS INDEPENDENT
   * =========================================================================
   */

  it("should keep threshold hold separate from client ad creation hold", async () => {
    await createThreshold({
      approvalType: "PARTIAL_REFUND",

      amountThreshold: 10000
    });

    const approvalId = await createApproval({
      requestedAmount: 10001
    });

    const result = await approveApproval(approvalId);

    expect(result.statusCode, JSON.stringify(result.body)).toBe(200);

    expect(result.status).toBe("HOLD");

    const clientResult = await pool.query<{
      ad_creation_hold: boolean;
    }>(
      `
        SELECT
          ad_creation_hold
        FROM advertisement_clients
        WHERE id = $1
      `,
      [testClientId]
    );

    const client = clientResult.rows[0];

    expect(client).toBeDefined();

    expect(client?.ad_creation_hold).toBe(false);
  });
});

