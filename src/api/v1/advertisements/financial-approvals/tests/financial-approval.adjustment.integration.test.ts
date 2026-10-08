import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Financial Approval ADJUSTMENT API Integration", () => {
  let creatorAccessToken = "";
  let financeAccessToken = "";

  let creatorUserId = 0;
  let financeUserId = 0;

  let creatorRoleId = 0;
  let financeRoleId = 0;

  let testClientId = 0;
  let testPlacementId = 0;
  let testAdvertisementId = 0;
  let testPaymentId = 0;

  let createdApprovalId = 0;
  let resubmitApprovalId = 0;

  const validationApprovalIds: number[] = [];
  const temporaryAdvertisementIds: number[] = [];

  const timestamp = Date.now();

  const creatorUsername = `financial_adjustment_creator_${timestamp}`;
  const creatorEmail = `financial.adjustment.creator.${timestamp}@example.com`;

  const financeUsername = `financial_adjustment_finance_${timestamp}`;
  const financeEmail = `financial.adjustment.finance.${timestamp}@example.com`;

  const creatorRoleName = `financial_adjustment_creator_role_${timestamp}`;
  const financeRoleName = `financial_adjustment_finance_role_${timestamp}`;

  const clientCode = `FADJ-CLIENT-${timestamp}`;
  const placementCode = `FADJ-PLACEMENT-${timestamp}`;

  const creatorPassword = "Test@12345";
  const financePassword = "Test@12345";

  const ADVERTISEMENT_RESOURCE = "advertisements";

  const FINANCIAL_APPROVAL_RESOURCE =
    "advertisements.financial_approvals";

  const creatorPermissionCodes = {
    read: `${ADVERTISEMENT_RESOURCE}.read`,
    create: `${ADVERTISEMENT_RESOURCE}.create`,
    update: `${ADVERTISEMENT_RESOURCE}.update`,
    submit: `${ADVERTISEMENT_RESOURCE}.submit`,
    financialApprovalRead: `${FINANCIAL_APPROVAL_RESOURCE}.read`,
  } as const;

  const financePermissionCodes = {
    read: `${FINANCIAL_APPROVAL_RESOURCE}.read`,
    hold: `${FINANCIAL_APPROVAL_RESOURCE}.hold`,
    reject: `${FINANCIAL_APPROVAL_RESOURCE}.reject`,
    approve: `${FINANCIAL_APPROVAL_RESOURCE}.approve`,
  } as const;

  const permissionIds = new Map<string, number>();

  const insertRolePermission = async (
    roleId: number,
    permissionId: number,
    createdBy: number,
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
      [roleId, permissionId, createdBy],
    );
  };

  const deleteApproval = async (
    approvalId: number,
  ): Promise<void> => {
    if (approvalId <= 0) {
      return;
    }

    await pool.query(
      `
        DELETE FROM advertisement_financial_approval_history
        WHERE approval_id = $1
      `,
      [approvalId],
    );

    await pool.query(
      `
        DELETE FROM advertisement_financial_approvals
        WHERE id = $1
      `,
      [approvalId],
    );
  };

  const createTemporaryAdvertisement = async (
    nameSuffix: string,
  ): Promise<number> => {
    const uniqueSuffix = `${timestamp}-${Date.now()}-${nameSuffix}`;

    const response = await request(app)
      .post("/api/v1/advertisements")
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      )
      .send({
        clientId: testClientId,
        name: `Financial Adjustment Temporary Advertisement ${uniqueSuffix}`,
        internalName: `financial-adjustment-temp-ad-${uniqueSuffix}`,
        advertisementType: "DISPLAY",
        destinationUrl:
          "https://example.com/financial-adjustment-temp-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes:
          "Temporary advertisement for isolated financial adjustment integration tests.",
        advertisementAmount: 50000,
        currencyCode: "INR",
        placementId: testPlacementId,
      });

    expect(
      response.status,
      `Temporary advertisement creation failed: ${JSON.stringify(
        response.body,
      )}`,
    ).toBe(201);

    expect(response.body.success).toBe(true);

    const advertisementId = Number(
      response.body.data.id,
    );

    expect(advertisementId).toBeGreaterThan(0);

    expect(
      response.body.data.workflowStatus,
    ).toBe("DRAFT");

    temporaryAdvertisementIds.push(
      advertisementId,
    );

    return advertisementId;
  };

  const createAdjustmentApproval = async (
    advertisementId: number,
    requestedAmount?: number,
    requestedPercentage?: number,
    approvalRemarks?: string,
  ): Promise<number> => {
    const payload: Record<string, unknown> = {
      advertisementId,
      clientId: testClientId,
      approvalType: "ADJUSTMENT",
    };

    if (requestedAmount !== undefined) {
      payload.requestedAmount = requestedAmount;
    }

    if (requestedPercentage !== undefined) {
      payload.requestedPercentage =
        requestedPercentage;
    }

    if (approvalRemarks !== undefined) {
      payload.approvalRemarks = approvalRemarks;
    }

    const response = await request(app)
      .post(
        "/api/v1/advertisements/payments/financial-approval",
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      )
      .send(payload);

    expect(
      response.status,
      `Adjustment approval creation failed: ${JSON.stringify(
        response.body,
      )}`,
    ).toBe(201);

    expect(response.body.success).toBe(true);

    const approvalId = Number(
      response.body.data.id,
    );

    expect(approvalId).toBeGreaterThan(0);

    validationApprovalIds.push(approvalId);

    return approvalId;
  };

  beforeAll(async () => {
    /*
     * ======================================================================
     * SUPER ADMIN ROLE
     * ======================================================================
     */

    const superAdminRoleResult =
      await pool.query<{
        id: number | string;
      }>(
        `
          SELECT id
          FROM roles
          WHERE code = 'SUPER_ADMIN'
            AND status = 'ACTIVE'
          LIMIT 1
        `,
      );

    const superAdminRole =
      superAdminRoleResult.rows[0];

    if (superAdminRole === undefined) {
      throw new Error(
        "SUPER_ADMIN role was not found.",
      );
    }

    const superAdminRoleId =
      Number(superAdminRole.id);

    expect(superAdminRoleId).toBeGreaterThan(0);

    /*
     * ======================================================================
     * CREATOR USER
     * ======================================================================
     */

    const creatorPasswordHash =
      await bcrypt.hash(
        creatorPassword,
        12,
      );

    const creatorUserResult =
      await pool.query<{
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
          creatorUsername,
          creatorEmail,
          creatorPasswordHash,
          "Financial Adjustment Integration Creator",
          "Financial Adjustment Creator",
          superAdminRoleId,
        ],
      );

    const creatorUser =
      creatorUserResult.rows[0];

    if (creatorUser === undefined) {
      throw new Error(
        "Failed to create financial adjustment creator user.",
      );
    }

    creatorUserId = Number(
      creatorUser.id,
    );

    expect(creatorUserId).toBeGreaterThan(0);

    /*
     * ======================================================================
     * FINANCE USER
     * ======================================================================
     */

    const financePasswordHash =
      await bcrypt.hash(
        financePassword,
        12,
      );

    const financeUserResult =
      await pool.query<{
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
          financeUsername,
          financeEmail,
          financePasswordHash,
          "Financial Adjustment Integration Finance",
          "Financial Adjustment Finance",
          superAdminRoleId,
        ],
      );

    const financeUser =
      financeUserResult.rows[0];

    if (financeUser === undefined) {
      throw new Error(
        "Failed to create financial adjustment finance user.",
      );
    }

    financeUserId = Number(
      financeUser.id,
    );

    expect(financeUserId).toBeGreaterThan(0);

    /*
     * ======================================================================
     * CREATOR ROLE
     * ======================================================================
     */

    const creatorRoleResult =
      await pool.query<{
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
            997,
            'ACTIVE',
            $4,
            $4,
            NOW(),
            NOW()
          )
          RETURNING id
        `,
        [
          creatorRoleName,
          "Financial Adjustment Creator Test Role",
          "Temporary role for financial adjustment creator integration tests.",
          creatorUserId,
        ],
      );

    const creatorRole =
      creatorRoleResult.rows[0];

    if (creatorRole === undefined) {
      throw new Error(
        "Failed to create financial adjustment creator role.",
      );
    }

    creatorRoleId = Number(
      creatorRole.id,
    );

    expect(creatorRoleId).toBeGreaterThan(0);

    /*
     * ======================================================================
     * FINANCE ROLE
     * ======================================================================
     */

    const financeRoleResult =
      await pool.query<{
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
            998,
            'ACTIVE',
            $4,
            $4,
            NOW(),
            NOW()
          )
          RETURNING id
        `,
        [
          financeRoleName,
          "Financial Adjustment Finance Test Role",
          "Temporary role for financial adjustment finance integration tests.",
          financeUserId,
        ],
      );

    const financeRole =
      financeRoleResult.rows[0];

    if (financeRole === undefined) {
      throw new Error(
        "Failed to create financial adjustment finance role.",
      );
    }

    financeRoleId = Number(
      financeRole.id,
    );

    expect(financeRoleId).toBeGreaterThan(0);

    /*
     * ======================================================================
     * ASSIGN ROLES TO USERS
     * ======================================================================
     */

    await pool.query(
      `
        UPDATE users
        SET role_id = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        creatorUserId,
        creatorRoleId,
      ],
    );

    await pool.query(
      `
        UPDATE users
        SET role_id = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        financeUserId,
        financeRoleId,
      ],
    );

    await pool.query(
      `
        DELETE FROM user_roles
        WHERE user_id = ANY($1::bigint[])
      `,
      [[creatorUserId, financeUserId]],
    );

    await pool.query(
      `
        INSERT INTO user_roles (
          user_id,
          role_id,
          created_by,
          created_at
        )
        VALUES
          ($1, $2, $1, NOW()),
          ($3, $4, $3, NOW())
        ON CONFLICT DO NOTHING
      `,
      [
        creatorUserId,
        creatorRoleId,
        financeUserId,
        financeRoleId,
      ],
    );

    /*
     * ======================================================================
     * RESOLVE PRODUCTION PERMISSIONS
     * ======================================================================
     */

    const requiredCreatorPermissionCodes =
      Object.values(
        creatorPermissionCodes,
      );

    const requiredFinancePermissionCodes =
      Object.values(
        financePermissionCodes,
      );

    const requiredPermissionCodes = [
      ...requiredCreatorPermissionCodes,
      ...requiredFinancePermissionCodes,
    ];

    for (const permissionCode of requiredPermissionCodes) {
      const permissionResult =
        await pool.query<{
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
          [permissionCode],
        );

      const permission =
        permissionResult.rows[0];

      if (permission === undefined) {
        throw new Error(
          `Required production permission '${permissionCode}' was not found.`,
        );
      }

      expect(
        permission.status,
        `Permission '${permissionCode}' must be ACTIVE.`,
      ).toBe("ACTIVE");

      expect(
        permission.module,
      ).toBe("ADVERTISEMENT");

      const parts =
        permissionCode.split(".");

      const action =
        parts.at(-1);

      const resource =
        parts.slice(0, -1).join(".");

      expect(permission.action).toBe(
        action,
      );

      expect(permission.resource).toBe(
        resource,
      );

      const permissionId =
        Number(permission.id);

      expect(permissionId).toBeGreaterThan(
        0,
      );

      permissionIds.set(
        permissionCode,
        permissionId,
      );
    }

    /*
     * ======================================================================
     * ATTACH CREATOR PERMISSIONS
     * ======================================================================
     */

    for (const permissionCode of requiredCreatorPermissionCodes) {
      const permissionId =
        permissionIds.get(permissionCode);

      if (permissionId === undefined) {
        throw new Error(
          `Creator permission ID was not resolved for '${permissionCode}'.`,
        );
      }

      await insertRolePermission(
        creatorRoleId,
        permissionId,
        creatorUserId,
      );
    }

    /*
     * ======================================================================
     * ATTACH FINANCE PERMISSIONS
     * ======================================================================
     */

    for (const permissionCode of requiredFinancePermissionCodes) {
      const permissionId =
        permissionIds.get(permissionCode);

      if (permissionId === undefined) {
        throw new Error(
          `Finance permission ID was not resolved for '${permissionCode}'.`,
        );
      }

      await insertRolePermission(
        financeRoleId,
        permissionId,
        financeUserId,
      );
    }

    /*
     * ======================================================================
     * VERIFY CREATOR PERMISSIONS
     * ======================================================================
     */

    const creatorVerificationResult =
      await pool.query<{
        code: string;
      }>(
        `
          SELECT p.code
          FROM role_permissions rp
          INNER JOIN permissions p
            ON p.id = rp.permission_id
          WHERE rp.role_id = $1
            AND p.status = 'ACTIVE'
            AND p.code = ANY($2::text[])
          ORDER BY p.code
        `,
        [
          creatorRoleId,
          requiredCreatorPermissionCodes,
        ],
      );

    const creatorAttachedCodes =
      new Set(
        creatorVerificationResult.rows.map(
          (row) => row.code,
        ),
      );

    expect(
      creatorAttachedCodes.size,
    ).toBe(
      requiredCreatorPermissionCodes.length,
    );

    for (const permissionCode of requiredCreatorPermissionCodes) {
      expect(
        creatorAttachedCodes.has(
          permissionCode,
        ),
      ).toBe(true);
    }

    /*
     * ======================================================================
     * VERIFY FINANCE PERMISSIONS
     * ======================================================================
     */

    const financeVerificationResult =
      await pool.query<{
        code: string;
      }>(
        `
          SELECT p.code
          FROM role_permissions rp
          INNER JOIN permissions p
            ON p.id = rp.permission_id
          WHERE rp.role_id = $1
            AND p.status = 'ACTIVE'
            AND p.code = ANY($2::text[])
          ORDER BY p.code
        `,
        [
          financeRoleId,
          requiredFinancePermissionCodes,
        ],
      );

    const financeAttachedCodes =
      new Set(
        financeVerificationResult.rows.map(
          (row) => row.code,
        ),
      );

    expect(
      financeAttachedCodes.size,
    ).toBe(
      requiredFinancePermissionCodes.length,
    );

    for (const permissionCode of requiredFinancePermissionCodes) {
      expect(
        financeAttachedCodes.has(
          permissionCode,
        ),
      ).toBe(true);
    }

    /*
     * ======================================================================
     * TEST CLIENT
     * ======================================================================
     */

    const clientResult =
      await pool.query<{
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
          "Financial Adjustment Test Client",
          "Financial Adjustment Test Client",
          creatorUserId,
        ],
      );

    const client =
      clientResult.rows[0];

    if (client === undefined) {
      throw new Error(
        "Failed to create financial adjustment test client.",
      );
    }

    testClientId = Number(
      client.id,
    );

    expect(testClientId).toBeGreaterThan(
      0,
    );

    /*
     * ======================================================================
     * TEST RUNTIME PLACEMENT
     *
     * Advertisement creation now requires a valid runtime placement.
     * The placement is deliberately created as a temporary fixture for
     * this integration suite and is reused by all temporary advertisements.
     * ======================================================================
     */

    const placementResult =
      await pool.query<{
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
          placementCode,
          "Financial Adjustment Test Placement",
          "Temporary runtime placement for financial adjustment integration tests.",
          creatorUserId,
        ],
      );

    const placement =
      placementResult.rows[0];

    if (placement === undefined) {
      throw new Error(
        "Failed to create financial adjustment test placement.",
      );
    }

    testPlacementId = Number(
      placement.id,
    );

    expect(testPlacementId).toBeGreaterThan(
      0,
    );

    /*
     * ======================================================================
     * CREATOR LOGIN
     * ======================================================================
     */

    const creatorLoginResponse =
      await request(app)
        .post("/api/v1/auth/login")
        .send({
          username: creatorUsername,
          password: creatorPassword,
        });

    expect(
      creatorLoginResponse.status,
      `Creator login failed: ${JSON.stringify(
        creatorLoginResponse.body,
      )}`,
    ).toBe(200);

    creatorAccessToken =
      creatorLoginResponse.body?.data
        ?.tokens?.accessToken;

    expect(
      creatorAccessToken,
      `Creator login response does not contain an access token: ${JSON.stringify(
        creatorLoginResponse.body,
      )}`,
    ).toBeTruthy();

    /*
     * ======================================================================
     * FINANCE LOGIN
     * ======================================================================
     */

    const financeLoginResponse =
      await request(app)
        .post("/api/v1/auth/login")
        .send({
          username: financeUsername,
          password: financePassword,
        });

    expect(
      financeLoginResponse.status,
      `Finance login failed: ${JSON.stringify(
        financeLoginResponse.body,
      )}`,
    ).toBe(200);

    financeAccessToken =
      financeLoginResponse.body?.data
        ?.tokens?.accessToken;

    expect(
      financeAccessToken,
      `Finance login response does not contain an access token: ${JSON.stringify(
        financeLoginResponse.body,
      )}`,
    ).toBeTruthy();
  });

  afterAll(async () => {
    /*
     * ======================================================================
     * APPROVAL CLEANUP
     * ======================================================================
     */

    const approvalIds = [
      createdApprovalId,
      resubmitApprovalId,
      ...validationApprovalIds,
    ].filter(
      (id, index, array) =>
        id > 0 &&
        array.indexOf(id) === index,
    );

    for (const approvalId of approvalIds) {
      try {
        await deleteApproval(
          approvalId,
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * TEMPORARY ADVERTISEMENT PAYMENT CLEANUP
     * ======================================================================
     */

    for (const advertisementId of temporaryAdvertisementIds) {
      try {
        await pool.query(
          `
            DELETE FROM advertisement_payments
            WHERE advertisement_id = $1
          `,
          [advertisementId],
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * MAIN PAYMENT CLEANUP
     * ======================================================================
     */

    if (testPaymentId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM advertisement_payments
            WHERE id = $1
          `,
          [testPaymentId],
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * TEMPORARY ADVERTISEMENT CLEANUP
     * ======================================================================
     */

    for (const advertisementId of temporaryAdvertisementIds) {
      try {
        await pool.query(
          `
            DELETE FROM advertisements
            WHERE id = $1
          `,
          [advertisementId],
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * MAIN ADVERTISEMENT CLEANUP
     * ======================================================================
     */

    if (testAdvertisementId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM advertisements
            WHERE id = $1
          `,
          [testAdvertisementId],
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * RUNTIME PLACEMENT CLEANUP
     *
     * Placement rules are normally removed by advertisement ON DELETE
     * CASCADE. Delete any remaining rules explicitly before deleting the
     * temporary placement so the fixture remains safe even if a test
     * stopped midway.
     * ======================================================================
     */

    if (testPlacementId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM advertisement_placement_rules
            WHERE placement_id = $1
          `,
          [testPlacementId],
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
          [testPlacementId],
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
          [testClientId],
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * CREATOR ROLE CLEANUP
     * ======================================================================
     */

    if (creatorRoleId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM role_permissions
            WHERE role_id = $1
          `,
          [creatorRoleId],
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
          [creatorRoleId],
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
          [creatorRoleId],
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    /*
     * ======================================================================
     * FINANCE ROLE CLEANUP
     * ======================================================================
     */

    if (financeRoleId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM role_permissions
            WHERE role_id = $1
          `,
          [financeRoleId],
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
          [financeRoleId],
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
          [financeRoleId],
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

    if (creatorUserId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM users
            WHERE id = $1
          `,
          [creatorUserId],
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    if (financeUserId > 0) {
      try {
        await pool.query(
          `
            DELETE FROM users
            WHERE id = $1
          `,
          [financeUserId],
        );
      } catch {
        // Cleanup must not fail the suite.
      }
    }

    await pool.end();
  });

  /*
   * =========================================================================
   * 1. AUTHENTICATION
   * =========================================================================
   */

  it("should authenticate the Ad Creator test user", () => {
    expect(creatorAccessToken).toBeTruthy();
  });

  /*
   * =========================================================================
   * 2. FINANCE AUTHENTICATION
   * =========================================================================
   */

  it("should authenticate the Finance test user", () => {
    expect(financeAccessToken).toBeTruthy();
  });

  /*
   * =========================================================================
   * 3. ADVERTISEMENT FIXTURE
   * =========================================================================
   */

  it("should create an advertisement fixture", async () => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      )
      .send({
        clientId: testClientId,
        name:
          "Financial Adjustment Integration Test Advertisement",
        internalName:
          `financial-adjustment-test-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl:
          "https://example.com/financial-adjustment-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes:
          "Advertisement fixture for financial adjustment integration tests.",
        advertisementAmount: 10000,
        currencyCode: "INR",
        placementId: testPlacementId,
      });

    expect(
      response.status,
      `Advertisement creation failed: ${JSON.stringify(
        response.body,
      )}`,
    ).toBe(201);

    expect(response.body.success).toBe(
      true,
    );

    testAdvertisementId = Number(
      response.body.data.id,
    );

    expect(
      testAdvertisementId,
    ).toBeGreaterThan(0);

    expect(
      response.body.data.workflowStatus,
    ).toBe("DRAFT");
  });

  /*
   * =========================================================================
   * 4. PAYMENT FIXTURE
   * =========================================================================
   */

  it("should create a payment fixture", async () => {
    expect(
      testAdvertisementId,
    ).toBeGreaterThan(0);

    const paymentResult =
      await pool.query<{
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
          `FADJ-PAY-${timestamp}`,
          "Financial adjustment integration test payment.",
          creatorUserId,
          "REGULAR",
        ],
      );

    const payment =
      paymentResult.rows[0];

    if (payment === undefined) {
      throw new Error(
        "Failed to create financial adjustment payment fixture.",
      );
    }

    testPaymentId = Number(
      payment.id,
    );

    expect(testPaymentId).toBeGreaterThan(
      0,
    );
  });

  /*
   * =========================================================================
   * 5. CREATE ADJUSTMENT BY AMOUNT
   * =========================================================================
   */

  it("should create an ADJUSTMENT approval using requested amount", async () => {
    const response = await request(app)
      .post(
        "/api/v1/advertisements/payments/financial-approval",
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      )
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "ADJUSTMENT",
        requestedAmount: 2500,
        approvalRemarks:
          "Initial adjustment approval request.",
      });

    expect(
      response.status,
      `Adjustment approval creation failed: ${JSON.stringify(
        response.body,
      )}`,
    ).toBe(201);

    expect(response.body.success).toBe(
      true,
    );

    createdApprovalId = Number(
      response.body.data.id,
    );

    expect(
      createdApprovalId,
    ).toBeGreaterThan(0);

    expect(
      response.body.data.approvalType,
    ).toBe("ADJUSTMENT");

    expect(
      Number(
        response.body.data.requestedAmount,
      ),
    ).toBe(2500);

    expect(
      response.body.data.requestedPercentage,
    ).toBeNull();

    expect(
      response.body.data.status,
    ).toBe("SUBMITTED");

    expect(
      Number(
        response.body.data.requestedBy,
      ),
    ).toBe(creatorUserId);

    expect(
      response.body.data.approvalRemarks,
    ).toBe(
      "Initial adjustment approval request.",
    );
  });

  /*
   * =========================================================================
   * 6. CREATE ADJUSTMENT BY PERCENTAGE
   * =========================================================================
   */

  it("should create an ADJUSTMENT approval using requested percentage", async () => {
    const advertisementId =
      await createTemporaryAdvertisement(
        "percentage",
      );

    const approvalId =
      await createAdjustmentApproval(
        advertisementId,
        undefined,
        12.5,
        "Percentage adjustment request.",
      );

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}`,
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      );

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(
      true,
    );

    expect(
      response.body.data.approvalType,
    ).toBe("ADJUSTMENT");

    expect(
      response.body.data.requestedAmount,
    ).toBeNull();

    expect(
      Number(
        response.body.data.requestedPercentage,
      ),
    ).toBe(12.5);

    await deleteApproval(
      approvalId,
    );
  });

  /*
   * =========================================================================
   * 7. GET BY ID
   * =========================================================================
   */

  it("should get the ADJUSTMENT approval by id", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}`,
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      );

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(
      true,
    );

    expect(
      Number(response.body.data.id),
    ).toBe(createdApprovalId);

    expect(
      response.body.data.approvalType,
    ).toBe("ADJUSTMENT");
  });

  /*
   * =========================================================================
   * 8. HOLD
   * =========================================================================
   */

  it("should place the ADJUSTMENT approval on hold", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}/hold`,
      )
      .set(
        "Authorization",
        `Bearer ${financeAccessToken}`,
      )
      .send({
        holdReason:
          "Adjustment requires additional financial verification.",
      });

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(
      true,
    );

    expect(
      response.body.data.status,
    ).toBe("HOLD");

    expect(
      Number(response.body.data.id),
    ).toBe(createdApprovalId);

    expect(
      response.body.data.holdReason,
    ).toBe(
      "Adjustment requires additional financial verification.",
    );

    expect(
      Number(
        response.body.data.reviewedBy,
      ),
    ).toBe(financeUserId);
  });

  /*
   * =========================================================================
   * 9. APPROVE FROM HOLD
   * =========================================================================
   */

  it("should approve the ADJUSTMENT approval from HOLD", async () => {
    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}/approve`,
      )
      .set(
        "Authorization",
        `Bearer ${financeAccessToken}`,
      )
      .send({
        approvalRemarks:
          "Adjustment financially approved after verification.",
      });

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(
      true,
    );

    expect(
      response.body.data.status,
    ).toBe("APPROVED");

    expect(
      Number(response.body.data.id),
    ).toBe(createdApprovalId);

    expect(
      response.body.data.approvalRemarks,
    ).toBe(
      "Adjustment financially approved after verification.",
    );

    expect(
      Number(
        response.body.data.reviewedBy,
      ),
    ).toBe(financeUserId);
  });

  /*
   * =========================================================================
   * 10. LATEST APPROVAL
   * =========================================================================
   */

  it("should return the approved ADJUSTMENT as the latest approval", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/advertisements/${testAdvertisementId}/latest`,
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      );

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(
      true,
    );

    expect(
      response.body.data,
    ).not.toBeNull();

    expect(
      Number(response.body.data.id),
    ).toBe(createdApprovalId);

    expect(
      response.body.data.approvalType,
    ).toBe("ADJUSTMENT");

    expect(
      response.body.data.status,
    ).toBe("APPROVED");
  });

  /*
   * =========================================================================
   * 11. NO PENDING AFTER APPROVAL
   * =========================================================================
   */

  it("should return no pending ADJUSTMENT after approval", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/advertisements/${testAdvertisementId}/pending`,
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      );

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(
      true,
    );

    expect(response.body.data).toBeNull();
  });

  /*
   * =========================================================================
   * 12. HISTORY
   * =========================================================================
   */

  it("should preserve ADJUSTMENT approval history", async () => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}/history`,
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      );

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(
      true,
    );

    expect(
      Array.isArray(response.body.data),
    ).toBe(true);

    expect(
      response.body.data.length,
    ).toBeGreaterThanOrEqual(3);

    const statuses =
      response.body.data.map(
        (item: {
          fromStatus: string | null;
          toStatus: string;
        }) => ({
          fromStatus: item.fromStatus,
          toStatus: item.toStatus,
        }),
      );

    expect(
      statuses.some(
        (item: {
          fromStatus: string | null;
          toStatus: string;
        }) =>
          item.fromStatus === null &&
          item.toStatus === "SUBMITTED",
      ),
    ).toBe(true);

    expect(
      statuses.some(
        (item: {
          fromStatus: string | null;
          toStatus: string;
        }) =>
          item.fromStatus === "SUBMITTED" &&
          item.toStatus === "HOLD",
      ),
    ).toBe(true);

    expect(
      statuses.some(
        (item: {
          fromStatus: string | null;
          toStatus: string;
        }) =>
          item.fromStatus === "HOLD" &&
          item.toStatus === "APPROVED",
      ),
    ).toBe(true);
  });

  /*
   * =========================================================================
   * 13. DUPLICATE PENDING
   * =========================================================================
   */

  it("should reject a duplicate pending ADJUSTMENT approval", async () => {
    const advertisementId =
      await createTemporaryAdvertisement(
        "duplicate",
      );

    const firstApprovalId =
      await createAdjustmentApproval(
        advertisementId,
        1000,
        undefined,
        "First adjustment request.",
      );

    const response = await request(app)
      .post(
        "/api/v1/advertisements/payments/financial-approval",
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      )
      .send({
        advertisementId,
        clientId: testClientId,
        approvalType: "ADJUSTMENT",
        requestedPercentage: 10,
        approvalRemarks:
          "Duplicate adjustment request.",
      });

    expect(
      response.status,
      `Unexpected duplicate response: ${JSON.stringify(
        response.body,
      )}`,
    ).toBe(409);

    expect(response.body.success).toBe(
      false,
    );

    await deleteApproval(
      firstApprovalId,
    );
  });

  /*
   * =========================================================================
   * 14. ZERO PERCENTAGE
   * =========================================================================
   */

  it("should allow an ADJUSTMENT requested percentage of zero", async () => {
    const advertisementId =
      await createTemporaryAdvertisement(
        "zero-percentage",
      );

    const approvalId =
      await createAdjustmentApproval(
        advertisementId,
        undefined,
        0,
        "Zero percentage adjustment request.",
      );

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}`,
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      );

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(
      true,
    );

    expect(
      response.body.data.approvalType,
    ).toBe("ADJUSTMENT");

    expect(
      Number(
        response.body.data.requestedPercentage,
      ),
    ).toBe(0);

    await deleteApproval(
      approvalId,
    );
  });

  /*
   * =========================================================================
   * 15. 100 PERCENTAGE
   * =========================================================================
   */

  it("should allow an ADJUSTMENT requested percentage of 100", async () => {
    const advertisementId =
      await createTemporaryAdvertisement(
        "full-percentage",
      );

    const approvalId =
      await createAdjustmentApproval(
        advertisementId,
        undefined,
        100,
        "Full percentage adjustment request.",
      );

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}`,
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      );

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(
      true,
    );

    expect(
      Number(
        response.body.data.requestedPercentage,
      ),
    ).toBe(100);

    await deleteApproval(
      approvalId,
    );
  });

  /*
   * =========================================================================
   * 16. BOTH AMOUNT AND PERCENTAGE
   * =========================================================================
   */

  it("should reject an ADJUSTMENT containing both amount and percentage", async () => {
    const response = await request(app)
      .post(
        "/api/v1/advertisements/payments/financial-approval",
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      )
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "ADJUSTMENT",
        requestedAmount: 1000,
        requestedPercentage: 10,
        approvalRemarks:
          "Invalid adjustment request.",
      });

    expect(response.status).toBe(400);

    expect(response.body.success).toBe(
      false,
    );
  });

  /*
   * =========================================================================
   * 17. NEITHER AMOUNT NOR PERCENTAGE
   * =========================================================================
   */

  it("should reject an ADJUSTMENT without amount or percentage", async () => {
    const response = await request(app)
      .post(
        "/api/v1/advertisements/payments/financial-approval",
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      )
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "ADJUSTMENT",
        approvalRemarks:
          "Incomplete adjustment request.",
      });

    expect(response.status).toBe(400);

    expect(response.body.success).toBe(
      false,
    );
  });

  /*
   * =========================================================================
   * 18. ZERO AMOUNT
   * =========================================================================
   */

  it("should reject an ADJUSTMENT requested amount of zero", async () => {
    const response = await request(app)
      .post(
        "/api/v1/advertisements/payments/financial-approval",
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      )
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "ADJUSTMENT",
        requestedAmount: 0,
      });

    expect(response.status).toBe(400);

    expect(response.body.success).toBe(
      false,
    );
  });

  /*
   * =========================================================================
   * 19. PERCENTAGE ABOVE 100
   * =========================================================================
   */

  it("should reject an ADJUSTMENT requested percentage above 100", async () => {
    const response = await request(app)
      .post(
        "/api/v1/advertisements/payments/financial-approval",
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      )
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "ADJUSTMENT",
        requestedPercentage: 100.01,
      });

    expect(response.status).toBe(400);

    expect(response.body.success).toBe(
      false,
    );
  });

  /*
   * =========================================================================
   * 20. MORE THAN TWO DECIMAL PLACES
   * =========================================================================
   */

  it("should reject an ADJUSTMENT requested amount with more than two decimal places", async () => {
    const response = await request(app)
      .post(
        "/api/v1/advertisements/payments/financial-approval",
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      )
      .send({
        advertisementId: testAdvertisementId,
        clientId: testClientId,
        paymentId: testPaymentId,
        approvalType: "ADJUSTMENT",
        requestedAmount: 1000.123,
      });

    expect(response.status).toBe(400);

    expect(response.body.success).toBe(
      false,
    );
  });

  /*
   * =========================================================================
   * 21. CREATOR CANNOT APPROVE
   * =========================================================================
   */

  it("should reject an ADJUSTMENT approval by Ad Creator", async () => {
    const advertisementId =
      await createTemporaryAdvertisement(
        "creator-approve",
      );

    const approvalId =
      await createAdjustmentApproval(
        advertisementId,
        1250,
        undefined,
        "Creator authorization test.",
      );

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/approve`,
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      )
      .send({
        approvalRemarks:
          "Creator must not approve.",
      });

    expect(response.status).toBe(403);

    expect(response.body.success).toBe(
      false,
    );

    await deleteApproval(
      approvalId,
    );
  });

  /*
   * =========================================================================
   * 22. FINANCE REJECTION
   * =========================================================================
   */

  it("should allow Finance to reject an ADJUSTMENT approval", async () => {
    const advertisementId =
      await createTemporaryAdvertisement(
        "finance-reject",
      );

    const approvalId =
      await createAdjustmentApproval(
        advertisementId,
        1500,
        undefined,
        "Adjustment rejection workflow test.",
      );

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${approvalId}/reject`,
      )
      .set(
        "Authorization",
        `Bearer ${financeAccessToken}`,
      )
      .send({
        rejectionReason:
          "Adjustment requires a revised financial basis.",
      });

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(
      true,
    );

    expect(
      response.body.data.status,
    ).toBe("REJECTED");

    expect(
      Number(response.body.data.id),
    ).toBe(approvalId);

    expect(
      response.body.data.rejectionReason,
    ).toBe(
      "Adjustment requires a revised financial basis.",
    );

    expect(
      Number(
        response.body.data.reviewedBy,
      ),
    ).toBe(financeUserId);

    await deleteApproval(
      approvalId,
    );
  });

  /*
   * =========================================================================
   * 23. CREATOR RESUBMISSION
   * =========================================================================
   */

  it("should allow Ad Creator to resubmit a rejected ADJUSTMENT approval", async () => {
    const advertisementId =
      await createTemporaryAdvertisement(
        "resubmit",
      );

    const createResponse =
      await request(app)
        .post(
          "/api/v1/advertisements/payments/financial-approval",
        )
        .set(
          "Authorization",
          `Bearer ${creatorAccessToken}`,
        )
        .send({
          advertisementId,
          clientId: testClientId,
          approvalType: "ADJUSTMENT",
          requestedAmount: 1750,
          approvalRemarks:
            "Original adjustment submission.",
        });

    expect(
      createResponse.status,
      `Adjustment approval creation failed: ${JSON.stringify(
        createResponse.body,
      )}`,
    ).toBe(201);

    expect(
      createResponse.body.success,
    ).toBe(true);

    const approvalId = Number(
      createResponse.body.data.id,
    );

    expect(approvalId).toBeGreaterThan(
      0,
    );

    validationApprovalIds.push(
      approvalId,
    );

    const rejectResponse =
      await request(app)
        .post(
          `/api/v1/advertisements/payments/financial-approval/${approvalId}/reject`,
        )
        .set(
          "Authorization",
          `Bearer ${financeAccessToken}`,
        )
        .send({
          rejectionReason:
            "Please revise the adjustment request.",
        });

    expect(
      rejectResponse.status,
    ).toBe(200);

    expect(
      rejectResponse.body.data.status,
    ).toBe("REJECTED");

    const resubmitResponse =
      await request(app)
        .post(
          `/api/v1/advertisements/payments/financial-approval/${approvalId}/resubmit`,
        )
        .set(
          "Authorization",
          `Bearer ${creatorAccessToken}`,
        )
        .send({
          approvalRemarks:
            "Revised adjustment request submitted for review.",
        });

    expect(
      resubmitResponse.status,
      `Adjustment resubmission failed: ${JSON.stringify(
        resubmitResponse.body,
      )}`,
    ).toBe(200);

    expect(
      resubmitResponse.body.success,
    ).toBe(true);

    expect(
      resubmitResponse.body.data.status,
    ).toBe("SUBMITTED");

    expect(
      Number(
        resubmitResponse.body.data.id,
      ),
    ).toBe(approvalId);

    expect(
      resubmitResponse.body.data.approvalRemarks,
    ).toBe(
      "Revised adjustment request submitted for review.",
    );

    expect(
      Number(
        resubmitResponse.body.data.requestedBy,
      ),
    ).toBe(creatorUserId);

    resubmitApprovalId = approvalId;
  });

  /*
   * =========================================================================
   * 24. FINANCE APPROVAL AFTER RESUBMISSION
   * =========================================================================
   */

  it("should allow Finance to approve a resubmitted ADJUSTMENT approval", async () => {
    expect(
      resubmitApprovalId,
    ).toBeGreaterThan(0);

    const response = await request(app)
      .post(
        `/api/v1/advertisements/payments/financial-approval/${resubmitApprovalId}/approve`,
      )
      .set(
        "Authorization",
        `Bearer ${financeAccessToken}`,
      )
      .send({
        approvalRemarks:
          "Revised adjustment approved by Finance.",
      });

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(
      true,
    );

    expect(
      response.body.data.status,
    ).toBe("APPROVED");

    expect(
      Number(response.body.data.id),
    ).toBe(resubmitApprovalId);

    expect(
      response.body.data.approvalRemarks,
    ).toBe(
      "Revised adjustment approved by Finance.",
    );

    expect(
      Number(
        response.body.data.reviewedBy,
      ),
    ).toBe(financeUserId);
  });

  /*
   * =========================================================================
   * 25. RESUBMISSION HISTORY
   * =========================================================================
   */

  it("should preserve ADJUSTMENT history through rejection and resubmission", async () => {
    expect(
      resubmitApprovalId,
    ).toBeGreaterThan(0);

    const response = await request(app)
      .get(
        `/api/v1/advertisements/payments/financial-approval/${resubmitApprovalId}/history`,
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      );

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(
      true,
    );

    expect(
      Array.isArray(response.body.data),
    ).toBe(true);

    expect(
      response.body.data.length,
    ).toBeGreaterThanOrEqual(4);

    const history =
      response.body.data as Array<{
        fromStatus: string | null;
        toStatus: string;
      }>;

    expect(
      history.some(
        (item) =>
          item.fromStatus === null &&
          item.toStatus === "SUBMITTED",
      ),
    ).toBe(true);

    expect(
      history.some(
        (item) =>
          item.fromStatus === "SUBMITTED" &&
          item.toStatus === "REJECTED",
      ),
    ).toBe(true);

    expect(
      history.some(
        (item) =>
          item.fromStatus === "REJECTED" &&
          item.toStatus === "SUBMITTED",
      ),
    ).toBe(true);

    expect(
      history.some(
        (item) =>
          item.fromStatus === "SUBMITTED" &&
          item.toStatus === "APPROVED",
      ),
    ).toBe(true);
  });

  /*
   * =========================================================================
   * 26. UNAUTHENTICATED ACCESS
   * =========================================================================
   */

  it("should reject an unauthenticated ADJUSTMENT approval request", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/payments/financial-approval/${createdApprovalId}`,
    );

    expect(response.status).toBe(401);

    expect(response.body.success).toBe(
      false,
    );
  });

  /*
   * =========================================================================
   * 27. MISSING APPROVAL
   * =========================================================================
   */

  it("should return 404 for a missing financial approval", async () => {
    const response = await request(app)
      .get(
        "/api/v1/advertisements/payments/financial-approval/999999999",
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`,
      );

    expect(response.status).toBe(404);

    expect(response.body.success).toBe(
      false,
    );
  });
});