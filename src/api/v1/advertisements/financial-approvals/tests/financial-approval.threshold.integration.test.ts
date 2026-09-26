import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Financial Approval Threshold Integration", () => {
  let creatorAccessToken = "";
  let reviewerAccessToken = "";

  let creatorUserId = 0;
  let reviewerUserId = 0;

  let creatorRoleId = 0;
  let reviewerRoleId = 0;

  let clientId = 0;
  let advertisementId = 0;

  let creatorUsername = "";
  let reviewerUsername = "";

  let testApprovalType = "";

  const timestamp = Date.now();

  const createdThresholdIds: number[] = [];
  const createdApprovalIds: number[] = [];
  const createdPaymentIds: number[] = [];

  const validApprovalTypes = [
    "DISCOUNT",
    "REFUND",
    "PARTIAL_REFUND",
    "ADJUSTMENT"
  ] as const;

  const createUser = async (
    username: string,
    email: string,
    fullName: string
  ): Promise<number> => {
    const passwordHash = await bcrypt.hash("Test@12345", 10);

    const result = await pool.query<{
      id: number | string;
    }>(
      `
        INSERT INTO users
        (
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
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $4,
          'ACTIVE',
          NULL,
          NOW(),
          NOW()
        )
        RETURNING id
      `,
      [username, email, passwordHash, fullName]
    );

    const rawId = result.rows[0]?.id;
    const userId = Number(rawId);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error(`Failed to create test user: ${email}`);
    }

    return userId;
  };

  const createRole = async (
    roleCode: string,
    roleName: string,
    createdBy: number
  ): Promise<number> => {
    const result = await pool.query<{
      id: number | string;
    }>(
      `
        INSERT INTO roles
        (
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
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          'ACTIVE',
          $5,
          $5,
          NOW(),
          NOW()
        )
        RETURNING id
      `,
      [roleCode, roleName, `${roleName} integration test role`, 9990, createdBy]
    );

    const rawId = result.rows[0]?.id;
    const roleId = Number(rawId);

    if (!Number.isInteger(roleId) || roleId <= 0) {
      throw new Error(`Failed to create test role: ${roleName}`);
    }

    return roleId;
  };

  const assignRole = async (userId: number, roleId: number): Promise<void> => {
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
        ON CONFLICT DO NOTHING
      `,
      [userId, roleId]
    );

    await pool.query(
      `
        UPDATE users
        SET
          role_id = $2,
          updated_at = NOW()
        WHERE id = $1
      `,
      [userId, roleId]
    );
  };

  const grantPermission = async (
    roleId: number,
    permissionCode: string
  ): Promise<void> => {
    const permissionResult = await pool.query<{
      id: number | string;
    }>(
      `
        SELECT id
        FROM permissions
        WHERE code = $1
        LIMIT 1
      `,
      [permissionCode]
    );

    const rawPermissionId = permissionResult.rows[0]?.id;
    const permissionId = Number(rawPermissionId);

    if (!Number.isInteger(permissionId) || permissionId <= 0) {
      throw new Error(`Permission not found: ${permissionCode}`);
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
  };

  const login = async (username: string): Promise<string> => {
    const response = await request(app).post("/api/v1/auth/login").send({
      username,
      password: "Test@12345"
    });

    expect(response.status, JSON.stringify(response.body)).toBe(200);

    const token = response.body?.data?.tokens?.accessToken;

    if (typeof token !== "string" || token.length === 0) {
      throw new Error(`Failed to obtain access token for ${username}`);
    }

    return token;
  };

  const findAvailableApprovalType = async (): Promise<string> => {
    for (const approvalType of validApprovalTypes) {
      const result = await pool.query<{
        count: string;
      }>(
        `
            SELECT COUNT(*)::text AS count
            FROM advertisement_financial_approval_thresholds
            WHERE
              approval_type = $1
              AND status = 'ACTIVE'
          `,
        [approvalType]
      );

      const count = Number(result.rows[0]?.count ?? 0);

      if (count === 0) {
        return approvalType;
      }
    }

    throw new Error(
      "No financial approval type is available for threshold integration testing. All approval types currently have an active threshold configuration."
    );
  };

  const createClient = async (): Promise<number> => {
    const result = await pool.query<{
      id: number | string;
    }>(
      `
        INSERT INTO advertisement_clients
        (
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
        VALUES
        (
          $1,
          $2,
          $3,
          'ACTIVE',
          false,
          $4,
          $4,
          NOW(),
          NOW()
        )
        RETURNING id
      `,
      [
        `TFA-T-${timestamp}`,
        "Threshold Test Client",
        "Threshold Test Client",
        creatorUserId
      ]
    );

    const rawId = result.rows[0]?.id;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Failed to create advertisement client.");
    }

    return id;
  };

  const createAdvertisement = async (): Promise<number> => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId,
        name: "Threshold Integration Advertisement",
        internalName: `TFA-THRESHOLD-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/threshold-test",
        priority: 1,
        isClickable: true,
        openInNewTab: true,
        notes: "Threshold integration test advertisement",
        advertisementAmount: 100000,
        currencyCode: "INR"
      });

    expect(response.status, JSON.stringify(response.body)).toBe(201);

    const id = Number(response.body?.data?.id);

    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Advertisement creation did not return an id.");
    }

    return id;
  };

  const createPayment = async (amount: number): Promise<number> => {
    const result = await pool.query<{
      id: number | string;
    }>(
      `
        INSERT INTO advertisement_payments
        (
          advertisement_id,
          amount,
          payment_date,
          payment_method,
          payment_status,
          transaction_reference,
          notes,
          recorded_by,
          recorded_at,
          verified_by,
          verified_at,
          payment_type
        )
        VALUES
        (
          $1,
          $2,
          NOW(),
          'BANK_TRANSFER',
          'VERIFIED',
          $3,
          'Threshold integration payment',
          $4,
          NOW(),
          $5,
          NOW(),
          'REGULAR'
        )
        RETURNING id
      `,
      [
        advertisementId,
        amount,
        `TFA-PAY-${timestamp}-${createdPaymentIds.length + 1}`,
        creatorUserId,
        reviewerUserId
      ]
    );

    const rawId = result.rows[0]?.id;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Failed to create payment fixture.");
    }

    createdPaymentIds.push(id);

    return id;
  };

  const createApproval = async (options: {
    requestedAmount?: number;
    requestedPercentage?: number;
    paymentId?: number;
    remarks?: string;
  }): Promise<{
    id: number;
    status: string;
  }> => {
    const body: Record<string, unknown> = {
      advertisementId,
      clientId,
      approvalType: testApprovalType,
      approvalRemarks: options.remarks ?? "Threshold integration approval"
    };

    if (options.requestedAmount !== undefined) {
      body.requestedAmount = options.requestedAmount;
    }

    if (options.requestedPercentage !== undefined) {
      body.requestedPercentage = options.requestedPercentage;
    }

    if (options.paymentId !== undefined) {
      body.paymentId = options.paymentId;
    }

    const response = await request(app)
      .post("/api/v1/advertisements/payments/financial-approval")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send(body);

    expect(response.status, JSON.stringify(response.body)).toBe(201);

    const id = Number(response.body?.data?.id);

    const status = response.body?.data?.status;

    if (!Number.isInteger(id) || id <= 0 || typeof status !== "string") {
      throw new Error("Financial approval creation did not return id/status.");
    }

    createdApprovalIds.push(id);

    return {
      id,
      status
    };
  };

  const createThreshold = async (options: {
    amountThreshold?: number | null;
    percentageThreshold?: number | null;
    status?: "ACTIVE" | "INACTIVE";
  }): Promise<number> => {
    if (
      options.amountThreshold === undefined &&
      options.percentageThreshold === undefined
    ) {
      throw new Error(
        "Threshold fixture requires amountThreshold or percentageThreshold."
      );
    }

    if (
      options.amountThreshold !== undefined &&
      options.percentageThreshold !== undefined &&
      options.amountThreshold !== null &&
      options.percentageThreshold !== null
    ) {
      throw new Error(
        "Threshold fixture cannot contain both amountThreshold and percentageThreshold."
      );
    }

    const result = await pool.query<{
      id: number | string;
    }>(
      `
        INSERT INTO advertisement_financial_approval_thresholds
        (
          approval_type,
          amount_threshold,
          percentage_threshold,
          status,
          created_by,
          updated_by,
          created_at,
          updated_at
        )
        VALUES
        (
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
        testApprovalType,
        options.amountThreshold ?? null,
        options.percentageThreshold ?? null,
        options.status ?? "ACTIVE",
        reviewerUserId
      ]
    );

    const rawId = result.rows[0]?.id;
    const id = Number(rawId);

    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Failed to create threshold fixture.");
    }

    createdThresholdIds.push(id);

    return id;
  };

  const setThresholdStatus = async (
    thresholdId: number,
    status: "ACTIVE" | "INACTIVE"
  ): Promise<void> => {
    await pool.query(
      `
        UPDATE advertisement_financial_approval_thresholds
        SET
          status = $2,
          updated_by = $3,
          updated_at = NOW()
        WHERE id = $1
      `,
      [thresholdId, status, reviewerUserId]
    );
  };

  const getApproval = async (
    approvalId: number
  ): Promise<{
    status: string;
    paymentId: number | null;
  }> => {
    const response = await request(app)
      .get(`/api/v1/advertisements/payments/financial-approval/${approvalId}`)
      .set("Authorization", `Bearer ${reviewerAccessToken}`);

    expect(response.status, JSON.stringify(response.body)).toBe(200);

    const status = response.body?.data?.status;

    if (typeof status !== "string") {
      throw new Error("Financial approval response did not return status.");
    }

    const rawPaymentId = response.body?.data?.paymentId;

    const paymentId =
      rawPaymentId === null || rawPaymentId === undefined
        ? null
        : Number(rawPaymentId);

    if (
      paymentId !== null &&
      (!Number.isInteger(paymentId) || paymentId <= 0)
    ) {
      throw new Error(
        "Financial approval response returned an invalid paymentId."
      );
    }

    return {
      status,
      paymentId
    };
  };

  const approve = async (
    approvalId: number
  ): Promise<{
    statusCode: number;
    status: string | undefined;
  }> => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`
      )
      .set("Authorization", `Bearer ${reviewerAccessToken}`)
      .send({
        approvalRemarks: "Threshold integration approval review"
      });

    return {
      statusCode: response.status,
      status: response.body?.data?.status
    };
  };

  const getHistory = async (
    approvalId: number
  ): Promise<
    Array<{
      fromStatus: string | null;
      toStatus: string;
      holdReason: string | null;
    }>
  > => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/history`
      )
      .set("Authorization", `Bearer ${reviewerAccessToken}`);

    expect(response.status, JSON.stringify(response.body)).toBe(200);

    const history = response.body?.data;

    if (!Array.isArray(history)) {
      throw new Error(
        "Financial approval history response did not return an array."
      );
    }

    return history as Array<{
      fromStatus: string | null;
      toStatus: string;
      holdReason: string | null;
    }>;
  };

  const cleanupApprovals = async (): Promise<void> => {
    if (createdApprovalIds.length === 0) {
      return;
    }

    const approvalIds = [...createdApprovalIds];

    /*
     * The actual history foreign-key column is
     * approval_id, not financial_approval_id.
     */
    await pool.query(
      `
          DELETE FROM advertisement_financial_approval_history
          WHERE approval_id = ANY($1::bigint[])
        `,
      [approvalIds]
    );

    await pool.query(
      `
          DELETE FROM advertisement_financial_approvals
          WHERE id = ANY($1::bigint[])
        `,
      [approvalIds]
    );

    createdApprovalIds.length = 0;
  };

  const cleanupPayments = async (): Promise<void> => {
    if (createdPaymentIds.length === 0) {
      return;
    }

    const paymentIds = [...createdPaymentIds];

    await pool.query(
      `
          DELETE FROM advertisement_payments
          WHERE id = ANY($1::bigint[])
        `,
      [paymentIds]
    );

    createdPaymentIds.length = 0;
  };

  const cleanupThresholds = async (): Promise<void> => {
    if (createdThresholdIds.length === 0) {
      return;
    }

    const thresholdIds = [...createdThresholdIds];

    await pool.query(
      `
          DELETE FROM advertisement_financial_approval_thresholds
          WHERE id = ANY($1::bigint[])
        `,
      [thresholdIds]
    );

    createdThresholdIds.length = 0;
  };

  beforeAll(async () => {
    creatorUsername = `threshold_creator_${timestamp}`;

    reviewerUsername = `threshold_reviewer_${timestamp}`;

    creatorUserId = await createUser(
      creatorUsername,
      `threshold-creator-${timestamp}@example.com`,
      "Threshold Test Creator"
    );

    reviewerUserId = await createUser(
      reviewerUsername,
      `threshold-reviewer-${timestamp}@example.com`,
      "Threshold Test Reviewer"
    );

    const creatorRoleCode = `TEST_TFA_CREATOR_${timestamp}`;

    const reviewerRoleCode = `TEST_TFA_REVIEWER_${timestamp}`;

    creatorRoleId = await createRole(
      creatorRoleCode,
      `Threshold Creator ${timestamp}`,
      creatorUserId
    );

    reviewerRoleId = await createRole(
      reviewerRoleCode,
      `Threshold Reviewer ${timestamp}`,
      reviewerUserId
    );

    await assignRole(creatorUserId, creatorRoleId);

    await assignRole(reviewerUserId, reviewerRoleId);

    await grantPermission(creatorRoleId, "advertisements.read");

    await grantPermission(creatorRoleId, "advertisements.create");

    await grantPermission(creatorRoleId, "advertisements.submit");

    await grantPermission(
      reviewerRoleId,
      "advertisements.financial_approvals.read"
    );

    await grantPermission(
      reviewerRoleId,
      "advertisements.financial_approvals.approve"
    );

    creatorAccessToken = await login(creatorUsername);

    reviewerAccessToken = await login(reviewerUsername);

    testApprovalType = await findAvailableApprovalType();

    clientId = await createClient();

    advertisementId = await createAdvertisement();
  });

  afterEach(async () => {
    await cleanupApprovals();
    await cleanupPayments();
    await cleanupThresholds();
  });

  afterAll(async () => {
    /*
     * Make cleanup defensive in case a test failed
     * before afterEach could remove one of the fixtures.
     */
    try {
      await cleanupApprovals();
    } catch {
      // Cleanup should not fail the suite.
    }

    try {
      await cleanupPayments();
    } catch {
      // Cleanup should not fail the suite.
    }

    try {
      await cleanupThresholds();
    } catch {
      // Cleanup should not fail the suite.
    }

    if (advertisementId > 0) {
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

    if (clientId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM advertisement_clients
            WHERE id = $1
          `,
          [clientId]
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

    if (reviewerUserId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM user_roles
            WHERE user_id = $1
          `,
          [reviewerUserId]
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

    if (reviewerRoleId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM role_permissions
            WHERE role_id = $1
          `,
          [reviewerRoleId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }

      try {
        await pool.query(
          `
            DELETE FROM roles
            WHERE id = $1
          `,
          [reviewerRoleId]
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

    if (reviewerUserId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM users
            WHERE id = $1
          `,
          [reviewerUserId]
        );
      } catch {
        // Cleanup should not fail the suite.
      }
    }

    await pool.end();
  });

  it("should approve a requested amount below the configured threshold", async () => {
    const thresholdId = await createThreshold({
      amountThreshold: 10000
    });

    const paymentId = await createPayment(50000);

    const approval = await createApproval({
      requestedAmount: 9999,
      paymentId
    });

    expect(approval.status).toBe("SUBMITTED");

    const result = await approve(approval.id);

    expect(result.statusCode).toBe(200);
    expect(result.status).toBe("APPROVED");
    expect(thresholdId).toBeGreaterThan(0);
  });

  it("should approve a requested amount exactly equal to the configured threshold", async () => {
    await createThreshold({
      amountThreshold: 10000
    });

    const paymentId = await createPayment(50000);

    const approval = await createApproval({
      requestedAmount: 10000,
      paymentId
    });

    const result = await approve(approval.id);

    expect(result.statusCode).toBe(200);
    expect(result.status).toBe("APPROVED");
  });

  it("should place a requested amount above the configured threshold on hold", async () => {
    await createThreshold({
      amountThreshold: 10000
    });

    const paymentId = await createPayment(50000);

    const approval = await createApproval({
      requestedAmount: 10001,
      paymentId
    });

    expect(approval.status).toBe("SUBMITTED");

    const result = await approve(approval.id);

    expect(result.statusCode).toBe(200);
    expect(result.status).toBe("HOLD");

    const stored = await getApproval(approval.id);

    expect(stored.status).toBe("HOLD");
    expect(stored.paymentId).toBe(paymentId);
  });

  it("should record THRESHOLD_EXCEEDED in approval history", async () => {
    await createThreshold({
      amountThreshold: 10000
    });

    const approval = await createApproval({
      requestedAmount: 10001
    });

    const result = await approve(approval.id);

    expect(result.statusCode).toBe(200);
    expect(result.status).toBe("HOLD");

    const history = await getHistory(approval.id);

    const thresholdHistory = history.find(
      (entry) => entry.fromStatus === "SUBMITTED" && entry.toStatus === "HOLD"
    );

    expect(thresholdHistory).toBeDefined();

    expect(thresholdHistory?.holdReason).toContain("THRESHOLD_EXCEEDED");
  });

  it("should allow a held approval to be approved without re-evaluating the threshold", async () => {
    await createThreshold({
      amountThreshold: 10000
    });

    const approval = await createApproval({
      requestedAmount: 10001
    });

    const firstAttempt = await approve(approval.id);

    expect(firstAttempt.statusCode).toBe(200);

    expect(firstAttempt.status).toBe("HOLD");

    const secondAttempt = await approve(approval.id);

    expect(secondAttempt.statusCode).toBe(200);

    expect(secondAttempt.status).toBe("APPROVED");

    const stored = await getApproval(approval.id);

    expect(stored.status).toBe("APPROVED");
  });

  it("should approve a requested percentage below the configured threshold", async () => {
    await createThreshold({
      percentageThreshold: 25
    });

    const paymentId = await createPayment(50000);

    const approval = await createApproval({
      requestedPercentage: 24.99,
      paymentId
    });

    expect(approval.status).toBe("SUBMITTED");

    const result = await approve(approval.id);

    expect(result.statusCode).toBe(200);
    expect(result.status).toBe("APPROVED");
  });

  it("should approve a requested percentage exactly equal to the configured threshold", async () => {
    await createThreshold({
      percentageThreshold: 25
    });

    const paymentId = await createPayment(50000);

    const approval = await createApproval({
      requestedPercentage: 25,
      paymentId
    });

    const result = await approve(approval.id);

    expect(result.statusCode).toBe(200);
    expect(result.status).toBe("APPROVED");
  });

  it("should place a requested percentage above the configured threshold on hold", async () => {
    await createThreshold({
      percentageThreshold: 25
    });

    const paymentId = await createPayment(50000);

    const approval = await createApproval({
      requestedPercentage: 25.01,
      paymentId
    });

    const result = await approve(approval.id);

    expect(result.statusCode).toBe(200);
    expect(result.status).toBe("HOLD");

    const stored = await getApproval(approval.id);

    expect(stored.status).toBe("HOLD");
    expect(stored.paymentId).toBe(paymentId);
  });

  it("should approve normally when no active threshold exists", async () => {
    const thresholdId = await createThreshold({
      amountThreshold: 10000
    });

    await setThresholdStatus(thresholdId, "INACTIVE");

    const paymentId = await createPayment(50000);

    const approval = await createApproval({
      requestedAmount: 50000,
      paymentId
    });

    const result = await approve(approval.id);

    expect(result.statusCode).toBe(200);
    expect(result.status).toBe("APPROVED");
  });

  it("should not change the payment when threshold approval is placed on hold", async () => {
    await createThreshold({
      amountThreshold: 10000
    });

    const paymentId = await createPayment(50000);

    const paymentBeforeResult = await pool.query<{
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

    expect(paymentBeforeResult.rows[0]?.payment_status).toBe("VERIFIED");

    expect(Number(paymentBeforeResult.rows[0]?.amount)).toBe(50000);

    const approval = await createApproval({
      requestedAmount: 10001,
      paymentId
    });

    const result = await approve(approval.id);

    expect(result.statusCode).toBe(200);
    expect(result.status).toBe("HOLD");

    const paymentAfterResult = await pool.query<{
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

    expect(paymentAfterResult.rows[0]?.payment_status).toBe("VERIFIED");

    expect(Number(paymentAfterResult.rows[0]?.amount)).toBe(50000);
  });

  it("should keep threshold hold separate from client ad creation hold", async () => {
    await pool.query(
      `
          UPDATE advertisement_clients
          SET
            ad_creation_hold = false,
            updated_at = NOW()
          WHERE id = $1
        `,
      [clientId]
    );

    await createThreshold({
      amountThreshold: 10000
    });

    const approval = await createApproval({
      requestedAmount: 10001
    });

    const result = await approve(approval.id);

    expect(result.statusCode).toBe(200);
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
      [clientId]
    );

    expect(clientResult.rows[0]?.ad_creation_hold).toBe(false);
  });
});
