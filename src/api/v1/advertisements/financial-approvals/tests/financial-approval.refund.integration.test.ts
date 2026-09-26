import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Financial Approval Refund Integration", () => {
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

  let resubmitApprovalId = 0;

  const createdApprovalIds: number[] = [];
  const temporaryAdvertisementIds: number[] = [];

  const timestamp = Date.now();

  const creatorUsername = `financial_refund_creator_${timestamp}`;
  const creatorEmail = `financial-refund-creator-${timestamp}@example.com`;

  const financeUsername = `financial_refund_finance_${timestamp}`;
  const financeEmail = `financial-refund-finance-${timestamp}@example.com`;

  const creatorRoleCode = `TEST_AD_FA_REFUND_CREATOR_${timestamp}`;
  const financeRoleCode = `TEST_AD_FA_REFUND_FINANCE_${timestamp}`;

  const testClientCode = `TEST-FA-REFUND-${timestamp}`;

  const creatorPassword = "Financial_Refund_Creator@123";
  const financePassword = "Financial_Refund_Finance@123";

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

  const resolveAndAttachPermissions = async (): Promise<void> => {
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

      expect(permission?.status).toBe("ACTIVE");
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

      expect(permission?.status).toBe("ACTIVE");
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
  };

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

    const creatorVerification = await pool.query(
      `
      SELECT p.id
      FROM role_permissions rp
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE rp.role_id = $1
        AND p.status = 'ACTIVE'
        AND p.id = ANY($2::INTEGER[])
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

    const financeVerification = await pool.query(
      `
      SELECT p.id
      FROM role_permissions rp
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE rp.role_id = $1
        AND p.status = 'ACTIVE'
        AND p.id = ANY($2::INTEGER[])
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

  const createTemporaryAdvertisement = async (
    nameSuffix: string
  ): Promise<number> => {
    const uniqueSuffix = `${timestamp}-${Date.now()}-${nameSuffix}`;

    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId: testClientId,
        name: `Financial Refund Temporary Advertisement ${uniqueSuffix}`,
        internalName: `financial-refund-temp-ad-${uniqueSuffix}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/financial-refund-temp-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes:
          "Temporary advertisement for isolated financial refund authorization tests.",
        advertisementAmount: 50000,
        currencyCode: "INR"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const advertisementId = Number(response.body.data.id);

    expect(advertisementId).toBeGreaterThan(0);
    expect(response.body.data.workflowStatus).toBe("DRAFT");

    temporaryAdvertisementIds.push(advertisementId);

    return advertisementId;
  };

  beforeAll(async () => {
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
        "Financial Refund Creator Test User",
        "Financial Refund Creator",
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
        "Financial Refund Finance Test User",
        "Financial Refund Finance",
        superAdminRoleId
      ]
    );

    financeUserId = Number(financeUserResult.rows[0]?.id ?? 0);

    expect(financeUserId).toBeGreaterThan(0);

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
        `FA Refund Creator ${timestamp}`,
        "Refund financial approval integration-test Ad Creator role.",
        creatorUserId
      ]
    );

    creatorRoleId = Number(creatorRoleResult.rows[0]?.id ?? 0);

    expect(creatorRoleId).toBeGreaterThan(0);

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
        `FA Refund Finance ${timestamp}`,
        "Refund financial approval integration-test Finance Approver role.",
        financeUserId
      ]
    );

    financeRoleId = Number(financeRoleResult.rows[0]?.id ?? 0);

    expect(financeRoleId).toBeGreaterThan(0);

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
      UPDATE users
      SET role_id = $2
      WHERE id = $1
      `,
      [financeUserId, financeRoleId]
    );

    await pool.query(
      `
      DELETE FROM user_roles
      WHERE user_id IN ($1, $2)
      `,
      [creatorUserId, financeUserId]
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
      ($1, $2, $1)
      ON CONFLICT (user_id, role_id) DO NOTHING
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
      ($1, $2, $1)
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [financeUserId, financeRoleId]
    );

    await resolveAndAttachPermissions();

    const creatorRequiredPermissionIds = Object.values(creatorPermissionIds);

    expect(creatorRequiredPermissionIds).toHaveLength(4);

    const creatorVerification = await pool.query(
      `
      SELECT
        rp.permission_id,
        p.code,
        p.status
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

    const financeRequiredPermissionIds = Object.values(financePermissionIds);

    expect(financeRequiredPermissionIds).toHaveLength(4);

    const financeVerification = await pool.query(
      `
      SELECT
        rp.permission_id,
        p.code,
        p.status
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
        `Financial Refund Client ${timestamp}`,
        `Financial Refund Client ${timestamp}`,
        creatorUserId
      ]
    );

    testClientId = Number(clientResult.rows[0]?.id ?? 0);

    expect(testClientId).toBeGreaterThan(0);

    const creatorLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: creatorUsername,
        password: creatorPassword
      });

    expect(creatorLoginResponse.status).toBe(200);

    creatorAccessToken = creatorLoginResponse.body.data.tokens.accessToken;

    expect(creatorAccessToken).toBeTruthy();

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

  beforeEach(async () => {
    await ensureRequiredPermissions();
  });

  afterAll(async () => {
    const uniqueApprovalIds = createdApprovalIds.filter(
      (id, index, array) => id > 0 && array.indexOf(id) === index
    );

    for (const approvalId of uniqueApprovalIds) {
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
        // Cleanup should not fail the suite.
      }
    }

    const uniqueTemporaryAdvertisementIds = temporaryAdvertisementIds.filter(
      (id, index, array) => id > 0 && array.indexOf(id) === index
    );

    for (const advertisementId of uniqueTemporaryAdvertisementIds) {
      try {
        await pool.query(
          `
          DELETE FROM advertisement_payments
          WHERE advertisement_id = $1
          `,
          [advertisementId]
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
          [advertisementId]
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

  it("should authenticate the Ad Creator and Finance Approver", () => {
    expect(creatorAccessToken).toBeTruthy();
    expect(financeAccessToken).toBeTruthy();
  });

  it("should create the advertisement used by refund approval tests", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId: testClientId,
        name: `Financial Refund Advertisement ${timestamp}`,
        internalName: `financial-refund-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/financial-refund-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes:
          "Temporary advertisement for financial refund integration tests.",
        advertisementAmount: 50000,
        currencyCode: "INR"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    testAdvertisementId = Number(response.body.data.id);

    expect(testAdvertisementId).toBeGreaterThan(0);
    expect(response.body.data.workflowStatus).toBe("DRAFT");
  });

  it("should create a verified payment linked to the advertisement", async () => {
    const paymentResult = await pool.query(
      `
      INSERT INTO advertisement_payments
      (
        advertisement_id,
        payment_date,
        amount,
        payment_method,
        payment_status,
        transaction_reference,
        notes,
        recorded_by,
        verified_by,
        verified_at
      )
      VALUES
      (
        $1,
        CURRENT_TIMESTAMP,
        $2,
        $3,
        'VERIFIED',
        $4,
        $5,
        $6,
        $6,
        CURRENT_TIMESTAMP
      )
      RETURNING id, advertisement_id, amount, payment_status
      `,
      [
        testAdvertisementId,
        25000,
        "UPI",
        `TXN-FA-REFUND-${timestamp}`,
        "Verified payment for financial refund integration tests.",
        financeUserId
      ]
    );

    testPaymentId = Number(paymentResult.rows[0]?.id ?? 0);

    expect(testPaymentId).toBeGreaterThan(0);
    expect(Number(paymentResult.rows[0]?.advertisement_id)).toBe(
      testAdvertisementId
    );
    expect(Number(paymentResult.rows[0]?.amount)).toBe(25000);
    expect(paymentResult.rows[0]?.payment_status).toBe("VERIFIED");
  });

  it("should create a REFUND approval using requestedAmount", async () => {
    const requestedAmount = 5000;

    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "REFUND",
        requestedAmount,
        remarks: "Refund requested as a fixed amount."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(response.body.data.approvalType).toBe("REFUND");
    expect(Number(response.body.data.requestedAmount)).toBe(requestedAmount);
    expect(response.body.data.requestedPercentage).toBeNull();
    expect(Number(response.body.data.paymentId)).toBe(testPaymentId);
    expect(response.body.data.status).toBe("SUBMITTED");
    expect(Number(response.body.data.requestedBy)).toBe(creatorUserId);
  });

  it("should allow Finance Approver to approve a REFUND amount request", async () => {
    const approvalId = createdApprovalIds[createdApprovalIds.length - 1];

    expect(approvalId).toBeGreaterThan(0);

    const approvalRemarks = "Fixed refund amount approved.";

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
    expect(response.body.data.approvalType).toBe("REFUND");
    expect(response.body.data.status).toBe("APPROVED");
    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);
    expect(response.body.data.approvalRemarks).toBe(approvalRemarks);
  });

  it("should create a REFUND approval using requestedPercentage", async () => {
    const requestedPercentage = 25;

    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "REFUND",
        requestedPercentage,
        remarks: "Refund requested as a percentage."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(response.body.data.approvalType).toBe("REFUND");
    expect(Number(response.body.data.requestedPercentage)).toBe(
      requestedPercentage
    );
    expect(response.body.data.requestedAmount).toBeNull();
    expect(Number(response.body.data.paymentId)).toBe(testPaymentId);
    expect(response.body.data.status).toBe("SUBMITTED");
  });

  it("should allow Finance Approver to approve a REFUND percentage request", async () => {
    const approvalId = createdApprovalIds[createdApprovalIds.length - 1];

    expect(approvalId).toBeGreaterThan(0);

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Percentage refund approved."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("APPROVED");
    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);
  });

  it("should allow a REFUND approval without paymentId", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        approvalType: "REFUND",
        requestedAmount: 2500,
        remarks: "Refund approval without payment linkage."
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
        approvalRemarks: "Refund approved without payment linkage."
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  it("should reject a REFUND request containing both amount and percentage", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "REFUND",
        requestedAmount: 5000,
        requestedPercentage: 20,
        remarks: "Both refund amount and percentage supplied."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject a REFUND request without amount or percentage", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "REFUND",
        remarks: "Missing refund amount and percentage."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject a REFUND requestedAmount below zero", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "REFUND",
        requestedAmount: -500,
        remarks: "Negative refund amount validation."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject a REFUND requestedPercentage above 100", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "REFUND",
        requestedPercentage: 101,
        remarks: "Refund percentage above maximum."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should accept a REFUND requestedPercentage of zero", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "REFUND",
        requestedPercentage: 0,
        remarks: "Zero refund percentage boundary test."
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(Number(response.body.data.requestedPercentage)).toBe(0);

    const approveResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Zero percentage refund approved."
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  it("should accept a REFUND requestedPercentage of 100", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "REFUND",
        requestedPercentage: 100,
        remarks: "Full refund percentage boundary test."
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
        approvalRemarks: "Full refund percentage approved."
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  it("should trim REFUND approval remarks", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "REFUND",
        requestedAmount: 1750,
        approvalRemarks: "   Refund remarks requiring trimming.   "
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    expect(response.body.data.approvalRemarks).toBe(
      "Refund remarks requiring trimming."
    );

    const approveResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Refund trimming test approved."
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.status).toBe("APPROVED");
  });

  it("should move a REFUND approval from SUBMITTED to HOLD", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "REFUND",
        requestedAmount: 3000,
        remarks: "Refund hold workflow test."
      });

    expect(response.status).toBe(201);

    const approvalId = Number(response.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    const holdResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/hold`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        holdReason: "Refund requires additional payment verification."
      });

    expect(holdResponse.status).toBe(200);
    expect(holdResponse.body.success).toBe(true);
    expect(holdResponse.body.data.approvalType).toBe("REFUND");
    expect(holdResponse.body.data.status).toBe("HOLD");
    expect(Number(holdResponse.body.data.reviewedBy)).toBe(financeUserId);
    expect(holdResponse.body.data.holdReason).toBe(
      "Refund requires additional payment verification."
    );
  });

  it("should allow Finance Approver to approve a REFUND from HOLD", async () => {
    const approvalId = createdApprovalIds[createdApprovalIds.length - 1];

    expect(approvalId).toBeGreaterThan(0);

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Refund approved after verification."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("APPROVED");
  });

  it("should record SUBMITTED, HOLD and APPROVED history for a REFUND approval", async () => {
    const approvalId = createdApprovalIds[createdApprovalIds.length - 1];

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/history`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const history = response.body.data as Array<{
      fromStatus: string | null;
      toStatus: string;
      actionBy: number | string;
    }>;

    expect(history.length).toBeGreaterThanOrEqual(3);

    const submittedHistory = history.find(
      (item) => item.fromStatus === null && item.toStatus === "SUBMITTED"
    );

    const holdHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "HOLD"
    );

    const approvedHistory = history.find(
      (item) => item.fromStatus === "HOLD" && item.toStatus === "APPROVED"
    );

    expect(submittedHistory).toBeDefined();
    expect(holdHistory).toBeDefined();
    expect(approvedHistory).toBeDefined();

    expect(Number(submittedHistory?.actionBy)).toBe(creatorUserId);

    expect(Number(holdHistory?.actionBy)).toBe(financeUserId);

    expect(Number(approvedHistory?.actionBy)).toBe(financeUserId);
  });

  it("should reject approving an already APPROVED REFUND approval", async () => {
    const approvalId = createdApprovalIds[createdApprovalIds.length - 1];

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Second refund approval attempt."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject placing an APPROVED REFUND approval on HOLD", async () => {
    const approvalId = createdApprovalIds[createdApprovalIds.length - 1];

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/hold`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        holdReason: "Attempted hold after refund approval."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject rejecting an APPROVED REFUND approval", async () => {
    const approvalId = createdApprovalIds[createdApprovalIds.length - 1];

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason: "Attempted rejection after refund approval."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject an empty REFUND rejection reason", async () => {
    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "REFUND",
        requestedAmount: 1250,
        remarks: "Refund rejection validation test."
      });

    expect(createResponse.status).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

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
  });

  it("should reject a REFUND approval by Ad Creator", async () => {
    const temporaryAdvertisementId = await createTemporaryAdvertisement(
      "creator-authorization"
    );

    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: temporaryAdvertisementId,
        clientId: testClientId,
        approvalType: "REFUND",
        requestedAmount: 1500,
        remarks: "Creator authorization boundary test."
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
        approvalRemarks: "Ad Creator must not approve a refund."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);

    const financeResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Creator authorization boundary test completed."
      });

    expect(financeResponse.status).toBe(200);
    expect(financeResponse.body.success).toBe(true);
    expect(financeResponse.body.data.status).toBe("APPROVED");
  });

  it("should deny Finance Approver from resubmitting a REFUND approval", async () => {
    const temporaryAdvertisementId = await createTemporaryAdvertisement(
      "finance-resubmit-authorization"
    );

    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: temporaryAdvertisementId,
        clientId: testClientId,
        approvalType: "REFUND",
        requestedAmount: 2000,
        remarks: "Finance resubmit authorization test."
      });

    expect(createResponse.status).toBe(201);

    const approvalId = Number(createResponse.body.data.id);

    expect(approvalId).toBeGreaterThan(0);

    createdApprovalIds.push(approvalId);

    const rejectResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason: "Temporary refund rejection for authorization testing."
      });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.data.status).toBe("REJECTED");

    const resubmitResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/resubmit`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        remarks: "Finance should not resubmit a refund approval."
      });

    expect(resubmitResponse.status).toBe(403);
    expect(resubmitResponse.body.success).toBe(false);
  });

  it("should allow Ad Creator to resubmit a rejected REFUND approval", async () => {
    const temporaryAdvertisementId = await createTemporaryAdvertisement(
      "creator-resubmit-workflow"
    );

    const createResponse = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        advertisementId: temporaryAdvertisementId,
        clientId: testClientId,
        approvalType: "REFUND",
        requestedAmount: 2250,
        remarks: "Refund resubmission workflow test."
      });

    expect(createResponse.status).toBe(201);

    resubmitApprovalId = Number(createResponse.body.data.id);

    expect(resubmitApprovalId).toBeGreaterThan(0);

    createdApprovalIds.push(resubmitApprovalId);

    const rejectResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${resubmitApprovalId}/reject`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        rejectionReason: "Refund requires revised documentation."
      });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.data.status).toBe("REJECTED");

    const resubmitResponse = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${resubmitApprovalId}/resubmit`
      )
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        remarks: "Refund documentation has been revised."
      });

    expect(resubmitResponse.status).toBe(200);
    expect(resubmitResponse.body.success).toBe(true);
    expect(resubmitResponse.body.data.status).toBe("SUBMITTED");
    expect(Number(resubmitResponse.body.data.id)).toBe(resubmitApprovalId);
    expect(Number(resubmitResponse.body.data.requestedBy)).toBe(creatorUserId);
  });

  it("should allow Finance Approver to approve a resubmitted REFUND approval", async () => {
    expect(resubmitApprovalId).toBeGreaterThan(0);

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${resubmitApprovalId}/approve`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`)
      .send({
        approvalRemarks: "Resubmitted refund approved."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("APPROVED");
    expect(Number(response.body.data.id)).toBe(resubmitApprovalId);
    expect(Number(response.body.data.reviewedBy)).toBe(financeUserId);
  });

  it("should preserve REFUND approval history through rejection and resubmission", async () => {
    expect(resubmitApprovalId).toBeGreaterThan(0);

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${resubmitApprovalId}/history`
      )
      .set("Authorization", `Bearer ${financeAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const history = response.body.data as Array<{
      fromStatus: string | null;
      toStatus: string;
      actionBy: number | string;
    }>;

    expect(history.length).toBeGreaterThanOrEqual(4);

    const submittedHistory = history.find(
      (item) => item.fromStatus === null && item.toStatus === "SUBMITTED"
    );

    const rejectedHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "REJECTED"
    );

    const resubmittedHistory = history.find(
      (item) => item.fromStatus === "REJECTED" && item.toStatus === "SUBMITTED"
    );

    const approvedHistory = history.find(
      (item) => item.fromStatus === "SUBMITTED" && item.toStatus === "APPROVED"
    );

    expect(submittedHistory).toBeDefined();
    expect(rejectedHistory).toBeDefined();
    expect(resubmittedHistory).toBeDefined();
    expect(approvedHistory).toBeDefined();

    expect(Number(submittedHistory?.actionBy)).toBe(creatorUserId);

    expect(Number(rejectedHistory?.actionBy)).toBe(financeUserId);

    expect(Number(resubmittedHistory?.actionBy)).toBe(creatorUserId);

    expect(Number(approvedHistory?.actionBy)).toBe(financeUserId);
  });
});
