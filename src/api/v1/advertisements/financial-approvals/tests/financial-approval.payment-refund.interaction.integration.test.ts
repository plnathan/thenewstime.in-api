import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Financial Approval + Payment/Refund Interaction Integration", () => {
  let creatorAccessToken = "";
  let financeAccessToken = "";

  let creatorUserId = 0;
  let financeUserId = 0;

  let creatorRoleId = 0;
  let financeRoleId = 0;

  let clientId = 0;
  let advertisementId = 0;
  let placementId = 0;

  let paymentId = 0;

  const createdPermissionIds: number[] = [];

  const FINANCIAL_APPROVAL_BASE_PATH =
    "/api/v1/advertisements/payments/financial-approval";

  const creatorPermissions = [
    "advertisements.read",
    "advertisements.create",
    "advertisements.update",
    "advertisements.submit"
  ];

  const financePermissions = [
    "advertisements.financial_approvals.read",
    "advertisements.financial_approvals.hold",
    "advertisements.financial_approvals.reject",
    "advertisements.financial_approvals.approve",
    "advertisements.payments.read",
    "advertisements.payments.create",
    "advertisements.payments.update",
    "advertisements.payments.verify",
    "advertisements.payments.cancel",
    "advertisements.payments.refund"
  ];

  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const creatorUsername = `financial-interaction-creator-${uniqueSuffix}`;
  const creatorPassword = "Test@12345";

  const financeUsername = `financial-interaction-finance-${uniqueSuffix}`;
  const financePassword = "Test@12345";

  const creatorRoleName = `Financial Interaction Creator ${uniqueSuffix}`;
  const financeRoleName = `Financial Interaction Finance ${uniqueSuffix}`;

  const clientName = `Financial Interaction Client ${uniqueSuffix}`;
  const advertisementName = `Financial Interaction Advertisement ${uniqueSuffix}`;
  const placementCode = `TEST-FA-INTERACTION-PLACEMENT-${uniqueSuffix}`;

  const getResponseBody = (
    response: request.Response
  ): Record<string, unknown> => response.body as Record<string, unknown>;

  const getData = <T>(response: request.Response): T =>
    getResponseBody(response).data as T;

  const getErrorMessage = (response: request.Response): string => {
    const body = getResponseBody(response);

    if (typeof body.message === "string") {
      return body.message;
    }

    return JSON.stringify(body);
  };

  const createPermissionIfNeeded = async (
    permissionCode: string
  ): Promise<number> => {
    const existingPermission = await pool.query<{ id: number }>(
      `
        SELECT id
        FROM permissions
        WHERE code = $1
        LIMIT 1
        `,
      [permissionCode]
    );

    const existingRow = existingPermission.rows[0];

    if (existingRow !== undefined) {
      return Number(existingRow.id);
    }

    const permissionParts = permissionCode.split(".");
    const action = permissionParts.pop() ?? "read";
    const resource = permissionParts.join(".");

    const result = await pool.query<{ id: number }>(
      `
        INSERT INTO permissions
        (
          module,
          resource,
          action,
          display_order,
          is_system_permission,
          status
        )
        VALUES
        (
          'ADVERTISEMENT',
          $1,
          $2,
          9999,
          FALSE,
          'ACTIVE'
        )
        RETURNING id
        `,
      [resource, action]
    );

    const row = result.rows[0];

    if (row === undefined) {
      throw new Error(`Failed to create permission '${permissionCode}'.`);
    }

    const permissionId = Number(row.id);

    createdPermissionIds.push(permissionId);

    return permissionId;
  };

  const createRole = async (
    roleName: string,
    permissionCodes: string[]
  ): Promise<number> => {
    /*
     * Ensure every permission required by this temporary test role
     * exists before the role is created.
     */
    for (const permissionCode of permissionCodes) {
      await createPermissionIfNeeded(permissionCode);
    }

    const roleResult = await pool.query<{ id: number }>(
      `
        INSERT INTO roles
        (
          code,
          display_name,
          description,
          display_order,
          status,
          is_system_role
        )
        VALUES
        (
          $1,
          $2,
          $3,
          0,
          'ACTIVE',
          FALSE
        )
        RETURNING id
        `,
      [
        roleName,
        roleName,
        `Temporary role for ${roleName} interaction integration tests`
      ]
    );

    const roleId = roleResult.rows[0]?.id;

    if (roleId === undefined) {
      throw new Error(`Failed to create role: ${roleName}`);
    }

    for (const permissionCode of permissionCodes) {
      const permissionResult = await pool.query<{ id: number }>(
        `
          SELECT id
          FROM permissions
          WHERE code = $1
          LIMIT 1
          `,
        [permissionCode]
      );

      const permissionId = permissionResult.rows[0]?.id;

      if (permissionId === undefined) {
        throw new Error(
          `Permission not found while creating role ${roleName}: ${permissionCode}`
        );
      }

      await pool.query(
        `
          INSERT INTO role_permissions
          (
            role_id,
            permission_id
          )
          VALUES
          (
            $1,
            $2
          )
          ON CONFLICT DO NOTHING
          `,
        [roleId, permissionId]
      );
    }

    return Number(roleId);
  };

  const createUser = async (
    username: string,
    password: string,
    roleId: number
  ): Promise<number> => {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query<{ id: number }>(
      `
        INSERT INTO users
        (
          full_name,
          display_name,
          username,
          password_hash,
          status,
          must_change_password
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          'ACTIVE',
          FALSE
        )
        RETURNING id
        `,
      [username, username, username, passwordHash]
    );

    const row = result.rows[0];

    if (row === undefined) {
      throw new Error(`Failed to create user '${username}'.`);
    }

    const userId = Number(row.id);

    await pool.query(
      `
        INSERT INTO user_roles
        (
          user_id,
          role_id
        )
        VALUES
        (
          $1,
          $2
        )
        `,
      [userId, roleId]
    );

    return userId;
  };

  const login = async (username: string, password: string): Promise<string> => {
    const response = await request(app).post("/api/v1/auth/login").send({
      username,
      password
    });

    expect(
      response.status,
      `Login failed for ${username}: ${getErrorMessage(response)}`
    ).toBe(200);

    const data = getData<{
      user?: {
        id?: string | number;
        username?: string;
      };
      tokens?: {
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: string;
      };
    }>(response);

    expect(data.user).toBeDefined();
    expect(data.tokens).toBeDefined();

    const token = data.tokens?.accessToken;

    if (!token) {
      throw new Error(
        `Login succeeded for '${username}' but no access token was returned.`
      );
    }

    return token;
  };

  const createClient = async (): Promise<number> => {
    const result = await pool.query<{ id: number }>(
      `
        INSERT INTO advertisement_clients
        (
          name,
          display_name,
          client_code,
          status
        )
        VALUES
        (
          $1,
          $1,
          $2,
          'ACTIVE'
        )
        RETURNING id
        `,
      [clientName, `FIC-${uniqueSuffix}`]
    );

    const row = result.rows[0];

    if (row === undefined) {
      throw new Error("Failed to create advertisement client fixture.");
    }

    return Number(row.id);
  };

  const createPlacement = async (): Promise<number> => {
    const result = await pool.query<{ id: number | string }>(
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
        placementCode,
        `Financial Interaction Integration Test Placement ${uniqueSuffix}`,
        "Temporary placement for financial approval payment/refund interaction integration tests.",
        creatorUserId
      ]
    );

    const row = result.rows[0];

    if (row === undefined) {
      throw new Error("Failed to create financial interaction test placement.");
    }

    const id = Number(row.id);

    expect(id).toBeGreaterThan(0);

    return id;
  };

  const createAdvertisement = async (): Promise<number> => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId,
        placementId,
        name: advertisementName,
        internalName: `financial-interaction-${uniqueSuffix}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/financial-interaction",
        priority: 10,
        clickable: true,
        openInNewTab: true,
        notes: "Financial approval payment/refund interaction test.",
        advertisementAmount: 50000,
        currencyCode: "INR"
      });

    expect(
      response.status,
      `Advertisement creation failed: ${getErrorMessage(response)}`
    ).toBe(201);

    const data = getData<{ id: number }>(response);

    expect(data.id).toBeDefined();

    return Number(data.id);
  };

  const configureAdvanceRequirement = async (
    advanceAmount: number
  ): Promise<void> => {
    const result = await pool.query(
      `
        UPDATE advertisements
        SET advance_amount = $2
        WHERE id = $1
      `,
      [advertisementId, advanceAmount]
    );

    expect(result.rowCount).toBe(1);
  };

  const createPayment = async (
    amount: number,
    paymentType: "ADVANCE" | "REGULAR" | "FINAL" | "INSTALLMENT",
    transactionReference: string
  ): Promise<number> => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        advertisementId,
        amount,
        paymentType,
        paymentMethod: "UPI",
        transactionReference
      });

    expect(
      response.status,
      `Payment creation failed: ${getErrorMessage(response)}`
    ).toBe(201);

    const data = getData<{
      id: number;
      paymentStatus: string;
    }>(response);

    expect(data.id).toBeDefined();
    expect(data.paymentStatus).toBe("RECEIVED");

    return Number(data.id);
  };

  const verifyPayment = async (id: number): Promise<void> => {
    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${id}/verify`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(
      response.status,
      `Payment verification failed: ${getErrorMessage(response)}`
    ).toBe(200);

    const data = getData<{
      id: number;
      paymentStatus: string;
    }>(response);

    expect(data.id).toBe(id);
    expect(data.paymentStatus).toBe("VERIFIED");
  };

  const createFinancialApproval = async (input: {
    paymentId: number;
    approvalType: "REFUND" | "PARTIAL_REFUND";
    requestedAmount: number;
    approvalRemarks: string;
  }): Promise<number> => {
    const response = await request(app)
      .post(FINANCIAL_APPROVAL_BASE_PATH)
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId,
        clientId,
        paymentId: input.paymentId,
        approvalType: input.approvalType,
        requestedAmount: input.requestedAmount,
        approvalRemarks: input.approvalRemarks
      });

    expect(
      response.status,
      `Financial approval creation failed: ${getErrorMessage(response)}`
    ).toBe(201);

    const data = getData<{
      id: number;
      paymentId: number | null;
      status: string;
      approvalType: string;
      requestedAmount: number | null;
    }>(response);

    expect(data.id).toBeDefined();
    expect(data.paymentId).toBe(input.paymentId);
    expect(data.status).toBe("SUBMITTED");
    expect(data.approvalType).toBe(input.approvalType);
    expect(data.requestedAmount).toBe(input.requestedAmount);

    return Number(data.id);
  };

  const approveFinancialApproval = async (
    approvalId: number,
    approvalRemarks: string
  ): Promise<void> => {
    /*
     * Financial approval workflow requires:
     *
     * SUBMITTED -> HOLD -> APPROVED
     *
     * Direct SUBMITTED -> APPROVED is intentionally not permitted
     * by the production workflow.
     */
    const holdResponse = await request(app)
      .post(`${FINANCIAL_APPROVAL_BASE_PATH}/${approvalId}/hold`)
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        holdReason: "Financial review required before final approval."
      });

    expect(
      holdResponse.status,
      `Financial approval hold failed: ${getErrorMessage(holdResponse)}`
    ).toBe(200);

    const heldData = getData<{
      id: number;
      status: string;
      paymentId: number | null;
      holdReason: string | null;
    }>(holdResponse);

    expect(heldData.id).toBe(approvalId);
    expect(heldData.status).toBe("HOLD");

    const response = await request(app)
      .post(`${FINANCIAL_APPROVAL_BASE_PATH}/${approvalId}/approve`)
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks
      });

    expect(
      response.status,
      `Financial approval failed: ${getErrorMessage(response)}`
    ).toBe(200);

    const data = getData<{
      id: number;
      status: string;
      paymentId: number | null;
    }>(response);

    expect(data.id).toBe(approvalId);
    expect(data.status).toBe("APPROVED");
  };

  beforeAll(async () => {
    creatorRoleId = await createRole(creatorRoleName, creatorPermissions);

    financeRoleId = await createRole(financeRoleName, financePermissions);

    creatorUserId = await createUser(
      creatorUsername,
      creatorPassword,
      creatorRoleId
    );

    financeUserId = await createUser(
      financeUsername,
      financePassword,
      financeRoleId
    );

    clientId = await createClient();

    /*
     * Advertisement creation now requires a valid runtime placement.
     * Create a dedicated active placement for this integration suite so
     * the test does not depend on production placement data.
     */
    placementId = await createPlacement();

    creatorAccessToken = await login(creatorUsername, creatorPassword);

    financeAccessToken = await login(financeUsername, financePassword);

    advertisementId = await createAdvertisement();
  });

  beforeEach(async () => {
    /*
     * Every interaction scenario uses the same advertisement fixture,
     * but must have completely isolated payment/refund/financial-
     * approval state.
     *
     * This is especially important because SUBMITTED and HOLD are
     * pending financial-approval states. A previous test that leaves
     * an approval in HOLD must not prevent the next test from creating
     * its own independent approval.
     *
     * Deletion order follows the foreign-key dependency chain:
     *
     * refunds
     *   -> financial approval history
     *   -> financial approvals
     *   -> payments
     */
    if (advertisementId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_payment_refunds
          WHERE payment_id IN
          (
            SELECT id
            FROM advertisement_payments
            WHERE advertisement_id = $1
          )
          `,
        [advertisementId]
      );

      await pool.query(
        `
          DELETE FROM advertisement_financial_approval_history
          WHERE approval_id IN
          (
            SELECT id
            FROM advertisement_financial_approvals
            WHERE advertisement_id = $1
          )
          `,
        [advertisementId]
      );

      await pool.query(
        `
          DELETE FROM advertisement_financial_approvals
          WHERE advertisement_id = $1
          `,
        [advertisementId]
      );

      await pool.query(
        `
          DELETE FROM advertisement_payments
          WHERE advertisement_id = $1
          `,
        [advertisementId]
      );
    }
    /*
     * Each test starts with no advance requirement by default.
     * Tests specifically exercising ADVANCE payments configure their
     * own requirement before recording the payment.
     *
     * This prevents one scenario's advance settings from blocking
     * REGULAR or FINAL payments in another scenario.
     */
    if (advertisementId > 0) {
      await configureAdvanceRequirement(0);
    }
    /*
     * Reset the fixture variable as well so no previous test's payment
     * identifier is accidentally reused.
     */
    paymentId = 0;
  });

  afterAll(async () => {
    /*
     * Delete refund ledger entries first because they reference
     * payments.
     */
    if (advertisementId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_payment_refunds
          WHERE payment_id IN
          (
            SELECT id
            FROM advertisement_payments
            WHERE advertisement_id = $1
          )
          `,
        [advertisementId]
      );

      await pool.query(
        `
          DELETE FROM advertisement_financial_approval_history
          WHERE approval_id IN
          (
            SELECT id
            FROM advertisement_financial_approvals
            WHERE advertisement_id = $1
          )
          `,
        [advertisementId]
      );

      await pool.query(
        `
          DELETE FROM advertisement_financial_approvals
          WHERE advertisement_id = $1
          `,
        [advertisementId]
      );

      await pool.query(
        `
          DELETE FROM advertisement_payments
          WHERE advertisement_id = $1
          `,
        [advertisementId]
      );

      /*
       * Advertisement creation automatically creates its runtime
       * placement rule. Remove that rule before deleting the
       * advertisement because the rule references the advertisement.
       */
      await pool.query(
        `
          DELETE FROM advertisement_placement_rules
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
     * Remove the dedicated placement fixture after the advertisement
     * and its runtime placement rule have been removed.
     */
    if (placementId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_placement_rules
          WHERE placement_id = $1
          `,
        [placementId]
      );

      await pool.query(
        `
          DELETE FROM advertisement_placements
          WHERE id = $1
          `,
        [placementId]
      );
    }

    if (clientId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_clients
          WHERE id = $1
          `,
        [clientId]
      );
    }

    /*
     * The current database does not contain a sessions table.
     * Authentication cleanup therefore only removes the test
     * users from the user-role relationship and users table.
     */
    if (creatorUserId > 0) {
      await pool.query(
        `
          DELETE FROM user_roles
          WHERE user_id = $1
          `,
        [creatorUserId]
      );

      await pool.query(
        `
          DELETE FROM users
          WHERE id = $1
          `,
        [creatorUserId]
      );
    }

    if (financeUserId > 0) {
      await pool.query(
        `
          DELETE FROM user_roles
          WHERE user_id = $1
          `,
        [financeUserId]
      );

      await pool.query(
        `
          DELETE FROM users
          WHERE id = $1
          `,
        [financeUserId]
      );
    }

    if (creatorRoleId > 0) {
      await pool.query(
        `
          DELETE FROM role_permissions
          WHERE role_id = $1
          `,
        [creatorRoleId]
      );

      await pool.query(
        `
          DELETE FROM roles
          WHERE id = $1
          `,
        [creatorRoleId]
      );
    }

    if (financeRoleId > 0) {
      await pool.query(
        `
          DELETE FROM role_permissions
          WHERE role_id = $1
          `,
        [financeRoleId]
      );

      await pool.query(
        `
          DELETE FROM roles
          WHERE id = $1
          `,
        [financeRoleId]
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

    await pool.end();
  });

  it("should approve a REFUND financial approval without changing the payment status", async () => {
    await configureAdvanceRequirement(25000);

    paymentId = await createPayment(
      25000,
      "ADVANCE",
      `FIN-INTERACTION-REFUND-${uniqueSuffix}`
    );

    await verifyPayment(paymentId);

    const beforeApproval = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(beforeApproval.status).toBe(200);

    const beforePayment = getData<{
      id: number;
      amount: number;
      paymentStatus: string;
      refundedBy: number | null;
      refundedAt: string | null;
    }>(beforeApproval);

    expect(beforePayment.id).toBe(paymentId);
    expect(beforePayment.amount).toBe(25000);
    expect(beforePayment.paymentStatus).toBe("VERIFIED");
    expect(beforePayment.refundedBy).toBeNull();
    expect(beforePayment.refundedAt).toBeNull();

    const approvalId = await createFinancialApproval({
      paymentId,
      approvalType: "REFUND",
      requestedAmount: 25000,
      approvalRemarks: "Full refund requested."
    });

    await approveFinancialApproval(
      approvalId,
      "Full refund financially approved."
    );

    const afterApproval = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(afterApproval.status).toBe(200);

    const afterPayment = getData<{
      id: number;
      amount: number;
      paymentStatus: string;
      refundedBy: number | null;
      refundedAt: string | null;
    }>(afterApproval);

    expect(afterPayment.id).toBe(paymentId);
    expect(afterPayment.amount).toBe(25000);

    /*
     * Financial approval is an authorization record only.
     * It must not execute the refund itself.
     */
    expect(afterPayment.paymentStatus).toBe("VERIFIED");
    expect(afterPayment.refundedBy).toBeNull();
    expect(afterPayment.refundedAt).toBeNull();

    const approvalResponse = await request(app)
      .get(`${FINANCIAL_APPROVAL_BASE_PATH}/${approvalId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(approvalResponse.status).toBe(200);

    const approval = getData<{
      id: number;
      paymentId: number | null;
      approvalType: string;
      status: string;
      requestedAmount: number | null;
    }>(approvalResponse);

    expect(approval.id).toBe(approvalId);
    expect(approval.paymentId).toBe(paymentId);
    expect(approval.approvalType).toBe("REFUND");
    expect(approval.requestedAmount).toBe(25000);
    expect(approval.status).toBe("APPROVED");
  });

  it("should allow a separately executed partial refund after PARTIAL_REFUND financial approval", async () => {
    paymentId = await createPayment(
      25000,
      "REGULAR",
      `FIN-INTERACTION-PARTIAL-${uniqueSuffix}`
    );

    await verifyPayment(paymentId);

    const approvalId = await createFinancialApproval({
      paymentId,
      approvalType: "PARTIAL_REFUND",
      requestedAmount: 5000,
      approvalRemarks: "Partial refund requested for customer adjustment."
    });

    await approveFinancialApproval(
      approvalId,
      "Partial refund financially approved."
    );

    const paymentBeforeRefundResponse = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(paymentBeforeRefundResponse.status).toBe(200);

    const paymentBeforeRefund = getData<{
      paymentStatus: string;
      amount: number;
    }>(paymentBeforeRefundResponse);

    expect(paymentBeforeRefund.paymentStatus).toBe("VERIFIED");
    expect(paymentBeforeRefund.amount).toBe(25000);

    const refundResponse = await request(app)
      .post(`/api/v1/advertisements/payments/${paymentId}/refunds`)
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        amount: 5000,
        refundReference: `FIN-REFUND-${uniqueSuffix}`,
        refundReason: "Approved partial customer refund."
      });

    expect(
      refundResponse.status,
      `Refund creation failed: ${getErrorMessage(refundResponse)}`
    ).toBe(201);

    const refund = getData<{
      id: number;
      paymentId: number;
      amount: number;
      refundReference: string | null;
      refundReason: string | null;
      refundedBy: number | null;
    }>(refundResponse);

    expect(refund.id).toBeDefined();
    expect(refund.paymentId).toBe(paymentId);
    expect(refund.amount).toBe(5000);
    expect(refund.refundReference).toBe(`FIN-REFUND-${uniqueSuffix}`);
    expect(refund.refundReason).toBe("Approved partial customer refund.");
    expect(refund.refundedBy).toBe(financeUserId);

    const paymentAfterRefundResponse = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(paymentAfterRefundResponse.status).toBe(200);

    const paymentAfterRefund = getData<{
      id: number;
      amount: number;
      paymentStatus: string;
      refundedBy: number | null;
      refundedAt: string | null;
    }>(paymentAfterRefundResponse);

    expect(paymentAfterRefund.id).toBe(paymentId);
    expect(paymentAfterRefund.amount).toBe(25000);

    /*
     * Partial refund leaves the original payment VERIFIED.
     */
    expect(paymentAfterRefund.paymentStatus).toBe("VERIFIED");
    expect(paymentAfterRefund.refundedBy).toBeNull();
    expect(paymentAfterRefund.refundedAt).toBeNull();

    const refundsResponse = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}/refunds`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(refundsResponse.status).toBe(200);

    const refunds = getData<
      Array<{
        id: number;
        paymentId: number;
        amount: number;
      }>
    >(refundsResponse);

    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.paymentId).toBe(paymentId);
    expect(refunds[0]?.amount).toBe(5000);

    const approvalResponse = await request(app)
      .get(`${FINANCIAL_APPROVAL_BASE_PATH}/${approvalId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(approvalResponse.status).toBe(200);

    const approval = getData<{
      id: number;
      status: string;
      paymentId: number | null;
    }>(approvalResponse);

    expect(approval.id).toBe(approvalId);
    expect(approval.status).toBe("APPROVED");
    expect(approval.paymentId).toBe(paymentId);
  });

  it("should allow a separately executed full refund after REFUND financial approval", async () => {
    paymentId = await createPayment(
      10000,
      "FINAL",
      `FIN-INTERACTION-FULL-${uniqueSuffix}`
    );

    await verifyPayment(paymentId);

    const approvalId = await createFinancialApproval({
      paymentId,
      approvalType: "REFUND",
      requestedAmount: 10000,
      approvalRemarks: "Full payment refund requested."
    });

    await approveFinancialApproval(approvalId, "Full payment refund approved.");

    /*
     * Approval alone must not mark the payment as refunded.
     */
    const beforeRefundResponse = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(beforeRefundResponse.status).toBe(200);

    const beforeRefund = getData<{
      paymentStatus: string;
    }>(beforeRefundResponse);

    expect(beforeRefund.paymentStatus).toBe("VERIFIED");

    /*
     * The actual refund is executed through the
     * payment/refund endpoint.
     */
    const refundResponse = await request(app)
      .post(`/api/v1/advertisements/payments/${paymentId}/refunds`)
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        amount: 10000,
        refundReference: `FIN-FULL-REFUND-${uniqueSuffix}`,
        refundReason: "Full refund after financial approval."
      });

    expect(
      refundResponse.status,
      `Full refund failed: ${getErrorMessage(refundResponse)}`
    ).toBe(201);

    const refund = getData<{
      id: number;
      paymentId: number;
      amount: number;
      refundedBy: number | null;
    }>(refundResponse);

    expect(refund.id).toBeDefined();
    expect(refund.paymentId).toBe(paymentId);
    expect(refund.amount).toBe(10000);
    expect(refund.refundedBy).toBe(financeUserId);

    const afterRefundResponse = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(afterRefundResponse.status).toBe(200);

    const afterRefund = getData<{
      id: number;
      amount: number;
      paymentStatus: string;
      refundedBy: number | null;
      refundedAt: string | null;
      refundReference: string | null;
      refundReason: string | null;
    }>(afterRefundResponse);

    expect(afterRefund.id).toBe(paymentId);
    expect(afterRefund.amount).toBe(10000);
    expect(afterRefund.paymentStatus).toBe("REFUNDED");
    expect(afterRefund.refundedBy).toBe(financeUserId);
    expect(afterRefund.refundedAt).not.toBeNull();
    expect(afterRefund.refundReference).toBe(`FIN-FULL-REFUND-${uniqueSuffix}`);
    expect(afterRefund.refundReason).toBe(
      "Full refund after financial approval."
    );

    const approvalResponse = await request(app)
      .get(`${FINANCIAL_APPROVAL_BASE_PATH}/${approvalId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(approvalResponse.status).toBe(200);

    const approval = getData<{
      id: number;
      status: string;
      approvalType: string;
      paymentId: number | null;
    }>(approvalResponse);

    expect(approval.id).toBe(approvalId);
    expect(approval.status).toBe("APPROVED");
    expect(approval.approvalType).toBe("REFUND");
    expect(approval.paymentId).toBe(paymentId);
  });

  it("should preserve the financial approval as APPROVED when a later refund operation is rejected", async () => {
    paymentId = await createPayment(
      15000,
      "REGULAR",
      `FIN-INTERACTION-REJECTED-REFUND-${uniqueSuffix}`
    );

    await verifyPayment(paymentId);

    const approvalId = await createFinancialApproval({
      paymentId,
      approvalType: "PARTIAL_REFUND",
      requestedAmount: 5000,
      approvalRemarks: "Partial refund authorization."
    });

    await approveFinancialApproval(
      approvalId,
      "Partial refund authorization approved."
    );

    /*
     * Attempt to refund more than the payment's
     * refundable balance.
     *
     * This belongs to payment/refund validation,
     * not financial approval.
     */
    const refundResponse = await request(app)
      .post(`/api/v1/advertisements/payments/${paymentId}/refunds`)
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        amount: 20000,
        refundReference: `FIN-OVER-REFUND-${uniqueSuffix}`,
        refundReason: "Invalid refund amount."
      });

    expect(refundResponse.status).toBe(400);

    const paymentResponse = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(paymentResponse.status).toBe(200);

    const payment = getData<{
      paymentStatus: string;
      amount: number;
    }>(paymentResponse);

    /*
     * Failed refund must not change the payment.
     */
    expect(payment.paymentStatus).toBe("VERIFIED");
    expect(payment.amount).toBe(15000);

    const approvalResponse = await request(app)
      .get(`${FINANCIAL_APPROVAL_BASE_PATH}/${approvalId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(approvalResponse.status).toBe(200);

    const approval = getData<{
      id: number;
      status: string;
      paymentId: number | null;
    }>(approvalResponse);

    /*
     * Failed payment/refund execution does not roll back
     * the already-completed financial approval workflow.
     */
    expect(approval.id).toBe(approvalId);
    expect(approval.status).toBe("APPROVED");
    expect(approval.paymentId).toBe(paymentId);
  });

  it("should preserve payment and refund ledger state when a REFUND financial approval is rejected", async () => {
    paymentId = await createPayment(
      20000,
      "REGULAR",
      `FIN-INTERACTION-REJECTED-APPROVAL-${uniqueSuffix}`
    );

    await verifyPayment(paymentId);

    const approvalId = await createFinancialApproval({
      paymentId,
      approvalType: "REFUND",
      requestedAmount: 20000,
      approvalRemarks: "Refund request awaiting review."
    });

    const rejectResponse = await request(app)
      .post(`${FINANCIAL_APPROVAL_BASE_PATH}/${approvalId}/reject`)
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason: "Refund request rejected during financial review."
      });

    expect(
      rejectResponse.status,
      `Financial approval rejection failed: ${getErrorMessage(rejectResponse)}`
    ).toBe(200);

    const rejectedApproval = getData<{
      id: number;
      status: string;
      paymentId: number | null;
      rejectionReason: string | null;
    }>(rejectResponse);

    expect(rejectedApproval.id).toBe(approvalId);
    expect(rejectedApproval.status).toBe("REJECTED");
    expect(rejectedApproval.paymentId).toBe(paymentId);
    expect(rejectedApproval.rejectionReason).toBe(
      "Refund request rejected during financial review."
    );

    /*
     * The rejection itself must not modify the payment.
     */
    const paymentResponse = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(paymentResponse.status).toBe(200);

    const payment = getData<{
      paymentStatus: string;
      amount: number;
      refundedBy: number | null;
      refundedAt: string | null;
    }>(paymentResponse);

    expect(payment.paymentStatus).toBe("VERIFIED");
    expect(payment.amount).toBe(20000);
    expect(payment.refundedBy).toBeNull();
    expect(payment.refundedAt).toBeNull();

    /*
     * No refund ledger entry should have been created by
     * the financial approval rejection.
     */
    const refundsResponse = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}/refunds`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(refundsResponse.status).toBe(200);

    const refunds = getData<
      Array<{
        id: number;
        paymentId: number;
        amount: number;
      }>
    >(refundsResponse);

    expect(refunds).toHaveLength(0);
  });

  it("should keep payment state unchanged when a financial approval is held", async () => {
    await configureAdvanceRequirement(30000);

    paymentId = await createPayment(
      30000,
      "ADVANCE",
      `FIN-INTERACTION-HOLD-${uniqueSuffix}`
    );

    await verifyPayment(paymentId);

    const approvalId = await createFinancialApproval({
      paymentId,
      approvalType: "PARTIAL_REFUND",
      requestedAmount: 10000,
      approvalRemarks: "Partial refund requires additional review."
    });

    const holdResponse = await request(app)
      .post(`${FINANCIAL_APPROVAL_BASE_PATH}/${approvalId}/hold`)
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        holdReason: "Additional financial verification required."
      });

    expect(
      holdResponse.status,
      `Financial approval hold failed: ${getErrorMessage(holdResponse)}`
    ).toBe(200);

    const heldApproval = getData<{
      id: number;
      status: string;
      paymentId: number | null;
      holdReason: string | null;
    }>(holdResponse);

    expect(heldApproval.id).toBe(approvalId);
    expect(heldApproval.status).toBe("HOLD");
    expect(heldApproval.paymentId).toBe(paymentId);
    expect(heldApproval.holdReason).toBe(
      "Additional financial verification required."
    );

    const paymentResponse = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(paymentResponse.status).toBe(200);

    const payment = getData<{
      id: number;
      amount: number;
      paymentStatus: string;
      refundedBy: number | null;
      refundedAt: string | null;
    }>(paymentResponse);

    expect(payment.id).toBe(paymentId);
    expect(payment.amount).toBe(30000);
    expect(payment.paymentStatus).toBe("VERIFIED");
    expect(payment.refundedBy).toBeNull();
    expect(payment.refundedAt).toBeNull();

    const refundsResponse = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}/refunds`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(refundsResponse.status).toBe(200);

    const refunds = getData<
      Array<{
        id: number;
        paymentId: number;
        amount: number;
      }>
    >(refundsResponse);

    expect(refunds).toHaveLength(0);
  });

  it("should expose the pending financial approval through the payment-level lookup", async () => {
    paymentId = await createPayment(
      18000,
      "REGULAR",
      `FIN-INTERACTION-PENDING-LOOKUP-${uniqueSuffix}`
    );

    await verifyPayment(paymentId);

    const approvalId = await createFinancialApproval({
      paymentId,
      approvalType: "PARTIAL_REFUND",
      requestedAmount: 4000,
      approvalRemarks: "Pending partial refund approval."
    });

    const pendingResponse = await request(app)
      .get(`${FINANCIAL_APPROVAL_BASE_PATH}/payments/${paymentId}/pending`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(
      pendingResponse.status,
      `Pending financial approval lookup failed: ${getErrorMessage(
        pendingResponse
      )}`
    ).toBe(200);

    const pendingApproval = getData<{
      id: number;
      paymentId: number | null;
      status: string;
      approvalType: string;
      requestedAmount: number | null;
    }>(pendingResponse);

    expect(pendingApproval.id).toBe(approvalId);
    expect(pendingApproval.paymentId).toBe(paymentId);
    expect(pendingApproval.status).toBe("SUBMITTED");
    expect(pendingApproval.approvalType).toBe("PARTIAL_REFUND");
    expect(pendingApproval.requestedAmount).toBe(4000);

    /*
     * The payment itself remains independently VERIFIED
     * while the financial request is awaiting approval.
     */
    const paymentResponse = await request(app)
      .get(`/api/v1/advertisements/payments/${paymentId}`)
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(paymentResponse.status).toBe(200);

    const payment = getData<{
      paymentStatus: string;
      amount: number;
    }>(paymentResponse);

    expect(payment.paymentStatus).toBe("VERIFIED");
    expect(payment.amount).toBe(18000);
  });
});
