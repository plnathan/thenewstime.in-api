import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Workflow API Integration", () => {
  let accessToken = "";

  let testUserId = 0;
  let superAdminRoleId = 0;
  let testRoleId = 0;
  let testClientId = 0;

  let workflowAdvertisementId = 0;
  let rejectionAdvertisementId = 0;

  const permissionIds: Record<string, number> = {};

  const timestamp = Date.now();

  const testUsername = `advertisement_workflow_test_user_${timestamp}`;
  const testEmail = `advertisement-workflow-test-${timestamp}@example.com`;
  const testRoleCode = `TEST_AD_WORKFLOW_ROLE_${timestamp}`;
  const testRoleDisplayName = `Advertisement Workflow Integration Test Role ${timestamp}`;
  const testClientCode = `TEST-AD-WORKFLOW-${timestamp}`;

  const password = "Advertisement_Workflow_Test@123";

  const workflowPermissionActions = [
    "read",
    "create",
    "submit",
    "approve",
    "reject",
    "hold",
    "resume",
    "archive"
  ] as const;

  beforeAll(async () => {
    /*
     * ==========================================================================
     * FIND SUPER_ADMIN ROLE
     * ==========================================================================
     */

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

    /*
     * ==========================================================================
     * CREATE TEMPORARY TEST USER
     * ==========================================================================
     */

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
        "Advertisement Workflow Integration Test User",
        "Advertisement Workflow Test User",
        superAdminRoleId
      ]
    );

    testUserId = Number(userResult.rows[0].id);

    expect(testUserId).toBeGreaterThan(0);

    /*
     * ==========================================================================
     * CREATE TEMPORARY TEST ROLE
     * ==========================================================================
     */

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
        testRoleDisplayName,
        "Temporary role for Advertisement Workflow API integration tests.",
        testUserId
      ]
    );

    testRoleId = Number(roleResult.rows[0].id);

    expect(testRoleId).toBeGreaterThan(0);

    /*
     * ==========================================================================
     * MOVE TEST USER FROM SUPER_ADMIN TO TEMPORARY ROLE
     * ==========================================================================
     */

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
      WHERE
        user_id = $1
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
      ON CONFLICT
      (
        user_id,
        role_id
      )
      DO NOTHING
      `,
      [testUserId, testRoleId]
    );

    /*
     * ==========================================================================
     * FIND WORKFLOW PERMISSIONS
     * ==========================================================================
     *
     * Phase 2A introduces:
     *
     * advertisements.submit
     * advertisements.approve
     * advertisements.reject
     * advertisements.hold
     * advertisements.resume
     * advertisements.archive
     *
     * Permission creation belongs to the application's permission
     * management / seed layer, so the test only looks up existing
     * permissions and assigns them to the temporary role.
     */

    const permissionsResult = await pool.query(
      `
      SELECT
        id,
        action
      FROM permissions
      WHERE
        LOWER(module) = LOWER('ADVERTISEMENT')
        AND LOWER(resource) = LOWER('advertisements')
        AND LOWER(action) = ANY($1::text[])
        AND status = 'ACTIVE'
      ORDER BY id ASC
      `,
      [workflowPermissionActions.map((action) => action.toLowerCase())]
    );

    for (const action of workflowPermissionActions) {
      const permission = permissionsResult.rows.find(
        (row) => String(row.action).toLowerCase() === action
      );

      expect(
        permission,
        `Active ADVERTISEMENT/advertisements/${action} permission must exist.`
      ).toBeDefined();

      permissionIds[action] = Number(permission.id);

      expect(permissionIds[action]).toBeGreaterThan(0);

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
        ON CONFLICT
        (
          role_id,
          permission_id
        )
        DO NOTHING
        `,
        [testRoleId, permissionIds[action], testUserId]
      );
    }

    /*
     * ==========================================================================
     * CREATE TEMPORARY ADVERTISEMENT CLIENT
     * ==========================================================================
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
        `Advertisement Workflow Test Client ${timestamp}`,
        `Ad Workflow Test Client ${timestamp}`,
        testUserId
      ]
    );

    testClientId = Number(clientResult.rows[0].id);

    expect(testClientId).toBeGreaterThan(0);

    /*
     * ==========================================================================
     * LOGIN THROUGH REAL AUTHENTICATION API
     * ==========================================================================
     */

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username: testUsername,
      password
    });

    expect(loginResponse.status).toBe(200);

    accessToken = loginResponse.body.data.tokens.accessToken;

    expect(accessToken).toBeTruthy();
  });

  afterAll(async () => {
    /*
     * ==========================================================================
     * DELETE TEST ADVERTISEMENTS
     * ==========================================================================
     *
     * Workflow history is deleted explicitly before deleting advertisements.
     */

    const advertisementIds = [
      workflowAdvertisementId,
      rejectionAdvertisementId
    ].filter((id, index, array) => id > 0 && array.indexOf(id) === index);

    for (const advertisementId of advertisementIds) {
      await pool.query(
        `
        DELETE FROM advertisement_workflow_history
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
     * ==========================================================================
     * DELETE TEST CLIENT
     * ==========================================================================
     */

    if (testClientId > 0) {
      await pool.query(
        `
        DELETE FROM advertisement_clients
        WHERE id = $1
        `,
        [testClientId]
      );
    }

    /*
     * ==========================================================================
     * DELETE ROLE PERMISSIONS
     * ==========================================================================
     */

    if (testRoleId > 0) {
      await pool.query(
        `
        DELETE FROM role_permissions
        WHERE role_id = $1
        `,
        [testRoleId]
      );
    }

    /*
     * ==========================================================================
     * DELETE USER SESSIONS
     * ==========================================================================
     */

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

    /*
     * ==========================================================================
     * DELETE TEMPORARY ROLE
     * ==========================================================================
     */

    if (testRoleId > 0) {
      await pool.query(
        `
        DELETE FROM roles
        WHERE id = $1
        `,
        [testRoleId]
      );
    }

    /*
     * ==========================================================================
     * DELETE TEMPORARY USER
     * ==========================================================================
     */

    if (testUserId > 0) {
      await pool.query(
        `
        DELETE FROM users
        WHERE id = $1
        `,
        [testUserId]
      );
    }

    /*
     * Do not call pool.end().
     */
  });

  /*
   * ============================================================================
   * AUTHENTICATION
   * ============================================================================
   */

  it("should have a valid authentication token", () => {
    expect(accessToken).toBeTruthy();
  });

  /*
   * ============================================================================
   * CREATE MAIN WORKFLOW ADVERTISEMENT
   * ============================================================================
   */

  it("POST /api/v1/advertisements - should create a draft advertisement", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: testClientId,
        isHouseAd: false,
        name: `Workflow Integration Advertisement ${timestamp}`,
        internalName: `workflow-integration-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/workflow-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes: "Advertisement Workflow API integration test.",
        advertisementAmount: 15000,
        discountPercentage: 0,
        advancePercentage: 0,
        currencyCode: "INR"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();

    workflowAdvertisementId = Number(response.body.data.id);

    expect(workflowAdvertisementId).toBeGreaterThan(0);
    expect(response.body.data.workflowStatus).toBe("DRAFT");
    expect(response.body.data.status).toBe("DRAFT");
    expect(response.body.data.isHouseAd).toBe(false);
    expect(Number(response.body.data.advertisementAmount)).toBe(15000);
  });

  /*
   * ============================================================================
   * INVALID APPROVAL FROM DRAFT
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/approve - should reject approval from DRAFT", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  /*
   * ============================================================================
   * INVALID REJECTION FROM DRAFT
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/reject - should reject rejection from DRAFT", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/reject`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        reason: "Invalid rejection attempt during integration testing.",
        remarks: "The advertisement is still in DRAFT."
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  /*
   * ============================================================================
   * SUBMIT
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/submit - should transition DRAFT to SUBMITTED", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        remarks: "Submitted for Advertisement Manager review."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(workflowAdvertisementId);
    expect(response.body.data.workflowStatus).toBe("SUBMITTED");
    expect(response.body.data.submittedBy).toBe(testUserId);
    expect(response.body.data.submittedAt).toBeTruthy();
  });

  /*
   * ============================================================================
   * INVALID HOLD FROM SUBMITTED
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/hold - should reject hold from SUBMITTED", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/hold`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        reason: "Invalid hold attempt."
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  /*
   * ============================================================================
   * INVALID ARCHIVE FROM SUBMITTED
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/archive - should reject archive from SUBMITTED", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/archive`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  /*
   * ============================================================================
   * APPROVE
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/approve - should transition SUBMITTED to APPROVED", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        remarks: "Advertisement approved by the manager."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(workflowAdvertisementId);
    expect(response.body.data.workflowStatus).toBe("APPROVED");
    expect(response.body.data.approvedBy).toBe(testUserId);
    expect(response.body.data.approvedAt).toBeTruthy();

    /*
     * Approval must not automatically change operational advertisement status.
     */
    expect(response.body.data.status).toBe("DRAFT");
  });

  /*
   * ============================================================================
   * INVALID SECOND APPROVAL
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/approve - should reject approval when already APPROVED", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  /*
   * ============================================================================
   * INVALID RESUME FROM APPROVED
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/resume - should reject resume when advertisement is APPROVED", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/resume`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  /*
   * ============================================================================
   * HOLD
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/hold - should transition APPROVED to ON_HOLD", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/hold`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        reason: "Payment reconciliation pending.",
        remarks: "Advertisement temporarily placed on hold."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(workflowAdvertisementId);
    expect(response.body.data.workflowStatus).toBe("ON_HOLD");
    expect(response.body.data.onHoldBy).toBe(testUserId);
    expect(response.body.data.onHoldAt).toBeTruthy();
    expect(response.body.data.onHoldReason).toBe(
      "Payment reconciliation pending."
    );
  });

  /*
   * ============================================================================
   * INVALID HOLD FROM ON_HOLD
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/hold - should reject a second hold while already ON_HOLD", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/hold`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        reason: "Second invalid hold."
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  /*
   * ============================================================================
   * RESUME
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/resume - should transition ON_HOLD to APPROVED", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/resume`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        remarks: "Payment reconciliation completed; advertisement resumed."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(workflowAdvertisementId);
    expect(response.body.data.workflowStatus).toBe("APPROVED");

    /*
     * Hold audit information should remain available after resume.
     */
    expect(response.body.data.onHoldReason).toBe(
      "Payment reconciliation pending."
    );
  });

  /*
   * ============================================================================
   * ARCHIVE
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/archive - should transition APPROVED to ARCHIVED", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/archive`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        remarks: "Advertisement archived after workflow completion."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(workflowAdvertisementId);
    expect(response.body.data.workflowStatus).toBe("ARCHIVED");
    expect(response.body.data.status).toBe("ARCHIVED");
  });

  /*
   * ============================================================================
   * INVALID SUBMIT FROM ARCHIVED
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/submit - should reject submission of an ARCHIVED advertisement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        remarks: "Invalid submission after archive."
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  /*
   * ============================================================================
   * INVALID RESUME FROM ARCHIVED
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/resume - should reject resume of an ARCHIVED advertisement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/resume`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  /*
   * ============================================================================
   * WORKFLOW HISTORY
   * ============================================================================
   */

  it("GET /api/v1/advertisements/:id/workflow-history - should return complete workflow history", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/${workflowAdvertisementId}/workflow-history`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const history = response.body.data;

    /*
     * Main workflow is returned in chronological order by the API:
     *
     * DRAFT -> SUBMITTED
     * SUBMITTED -> APPROVED
     * APPROVED -> ON_HOLD
     * ON_HOLD -> APPROVED
     * APPROVED -> ARCHIVED
     */

    expect(history.length).toBe(5);

    expect(history[0].fromStatus).toBe("DRAFT");
    expect(history[0].toStatus).toBe("SUBMITTED");

    expect(history[1].fromStatus).toBe("SUBMITTED");
    expect(history[1].toStatus).toBe("APPROVED");

    expect(history[2].fromStatus).toBe("APPROVED");
    expect(history[2].toStatus).toBe("ON_HOLD");

    expect(history[3].fromStatus).toBe("ON_HOLD");
    expect(history[3].toStatus).toBe("APPROVED");

    expect(history[4].fromStatus).toBe("APPROVED");
    expect(history[4].toStatus).toBe("ARCHIVED");

    for (const item of history) {
      expect(Number(item.advertisementId)).toBe(workflowAdvertisementId);
      expect(Number(item.performedBy)).toBe(testUserId);
      expect(item.performedAt).toBeTruthy();
    }
  });

  /*
   * ============================================================================
   * CREATE REJECTION WORKFLOW ADVERTISEMENT
   * ============================================================================
   */

  it("POST /api/v1/advertisements - should create a second advertisement for rejection workflow testing", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: testClientId,
        isHouseAd: false,
        name: `Rejected Workflow Advertisement ${timestamp}`,
        internalName: `rejected-workflow-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/rejected-workflow-test",
        priority: 5,
        isClickable: true,
        openInNewTab: true,
        notes: "Advertisement rejection workflow integration test.",
        advertisementAmount: 12000,
        discountPercentage: 0,
        advancePercentage: 0,
        currencyCode: "INR"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    rejectionAdvertisementId = Number(response.body.data.id);

    expect(rejectionAdvertisementId).toBeGreaterThan(0);
    expect(response.body.data.workflowStatus).toBe("DRAFT");
    expect(response.body.data.status).toBe("DRAFT");
    expect(response.body.data.isHouseAd).toBe(false);
    expect(Number(response.body.data.advertisementAmount)).toBe(12000);
  });

  /*
   * ============================================================================
   * REJECT REQUIRES REASON
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/reject - should require a rejection reason", async () => {
    const submitResponse = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        remarks: "Submit second advertisement for rejection testing."
      });

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.data.workflowStatus).toBe("SUBMITTED");

    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/reject`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        remarks: "Missing required reason."
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  /*
   * ============================================================================
   * REJECT
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/reject - should transition SUBMITTED to REJECTED", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/reject`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        reason:
          "Creative does not meet the agreed advertisement specifications.",
        remarks: "Returned to advertiser for correction."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(rejectionAdvertisementId);
    expect(response.body.data.workflowStatus).toBe("REJECTED");
    expect(response.body.data.rejectedBy).toBe(testUserId);
    expect(response.body.data.rejectedAt).toBeTruthy();
    expect(response.body.data.rejectionReason).toBe(
      "Creative does not meet the agreed advertisement specifications."
    );
  });

  /*
   * ============================================================================
   * RESUBMIT REJECTED ADVERTISEMENT
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/submit - should allow REJECTED advertisement to be resubmitted", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        remarks: "Advertiser corrected the rejected advertisement."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(rejectionAdvertisementId);
    expect(response.body.data.workflowStatus).toBe("SUBMITTED");

    /*
     * A new review cycle should clear the previous rejection state.
     */
    expect(response.body.data.rejectionReason).toBeNull();
    expect(response.body.data.rejectedBy).toBeNull();
    expect(response.body.data.rejectedAt).toBeNull();

    expect(response.body.data.submittedBy).toBe(testUserId);
    expect(response.body.data.submittedAt).toBeTruthy();
  });

  /*
   * ============================================================================
   * APPROVE RESUBMITTED ADVERTISEMENT
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/approve - should approve a resubmitted REJECTED advertisement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        remarks: "Corrected advertisement approved."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.workflowStatus).toBe("APPROVED");
    expect(response.body.data.approvedBy).toBe(testUserId);
    expect(response.body.data.approvedAt).toBeTruthy();
  });

  /*
   * ============================================================================
   * REJECTION WORKFLOW HISTORY
   * ============================================================================
   */

  it("GET /api/v1/advertisements/:id/workflow-history - should record rejection and resubmission history", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/${rejectionAdvertisementId}/workflow-history`
      )
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);

    const history = response.body.data;

    /*
     * API returns workflow history in chronological order:
     *
     * DRAFT -> SUBMITTED
     * SUBMITTED -> REJECTED
     * REJECTED -> SUBMITTED
     * SUBMITTED -> APPROVED
     */

    expect(history.length).toBe(4);

    expect(history[0].fromStatus).toBe("DRAFT");
    expect(history[0].toStatus).toBe("SUBMITTED");

    expect(history[1].fromStatus).toBe("SUBMITTED");
    expect(history[1].toStatus).toBe("REJECTED");

    expect(history[2].fromStatus).toBe("REJECTED");
    expect(history[2].toStatus).toBe("SUBMITTED");

    expect(history[3].fromStatus).toBe("SUBMITTED");
    expect(history[3].toStatus).toBe("APPROVED");

    expect(history[1].remarks).toBe("Returned to advertiser for correction.");

    for (const item of history) {
      expect(Number(item.advertisementId)).toBe(rejectionAdvertisementId);
      expect(Number(item.performedBy)).toBe(testUserId);
      expect(item.performedAt).toBeTruthy();
    }
  });

  /*
   * ============================================================================
   * NON-EXISTENT ADVERTISEMENT
   * ============================================================================
   */

  it("POST /api/v1/advertisements/:id/submit - should return 404 for a non-existent advertisement", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/999999999/submit")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        remarks: "Non-existent advertisement test."
      });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/:id/workflow-history - should return 404 for a non-existent advertisement", async () => {
    const response = await request(app)
      .get("/api/v1/advertisements/999999999/workflow-history")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  /*
   * ============================================================================
   * AUTHENTICATION DENIAL
   * ============================================================================
   */

  it("GET /api/v1/advertisements/:id/workflow-history - should reject unauthenticated requests", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/${rejectionAdvertisementId}/workflow-history`
    );

    expect(response.status).toBe(401);
  });

  it("POST /api/v1/advertisements/:id/submit - should reject unauthenticated requests", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/submit`)
      .send({
        remarks: "Unauthenticated workflow request."
      });

    expect(response.status).toBe(401);
  });

  /*
   * ============================================================================
   * AUTHORIZATION TEST
   * ============================================================================
   *
   * Use the currently APPROVED second advertisement because the test role can
   * safely have its APPROVE permission removed without disturbing the remaining
   * workflow tests.
   */

  it("should remove APPROVE permission from the temporary role", async () => {
    const result = await pool.query(
      `
      DELETE FROM role_permissions
      WHERE
        role_id = $1
        AND permission_id = $2
      `,
      [testRoleId, permissionIds.approve]
    );

    expect(result.rowCount).toBe(1);
  });

  it("POST /api/v1/advertisements/:id/approve - should deny access without APPROVE permission", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/approve`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(response.status).toBe(403);
  });

  /*
   * ============================================================================
   * RESTORE APPROVE PERMISSION
   * ============================================================================
   */

  it("should restore APPROVE permission after authorization test", async () => {
    const result = await pool.query(
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
      ON CONFLICT
      (
        role_id,
        permission_id
      )
      DO NOTHING
      `,
      [testRoleId, permissionIds.approve, testUserId]
    );

    expect(result.rowCount).toBe(1);
  });

  /*
   * ============================================================================
   * DATABASE-LEVEL HISTORY VERIFICATION
   * ============================================================================
   */

  it("should persist workflow history with the expected database fields", async () => {
    const result = await pool.query(
      `
      SELECT
        id,
        advertisement_id,
        from_status,
        to_status,
        remarks,
        performed_by,
        performed_at
      FROM advertisement_workflow_history
      WHERE advertisement_id = $1
      ORDER BY
        performed_at DESC,
        id DESC
      `,
      [workflowAdvertisementId]
    );

    expect(result.rows.length).toBe(5);

    for (const row of result.rows) {
      expect(Number(row.id)).toBeGreaterThan(0);
      expect(Number(row.advertisement_id)).toBe(workflowAdvertisementId);
      expect(row.to_status).toBeTruthy();
      expect(Number(row.performed_by)).toBe(testUserId);
      expect(row.performed_at).toBeTruthy();
    }
  });

  /*
   * ============================================================================
   * INVALID TRANSITION MUST NOT CREATE HISTORY
   * ============================================================================
   */

  it("should not create workflow history for an invalid transition", async () => {
    const beforeResult = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM advertisement_workflow_history
      WHERE advertisement_id = $1
      `,
      [workflowAdvertisementId]
    );

    const beforeCount = Number(beforeResult.rows[0].count);

    expect(beforeCount).toBe(5);

    const response = await request(app)
      .post(`/api/v1/advertisements/${workflowAdvertisementId}/submit`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        remarks: "This transition must not be recorded."
      });

    expect(response.status).toBe(409);

    const afterResult = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM advertisement_workflow_history
      WHERE advertisement_id = $1
      `,
      [workflowAdvertisementId]
    );

    const afterCount = Number(afterResult.rows[0].count);

    expect(afterCount).toBe(beforeCount);
  });
});
