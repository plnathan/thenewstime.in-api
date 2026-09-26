import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Workflow API Integration", () => {
  let creatorAccessToken = "";
  let managerAccessToken = "";

  let creatorUserId = 0;
  let managerUserId = 0;
  let superAdminRoleId = 0;
  let creatorRoleId = 0;
  let managerRoleId = 0;

  let testClientId = 0;
  let advertisementId = 0;
  let rejectionAdvertisementId = 0;

  const timestamp = Date.now();

  const creatorUsername = `fa_ad_creator_${timestamp}`;
  const creatorEmail = `fa-ad-creator-${timestamp}@example.com`;
  const managerUsername = `fa_ad_manager_${timestamp}`;
  const managerEmail = `fa-ad-manager-${timestamp}@example.com`;

  const creatorRoleCode = `TEST_FA_AD_CREATOR_${timestamp}`;
  const managerRoleCode = `TEST_FA_AD_MANAGER_${timestamp}`;
  const testClientCode = `TEST-FA-AD-${timestamp}`;

  const creatorPassword = "FA_Ad_Creator@123";
  const managerPassword = "FA_Ad_Manager@123";

  const creatorPermissionCodes = {
    read: "advertisements.read",
    create: "advertisements.create",
    update: "advertisements.update",
    submit: "advertisements.submit"
  } as const;

  const managerPermissionCodes = {
    read: "advertisements.read",
    update: "advertisements.update",
    approve: "advertisements.approve",
    reject: "advertisements.reject"
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

  const managerPermissionIds: Record<
    keyof typeof managerPermissionCodes,
    number
  > = {
    read: 0,
    update: 0,
    approve: 0,
    reject: 0
  };

  const resolveAndAttachPermissions = async (
    roleId: number,
    permissionCodes: Record<string, string>,
    permissionIds: Record<string, number>,
    actorId: number
  ): Promise<void> => {
    for (const [key, code] of Object.entries(permissionCodes)) {
      const result = await pool.query(
        `
        SELECT id, code, status, module, resource, action
        FROM permissions
        WHERE code = $1
        LIMIT 1
        `,
        [code]
      );

      expect(
        result.rows.length,
        `Required production permission '${code}' was not found.`
      ).toBe(1);

      const permission = result.rows[0];

      expect(permission?.status).toBe("ACTIVE");
      expect(permission?.module).toBe("ADVERTISEMENT");
      expect(permission?.resource).toBe("advertisements");
      expect(permission?.action).toBe(key);

      const permissionId = Number(permission?.id ?? 0);
      expect(permissionId).toBeGreaterThan(0);

      permissionIds[key] = permissionId;

      await pool.query(
        `
        INSERT INTO role_permissions (role_id, permission_id, created_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (role_id, permission_id) DO NOTHING
        `,
        [roleId, permissionId, actorId]
      );
    }
  };

  const ensureRolesAndPermissions = async (): Promise<void> => {
    await pool.query(
      `UPDATE roles SET status = 'ACTIVE' WHERE id IN ($1, $2)`,
      [creatorRoleId, managerRoleId]
    );

    await pool.query(
      `UPDATE users SET role_id = $2, status = 'ACTIVE' WHERE id = $1`,
      [creatorUserId, creatorRoleId]
    );

    await pool.query(
      `UPDATE users SET role_id = $2, status = 'ACTIVE' WHERE id = $1`,
      [managerUserId, managerRoleId]
    );

    for (const [roleId, userId, permissionIds] of [
      [creatorRoleId, creatorUserId, Object.values(creatorPermissionIds)],
      [managerRoleId, managerUserId, Object.values(managerPermissionIds)]
    ] as Array<[number, number, number[]]>) {
      for (const permissionId of permissionIds) {
        await pool.query(
          `
          INSERT INTO role_permissions (role_id, permission_id, created_by)
          VALUES ($1, $2, $3)
          ON CONFLICT (role_id, permission_id) DO NOTHING
          `,
          [roleId, permissionId, userId]
        );
      }
    }
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
    const managerPasswordHash = await bcrypt.hash(managerPassword, 12);

    const creatorUserResult = await pool.query(
      `
      INSERT INTO users
      (username, email, password_hash, full_name, display_name, status, role_id)
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)
      RETURNING id
      `,
      [
        creatorUsername,
        creatorEmail,
        creatorPasswordHash,
        "Financial Approval Advertisement Creator",
        "FA Advertisement Creator",
        superAdminRoleId
      ]
    );

    creatorUserId = Number(creatorUserResult.rows[0]?.id ?? 0);
    expect(creatorUserId).toBeGreaterThan(0);

    const managerUserResult = await pool.query(
      `
      INSERT INTO users
      (username, email, password_hash, full_name, display_name, status, role_id)
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6)
      RETURNING id
      `,
      [
        managerUsername,
        managerEmail,
        managerPasswordHash,
        "Financial Approval Advertisement Manager",
        "FA Advertisement Manager",
        superAdminRoleId
      ]
    );

    managerUserId = Number(managerUserResult.rows[0]?.id ?? 0);
    expect(managerUserId).toBeGreaterThan(0);

    const creatorRoleResult = await pool.query(
      `
      INSERT INTO roles
      (code, display_name, description, display_order, status, created_by, updated_by)
      VALUES ($1, $2, $3, 999, 'ACTIVE', $4, $4)
      RETURNING id
      `,
      [
        creatorRoleCode,
        `FA Advertisement Creator ${timestamp}`,
        "Temporary Ad Creator role for advertisement workflow integration tests.",
        creatorUserId
      ]
    );

    creatorRoleId = Number(creatorRoleResult.rows[0]?.id ?? 0);
    expect(creatorRoleId).toBeGreaterThan(0);

    const managerRoleResult = await pool.query(
      `
      INSERT INTO roles
      (code, display_name, description, display_order, status, created_by, updated_by)
      VALUES ($1, $2, $3, 999, 'ACTIVE', $4, $4)
      RETURNING id
      `,
      [
        managerRoleCode,
        `FA Advertisement Manager ${timestamp}`,
        "Temporary Ad Manager role for advertisement workflow integration tests.",
        managerUserId
      ]
    );

    managerRoleId = Number(managerRoleResult.rows[0]?.id ?? 0);
    expect(managerRoleId).toBeGreaterThan(0);

    await pool.query(`UPDATE users SET role_id = $2 WHERE id = $1`, [
      creatorUserId,
      creatorRoleId
    ]);

    await pool.query(`UPDATE users SET role_id = $2 WHERE id = $1`, [
      managerUserId,
      managerRoleId
    ]);

    await pool.query(`DELETE FROM user_roles WHERE user_id IN ($1, $2)`, [
      creatorUserId,
      managerUserId
    ]);

    await pool.query(
      `
      INSERT INTO user_roles (user_id, role_id, created_by)
      VALUES ($1, $2, $1), ($3, $4, $3)
      ON CONFLICT (user_id, role_id) DO NOTHING
      `,
      [creatorUserId, creatorRoleId, managerUserId, managerRoleId]
    );

    await resolveAndAttachPermissions(
      creatorRoleId,
      creatorPermissionCodes,
      creatorPermissionIds,
      creatorUserId
    );

    await resolveAndAttachPermissions(
      managerRoleId,
      managerPermissionCodes,
      managerPermissionIds,
      managerUserId
    );

    const clientResult = await pool.query(
      `
      INSERT INTO advertisement_clients
      (client_code, name, display_name, status, ad_creation_hold, created_by, updated_by)
      VALUES ($1, $2, $3, 'ACTIVE', FALSE, $4, $4)
      RETURNING id
      `,
      [
        testClientCode,
        `Financial Approval Advertisement Workflow Client ${timestamp}`,
        `FA Advertisement Workflow Client ${timestamp}`,
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

    const managerLoginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: managerUsername,
        password: managerPassword
      });

    expect(managerLoginResponse.status).toBe(200);
    managerAccessToken = managerLoginResponse.body.data.tokens.accessToken;
    expect(managerAccessToken).toBeTruthy();
  });

  beforeEach(async () => {
    await ensureRolesAndPermissions();
  });

  afterAll(async () => {
    const advertisementIds = [advertisementId, rejectionAdvertisementId].filter(
      (id, index, values) => id > 0 && values.indexOf(id) === index
    );

    for (const id of advertisementIds) {
      try {
        await pool.query(
          `DELETE FROM advertisement_workflow_history WHERE advertisement_id = $1`,
          [id]
        );
      } catch {
        // Cleanup must not mask test results.
      }

      try {
        await pool.query(`DELETE FROM advertisements WHERE id = $1`, [id]);
      } catch {
        // Cleanup must not mask test results.
      }
    }

    if (testClientId > 0) {
      try {
        await pool.query(`DELETE FROM advertisement_clients WHERE id = $1`, [
          testClientId
        ]);
      } catch {
        // Cleanup must not mask test results.
      }
    }

    for (const userId of [creatorUserId, managerUserId]) {
      if (userId > 0) {
        try {
          await pool.query(`DELETE FROM user_sessions WHERE user_id = $1`, [
            userId
          ]);
        } catch {
          // Cleanup must not mask test results.
        }

        try {
          await pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [
            userId
          ]);
        } catch {
          // Cleanup must not mask test results.
        }
      }
    }

    for (const roleId of [creatorRoleId, managerRoleId]) {
      if (roleId > 0) {
        try {
          await pool.query(`DELETE FROM role_permissions WHERE role_id = $1`, [
            roleId
          ]);
        } catch {
          // Cleanup must not mask test results.
        }

        try {
          await pool.query(`DELETE FROM roles WHERE id = $1`, [roleId]);
        } catch {
          // Cleanup must not mask test results.
        }
      }
    }

    for (const userId of [creatorUserId, managerUserId]) {
      if (userId > 0) {
        try {
          await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
        } catch {
          // Cleanup must not mask test results.
        }
      }
    }
  });

  it("should authenticate the Ad Creator and Ad Manager", () => {
    expect(creatorAccessToken).toBeTruthy();
    expect(managerAccessToken).toBeTruthy();
  });

  it("POST /api/v1/advertisements - should allow Ad Creator to create a DRAFT advertisement", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId: testClientId,
        name: `Advertisement Workflow Main ${timestamp}`,
        internalName: `fa-ad-workflow-main-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/fa-ad-workflow-main",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes: "Advertisement workflow integration test.",
        agreedAmount: 50000,
        currencyCode: "INR"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    advertisementId = Number(response.body.data.id);

    expect(advertisementId).toBeGreaterThan(0);
    expect(response.body.data.workflowStatus).toBe("DRAFT");
    expect(response.body.data.status).toBe("DRAFT");
  });

  it("PATCH /api/v1/advertisements/:id - should allow Ad Creator to edit a DRAFT advertisement", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/${advertisementId}`)
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        name: `Advertisement Workflow Main Updated ${timestamp}`,
        notes: "Updated while the advertisement remains in DRAFT."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.workflowStatus).toBe("DRAFT");
    expect(response.body.data.name).toBe(
      `Advertisement Workflow Main Updated ${timestamp}`
    );
  });

  it("POST /api/v1/advertisements/:id/submit - should allow Ad Creator to submit DRAFT for Ad Manager review", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${advertisementId}/submit`)
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        remarks: "Advertisement content is ready for Ad Manager review."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.workflowStatus).toBe("SUBMITTED");
    expect(Number(response.body.data.submittedBy)).toBe(creatorUserId);
    expect(response.body.data.submittedAt).toBeDefined();
  });

  it("PATCH /api/v1/advertisements/:id - should deny Ad Creator from editing a SUBMITTED advertisement", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/${advertisementId}`)
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        name: `Should Not Update ${timestamp}`
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/:id/approve - should deny Ad Creator from approving an advertisement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${advertisementId}/approve`)
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        remarks: "Creator must not approve."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/:id/approve - should allow Ad Manager to approve SUBMITTED advertisement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${advertisementId}/approve`)
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        remarks: "Advertisement reviewed and approved by Ad Manager."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.workflowStatus).toBe("APPROVED");
    expect(Number(response.body.data.approvedBy)).toBe(managerUserId);
    expect(response.body.data.approvedAt).toBeDefined();
  });

  it("PATCH /api/v1/advertisements/:id - should deny editing an APPROVED advertisement", async () => {
    const response = await request(app)
      .patch(`/api/v1/advertisements/${advertisementId}`)
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        name: `Approved Edit Attempt ${timestamp}`
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/:id/submit - should reject submitting an already APPROVED advertisement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${advertisementId}/submit`)
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        remarks: "Invalid second submission."
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/:id/workflow-history - should return the submitted and approved workflow history", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/${advertisementId}/workflow-history`)
      .set("Authorization", `Bearer ${managerAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const history = response.body.data as Array<{
      fromStatus: string | null;
      toStatus: string;
      remarks: string | null;
      performedBy: number | string | null;
      performedAt: string;
    }>;

    expect(history.length).toBe(2);
    expect(history[0]?.fromStatus).toBe("DRAFT");
    expect(history[0]?.toStatus).toBe("SUBMITTED");
    expect(Number(history[0]?.performedBy)).toBe(creatorUserId);

    expect(history[1]?.fromStatus).toBe("SUBMITTED");
    expect(history[1]?.toStatus).toBe("APPROVED");
    expect(Number(history[1]?.performedBy)).toBe(managerUserId);

    expect(
      new Date(history[0]?.performedAt ?? "").getTime()
    ).toBeLessThanOrEqual(new Date(history[1]?.performedAt ?? "").getTime());
  });

  it("GET /api/v1/advertisements/:id/workflow-history - should allow Ad Creator to read advertisement workflow history", async () => {
    const response = await request(app)
      .get(`/api/v1/advertisements/${advertisementId}/workflow-history`)
      .set("Authorization", `Bearer ${creatorAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("POST /api/v1/advertisements - should deny Ad Manager from creating advertisements", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        clientId: testClientId,
        name: `Manager Cannot Create ${timestamp}`,
        internalName: `manager-cannot-create-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/manager-cannot-create"
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/:id/submit - should deny Ad Manager from submitting an advertisement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${advertisementId}/submit`)
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        remarks: "Manager cannot submit."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements - should create a separate advertisement for rejection workflow", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        clientId: testClientId,
        name: `Advertisement Workflow Rejection ${timestamp}`,
        internalName: `fa-ad-workflow-rejection-${timestamp}`,
        advertisementType: "BANNER",
        destinationUrl: "https://example.com/fa-ad-workflow-rejection",
        priority: 5,
        isClickable: true,
        openInNewTab: true,
        agreedAmount: 25000,
        currencyCode: "INR"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.workflowStatus).toBe("DRAFT");

    rejectionAdvertisementId = Number(response.body.data.id);

    expect(rejectionAdvertisementId).toBeGreaterThan(0);
  });

  it("POST /api/v1/advertisements/:id/submit - should submit the rejection-workflow advertisement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/submit`)
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        remarks: "Submit for rejection-path review."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.workflowStatus).toBe("SUBMITTED");
    expect(Number(response.body.data.submittedBy)).toBe(creatorUserId);
  });

  it("POST /api/v1/advertisements/:id/reject - should reject SUBMITTED advertisement with a required reason", async () => {
    const rejectionReason = "Creative requires correction before approval.";

    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/reject`)
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        reason: rejectionReason,
        remarks: "Please update the creative and resubmit."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.workflowStatus).toBe("REJECTED");
    expect(Number(response.body.data.rejectedBy)).toBe(managerUserId);
    expect(response.body.data.rejectedAt).toBeDefined();
    expect(response.body.data.rejectionReason).toBe(rejectionReason);
  });

  it("POST /api/v1/advertisements/:id/approve - should reject approving a REJECTED advertisement before resubmission", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/approve`)
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        remarks: "Cannot approve without resubmission."
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/:id/reject - should reject a blank rejection reason", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/reject`)
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        reason: "   "
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/:id/submit - should allow Ad Creator to resubmit a REJECTED advertisement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/submit`)
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        remarks: "Creative corrected and resubmitted for review."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.workflowStatus).toBe("SUBMITTED");
    expect(Number(response.body.data.submittedBy)).toBe(creatorUserId);
    expect(response.body.data.rejectionReason).toBeNull();
  });

  it("POST /api/v1/advertisements/:id/approve - should allow Ad Manager to approve the resubmitted advertisement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/approve`)
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        remarks: "Corrected advertisement approved."
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.workflowStatus).toBe("APPROVED");
    expect(Number(response.body.data.approvedBy)).toBe(managerUserId);
  });

  it("POST /api/v1/advertisements/:id/reject - should reject rejecting an APPROVED advertisement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${rejectionAdvertisementId}/reject`)
      .set("Authorization", `Bearer ${managerAccessToken}`)
      .send({
        reason: "Attempted rejection after approval."
      });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/:id/workflow-history - should preserve the complete rejection and resubmission history", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/${rejectionAdvertisementId}/workflow-history`
      )
      .set("Authorization", `Bearer ${managerAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const history = response.body.data as Array<{
      fromStatus: string | null;
      toStatus: string;
      performedBy: number | string | null;
    }>;

    expect(history.length).toBe(4);

    expect(history[0]?.fromStatus).toBe("DRAFT");
    expect(history[0]?.toStatus).toBe("SUBMITTED");
    expect(Number(history[0]?.performedBy)).toBe(creatorUserId);

    expect(history[1]?.fromStatus).toBe("SUBMITTED");
    expect(history[1]?.toStatus).toBe("REJECTED");
    expect(Number(history[1]?.performedBy)).toBe(managerUserId);

    expect(history[2]?.fromStatus).toBe("REJECTED");
    expect(history[2]?.toStatus).toBe("SUBMITTED");
    expect(Number(history[2]?.performedBy)).toBe(creatorUserId);

    expect(history[3]?.fromStatus).toBe("SUBMITTED");
    expect(history[3]?.toStatus).toBe("APPROVED");
    expect(Number(history[3]?.performedBy)).toBe(managerUserId);
  });

  it("POST /api/v1/advertisements/:id/submit - should reject submitting a nonexistent advertisement", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements/999999999/submit")
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        remarks: "Unknown advertisement."
      });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("POST /api/v1/advertisements/:id/reject - should deny Ad Creator from rejecting an advertisement", async () => {
    const response = await request(app)
      .post(`/api/v1/advertisements/${advertisementId}/reject`)
      .set("Authorization", `Bearer ${creatorAccessToken}`)
      .send({
        reason: "Creator cannot reject."
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it("should verify that the approved advertisement has no unexpected workflow mutation", async () => {
    const result = await pool.query(
      `
      SELECT
        id,
        workflow_status,
        submitted_by,
        approved_by,
        rejected_by,
        rejection_reason,
        on_hold_by,
        on_hold_reason
      FROM advertisements
      WHERE id = $1
      `,
      [advertisementId]
    );

    expect(result.rows.length).toBe(1);

    const row = result.rows[0];

    expect(row?.workflow_status).toBe("APPROVED");
    expect(Number(row?.submitted_by)).toBe(creatorUserId);
    expect(Number(row?.approved_by)).toBe(managerUserId);
    expect(row?.rejected_by).toBeNull();
    expect(row?.rejection_reason).toBeNull();
    expect(row?.on_hold_by).toBeNull();
    expect(row?.on_hold_reason).toBeNull();
  });
});
