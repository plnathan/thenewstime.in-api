import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Financial Approval API Integration", () => {
  let accessToken = "";

  let testUserId = 0;
  let testRoleId = 0;
  let testClientId = 0;
  let testPlacementId = 0;
  let testAdvertisementId = 0;
  let testPaymentId = 0;

  let createdApprovalId = 0;
  let holdRejectApprovalId = 0;

  const timestamp = Date.now();

  const username = `financial_approval_test_${timestamp}`;
  const email = `financial.approval.test.${timestamp}@example.com`;
  const roleName = `financial_approval_test_role_${timestamp}`;
  const clientCode = `FA-CLIENT-${timestamp}`;
  const testPlacementCode = `TEST-FA-PLACEMENT-${timestamp}`;
  const password = "Test@12345";

  const FINANCIAL_APPROVAL_RESOURCE = "advertisements.financial_approvals";

  const permissionCodes = {
    advertisementRead: "advertisements.read",
    advertisementCreate: "advertisements.create",
    advertisementUpdate: "advertisements.update",
    advertisementSubmit: "advertisements.submit",
    financialApprovalRead: `${FINANCIAL_APPROVAL_RESOURCE}.read`,
    financialApprovalHold: `${FINANCIAL_APPROVAL_RESOURCE}.hold`,
    financialApprovalReject: `${FINANCIAL_APPROVAL_RESOURCE}.reject`,
    financialApprovalApprove: `${FINANCIAL_APPROVAL_RESOURCE}.approve`
  } as const;

  const permissionIds = new Map<string, number>();

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
        VALUES ($1, $2, $3, NOW())
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

  const getHistoryStatusValues = (
    history: Array<Record<string, unknown>>
  ): string[] => {
    const statusKeys = [
      "status",
      "action",
      "newStatus",
      "new_status",
      "workflowStatus",
      "workflow_status",
      "fromStatus",
      "from_status",
      "toStatus",
      "to_status",
      "previousStatus",
      "previous_status",
      "currentStatus",
      "current_status"
    ] as const;

    return history.flatMap((entry) =>
      statusKeys
        .map((key) => entry[key])
        .filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
        .map((value) => value.trim().toUpperCase())
    );
  };

  beforeAll(async () => {
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
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, NOW(), NOW())
        RETURNING id
      `,
      [
        username,
        email,
        passwordHash,
        "Financial Approval Integration Test User",
        "Financial Approval Test User",
        superAdminRoleId
      ]
    );

    const user = userResult.rows[0];

    if (user === undefined) {
      throw new Error("Failed to create financial approval test user.");
    }

    testUserId = Number(user.id);

    expect(testUserId).toBeGreaterThan(0);

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
        VALUES ($1, $2, $3, 999, 'ACTIVE', $4, $4, NOW(), NOW())
        RETURNING id
      `,
      [
        roleName,
        "Financial Approval Integration Test Role",
        "Temporary role for financial approval integration tests.",
        testUserId
      ]
    );

    const role = roleResult.rows[0];

    if (role === undefined) {
      throw new Error("Failed to create financial approval test role.");
    }

    testRoleId = Number(role.id);

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
        INSERT INTO user_roles (
          user_id,
          role_id,
          created_by,
          created_at
        )
        VALUES ($1, $2, $1, NOW())
        ON CONFLICT DO NOTHING
      `,
      [testUserId, testRoleId]
    );

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
          SELECT id, code, module, resource, action, status
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

    const verificationResult = await pool.query<{
      id: number | string;
      code: string;
    }>(
      `
        SELECT p.id, p.code
        FROM role_permissions rp
        INNER JOIN permissions p ON p.id = rp.permission_id
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
        VALUES ($1, $2, $3, 'ACTIVE', FALSE, $4, $4, NOW(), NOW())
        RETURNING id
      `,
      [
        clientCode,
        "Financial Approval Test Client",
        "Financial Approval Test Client",
        testUserId
      ]
    );

    const client = clientResult.rows[0];

    if (client === undefined) {
      throw new Error("Failed to create financial approval test client.");
    }

    testClientId = Number(client.id);

    expect(testClientId).toBeGreaterThan(0);

    const placementResult = await pool.query<{
      id: number | string;
    }>(
      `
        INSERT INTO advertisement_placements (
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
        VALUES (
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
        `Financial Approval Test Placement ${timestamp}`,
        "Temporary placement for financial approval integration tests.",
        testUserId
      ]
    );

    const placement = placementResult.rows[0];

    if (placement === undefined) {
      throw new Error("Failed to create financial approval test placement.");
    }

    testPlacementId = Number(placement.id);

    expect(testPlacementId).toBeGreaterThan(0);

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
  });

  afterAll(async () => {
    const approvalIds = [createdApprovalId, holdRejectApprovalId].filter(
      (id, index, array) => id > 0 && array.indexOf(id) === index
    );

    for (const approvalId of approvalIds) {
      try {
        await deleteApproval(approvalId);
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    if (testPaymentId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM advertisement_payments
            WHERE id = $1
          `,
          [testPaymentId]
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

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
        // Cleanup must not fail the suite.
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
        // Cleanup must not fail the suite.
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
        // Cleanup must not fail the suite.
      }
    }

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

  it("should authenticate the test user", () => {
    expect(accessToken).toBeTruthy();
  });

  it("should create an advertisement fixture", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: testClientId,
        placementId: testPlacementId,
        name: "Financial Approval Integration Test Advertisement",
        internalName: `financial-approval-test-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/financial-approval-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes:
          "Advertisement fixture for financial approval integration tests.",
        advertisementAmount: 10000,
        currencyCode: "INR"
      });

    expect(
      response.status,
      `Advertisement creation failed: ${JSON.stringify(response.body)}`
    ).toBe(201);

    expect(response.body.success).toBe(true);

    testAdvertisementId = Number(response.body.data.id);

    expect(testAdvertisementId).toBeGreaterThan(0);
    expect(response.body.data.workflowStatus).toBe("DRAFT");
  });

  it("should create a payment fixture", async () => {
    expect(testAdvertisementId).toBeGreaterThan(0);

    const paymentResult = await pool.query<{
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
          $4,
          $5,
          $6,
          $7,
          NOW(),
          NOW(),
          $8
        )
        RETURNING id
      `,
      [
        testAdvertisementId,
        5000,
        "BANK_TRANSFER",
        "PENDING",
        `FA-PAY-${timestamp}`,
        "Financial approval integration test payment.",
        testUserId,
        "REGULAR"
      ]
    );

    const payment = paymentResult.rows[0];

    if (payment === undefined) {
      throw new Error("Failed to create financial approval payment fixture.");
    }

    testPaymentId = Number(payment.id);

    expect(testPaymentId).toBeGreaterThan(0);
  });

  it("should create a financial approval using advertisements.submit", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "DISCOUNT",
        requestedAmount: 5000,
        approvalRemarks: "Initial financial approval request."
      });

    expect(
      response.status,
      `Financial approval creation failed: ${JSON.stringify(response.body)}`
    ).toBe(201);

    expect(response.body.success).toBe(true);

    createdApprovalId = Number(response.body.data.id);

    expect(createdApprovalId).toBeGreaterThan(0);
    expect(response.body.data.status).toBe("SUBMITTED");
    expect(Number(response.body.data.requestedBy)).toBe(testUserId);
  });

  it("should get a financial approval by id", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.id)).toBe(createdApprovalId);
  });

  it("should list financial approvals", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        page: 1,
        pageSize: 10
      });

    expect(
      response.status,
      `Financial approval list failed: ${JSON.stringify(response.body)}`
    ).toBe(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeTruthy();
  });

  it("should list financial approvals using filters", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        page: 1,
        pageSize: 10,
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "DISCOUNT",
        status: "SUBMITTED",
        requestedBy: testUserId
      });

    expect(
      response.status,
      `Filtered financial approval list failed: ${JSON.stringify(
        response.body
      )}`
    ).toBe(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeTruthy();
  });

  it("should report that the financial approval exists", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}/exists`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.exists).toBe(true);
  });

  it("should report that a financial approval exists for the advertisement", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/advertisements/${testAdvertisementId}/exists`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.exists).toBe(true);
  });

  it("should return the latest financial approval", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/advertisements/${testAdvertisementId}/latest`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.id)).toBe(createdApprovalId);
  });

  it("should return the pending financial approval for the advertisement", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/advertisements/${testAdvertisementId}/pending`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).not.toBeNull();
    expect(Number(response.body.data.id)).toBe(createdApprovalId);
    expect(response.body.data.status).toBe("SUBMITTED");
  });

  it("should return the pending financial approval for the payment", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/payments/${testPaymentId}/pending`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).not.toBeNull();
    expect(Number(response.body.data.id)).toBe(createdApprovalId);
  });

  it("should update financial approval remarks", async () => {
    const approvalRemarks = "Updated financial approval remarks.";

    const response = await request(app)
      .patch(
        `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}/remarks`
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        approvalRemarks
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.approvalRemarks).toBe(approvalRemarks);
  });

  it("should reject a duplicate pending financial approval", async () => {
    /*
     * The original approval is DISCOUNT and remains SUBMITTED.
     * A duplicate must use the same advertisement and approval type.
     * ADJUSTMENT is a different approval type and is not a duplicate
     * under the type-specific pending-approval rule.
     */
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "DISCOUNT",
        requestedAmount: 1000,
        approvalRemarks: "Duplicate pending approval."
      });

    expect(
      response.status,
      `Unexpected duplicate response: ${JSON.stringify(response.body)}`
    ).toBe(409);

    expect(response.body.success).toBe(false);
  });

  it("should approve the financial approval", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        approvalRemarks: "Financial approval approved."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("APPROVED");
    expect(Number(response.body.data.id)).toBe(createdApprovalId);
  });

  it("should keep the approved financial approval as the latest approval", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/advertisements/${testAdvertisementId}/latest`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).not.toBeNull();
    expect(Number(response.body.data.id)).toBe(createdApprovalId);
    expect(response.body.data.status).toBe("APPROVED");
  });

  it("should return no pending financial approval after approval", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/advertisements/${testAdvertisementId}/pending`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeNull();
  });

  it("should return no pending financial approval for the payment after approval", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/payments/${testPaymentId}/pending`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeNull();
  });

  it("should reject both requested amount and percentage", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "DISCOUNT",
        requestedAmount: 1000,
        requestedPercentage: 10
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject missing amount and percentage", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "DISCOUNT"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject an invalid approval type", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "INVALID",
        requestedAmount: 1000
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject a zero requested amount", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "DISCOUNT",
        requestedAmount: 0
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject a requested percentage above 100", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "DISCOUNT",
        requestedPercentage: 101
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject a requested amount with more than two decimal places", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "DISCOUNT",
        requestedAmount: 1000.123
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should return 404 for a missing financial approval", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/payments/financial-approval/999999999")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("should return null for the latest approval of an advertisement with no approvals", async () => {
    const response = await request(app)
      .get(
        "/api/v1/advertisements/payments/financial-approval/advertisements/999999999/latest"
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeNull();
  });

  it("should return null for a pending approval of an advertisement with no approvals", async () => {
    const response = await request(app)
      .get(
        "/api/v1/advertisements/payments/financial-approval/advertisements/999999999/pending"
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeNull();
  });

  it("should return null for a pending approval of a payment with no approvals", async () => {
    const response = await request(app)
      .get(
        "/api/v1/advertisements/payments/financial-approval/payments/999999999/pending"
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeNull();
  });

  it("should reject an unauthenticated financial approval request", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}`
    );

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("should reject financial approval read access without the read permission", async () => {
    const permissionId = permissionIds.get(
      permissionCodes.financialApprovalRead
    );

    if (permissionId === undefined) {
      throw new Error(
        "Financial approval read permission ID was not resolved."
      );
    }

    await pool.query(
      `
        DELETE FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, permissionId]
    );

    try {
      const response = await request(app)
        .get(
          `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}`
        )
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    } finally {
      await insertRolePermission(testRoleId, permissionId, testUserId);
    }
  });

  it("should reject financial approval creation without advertisements.submit", async () => {
    const permissionId = permissionIds.get(permissionCodes.advertisementSubmit);

    if (permissionId === undefined) {
      throw new Error("Advertisement submit permission ID was not resolved.");
    }

    await pool.query(
      `
        DELETE FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, permissionId]
    );

    try {
      const response = await request(app)
        .post("/api/v1/advertisements/payments/financial-approval")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          advertisementId: testAdvertisementId,
          clientId: testClientId,
          paymentId: testPaymentId,
          approvalType: "DISCOUNT",
          requestedAmount: 1000,
          approvalRemarks: "Permission test."
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    } finally {
      await insertRolePermission(testRoleId, permissionId, testUserId);
    }
  });

  it("should reject remark update without advertisements.update", async () => {
    const permissionId = permissionIds.get(permissionCodes.advertisementUpdate);

    if (permissionId === undefined) {
      throw new Error("Advertisement update permission ID was not resolved.");
    }

    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "ADJUSTMENT",
        requestedAmount: 1250,
        approvalRemarks: "Temporary remarks authorization test."
      });

    expect(
      createResponse.status,
      `Temporary financial approval creation failed: ${JSON.stringify(
        createResponse.body
      )}`
    ).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    try {
      await pool.query(
        `
          DELETE FROM role_permissions
          WHERE role_id = $1
            AND permission_id = $2
        `,
        [testRoleId, permissionId]
      );

      const response = await request(app)
        .patch(
          `/api/v1/advertisements/payments/financial-approval/${approvalId}/remarks`
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          approvalRemarks: "Permission test."
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    } finally {
      await insertRolePermission(testRoleId, permissionId, testUserId);
      await deleteApproval(approvalId);
    }
  });

  it("should reject approval without the approve permission", async () => {
    const permissionId = permissionIds.get(
      permissionCodes.financialApprovalApprove
    );

    if (permissionId === undefined) {
      throw new Error(
        "Financial approval approve permission ID was not resolved."
      );
    }

    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "ADJUSTMENT",
        requestedAmount: 1500,
        approvalRemarks: "Temporary approval authorization test."
      });

    expect(
      createResponse.status,
      `Temporary financial approval creation failed: ${JSON.stringify(
        createResponse.body
      )}`
    ).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    try {
      await pool.query(
        `
          DELETE FROM role_permissions
          WHERE role_id = $1
            AND permission_id = $2
        `,
        [testRoleId, permissionId]
      );

      const response = await request(app)
        .post(
          `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          approvalRemarks: "Permission test."
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    } finally {
      await insertRolePermission(testRoleId, permissionId, testUserId);
      await deleteApproval(approvalId);
    }
  });

  it("should reject hold without the hold permission", async () => {
    const permissionId = permissionIds.get(
      permissionCodes.financialApprovalHold
    );

    if (permissionId === undefined) {
      throw new Error(
        "Financial approval hold permission ID was not resolved."
      );
    }

    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "ADJUSTMENT",
        requestedAmount: 1750,
        approvalRemarks: "Temporary hold authorization test."
      });

    expect(
      createResponse.status,
      `Temporary financial approval creation failed: ${JSON.stringify(
        createResponse.body
      )}`
    ).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    try {
      await pool.query(
        `
          DELETE FROM role_permissions
          WHERE role_id = $1
            AND permission_id = $2
        `,
        [testRoleId, permissionId]
      );

      const response = await request(app)
        .post(
          `/api/v1/advertisements/payments/financial-approval/${approvalId}/hold`
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          holdReason: "Permission test."
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    } finally {
      await insertRolePermission(testRoleId, permissionId, testUserId);
      await deleteApproval(approvalId);
    }
  });

  it("should reject rejection without the reject permission", async () => {
    const permissionId = permissionIds.get(
      permissionCodes.financialApprovalReject
    );

    if (permissionId === undefined) {
      throw new Error(
        "Financial approval reject permission ID was not resolved."
      );
    }

    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "ADJUSTMENT",
        requestedAmount: 2000,
        approvalRemarks: "Temporary reject authorization test."
      });

    expect(
      createResponse.status,
      `Temporary financial approval creation failed: ${JSON.stringify(
        createResponse.body
      )}`
    ).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    try {
      await pool.query(
        `
          DELETE FROM role_permissions
          WHERE role_id = $1
            AND permission_id = $2
        `,
        [testRoleId, permissionId]
      );

      const response = await request(app)
        .post(
          `/api/v1/advertisements/payments/financial-approval/${approvalId}/reject`
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          rejectionReason: "Permission test."
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    } finally {
      await insertRolePermission(testRoleId, permissionId, testUserId);
      await deleteApproval(approvalId);
    }
  });

  it("should move a submitted financial approval to HOLD", async () => {
    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "ADJUSTMENT",
        requestedAmount: 2250,
        approvalRemarks: "HOLD to REJECTED integration test."
      });

    expect(
      createResponse.status,
      `Financial approval creation failed: ${JSON.stringify(
        createResponse.body
      )}`
    ).toBe(201);

    expect(createResponse.body.success).toBe(true);

    holdRejectApprovalId = Number(createResponse.body.data.id);

    expect(holdRejectApprovalId).toBeGreaterThan(0);
    expect(createResponse.body.data.status).toBe("SUBMITTED");

    const holdReason =
      "Financial approval is placed on hold for Phase 5 integration testing.";

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${holdRejectApprovalId}/hold`
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        holdReason
      });

    expect(
      response.status,
      `Financial approval hold failed: ${JSON.stringify(response.body)}`
    ).toBe(200);

    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.id)).toBe(holdRejectApprovalId);
    expect(response.body.data.status).toBe("HOLD");
    expect(response.body.data.holdReason).toBe(holdReason);
  });

  it("should persist the HOLD state and reason", async () => {
    expect(holdRejectApprovalId).toBeGreaterThan(0);

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${holdRejectApprovalId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.id)).toBe(holdRejectApprovalId);
    expect(response.body.data.status).toBe("HOLD");
    expect(response.body.data.holdReason).toBe(
      "Financial approval is placed on hold for Phase 5 integration testing."
    );
  });

  it("should move a held financial approval to REJECTED", async () => {
    expect(holdRejectApprovalId).toBeGreaterThan(0);

    const rejectionReason =
      "Financial approval rejected after the hold review.";

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${holdRejectApprovalId}/reject`
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        rejectionReason
      });

    expect(
      response.status,
      `Financial approval rejection failed: ${JSON.stringify(response.body)}`
    ).toBe(200);

    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.id)).toBe(holdRejectApprovalId);
    expect(response.body.data.status).toBe("REJECTED");
    expect(response.body.data.rejectionReason).toBe(rejectionReason);
  });

  it("should persist the REJECTED state and rejection reason after HOLD", async () => {
    expect(holdRejectApprovalId).toBeGreaterThan(0);

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${holdRejectApprovalId}`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.id)).toBe(holdRejectApprovalId);
    expect(response.body.data.status).toBe("REJECTED");
    expect(response.body.data.holdReason).toBeNull();
    expect(response.body.data.rejectionReason).toBe(
      "Financial approval rejected after the hold review."
    );
  });

  it("should return the complete HOLD → REJECTED approval history", async () => {
    expect(holdRejectApprovalId).toBeGreaterThan(0);

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${holdRejectApprovalId}/history`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(
      response.status,
      `Financial approval history failed: ${JSON.stringify(response.body)}`
    ).toBe(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const history = response.body.data as Array<Record<string, unknown>>;

    expect(history.length).toBeGreaterThanOrEqual(2);

    for (const entry of history) {
      expect(Number(entry.approvalId ?? entry.approval_id)).toBe(
        holdRejectApprovalId
      );
    }

    const historyValues = getHistoryStatusValues(history);

    expect(historyValues).toContain("HOLD");
    expect(historyValues).toContain("REJECTED");
  });

  it("should return the complete history for the approved financial approval", async () => {
    expect(createdApprovalId).toBeGreaterThan(0);

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}/history`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(
      response.status,
      `Financial approval history failed: ${JSON.stringify(response.body)}`
    ).toBe(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const history = response.body.data as Array<Record<string, unknown>>;

    expect(history.length).toBeGreaterThanOrEqual(1);

    for (const entry of history) {
      expect(Number(entry.approvalId ?? entry.approval_id)).toBe(
        createdApprovalId
      );
    }

    const historyValues = getHistoryStatusValues(history);

    expect(historyValues).toContain("APPROVED");
  });

  it("should reject an invalid transition from REJECTED back to HOLD", async () => {
    expect(holdRejectApprovalId).toBeGreaterThan(0);

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${holdRejectApprovalId}/hold`
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        holdReason: "Invalid terminal-state transition test."
      });

    expect(
      response.status,
      `Unexpected REJECTED → HOLD response: ${JSON.stringify(response.body)}`
    ).toBe(400);

    expect(response.body.success).toBe(false);
  });

  it("should reject an invalid transition from REJECTED back to APPROVED", async () => {
    expect(holdRejectApprovalId).toBeGreaterThan(0);

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${holdRejectApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        approvalRemarks: "Invalid terminal-state transition test."
      });

    expect(
      response.status,
      `Unexpected REJECTED → APPROVED response: ${JSON.stringify(
        response.body
      )}`
    ).toBe(400);

    expect(response.body.success).toBe(false);
  });

  it("should return history for the existing approved financial approval", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}/history`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    expect(response.body.data[0]).toBeDefined();
  });
});
