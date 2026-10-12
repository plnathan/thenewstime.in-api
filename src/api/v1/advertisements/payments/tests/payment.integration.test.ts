import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Payment API Integration", () => {
  let accessToken = "";

  let testUserId = 0;
  let superAdminRoleId = 0;
  let testRoleId = 0;

  let testClientId = 0;
  let testPlacementId = 0;
  let testAdvertisementId = 0;

  let createdPaymentId = 0;
  let pendingPaymentId = 0;
  let cancelledPaymentId = 0;
  let refundedPaymentId = 0;
  let partialRefundPaymentId = 0;

  const timestamp = Date.now();

  const testUsername = `payment_test_user_${timestamp}`;
  const testEmail = `payment-test-user-${timestamp}@example.com`;
  const testRoleCode = `TEST_AD_PAYMENT_ROLE_${timestamp}`;
  const testClientCode = `TEST-PAY-${timestamp}`;
  const testPlacementCode = `TEST_PAYMENT_PLACEMENT_${timestamp}`;

  const password = "Payment_Test@123";

  const paymentPermissionCodes = {
    read: "advertisements.payments.read",
    create: "advertisements.payments.create",
    update: "advertisements.payments.update",
    verify: "advertisements.payments.verify",
    cancel: "advertisements.payments.cancel",
    refund: "advertisements.payments.refund"
  };

  const advertisementPermissionCodes = {
    read: "advertisements.read",
    create: "advertisements.create"
  };

  const paymentPermissionIds: Record<
    keyof typeof paymentPermissionCodes,
    number
  > = {
    read: 0,
    create: 0,
    update: 0,
    verify: 0,
    cancel: 0,
    refund: 0
  };

  const advertisementPermissionIds: Record<
    keyof typeof advertisementPermissionCodes,
    number
  > = {
    read: 0,
    create: 0
  };

  const createdPermissionIds: number[] = [];

  /*
   * ==========================================================================
   * TEST SETUP
   * ==========================================================================
   */

  beforeAll(async () => {
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

    expect(superAdminRoleId).toBeGreaterThan(0);

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
        "Payment Integration Test User",
        "Payment Test User",
        superAdminRoleId
      ]
    );

    testUserId = Number(userResult.rows[0].id);

    expect(testUserId).toBeGreaterThan(0);

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
        `Advertisement Payment Test Role ${timestamp}`,
        "Temporary role for Advertisement Payment API integration tests.",
        testUserId
      ]
    );

    testRoleId = Number(roleResult.rows[0].id);

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
        AND role_id = $2
      `,
      [testUserId, superAdminRoleId]
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

    for (const [key, code] of Object.entries(paymentPermissionCodes) as Array<
      [keyof typeof paymentPermissionCodes, string]
    >) {
      const existing = await pool.query(
        `
        SELECT id
        FROM permissions
        WHERE code = $1
        LIMIT 1
        `,
        [code]
      );

      if (existing.rows[0]) {
        paymentPermissionIds[key] = Number(existing.rows[0].id);
      } else {
        const created = await pool.query(
          `
          INSERT INTO permissions
          (
            code,
            display_name,
            description,
            module,
            resource,
            action,
            display_order,
            is_system_permission,
            status,
            created_by,
            updated_by
          )
          VALUES
          (
            $1,
            $2,
            $3,
            'ADVERTISEMENT',
            'advertisements.payments',
            $4,
            999,
            TRUE,
            'ACTIVE',
            $5,
            $5
          )
          RETURNING id
          `,
          [
            code,
            `Advertisement Payment ${key} permission`,
            `Integration-test permission for ${code}.`,
            key,
            testUserId
          ]
        );

        paymentPermissionIds[key] = Number(created.rows[0].id);

        createdPermissionIds.push(paymentPermissionIds[key]);
      }

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
        [testRoleId, paymentPermissionIds[key], testUserId]
      );
    }

    for (const [key, code] of Object.entries(
      advertisementPermissionCodes
    ) as Array<[keyof typeof advertisementPermissionCodes, string]>) {
      const existing = await pool.query(
        `
        SELECT id
        FROM permissions
        WHERE code = $1
        LIMIT 1
        `,
        [code]
      );

      if (existing.rows[0]) {
        advertisementPermissionIds[key] = Number(existing.rows[0].id);
      } else {
        const created = await pool.query(
          `
          INSERT INTO permissions
          (
            code,
            display_name,
            description,
            module,
            resource,
            action,
            display_order,
            is_system_permission,
            status,
            created_by,
            updated_by
          )
          VALUES
          (
            $1,
            $2,
            $3,
            'ADVERTISEMENT',
            'advertisements',
            $4,
            999,
            TRUE,
            'ACTIVE',
            $5,
            $5
          )
          RETURNING id
          `,
          [
            code,
            `Advertisement ${key} permission`,
            `Integration-test permission for ${code}.`,
            key,
            testUserId
          ]
        );

        advertisementPermissionIds[key] = Number(created.rows[0].id);

        createdPermissionIds.push(advertisementPermissionIds[key]);
      }

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
        [testRoleId, advertisementPermissionIds[key], testUserId]
      );
    }

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
        `Payment Integration Client ${timestamp}`,
        `Payment Test Client ${timestamp}`,
        testUserId
      ]
    );

    testClientId = Number(clientResult.rows[0].id);

    expect(testClientId).toBeGreaterThan(0);

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
        `Payment Integration Placement ${timestamp}`,
        "Temporary placement for Advertisement Payment API integration tests.",
        testUserId
      ]
    );

    testPlacementId = Number(placementResult.rows[0].id);

    expect(testPlacementId).toBeGreaterThan(0);

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username: testUsername,
      password
    });

    expect(loginResponse.status).toBe(200);

    accessToken = loginResponse.body.data.tokens.accessToken;

    expect(accessToken).toBeTruthy();
  });

  /*
   * ==========================================================================
   * TEST CLEANUP
   * ==========================================================================
   */

  afterAll(async () => {
    const paymentIds = [
      createdPaymentId,
      pendingPaymentId,
      cancelledPaymentId,
      refundedPaymentId,
      partialRefundPaymentId
    ].filter((id, index, array) => id > 0 && array.indexOf(id) === index);

    for (const paymentId of paymentIds) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_payment_refunds
          WHERE payment_id = $1
          `,
          [paymentId]
        );
      } catch {
        // Cleanup should not make the test suite fail.
      }
    }

    for (const paymentId of paymentIds) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_payments
          WHERE id = $1
          `,
          [paymentId]
        );
      } catch {
        // Cleanup should not make the test suite fail.
      }
    }

    if (testAdvertisementId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_pricing_snapshots
          WHERE advertisement_id = $1
          `,
          [testAdvertisementId]
        );
      } catch {
        // Cleanup should not make the test suite fail.
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
        // Cleanup should not make the test suite fail.
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
        // Cleanup should not make the test suite fail.
      }
    }

    if (testPlacementId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_placements
          WHERE id = $1
          `,
          [testPlacementId]
        );
      } catch {
        // Cleanup should not make the test suite fail.
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
        // Cleanup should not make the test suite fail.
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
        // Cleanup should not make the test suite fail.
      }
    }

    if (testUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM user_sessions
          WHERE user_id = $1
          `,
          [testUserId]
        );
      } catch {
        // Cleanup should not make the test suite fail.
      }
    }

    if (testUserId > 0) {
      try {
        await pool.query(
          `
          DELETE FROM user_roles
          WHERE user_id = $1
          `,
          [testUserId]
        );
      } catch {
        // Cleanup should not make the test suite fail.
      }
    }

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
        // Cleanup should not make the test suite fail.
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
        // Cleanup should not make the test suite fail.
      }
    }

    for (const permissionId of createdPermissionIds) {
      try {
        await pool.query(
          `
          DELETE FROM permissions
          WHERE id = $1
          `,
          [permissionId]
        );
      } catch {
        // Cleanup should not make the test suite fail.
      }
    }
  });

  /*
   * ==========================================================================
   * AUTHENTICATION BASELINE
   * ==========================================================================
   */

  it("should have a valid authentication token", () => {
    expect(accessToken).toBeTruthy();
  });

  /*
   * ==========================================================================
   * CREATE TEST ADVERTISEMENT
   * ==========================================================================
   */

  it("POST /api/v1/advertisements - should create the advertisement used by payment tests", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: testClientId,
        placementId: testPlacementId,
        name: `Payment Integration Advertisement ${timestamp}`,
        internalName: `payment-integration-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/payment-integration-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes: "Temporary advertisement for payment integration tests.",
        advertisementAmount: 50000,
        discountPercentage: 0,
        advancePercentage: 50,
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
   * CREATE ADVANCE PAYMENT
   * ==========================================================================
   */

  it("POST /api/v1/advertisements/payments - should create a payment", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        amount: 25000,
        paymentType: "ADVANCE",
        paymentMethod: "UPI",
        transactionReference: `PAY-TXN-${timestamp}`,
        notes: "Advance payment for integration test."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    createdPaymentId = Number(response.body.data.id);

    expect(createdPaymentId).toBeGreaterThan(0);
    expect(Number(response.body.data.advertisementId)).toBe(
      testAdvertisementId
    );
    expect(Number(response.body.data.amount)).toBe(25000);
    expect(response.body.data.paymentType).toBe("ADVANCE");
    expect(response.body.data.paymentStatus).toBe("RECEIVED");
    expect(response.body.data.paymentMethod).toBe("UPI");
    expect(response.body.data.transactionReference).toBe(
      `PAY-TXN-${timestamp}`
    );
  });

  /*
   * ==========================================================================
   * GET PAYMENT
   * ==========================================================================
   */

  it("GET /api/v1/advertisements/payments/:id - should retrieve the payment", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/payments/${createdPaymentId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(createdPaymentId);
    expect(Number(response.body.data.advertisementId)).toBe(
      testAdvertisementId
    );
  });

  /*
   * ==========================================================================
   * LIST PAYMENTS
   * ==========================================================================
   */

  it("GET /api/v1/advertisements/payments - should list payments", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        page: 1,
        pageSize: 20,
        advertisementId: testAdvertisementId
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.meta).toBeDefined();
    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.pageSize).toBe(20);

    const payment = response.body.data.find(
      (item: { id: number | string }) => Number(item.id) === createdPaymentId
    );

    expect(payment).toBeDefined();
    expect(Number(payment.advertisementId)).toBe(testAdvertisementId);
    expect(payment.advertisementName).toBeDefined();
    expect(payment.clientId).toBe(testClientId);
    expect(payment.clientName).toBeDefined();
    expect(payment.clientCode).toBe(testClientCode);
  });

  /*
   * ==========================================================================
   * UPDATE PENDING PAYMENT
   * ==========================================================================
   */

  it("PATCH /api/v1/advertisements/payments/:id - should update a PENDING payment", async () => {
    const pendingResult = await pool.query(
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
        recorded_by
      )
      VALUES
      (
        $1,
        $2,
        $3,
        CURRENT_TIMESTAMP,
        $4,
        'PENDING',
        $5,
        $6,
        $7
      )
      RETURNING id
      `,
      [
        testAdvertisementId,
        5000,
        "INSTALLMENT",
        "BANK_TRANSFER",
        `PENDING-TXN-${timestamp}`,
        "Pending payment created for update integration test.",
        testUserId
      ]
    );

    pendingPaymentId = Number(pendingResult.rows[0].id);

    expect(pendingPaymentId).toBeGreaterThan(0);

    const response = await request(app)
      .patch(`/api/v1/advertisements/payments/${pendingPaymentId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        amount: 7500,
        paymentType: "REGULAR",
        paymentMethod: "UPI",
        transactionReference: `UPDATED-TXN-${timestamp}`,
        notes: "Updated payment integration test."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.id)).toBe(pendingPaymentId);
    expect(Number(response.body.data.amount)).toBe(7500);
    expect(response.body.data.paymentType).toBe("REGULAR");
    expect(response.body.data.paymentMethod).toBe("UPI");
    expect(response.body.data.transactionReference).toBe(
      `UPDATED-TXN-${timestamp}`
    );
  });

  /*
   * ==========================================================================
   * RECEIVED PAYMENT CANNOT BE UPDATED
   * ==========================================================================
   */

  it("PATCH /api/v1/advertisements/payments/:id - should reject updating a RECEIVED payment", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/payments/${createdPaymentId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        amount: 26000
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * VERIFY ADVANCE PAYMENT
   * ==========================================================================
   */

  it("POST /api/v1/advertisements/payments/:id/verify - should verify a RECEIVED payment", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${createdPaymentId}/verify`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.id)).toBe(createdPaymentId);
    expect(response.body.data.paymentStatus).toBe("VERIFIED");
    expect(Number(response.body.data.verifiedBy)).toBe(testUserId);
    expect(response.body.data.verifiedAt).toBeDefined();
  });

  it("POST /api/v1/advertisements/payments/:id/verify - should reject an already verified payment", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${createdPaymentId}/verify`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/payments/:id - should return the verified payment", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/payments/${createdPaymentId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.paymentStatus).toBe("VERIFIED");
  });

  it("GET /api/v1/advertisements/payments - should filter payments by VERIFIED status", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({
        page: 1,
        pageSize: 20,
        advertisementId: testAdvertisementId,
        paymentStatus: "VERIFIED"
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const payment = response.body.data.find(
      (item: { id: number | string }) => Number(item.id) === createdPaymentId
    );

    expect(payment).toBeDefined();
    expect(payment.paymentStatus).toBe("VERIFIED");
  });

  /*
   * ==========================================================================
   * CREATE A REGULAR PAYMENT FOR PARTIAL-REFUND TESTING
   * ==========================================================================
   *
   * The partial refund belongs to a REGULAR payment, not the ADVANCE payment.
   * This verifies that a refund against a regular payment does not reduce
   * advanceReceivedAmount.
   */

  it("POST /api/v1/advertisements/payments - should create a regular payment for partial-refund testing", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        amount: 10000,
        paymentType: "REGULAR",
        paymentMethod: "BANK_TRANSFER",
        transactionReference: `PARTIAL-REFUND-TXN-${timestamp}`,
        notes: "Regular payment used for partial-refund integration test."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    partialRefundPaymentId = Number(response.body.data.id);

    expect(partialRefundPaymentId).toBeGreaterThan(0);
    expect(response.body.data.paymentStatus).toBe("RECEIVED");
    expect(response.body.data.paymentType).toBe("REGULAR");
  });

  it("POST /api/v1/advertisements/payments/:id/verify - should verify the regular payment used for partial refunds", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${partialRefundPaymentId}/verify`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.paymentStatus).toBe("VERIFIED");
  });

  it("POST /api/v1/advertisements/payments/:id/refunds - should create a partial refund against the regular payment", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${partialRefundPaymentId}/refunds`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        amount: 5000,
        refundReference: `REF-PARTIAL-${timestamp}`,
        refundReason: "Partial refund for integration test."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    expect(Number(response.body.data.paymentId)).toBe(partialRefundPaymentId);
    expect(Number(response.body.data.amount)).toBe(5000);
    expect(response.body.data.refundReference).toBe(`REF-PARTIAL-${timestamp}`);
    expect(response.body.data.refundReason).toBe(
      "Partial refund for integration test."
    );
    expect(Number(response.body.data.refundedBy)).toBe(testUserId);
  });

  it("GET /api/v1/advertisements/payments/:id/refunds - should return the partial refund", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/payments/${partialRefundPaymentId}/refunds`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const refund = response.body.data.find(
      (item: { amount: number | string }) => Number(item.amount) === 5000
    );

    expect(refund).toBeDefined();
  });

  it("GET /api/v1/advertisements/payments/:id - should keep the regular payment VERIFIED after a partial refund", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/payments/${partialRefundPaymentId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.paymentStatus).toBe("VERIFIED");
  });

  /*
   * ==========================================================================
   * CREATE SECOND REGULAR PAYMENT FOR FULL-REFUND TESTING
   * ==========================================================================
   */

  it("POST /api/v1/advertisements/payments - should create a second payment for full-refund testing", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        amount: 10000,
        paymentType: "REGULAR",
        paymentMethod: "BANK_TRANSFER",
        transactionReference: `FULL-REFUND-TXN-${timestamp}`,
        notes: "Payment used for full refund integration test."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    refundedPaymentId = Number(response.body.data.id);

    expect(refundedPaymentId).toBeGreaterThan(0);
    expect(response.body.data.paymentStatus).toBe("RECEIVED");
  });

  it("POST /api/v1/advertisements/payments/:id/verify - should verify the second payment", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${refundedPaymentId}/verify`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.paymentStatus).toBe("VERIFIED");
  });

  it("POST /api/v1/advertisements/payments/:id/refunds - should fully refund the second payment", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${refundedPaymentId}/refunds`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        amount: 10000,
        refundReference: `REF-FULL-${timestamp}`,
        refundReason: "Full refund for integration test."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.paymentId)).toBe(refundedPaymentId);
    expect(Number(response.body.data.amount)).toBe(10000);
  });

  it("GET /api/v1/advertisements/payments/:id - should mark the payment REFUNDED after a full refund", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/payments/${refundedPaymentId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.paymentStatus).toBe("REFUNDED");
    expect(Number(response.body.data.refundedBy)).toBe(testUserId);
    expect(response.body.data.refundedAt).toBeDefined();
  });

  it("POST /api/v1/advertisements/payments/:id/refunds - should reject a refund greater than the remaining refundable amount", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${partialRefundPaymentId}/refunds`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        amount: 6000,
        refundReference: `REF-OVER-${timestamp}`,
        refundReason: "Refund exceeds remaining amount."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * PAYMENT SUMMARY
   * ==========================================================================
   *
   * Verified payments:
   *   ADVANCE  : 25,000
   *   REGULAR  : 10,000 (partial refund 5,000)
   *   REGULAR  : 10,000 (full refund 10,000)
   *
   * Gross verified payments = 45,000.
   * Total refunds           = 15,000.
   * Net paid                = 30,000.
   * Outstanding             = 20,000.
   *
   * The advance amount is unaffected by refunds against regular payments.
   */

  it("GET /api/v1/advertisements/payments/:id/summary - should return the advertisement payment summary", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/payments/${testAdvertisementId}/summary`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    expect(Number(response.body.data.advertisementId)).toBe(
      testAdvertisementId
    );

    expect(Number(response.body.data.advertisementAmount)).toBe(50000);
    expect(Number(response.body.data.verifiedPaymentAmount)).toBe(45000);
    expect(Number(response.body.data.refundedAmount)).toBe(15000);
    expect(Number(response.body.data.netPaidAmount)).toBe(30000);

    expect(Number(response.body.data.advanceRequiredAmount)).toBe(25000);
    expect(Number(response.body.data.advanceReceivedAmount)).toBe(25000);
    expect(Number(response.body.data.advancePendingAmount)).toBe(0);
    expect(Number(response.body.data.outstandingAmount)).toBe(20000);
  });

  /*
   * ==========================================================================
   * CREATE PAYMENT FOR CANCELLATION
   * ==========================================================================
   */

  it("POST /api/v1/advertisements/payments - should create a payment for cancellation testing", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        amount: 3000,
        paymentType: "INSTALLMENT",
        paymentMethod: "CASH",
        transactionReference: `CANCEL-TXN-${timestamp}`,
        notes: "Payment used for cancellation integration test."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    cancelledPaymentId = Number(response.body.data.id);

    expect(cancelledPaymentId).toBeGreaterThan(0);
    expect(response.body.data.paymentStatus).toBe("RECEIVED");
  });

  it("POST /api/v1/advertisements/payments/:id/cancel - should cancel a RECEIVED payment", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${cancelledPaymentId}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        cancellationReason:
          "Duplicate payment recorded during integration test."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.paymentStatus).toBe("CANCELLED");
    expect(Number(response.body.data.cancelledBy)).toBe(testUserId);
    expect(response.body.data.cancelledAt).toBeDefined();
    expect(response.body.data.cancellationReason).toBe(
      "Duplicate payment recorded during integration test."
    );
  });

  it("POST /api/v1/advertisements/payments/:id/cancel - should reject cancellation of a VERIFIED payment", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${createdPaymentId}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        cancellationReason: "Attempted cancellation of verified payment."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/payments/:id/refunds - should reject refund of a CANCELLED payment", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${cancelledPaymentId}/refunds`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        amount: 1000,
        refundReference: `REF-CANCELLED-${timestamp}`,
        refundReason: "Refund of cancelled payment."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * VALIDATION - CREATE PAYMENT
   * ==========================================================================
   */

  it("POST /api/v1/advertisements/payments - should reject an invalid payment amount", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        amount: 0,
        paymentType: "REGULAR",
        paymentMethod: "CASH"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/payments - should reject an invalid payment type", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        amount: 1000,
        paymentType: "INVALID",
        paymentMethod: "CASH"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/payments - should reject more than two decimal places", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        amount: 1000.123,
        paymentType: "REGULAR",
        paymentMethod: "CASH"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/payments - should reject a duplicate transaction reference", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        amount: 1000,
        paymentType: "REGULAR",
        paymentMethod: "UPI",
        transactionReference: `PAY-TXN-${timestamp}`
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * MISSING PAYMENT / ADVERTISEMENT
   * ==========================================================================
   */

  it("GET /api/v1/advertisements/payments/:id - should return 404 for a missing payment", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/payments/999999999")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/payments - should reject payment for a missing advertisement", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: 999999999,
        amount: 1000,
        paymentType: "REGULAR",
        paymentMethod: "CASH",
        transactionReference: `MISSING-AD-${timestamp}`
      });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/payments/:id/summary - should return 404 for a missing advertisement", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/payments/999999999/summary")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/payments/:id/refunds - should return 404 for a missing payment", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/payments/999999999/refunds")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  /*
   * ==========================================================================
   * AUTHENTICATION
   * ==========================================================================
   */

  it("GET /api/v1/advertisements/payments - should reject requests without authentication", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/payments")
      .query({
        page: 1,
        pageSize: 20
      });

    expect(response.status).toBe(401);
  });

  /*
   * ==========================================================================
   * READ PERMISSION
   * ==========================================================================
   */

  it("GET /api/v1/advertisements/payments/:id - should deny access without READ permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, paymentPermissionIds.read]
    );

    const response = await request(app)
      .get(`/api/v1/advertisements/payments/${createdPaymentId}`)
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
      [testRoleId, paymentPermissionIds.read, testUserId]
    );
  });

  /*
   * ==========================================================================
   * CREATE PERMISSION
   * ==========================================================================
   */

  it("POST /api/v1/advertisements/payments - should deny access without CREATE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, paymentPermissionIds.create]
    );

    const response = await request(app)
      .post("/api/v1/advertisements/payments")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        amount: 1000,
        paymentType: "REGULAR",
        paymentMethod: "CASH",
        transactionReference: `DENIED-CREATE-${timestamp}`
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
      [testRoleId, paymentPermissionIds.create, testUserId]
    );
  });

  /*
   * ==========================================================================
   * UPDATE PERMISSION
   * ==========================================================================
   */

  it("PATCH /api/v1/advertisements/payments/:id - should deny access without UPDATE permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, paymentPermissionIds.update]
    );

    const response = await request(app)
      .patch(`/api/v1/advertisements/payments/${pendingPaymentId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        amount: 8000
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
      [testRoleId, paymentPermissionIds.update, testUserId]
    );
  });

  /*
   * ==========================================================================
   * VERIFY PERMISSION
   * ==========================================================================
   */

  it("POST /api/v1/advertisements/payments/:id/verify - should deny access without VERIFY permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, paymentPermissionIds.verify]
    );

    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${cancelledPaymentId}/verify`)
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
      [testRoleId, paymentPermissionIds.verify, testUserId]
    );
  });

  /*
   * ==========================================================================
   * CANCEL PERMISSION
   * ==========================================================================
   */

  it("POST /api/v1/advertisements/payments/:id/cancel - should deny access without CANCEL permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, paymentPermissionIds.cancel]
    );

    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${cancelledPaymentId}/cancel`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        cancellationReason: "Permission test."
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
      [testRoleId, paymentPermissionIds.cancel, testUserId]
    );
  });

  /*
   * ==========================================================================
   * REFUND PERMISSION
   * ==========================================================================
   */

  it("POST /api/v1/advertisements/payments/:id/refunds - should deny access without REFUND permission", async () => {
    await pool.query(
      `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, paymentPermissionIds.refund]
    );

    const response = await request(app)
      .post(`/api/v1/advertisements/payments/${createdPaymentId}/refunds`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        amount: 1000,
        refundReference: `DENIED-REFUND-${timestamp}`,
        refundReason: "Permission test."
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
      [testRoleId, paymentPermissionIds.refund, testUserId]
    );
  });
});
