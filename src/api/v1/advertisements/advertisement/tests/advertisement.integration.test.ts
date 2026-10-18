import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement API Integration", () => {
  let accessToken = "";

  let testUserId = 0;
  let superAdminRoleId = 0;
  let testRoleId = 0;
  let testClientId = 0;
  let testAdvertisementId = 0;
  let testPlacementId = 0;
  let testRateCardId = 0;

  let readPermissionId = 0;
  let createPermissionId = 0;
  let updatePermissionId = 0;
  let activatePermissionId = 0;

  const timestamp = Date.now();

  const testUsername = `advertisement_test_${timestamp}`;
  const testEmail = `advertisement_test_${timestamp}@example.com`;
  const testRoleCode = `ADVERTISEMENT_TEST_${timestamp}`;
  const testRoleName = `Advertisement Integration Test ${timestamp}`;
  const testClientCode = `ADTEST${timestamp}`;

  const testPassword = "Advertisement_Test@123";

  const advertisementAmount = 10000;

  beforeAll(async () => {
    const superAdminRoleResult = await pool.query<{
      id: number;
    }>(
      `
        SELECT id
        FROM roles
        WHERE UPPER(code) = 'SUPER_ADMIN'
        LIMIT 1
      `
    );

    expect(superAdminRoleResult.rows.length).toBe(1);

    superAdminRoleId = Number(superAdminRoleResult.rows[0]!.id);

    const passwordHash = await bcrypt.hash(testPassword, 10);

    const userResult = await pool.query<{
      id: number;
    }>(
      `
        INSERT INTO users
        (
          full_name,
          display_name,
          username,
          email,
          password_hash,
          role_id,
          status,
          must_change_password
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          'ACTIVE',
          false
        )
        RETURNING id
      `,
      [
        "Advertisement Integration Test User",
        "Advertisement Test User",
        testUsername,
        testEmail,
        passwordHash,
        superAdminRoleId
      ]
    );

    expect(userResult.rows.length).toBe(1);

    testUserId = Number(userResult.rows[0]!.id);

    const roleResult = await pool.query<{
      id: number;
    }>(
      `
        INSERT INTO roles
        (
          code,
          display_name,
          description,
          status
        )
        VALUES
        (
          $1,
          $2,
          $3,
          'ACTIVE'
        )
        RETURNING id
      `,
      [
        testRoleCode,
        testRoleName,
        "Temporary role used by Advertisement API integration tests"
      ]
    );

    expect(roleResult.rows.length).toBe(1);

    testRoleId = Number(roleResult.rows[0]!.id);

    await pool.query(
      `
        UPDATE users
        SET role_id = $1
        WHERE id = $2
      `,
      [testRoleId, testUserId]
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
      [testUserId, testRoleId]
    );

    const permissionResult = await pool.query<{
      id: number;
      code: string;
    }>(
      `
        SELECT
          id,
          code
        FROM permissions
        WHERE
          UPPER(module) = 'ADVERTISEMENT'
          AND status = 'ACTIVE'
          AND LOWER(code) IN
          (
            'advertisements.read',
            'advertisements.create',
            'advertisements.update',
            'advertisements.activate'
          )
      `
    );

    for (const permission of permissionResult.rows) {
      const code = permission.code.toLowerCase();

      if (code === "advertisements.read") {
        readPermissionId = Number(permission.id);
      }

      if (code === "advertisements.create") {
        createPermissionId = Number(permission.id);
      }

      if (code === "advertisements.update") {
        updatePermissionId = Number(permission.id);
      }

      if (code === "advertisements.activate") {
        activatePermissionId = Number(permission.id);
      }
    }

    expect(readPermissionId).toBeGreaterThan(0);
    expect(createPermissionId).toBeGreaterThan(0);
    expect(updatePermissionId).toBeGreaterThan(0);
    expect(activatePermissionId).toBeGreaterThan(0);

    await pool.query(
      `
        INSERT INTO role_permissions
        (
          role_id,
          permission_id
        )
        VALUES
        ($1, $2),
        ($1, $3),
        ($1, $4),
        ($1, $5)
      `,
      [
        testRoleId,
        readPermissionId,
        createPermissionId,
        updatePermissionId,
        activatePermissionId
      ]
    );

    const clientResult = await pool.query<{
      id: number;
    }>(
      `
        INSERT INTO advertisement_clients
        (
          name,
          display_name,
          contact_person,
          email,
          mobile,
          client_code,
          ad_creation_hold,
          ad_creation_hold_reason,
          status
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          false,
          NULL,
          'ACTIVE'
        )
        RETURNING id
      `,
      [
        `Advertisement Test Client ${timestamp}`,
        `Advertisement Test Client ${timestamp}`,
        "Advertisement Integration Test Contact",
        `advertisement-test-${timestamp}@example.com`,
        "9876543210",
        testClientCode
      ]
    );

    expect(clientResult.rows.length).toBe(1);

    testClientId = Number(clientResult.rows[0]!.id);

    /*
     * Advertisement creation with pricing requires:
     *
     * 1. An ACTIVE placement.
     * 2. The placement must be enabled.
     * 3. An ACTIVE DAY rate card must exist for that placement.
     * 4. The rate card must currently be effective.
     *
     * Do not depend on a pre-existing seed rate card because the test
     * database may not contain an effective DAY rate card.
     *
     * Select an ACTIVE/enabled placement that does not already have an
     * ACTIVE DAY rate card, then create a temporary rate card for it.
     *
     * This also avoids the active-rate-card overlap constraint.
     */
    const placementResult = await pool.query<{
      id: number;
    }>(
      `
        SELECT
          p.id
        FROM advertisement_placements p
        WHERE
          p.status = 'ACTIVE'
          AND p.is_enabled = TRUE
          AND NOT EXISTS
          (
            SELECT 1
            FROM advertisement_rate_cards rc
            WHERE
              rc.placement_id = p.id
              AND rc.pricing_unit = 'DAY'
              AND rc.status = 'ACTIVE'
          )
        ORDER BY
          p.id ASC
        LIMIT 1
      `
    );

    expect(placementResult.rows.length).toBe(1);

    testPlacementId = Number(placementResult.rows[0]!.id);

    expect(testPlacementId).toBeGreaterThan(0);

    /*
     * Create a deterministic temporary DAY rate card.
     *
     * The amount is aligned with the project's standard DAY rate-card
     * test value of INR 5,000.
     *
     * The effective period starts slightly before the current timestamp
     * and ends one day later.
     */
    const rateCardResult = await pool.query<{
      id: number;
    }>(
      `
        INSERT INTO advertisement_rate_cards
        (
          placement_id,
          pricing_unit,
          rate_amount,
          currency_code,
          effective_from,
          effective_to,
          status,
          created_by
        )
        VALUES
        (
          $1,
          'DAY',
          5000,
          'INR',
          CURRENT_TIMESTAMP - INTERVAL '1 minute',
          CURRENT_TIMESTAMP + INTERVAL '1 day',
          'ACTIVE',
          $2
        )
        RETURNING id
      `,
      [testPlacementId, testUserId]
    );

    expect(rateCardResult.rows.length).toBe(1);

    testRateCardId = Number(rateCardResult.rows[0]!.id);

    expect(testRateCardId).toBeGreaterThan(0);

    const rateCardVerificationResult = await pool.query<{
      placement_id: number;
      pricing_unit: string;
      rate_amount: string;
      currency_code: string;
      status: string;
    }>(
      `
        SELECT
          placement_id,
          pricing_unit,
          rate_amount,
          currency_code,
          status
        FROM advertisement_rate_cards
        WHERE id = $1
      `,
      [testRateCardId]
    );

    expect(rateCardVerificationResult.rows.length).toBe(1);

    const rateCard = rateCardVerificationResult.rows[0]!;

    expect(Number(rateCard.placement_id)).toBe(testPlacementId);
    expect(rateCard.pricing_unit).toBe("DAY");
    expect(Number(rateCard.rate_amount)).toBe(5000);
    expect(rateCard.currency_code).toBe("INR");
    expect(rateCard.status).toBe("ACTIVE");

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username: testUsername,
      password: testPassword
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);

    accessToken =
      loginResponse.body.data?.accessToken ??
      loginResponse.body.data?.tokens?.accessToken ??
      "";

    expect(accessToken).toBeTruthy();
  });

  afterAll(async () => {
    if (testAdvertisementId > 0) {
      /*
       * Placement rules reference advertisements, so remove them first.
       */
      await pool.query(
        `
          DELETE FROM advertisement_placement_rules
          WHERE advertisement_id = $1
        `,
        [testAdvertisementId]
      );

      /*
       * Payment records reference advertisements and must be removed
       * before deleting the advertisement.
       */
      await pool.query(
        `
          DELETE FROM advertisement_payments
          WHERE advertisement_id = $1
        `,
        [testAdvertisementId]
      );

      /*
       * Workflow history references advertisements.
       */
      await pool.query(
        `
          DELETE FROM advertisement_workflow_history
          WHERE advertisement_id = $1
        `,
        [testAdvertisementId]
      );

      /*
       * Pricing snapshots have a RESTRICT foreign key to advertisements,
       * so remove them before deleting the advertisement.
       */
      await pool.query(
        `
          DELETE FROM advertisement_pricing_snapshots
          WHERE advertisement_id = $1
        `,
        [testAdvertisementId]
      );

      /*
       * Operational audit entries, if present, also belong to the
       * advertisement and should be removed before deleting it.
       */
      await pool.query(
        `
          DELETE FROM advertisement_operational_audit
          WHERE advertisement_id = $1
        `,
        [testAdvertisementId]
      );

      await pool.query(
        `
          DELETE FROM advertisements
          WHERE id = $1
        `,
        [testAdvertisementId]
      );
    }

    /*
     * The rate card was created by the temporary test user, so remove
     * it before deleting that user.
     */
    if (testRateCardId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_rate_cards
          WHERE id = $1
        `,
        [testRateCardId]
      );
    }

    if (testClientId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_clients
          WHERE id = $1
        `,
        [testClientId]
      );
    }

    if (testRoleId > 0) {
      await pool.query(
        `
          DELETE FROM role_permissions
          WHERE role_id = $1
        `,
        [testRoleId]
      );
    }

    if (testUserId > 0) {
      await pool.query(
        `
          DELETE FROM user_sessions
          WHERE user_id = $1
        `,
        [testUserId]
      );

      await pool.query(
        `
          DELETE FROM user_roles
          WHERE user_id = $1
        `,
        [testUserId]
      );
    }

    if (testRoleId > 0) {
      await pool.query(
        `
          DELETE FROM roles
          WHERE id = $1
        `,
        [testRoleId]
      );
    }

    if (testUserId > 0) {
      await pool.query(
        `
          DELETE FROM users
          WHERE id = $1
        `,
        [testUserId]
      );
    }
  });

  it("should have a valid authentication token", () => {
    expect(accessToken).toBeTruthy();
  });

  it("POST /api/v1/advertisements - should create an advertisement", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: testClientId,
        name: `Integration Test Advertisement ${timestamp}`,
        advertisementType: "DISPLAY",
        currencyCode: "INR",
        advertisementAmount,
        destinationUrl: "https://example.com",
        isClickable: true,
        openInNewTab: true,
        priority: 10,
        pricing: {
          placementId: testPlacementId,
          pricingUnit: "DAY",
          quantity: 1
        }
      });

    console.log(
      "Advertisement create response:",
      response.status,
      response.body
    );

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    testAdvertisementId = Number(response.body.data.id);

    expect(testAdvertisementId).toBeGreaterThan(0);
    expect(Number(response.body.data.clientId)).toBe(testClientId);
    expect(response.body.data.workflowStatus).toBe("DRAFT");
    expect(response.body.data.status).toBe("DRAFT");
  });

  it("GET /api/v1/advertisements/:id - should retrieve the created advertisement", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/${testAdvertisementId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.id)).toBe(testAdvertisementId);
    expect(Number(response.body.data.clientId)).toBe(testClientId);
    expect(response.body.data.name).toContain("Integration Test Advertisement");
  });

  it("GET /api/v1/advertisements/:id - should return 404 for an unknown advertisement", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/999999999")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements - should list advertisements", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements?page=1&pageSize=20&clientId=${testClientId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const found = response.body.data.some(
      (advertisement: { id: number | string }) =>
        Number(advertisement.id) === testAdvertisementId
    );

    expect(found).toBe(true);
    expect(response.body.meta).toBeDefined();
  });

  it("PATCH /api/v1/advertisements/:id - should update a draft advertisement", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/${testAdvertisementId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: `Updated Integration Advertisement ${timestamp}`,
        priority: 20,
        notes: "Updated by Advertisement API integration test"
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe(
      `Updated Integration Advertisement ${timestamp}`
    );
    expect(Number(response.body.data.priority)).toBe(20);
  });

  it("PATCH /api/v1/advertisements/:id - should allow advertisement amount update while the advertisement is a draft", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/${testAdvertisementId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementAmount: 12000
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.advertisementAmount)).toBe(12000);
  });

  it("PATCH /api/v1/advertisements/:id - should restore the advertisement amount to the integration-test value", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/${testAdvertisementId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        advertisementAmount
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.advertisementAmount)).toBe(
      advertisementAmount
    );
  });

  it("POST /api/v1/advertisements - should reject a request with missing required fields", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements - should reject an unknown client", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: 999999999,
        name: `Unknown Client Advertisement ${timestamp}`,
        advertisementType: "DISPLAY",
        currencyCode: "INR",
        advertisementAmount: 10000,
        destinationUrl: "https://example.com/unknown-client-test",
        isClickable: true,
        openInNewTab: true,
        priority: 1,
        pricing: {
          placementId: testPlacementId,
          pricingUnit: "DAY",
          quantity: 1
        }
      });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements - should reject an invalid currency code", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: testClientId,
        name: `Invalid Currency Advertisement ${timestamp}`,
        advertisementType: "DISPLAY",
        currencyCode: "INVALID",
        advertisementAmount,
        priority: 10,
        pricing: {
          placementId: testPlacementId,
          pricingUnit: "DAY",
          quantity: 1
        }
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements - should reject a negative advertisement amount", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: testClientId,
        name: `Negative Amount Advertisement ${timestamp}`,
        advertisementType: "DISPLAY",
        currencyCode: "INR",
        advertisementAmount: -1,
        priority: 10,
        pricing: {
          placementId: testPlacementId,
          pricingUnit: "DAY",
          quantity: 1
        }
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements - should reject creation when the client is on ad-creation hold", async () => {
    await pool.query(
      `
        UPDATE advertisement_clients
        SET
          ad_creation_hold = true,
          ad_creation_hold_reason = 'Integration test hold'
        WHERE id = $1
      `,
      [testClientId]
    );

    try {
      const response = await request(app)
        .post("/api/v1/advertisements")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          clientId: testClientId,
          name: `Held Client Advertisement ${timestamp}`,
          advertisementType: "DISPLAY",
          currencyCode: "INR",
          advertisementAmount: 10000,
          destinationUrl: "https://example.com/hold-test",
          isClickable: true,
          openInNewTab: true,
          priority: 1,
          pricing: {
            placementId: testPlacementId,
            pricingUnit: "DAY",
            quantity: 1
          }
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    } finally {
      await pool.query(
        `
          UPDATE advertisement_clients
          SET
            ad_creation_hold = false,
            ad_creation_hold_reason = NULL
          WHERE id = $1
        `,
        [testClientId]
      );
    }
  });

  it("should verify that a newly created advertisement is in DRAFT workflow state", async () => {
    const result = await pool.query<{
      workflow_status: string;
      submitted_at: Date | null;
      submitted_by: number | null;
      approved_at: Date | null;
      approved_by: number | null;
      rejected_at: Date | null;
      rejected_by: number | null;
      on_hold_at: Date | null;
      on_hold_by: number | null;
      on_hold_reason: string | null;
    }>(
      `
        SELECT
          workflow_status,
          submitted_at,
          submitted_by,
          approved_at,
          approved_by,
          rejected_at,
          rejected_by,
          on_hold_at,
          on_hold_by,
          on_hold_reason
        FROM advertisements
        WHERE id = $1
      `,
      [testAdvertisementId]
    );

    expect(result.rows.length).toBe(1);

    const advertisement = result.rows[0]!;

    expect(advertisement.workflow_status).toBe("DRAFT");
    expect(advertisement.submitted_at).toBeNull();
    expect(advertisement.submitted_by).toBeNull();
    expect(advertisement.approved_at).toBeNull();
    expect(advertisement.approved_by).toBeNull();
    expect(advertisement.rejected_at).toBeNull();
    expect(advertisement.rejected_by).toBeNull();
    expect(advertisement.on_hold_at).toBeNull();
    expect(advertisement.on_hold_by).toBeNull();
    expect(advertisement.on_hold_reason).toBeNull();
  });

  it("should have no workflow history before a workflow transition occurs", async () => {
    const result = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM advertisement_workflow_history
        WHERE advertisement_id = $1
      `,
      [testAdvertisementId]
    );

    expect(Number(result.rows[0]!.count)).toBe(0);
  });

  it("should have no payment records when an advertisement is first created", async () => {
    const result = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM advertisement_payments
        WHERE advertisement_id = $1
      `,
      [testAdvertisementId]
    );

    expect(Number(result.rows[0]!.count)).toBe(0);
  });

  it("should reject activation of an archived advertisement without changing its state", async () => {
    await pool.query(
      `
        UPDATE advertisements
        SET
          workflow_status = 'ARCHIVED',
          status = 'ARCHIVED'
        WHERE id = $1
      `,
      [testAdvertisementId]
    );

    const response = await request(app)
      .post(`/api/v1/advertisements/${testAdvertisementId}/activate`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        remarks: "Attempting to activate an archived advertisement."
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Only approved advertisements can be activated."
    );
  });

  it("should preserve ARCHIVED workflow and operational statuses after rejected activation", async () => {
    const result = await pool.query<{
      workflow_status: string;
      status: string;
    }>(
      `
        SELECT
          workflow_status,
          status
        FROM advertisements
        WHERE id = $1
      `,
      [testAdvertisementId]
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0]!.workflow_status).toBe("ARCHIVED");
    expect(result.rows[0]!.status).toBe("ARCHIVED");
  });

  it("should not record workflow history when archived activation is rejected", async () => {
    const result = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM advertisement_workflow_history
        WHERE advertisement_id = $1
      `,
      [testAdvertisementId]
    );

    /*
     * Activation is an operational action, not a workflow transition.
     * A rejected activation attempt must not create ARCHIVED -> DRAFT
     * workflow history.
     */
    expect(Number(result.rows[0]!.count)).toBe(0);
  });

  it("POST /api/v1/advertisements/:id/activate - should reject activation of a rejected advertisement", async () => {
    await pool.query(
      `
        UPDATE advertisements
        SET
          workflow_status = 'REJECTED',
          status = 'DRAFT'
        WHERE id = $1
      `,
      [testAdvertisementId]
    );

    try {
      const response = await request(app)
        .post(`/api/v1/advertisements/${testAdvertisementId}/activate`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          remarks: "Invalid activation attempt."
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(
        "Only approved advertisements can be activated."
      );

      const result = await pool.query<{
        workflow_status: string;
        status: string;
      }>(
        `
          SELECT
            workflow_status,
            status
          FROM advertisements
          WHERE id = $1
        `,
        [testAdvertisementId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0]!.workflow_status).toBe("REJECTED");
      expect(result.rows[0]!.status).toBe("DRAFT");
    } finally {
      /*
       * Restore the fixture so later tests do not inherit the REJECTED
       * workflow state.
       */
      await pool.query(
        `
          UPDATE advertisements
          SET
            workflow_status = 'DRAFT',
            status = 'DRAFT',
            rejected_at = NULL,
            rejected_by = NULL,
            rejection_reason = NULL
        WHERE id = $1
        `,
        [testAdvertisementId]
      );
    }
  });

  it("should record a partial payment and calculate the pending amount", async () => {
    const paymentResult = await pool.query<{ id: number }>(
      `
        INSERT INTO advertisement_payments
        (
          advertisement_id,
          amount,
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
          'BANK_TRANSFER',
          'RECEIVED',
          $3,
          'Partial payment integration test',
          $4
        )
        RETURNING id
      `,
      [testAdvertisementId, 4000, `TXN-PARTIAL-${timestamp}`, testUserId]
    );

    expect(paymentResult.rows.length).toBe(1);

    const result = await pool.query<{
      agreed_amount: string | null;
      paid_amount: string;
      pending_amount: string;
    }>(
      `
        SELECT
          a.advertisement_amount AS agreed_amount,
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(p.payment_status) IN ('received', 'verified')
                THEN p.amount
                ELSE 0
              END
            ),
            0
          ) AS paid_amount,
          GREATEST(
            COALESCE(a.advertisement_amount, 0) -
            COALESCE(
              SUM(
                CASE
                  WHEN LOWER(p.payment_status) IN ('received', 'verified')
                  THEN p.amount
                  ELSE 0
                END
              ),
              0
            ),
            0
          ) AS pending_amount
        FROM advertisements a
        LEFT JOIN advertisement_payments p
          ON p.advertisement_id = a.id
        WHERE a.id = $1
        GROUP BY a.id, a.advertisement_amount
      `,
      [testAdvertisementId]
    );

    expect(result.rows.length).toBe(1);
    expect(Number(result.rows[0]!.agreed_amount)).toBe(advertisementAmount);
    expect(Number(result.rows[0]!.paid_amount)).toBe(4000);
    expect(Number(result.rows[0]!.pending_amount)).toBe(6000);

    await pool.query(
      `
        DELETE FROM advertisement_payments
        WHERE advertisement_id = $1
      `,
      [testAdvertisementId]
    );
  });

  it("should not count a PENDING payment as received payment", async () => {
    await pool.query(
      `
        INSERT INTO advertisement_payments
        (
          advertisement_id,
          amount,
          payment_method,
          payment_status,
          transaction_reference,
          notes,
          recorded_by
        )
        VALUES
        (
          $1,
          4000,
          'BANK_TRANSFER',
          'PENDING',
          $2,
          'Pending payment integration test',
          $3
        )
      `,
      [testAdvertisementId, `TXN-PENDING-${timestamp}`, testUserId]
    );

    const result = await pool.query<{
      paid_amount: string;
      pending_amount: string;
    }>(
      `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(p.payment_status) IN ('received', 'verified')
                THEN p.amount
                ELSE 0
              END
            ),
            0
          ) AS paid_amount,
          GREATEST(
            COALESCE(a.advertisement_amount, 0) -
            COALESCE(
              SUM(
                CASE
                  WHEN LOWER(p.payment_status) IN ('received', 'verified')
                  THEN p.amount
                  ELSE 0
                END
              ),
              0
            ),
            0
          ) AS pending_amount
        FROM advertisements a
        LEFT JOIN advertisement_payments p
          ON p.advertisement_id = a.id
        WHERE a.id = $1
        GROUP BY a.id, a.advertisement_amount
      `,
      [testAdvertisementId]
    );

    expect(result.rows.length).toBe(1);
    expect(Number(result.rows[0]!.paid_amount)).toBe(0);
    expect(Number(result.rows[0]!.pending_amount)).toBe(advertisementAmount);

    await pool.query(
      `
        DELETE FROM advertisement_payments
        WHERE advertisement_id = $1
      `,
      [testAdvertisementId]
    );
  });

  it("should count VERIFIED payments as paid", async () => {
    await pool.query(
      `
        INSERT INTO advertisement_payments
        (
          advertisement_id,
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
          7000,
          'BANK_TRANSFER',
          'VERIFIED',
          $2,
          'Verified payment integration test',
          $3,
          $3,
          NOW()
        )
      `,
      [testAdvertisementId, `TXN-VERIFIED-${timestamp}`, testUserId]
    );

    const result = await pool.query<{
      paid_amount: string;
      pending_amount: string;
    }>(
      `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(p.payment_status) IN ('received', 'verified')
                THEN p.amount
                ELSE 0
              END
            ),
            0
          ) AS paid_amount,
          GREATEST(
            COALESCE(a.advertisement_amount, 0) -
            COALESCE(
              SUM(
                CASE
                  WHEN LOWER(p.payment_status) IN ('received', 'verified')
                  THEN p.amount
                  ELSE 0
                END
              ),
              0
            ),
            0
          ) AS pending_amount
        FROM advertisements a
        LEFT JOIN advertisement_payments p
          ON p.advertisement_id = a.id
        WHERE a.id = $1
        GROUP BY a.id, a.advertisement_amount
      `,
      [testAdvertisementId]
    );

    expect(result.rows.length).toBe(1);
    expect(Number(result.rows[0]!.paid_amount)).toBe(7000);
    expect(Number(result.rows[0]!.pending_amount)).toBe(3000);

    await pool.query(
      `
        DELETE FROM advertisement_payments
        WHERE advertisement_id = $1
      `,
      [testAdvertisementId]
    );
  });

  it("should exclude CANCELLED and REFUNDED payments from the paid amount", async () => {
    await pool.query(
      `
        INSERT INTO advertisement_payments
        (
          advertisement_id,
          amount,
          payment_method,
          payment_status,
          transaction_reference,
          notes,
          recorded_by
        )
        VALUES
        ($1, 3000, 'BANK_TRANSFER', 'RECEIVED', $2, 'Received payment', $3),
        ($1, 2000, 'BANK_TRANSFER', 'CANCELLED', $4, 'Cancelled payment', $3),
        ($1, 1000, 'BANK_TRANSFER', 'REFUNDED', $5, 'Refunded payment', $3)
      `,
      [
        testAdvertisementId,
        `TXN-RECEIVED-${timestamp}`,
        testUserId,
        `TXN-CANCELLED-${timestamp}`,
        `TXN-REFUNDED-${timestamp}`
      ]
    );

    const result = await pool.query<{
      paid_amount: string;
      pending_amount: string;
    }>(
      `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(p.payment_status) IN ('received', 'verified')
                THEN p.amount
                ELSE 0
              END
            ),
            0
          ) AS paid_amount,
          GREATEST(
            COALESCE(a.advertisement_amount, 0) -
            COALESCE(
              SUM(
                CASE
                  WHEN LOWER(p.payment_status) IN ('received', 'verified')
                  THEN p.amount
                  ELSE 0
                END
              ),
              0
            ),
            0
          ) AS pending_amount
        FROM advertisements a
        LEFT JOIN advertisement_payments p
          ON p.advertisement_id = a.id
        WHERE a.id = $1
        GROUP BY a.id, a.advertisement_amount
      `,
      [testAdvertisementId]
    );

    expect(result.rows.length).toBe(1);
    expect(Number(result.rows[0]!.paid_amount)).toBe(3000);
    expect(Number(result.rows[0]!.pending_amount)).toBe(7000);

    await pool.query(
      `
        DELETE FROM advertisement_payments
        WHERE advertisement_id = $1
      `,
      [testAdvertisementId]
    );
  });

  it("should calculate zero pending amount when the advertisement amount is fully paid", async () => {
    await pool.query(
      `
        INSERT INTO advertisement_payments
        (
          advertisement_id,
          amount,
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
          'BANK_TRANSFER',
          'VERIFIED',
          $3,
          'Full payment integration test',
          $4
        )
      `,
      [
        testAdvertisementId,
        advertisementAmount,
        `TXN-FULL-${timestamp}`,
        testUserId
      ]
    );

    const result = await pool.query<{
      paid_amount: string;
      pending_amount: string;
    }>(
      `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(p.payment_status) IN ('received', 'verified')
                THEN p.amount
                ELSE 0
              END
            ),
            0
          ) AS paid_amount,
          GREATEST(
            COALESCE(a.advertisement_amount, 0) -
            COALESCE(
              SUM(
                CASE
                  WHEN LOWER(p.payment_status) IN ('received', 'verified')
                  THEN p.amount
                  ELSE 0
                END
              ),
              0
            ),
            0
          ) AS pending_amount
        FROM advertisements a
        LEFT JOIN advertisement_payments p
          ON p.advertisement_id = a.id
        WHERE a.id = $1
        GROUP BY a.id, a.advertisement_amount
      `,
      [testAdvertisementId]
    );

    expect(result.rows.length).toBe(1);
    expect(Number(result.rows[0]!.paid_amount)).toBe(advertisementAmount);
    expect(Number(result.rows[0]!.pending_amount)).toBe(0);

    await pool.query(
      `
        DELETE FROM advertisement_payments
        WHERE advertisement_id = $1
      `,
      [testAdvertisementId]
    );
  });

  it("should reject a zero payment amount at the database constraint level", async () => {
    await expect(
      pool.query(
        `
          INSERT INTO advertisement_payments
          (
            advertisement_id,
            amount,
            payment_method,
            payment_status,
            transaction_reference,
            recorded_by
          )
          VALUES
          (
            $1,
            0,
            'BANK_TRANSFER',
            'RECEIVED',
            $2,
            $3
          )
        `,
        [testAdvertisementId, `TXN-ZERO-${timestamp}`, testUserId]
      )
    ).rejects.toThrow();
  });

  it("should reject a negative payment amount at the database constraint level", async () => {
    await expect(
      pool.query(
        `
          INSERT INTO advertisement_payments
          (
            advertisement_id,
            amount,
            payment_method,
            payment_status,
            transaction_reference,
            recorded_by
          )
          VALUES
          (
            $1,
            -1,
            'BANK_TRANSFER',
            'RECEIVED',
            $2,
            $3
          )
        `,
        [testAdvertisementId, `TXN-NEGATIVE-${timestamp}`, testUserId]
      )
    ).rejects.toThrow();
  });

  it("should accept the defined advertisement workflow states", async () => {
    const workflowStates = [
      "DRAFT",
      "SUBMITTED",
      "APPROVED",
      "REJECTED",
      "ON_HOLD",
      "ARCHIVED"
    ];

    for (const workflowStatus of workflowStates) {
      await pool.query(
        `
          UPDATE advertisements
          SET
            workflow_status = $1
          WHERE id = $2
        `,
        [workflowStatus, testAdvertisementId]
      );

      const result = await pool.query<{
        workflow_status: string;
      }>(
        `
          SELECT workflow_status
          FROM advertisements
          WHERE id = $1
        `,
        [testAdvertisementId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0]!.workflow_status).toBe(workflowStatus);
    }

    await pool.query(
      `
        UPDATE advertisements
        SET
          workflow_status = 'DRAFT',
          status = 'DRAFT',
          submitted_at = NULL,
          submitted_by = NULL,
          approved_at = NULL,
          approved_by = NULL,
          rejected_at = NULL,
          rejected_by = NULL,
          rejection_reason = NULL,
          on_hold_at = NULL,
          on_hold_by = NULL,
          on_hold_reason = NULL
        WHERE id = $1
      `,
      [testAdvertisementId]
    );
  });

  it("should remove CREATE permission from the test role", async () => {
    await pool.query(
      `
        DELETE FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, createPermissionId]
    );

    const result = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, createPermissionId]
    );

    expect(Number(result.rows[0]!.count)).toBe(0);
  });

  it("POST /api/v1/advertisements - should deny access without CREATE permission", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: testClientId,
        name: `Permission Denied Advertisement ${timestamp}`,
        advertisementType: "DISPLAY",
        currencyCode: "INR",
        advertisementAmount,
        priority: 10,
        pricing: {
          placementId: testPlacementId,
          pricingUnit: "DAY",
          quantity: 1
        }
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("should remove UPDATE permission from the test role", async () => {
    await pool.query(
      `
        DELETE FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, updatePermissionId]
    );

    const result = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, updatePermissionId]
    );

    expect(Number(result.rows[0]!.count)).toBe(0);
  });

  it("PATCH /api/v1/advertisements/:id - should deny access without UPDATE permission", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/${testAdvertisementId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: `Permission Denied Update ${timestamp}`
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("should remove READ permission from the test role", async () => {
    await pool.query(
      `
        DELETE FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, readPermissionId]
    );

    const result = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM role_permissions
        WHERE role_id = $1
          AND permission_id = $2
      `,
      [testRoleId, readPermissionId]
    );

    expect(Number(result.rows[0]!.count)).toBe(0);
  });

  it("GET /api/v1/advertisements/:id - should deny access without READ permission", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/${testAdvertisementId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements - should deny list access without READ permission", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements?page=1&pageSize=20")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements - should reject requests without authentication", async () => {
    const response = await request(app).get(
      "/api/v1/advertisements?page=1&pageSize=20"
    );

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
