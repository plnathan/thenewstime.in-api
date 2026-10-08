import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Pricing E2E Integration", () => {
  let creatorAccessToken = "";
  let creatorUserId = 0;
  let creatorRoleId = 0;

  let clientId = 0;
  let placementId = 0;
  let rateCardId = 0;
  let advertisementId = 0;
  let pricingSnapshotId = 0;

  const E2E_HOOK_TIMEOUT = 30_000;

  const createdPermissionIds: number[] = [];

  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const creatorUsername = `pricing-e2e-creator-${uniqueSuffix}`;
  const creatorPassword = "PricingE2E@12345";
  const creatorFullName = `Pricing E2E Creator ${uniqueSuffix}`;
  const creatorDisplayName = `Pricing E2E Creator ${uniqueSuffix}`;

  /*
   * Actual roles schema:
   *
   *   code
   *   display_name
   *
   * code is VARCHAR(50), therefore keep the unique role code short.
   */
  const creatorRoleCode = `PRC-E2E-${uniqueSuffix}`;
  const creatorRoleDisplayName = `Pricing E2E Creator ${uniqueSuffix}`;

  const clientCode = `PRC-E2E-${uniqueSuffix}`;
  const clientName = `Pricing E2E Client ${uniqueSuffix}`;

  const placementCode = `PRC-E2E-PLACEMENT-${uniqueSuffix}`;
  const placementName = `Pricing E2E Placement ${uniqueSuffix}`;

  const advertisementInternalName = `pricing-e2e-ad-${uniqueSuffix}`;
  const advertisementName = `Pricing E2E Advertisement ${uniqueSuffix}`;

  const rateEffectiveFrom = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rateEffectiveTo = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  );

  const initialRateAmount = 5000;
  const changedRateAmount = 7500;

  const pricingQuantity = 9;

  const expectedStandardAmount =
    initialRateAmount * pricingQuantity;

  const initialAgreedAmount = 45000;

  const changedRateCardCurrency = "USD";

  /*
   * --------------------------------------------------------------------------
   * Production permission codes
   * --------------------------------------------------------------------------
   */

  const permissionDefinitions = [
    {
      code: "advertisements.read",
      displayName: "Read advertisements",
      module: "ADVERTISEMENT",
      resource: "advertisements",
      action: "read"
    },
    {
      code: "advertisements.create",
      displayName: "Create advertisements",
      module: "ADVERTISEMENT",
      resource: "advertisements",
      action: "create"
    },
    {
      code: "advertisements.update",
      displayName: "Update advertisements",
      module: "ADVERTISEMENT",
      resource: "advertisements",
      action: "update"
    },
    {
      code: "advertisements.placements.read",
      displayName: "Read advertisement placements",
      module: "ADVERTISEMENT",
      resource: "advertisements.placements",
      action: "read"
    },
    {
      code: "advertisements.placements.create",
      displayName: "Create advertisement placements",
      module: "ADVERTISEMENT",
      resource: "advertisements.placements",
      action: "create"
    },
    {
      code: "advertisements.rate_cards.read",
      displayName: "Read advertisement rate cards",
      module: "ADVERTISEMENT",
      resource: "advertisements.rate_cards",
      action: "read"
    },
    {
      code: "advertisements.rate_cards.create",
      displayName: "Create advertisement rate cards",
      module: "ADVERTISEMENT",
      resource: "advertisements.rate_cards",
      action: "create"
    },
    {
      code: "advertisements.pricing_snapshots.read",
      displayName: "Read advertisement pricing snapshots",
      module: "ADVERTISEMENT",
      resource: "advertisements.pricing_snapshots",
      action: "read"
    },
    {
      code: "advertisements.pricing_snapshots.create",
      displayName: "Create advertisement pricing snapshots",
      module: "ADVERTISEMENT",
      resource: "advertisements.pricing_snapshots",
      action: "create"
    }
  ] as const;

  const permissionIds: number[] = [];

  /*
   * --------------------------------------------------------------------------
   * Response helpers
   * --------------------------------------------------------------------------
   */

  const getResponseBody = (
    response: request.Response
  ): Record<string, unknown> => {
    return response.body as Record<string, unknown>;
  };

  const getData = <T>(response: request.Response): T => {
    const body = getResponseBody(response);

    return body.data as T;
  };

  const getErrorMessage = (
    response: request.Response
  ): string => {
    const body = getResponseBody(response);

    if (typeof body.message === "string") {
      return body.message;
    }

    if (Array.isArray(body.errors)) {
      return body.errors
        .map((error) => {
          if (
            typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof error.message === "string"
          ) {
            return error.message;
          }

          return String(error);
        })
        .join("; ");
    }

    return JSON.stringify(body);
  };

  /*
   * --------------------------------------------------------------------------
   * Permission fixture
   * --------------------------------------------------------------------------
   */

  const createPermissionIfNeeded = async (
    code: string,
    displayName: string,
    module: string,
    resource: string,
    action: string
  ): Promise<number> => {
    const existingResult = await pool.query<{
      id: number | string;
    }>(
      `
      SELECT id
      FROM permissions
      WHERE code = $1
      LIMIT 1
      `,
      [code]
    );

    const existing = existingResult.rows[0];

    if (existing) {
      return Number(existing.id);
    }

    const result = await pool.query<{
      id: number | string;
    }>(
      `
      INSERT INTO permissions (
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
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        0,
        false,
        'ACTIVE',
        NULL,
        NULL
      )
      RETURNING id
      `,
      [
        code,
        displayName,
        `Pricing E2E permission: ${code}`,
        module,
        resource,
        action
      ]
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        `Permission was not created: ${code}`
      );
    }

    const permissionId = Number(row.id);

    createdPermissionIds.push(permissionId);

    return permissionId;
  };

  /*
   * --------------------------------------------------------------------------
   * Role creation
   * --------------------------------------------------------------------------
   */

  const createRole = async (): Promise<number> => {
    permissionIds.length = 0;

    for (const permission of permissionDefinitions) {
      const permissionId =
        await createPermissionIfNeeded(
          permission.code,
          permission.displayName,
          permission.module,
          permission.resource,
          permission.action
        );

      permissionIds.push(permissionId);
    }

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
        is_system_role,
        created_by,
        updated_by
      )
      VALUES (
        $1,
        $2,
        $3,
        0,
        'ACTIVE',
        false,
        NULL,
        NULL
      )
      RETURNING id
      `,
      [
        creatorRoleCode,
        creatorRoleDisplayName,
        "Temporary role for advertisement pricing E2E testing."
      ]
    );

    const roleRow = roleResult.rows[0];

    if (!roleRow) {
      throw new Error(
        "Pricing E2E creator role was not created."
      );
    }

    creatorRoleId = Number(roleRow.id);

    expect(creatorRoleId).toBeGreaterThan(0);

    for (const permissionId of permissionIds) {
      await pool.query(
        `
        INSERT INTO role_permissions (
          role_id,
          permission_id
        )
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [creatorRoleId, permissionId]
      );
    }

    return creatorRoleId;
  };

  /*
   * --------------------------------------------------------------------------
   * Creator user
   * --------------------------------------------------------------------------
   */

  const createCreatorUser = async (): Promise<void> => {
    const passwordHash =
      await bcrypt.hash(creatorPassword, 10);

    const userResult = await pool.query<{
      id: number | string;
    }>(
      `
      INSERT INTO users (
        username,
        password_hash,
        full_name,
        display_name,
        email,
        status,
        created_by,
        updated_by
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        'ACTIVE',
        1,
        1
      )
      RETURNING id
      `,
      [
        creatorUsername,
        passwordHash,
        creatorFullName,
        creatorDisplayName,
        `pricing-e2e-${uniqueSuffix}@example.com`
      ]
    );

    const userRow = userResult.rows[0];

    if (!userRow) {
      throw new Error(
        "Pricing E2E creator user was not created."
      );
    }

    creatorUserId = Number(userRow.id);

    expect(creatorUserId).toBeGreaterThan(0);

    await pool.query(
      `
      INSERT INTO user_roles (
        user_id,
        role_id
      )
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [creatorUserId, creatorRoleId]
    );
  };

  /*
   * --------------------------------------------------------------------------
   * Authentication
   * --------------------------------------------------------------------------
   */

  const extractAccessToken = (
    response: request.Response
  ): string | undefined => {
    const body = getResponseBody(response);

    const data =
      typeof body.data === "object" &&
      body.data !== null
        ? (body.data as Record<string, unknown>)
        : undefined;

    const nestedTokens =
      data &&
      typeof data.tokens === "object" &&
      data.tokens !== null
        ? (data.tokens as Record<string, unknown>)
        : undefined;

    const candidates: unknown[] = [
      data?.accessToken,
      data?.access_token,
      data?.token,
      nestedTokens?.accessToken,
      nestedTokens?.access_token,
      nestedTokens?.token,
      body.accessToken,
      body.access_token,
      body.token
    ];

    const token = candidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" &&
        candidate.trim().length > 0
    );

    return token;
  };

  const login = async (): Promise<string> => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: creatorUsername,
        password: creatorPassword
      });

    expect(
      response.status,
      `Pricing E2E login failed: ${getErrorMessage(response)}`
    ).toBe(200);

    const accessToken =
      extractAccessToken(response);

    expect(
      accessToken,
      `Pricing E2E login response did not contain an access token. Response: ${JSON.stringify(
        getResponseBody(response)
      )}`
    ).toBeTruthy();

    return accessToken ?? "";
  };

  /*
   * --------------------------------------------------------------------------
   * Advertisement Client fixture
   * --------------------------------------------------------------------------
   *
   * Client is created directly in the database because the pricing E2E flow
   * only requires the client as a prerequisite for advertisement creation.
   */

  const createClient = async (): Promise<number> => {
    const result = await pool.query<{
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
        updated_by
      )
      VALUES (
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
        clientCode,
        clientName,
        clientName,
        creatorUserId
      ]
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        "Pricing E2E advertisement client was not created."
      );
    }

    const id = Number(row.id);

    expect(id).toBeGreaterThan(0);

    return id;
  };

  /*
   * --------------------------------------------------------------------------
   * Placement
   * --------------------------------------------------------------------------
   */

  const createPlacement = async (): Promise<number> => {
    const response = await request(app)
      .post("/api/v1/advertisements/placements")
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`
      )
      .send({
        code: placementCode,
        displayName: placementName,
        description: "Pricing E2E placement",
        pageType: "NEWS_DETAIL",
        placementType: "NEWS_DETAIL_TOP",
        insertionType: "FIXED",
        displayOrder: 1,
        isEnabled: true,
        collapseWhenEmpty: true,
        fallbackBehavior: "HIDE",
        displayFrequency: null,
        frequencyValue: null,
        autoCloseEnabled: false,
        autoCloseSeconds: null,
        closeButtonEnabled: true,
        closeOnOverlayClick: true,
        status: "ACTIVE"
      });

    expect(
      response.status,
      `Placement creation failed: ${getErrorMessage(response)}`
    ).toBe(201);

    const data = getData<{
      id: number | string;
    }>(response);

    expect(data.id).toBeDefined();

    const id = Number(data.id);

    expect(id).toBeGreaterThan(0);

    return id;
  };

  /*
   * --------------------------------------------------------------------------
   * Rate card
   * --------------------------------------------------------------------------
   */

  const createRateCard = async (
    targetPlacementId: number,
    amount: number,
    currencyCode = "INR"
  ): Promise<number> => {
    const response = await request(app)
      .post("/api/v1/advertisements/rate-cards")
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`
      )
      .send({
        placementId: targetPlacementId,
        pricingUnit: "DAY",
        rateAmount: amount,
        currencyCode,
        effectiveFrom:
          rateEffectiveFrom.toISOString(),
        effectiveTo:
          rateEffectiveTo.toISOString(),
        status: "ACTIVE",
        notes: "Pricing E2E rate card."
      });

    expect(
      response.status,
      `Rate card creation failed: ${getErrorMessage(response)}`
    ).toBe(201);

    const data = getData<{
      id: number | string;
    }>(response);

    expect(data.id).toBeDefined();

    return Number(data.id);
  };

  /*
   * --------------------------------------------------------------------------
   * Advertisement
   * --------------------------------------------------------------------------
   */

  const createAdvertisement = async (): Promise<number> => {
    const response = await request(app)
      .post("/api/v1/advertisements")
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`
      )
      .send({
        clientId,
        name: advertisementName,
        internalName: advertisementInternalName,
        advertisementType: "DISPLAY",
        destinationUrl:
          "https://example.com/pricing-e2e",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes: "Pricing E2E regression advertisement.",
        currencyCode: "INR",
        pricing: {
          placementId,
          pricingUnit: "DAY",
          quantity: pricingQuantity
        }
      });

    expect(
      response.status,
      `Advertisement creation failed: ${getErrorMessage(response)}`
    ).toBe(201);

    const data = getData<{
      id: number | string;
      standardAmount?: number | string | null;
      pricingPlacementId?:
        | number
        | string
        | null;
      pricingUnit?: string | null;
      pricingQuantity?:
        | number
        | string
        | null;
      advertisementAmount?:
        | number
        | string
        | null;
      currencyCode?: string | null;
    }>(response);

    expect(data.id).toBeDefined();

    /*
     * IMPORTANT:
     *
     * Capture the advertisement ID immediately after successful creation.
     *
     * If a later assertion fails, afterAll() can still remove the
     * advertisement before attempting to remove its placement.
     */
    advertisementId = Number(data.id);

    expect(advertisementId).toBeGreaterThan(0);

    expect(
      Number(data.pricingPlacementId)
    ).toBe(placementId);

    expect(data.pricingUnit).toBe("DAY");

    expect(
      Number(data.pricingQuantity)
    ).toBe(pricingQuantity);

    expect(
      Number(data.standardAmount)
    ).toBe(expectedStandardAmount);

    expect(
      data.advertisementAmount ?? null
    ).toBeNull();

    expect(data.currencyCode).toBe("INR");

    return advertisementId;
  };

  /*
   * --------------------------------------------------------------------------
   * Pricing snapshot
   * --------------------------------------------------------------------------
   */

  const createPricingSnapshot = async (
    targetRateCardId: number
  ): Promise<number> => {
    const response = await request(app)
      .post(
        "/api/v1/advertisements/pricing-snapshots"
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`
      )
      .send({
        advertisementId,
        placementId,
        rateCardId: targetRateCardId
      });

    expect(
      response.status,
      `Pricing snapshot creation failed: ${getErrorMessage(response)}`
    ).toBe(201);

    const data = getData<{
      id: number | string;
      advertisementId: number | string;
      placementId: number | string;
      rateCardId: number | string;
      pricingUnit: string;
      rateAmount: number | string;
      currencyCode: string;
      quantity: number | string;
      standardAmount: number | string;
    }>(response);

    expect(Number(data.id)).toBeGreaterThan(0);

    expect(
      Number(data.advertisementId)
    ).toBe(advertisementId);

    expect(
      Number(data.placementId)
    ).toBe(placementId);

    expect(
      Number(data.rateCardId)
    ).toBe(targetRateCardId);

    return Number(data.id);
  };

  const getPricingSnapshot = async (
    snapshotId: number
  ) => {
    const response = await request(app)
      .get(
        `/api/v1/advertisements/pricing-snapshots/${snapshotId}`
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`
      );

    expect(
      response.status,
      `Pricing snapshot retrieval failed: ${getErrorMessage(response)}`
    ).toBe(200);

    return getData<{
      id: number | string;
      advertisementId: number | string;
      placementId: number | string;
      rateCardId: number | string;
      pricingUnit: string;
      rateAmount: number | string;
      currencyCode: string;
      quantity: number | string;
      standardAmount: number | string;
    }>(response);
  };

  /*
   * --------------------------------------------------------------------------
   * Advertisement Amount
   * --------------------------------------------------------------------------
   *
   * The API exposes the final negotiated/commercial amount as
   * `advertisementAmount`.
   *
   * The database column remains `agreed_amount`.
   *
   * This is deliberately separate from `standardAmount`, which is
   * system-derived from the rate card and pricing quantity.
   */

  const updateAdvertisementAmount = async (
    amount: number
  ): Promise<void> => {
    const response = await request(app)
      .patch(
        `/api/v1/advertisements/${advertisementId}`
      )
      .set(
        "Authorization",
        `Bearer ${creatorAccessToken}`
      )
      .send({
        advertisementAmount: amount,
        currencyCode: "INR"
      });

    expect(
      response.status,
      `Advertisement amount update failed: ${getErrorMessage(response)}`
    ).toBe(200);

    const data = getData<{
      id: number | string;
      standardAmount?:
        | number
        | string
        | null;
      advertisementAmount?:
        | number
        | string
        | null;
      currencyCode?: string | null;
    }>(response);

    expect(Number(data.id)).toBe(advertisementId);

    /*
     * Updating the negotiated amount must never change the
     * system-derived standard amount.
     */
    expect(
      Number(data.standardAmount)
    ).toBe(expectedStandardAmount);

    expect(
      Number(data.advertisementAmount)
    ).toBe(amount);

    expect(data.currencyCode).toBe("INR");
  };

  /*
   * --------------------------------------------------------------------------
   * Setup
   * --------------------------------------------------------------------------
   */

  beforeAll(async () => {
    await createRole();

    await createCreatorUser();

    creatorAccessToken = await login();

    clientId = await createClient();

    placementId = await createPlacement();

    rateCardId = await createRateCard(
      placementId,
      initialRateAmount,
      "INR"
    );

    advertisementId =
      await createAdvertisement();
  }, E2E_HOOK_TIMEOUT);

  beforeEach(() => {
    /*
     * The pricing flow is intentionally sequential.
     *
     * Individual tests depend on the advertisement, rate card and snapshots
     * created by beforeAll().
     *
     * No database reset is performed here.
     */
  });

  /*
   * --------------------------------------------------------------------------
   * Cleanup
   * --------------------------------------------------------------------------
   */

  afterAll(async () => {
    try {
      /*
       * ========================================================
       * Recover advertisement ID if beforeAll() failed after
       * the API created the advertisement but before the local
       * advertisementId variable was assigned.
       * ========================================================
       */

      if (
        advertisementId <= 0 &&
        clientId > 0
      ) {
        try {
          const advertisementResult =
            await pool.query<{
              id: number | string;
            }>(
              `
              SELECT id
              FROM advertisements
              WHERE
                client_id = $1
                AND internal_name = $2
              ORDER BY id DESC
              LIMIT 1
              `,
              [
                clientId,
                advertisementInternalName
              ]
            );

          const advertisementRow =
            advertisementResult.rows[0];

          if (advertisementRow) {
            advertisementId =
              Number(advertisementRow.id);
          }
        } catch {
          /*
           * Cleanup must continue even if fixture recovery fails.
           */
        }
      }

      /*
       * ========================================================
       * Recover placement ID if required.
       * ========================================================
       */

      if (placementId <= 0) {
        try {
          const placementResult =
            await pool.query<{
              id: number | string;
            }>(
              `
              SELECT id
              FROM advertisement_placements
              WHERE code = $1
              ORDER BY id DESC
              LIMIT 1
              `,
              [placementCode]
            );

          const placementRow =
            placementResult.rows[0];

          if (placementRow) {
            placementId =
              Number(placementRow.id);
          }
        } catch {
          /*
           * Cleanup must continue.
           */
        }
      }

      /*
       * ========================================================
       * Recover rate card ID if required.
       * ========================================================
       */

      if (
        rateCardId <= 0 &&
        placementId > 0
      ) {
        try {
          const rateCardResult =
            await pool.query<{
              id: number | string;
            }>(
              `
              SELECT id
              FROM advertisement_rate_cards
              WHERE placement_id = $1
              ORDER BY id DESC
              LIMIT 1
              `,
              [placementId]
            );

          const rateCardRow =
            rateCardResult.rows[0];

          if (rateCardRow) {
            rateCardId =
              Number(rateCardRow.id);
          }
        } catch {
          /*
           * Cleanup must continue.
           */
        }
      }

      /*
       * ========================================================
       * PRICING SNAPSHOTS
       * ========================================================
       */

      if (advertisementId > 0) {
        try {
          await pool.query(
            `
            DELETE FROM advertisement_pricing_snapshots
            WHERE advertisement_id = $1
            `,
            [advertisementId]
          );
        } catch {
          /*
           * Cleanup must continue.
           */
        }
      }

      if (rateCardId > 0) {
        try {
          await pool.query(
            `
            DELETE FROM advertisement_pricing_snapshots
            WHERE rate_card_id = $1
            `,
            [rateCardId]
          );
        } catch {
          /*
           * Cleanup must continue.
           */
        }
      }

      if (placementId > 0) {
        try {
          await pool.query(
            `
            DELETE FROM advertisement_pricing_snapshots
            WHERE placement_id = $1
            `,
            [placementId]
          );
        } catch {
          /*
           * Cleanup must continue.
           */
        }
      }

      /*
       * ========================================================
       * ADVERTISEMENT
       * ========================================================
       *
       * This MUST happen before deleting the placement because
       * advertisement pricing uses ON DELETE RESTRICT for the
       * placement foreign key.
       */

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
          /*
           * Cleanup must continue.
           */
        }
      }

      /*
       * ========================================================
       * RATE CARD
       * ========================================================
       */

      if (rateCardId > 0) {
        try {
          await pool.query(
            `
            DELETE FROM advertisement_rate_cards
            WHERE id = $1
            `,
            [rateCardId]
          );
        } catch {
          /*
           * Cleanup must continue.
           */
        }
      }

      /*
       * ========================================================
       * PLACEMENT
       * ========================================================
       */

      if (placementId > 0) {
        try {
          await pool.query(
            `
            DELETE FROM advertisement_placements
            WHERE id = $1
            `,
            [placementId]
          );
        } catch {
          /*
           * Cleanup must continue.
           */
        }
      }

      /*
       * ========================================================
       * CLIENT
       * ========================================================
       */

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
          /*
           * Cleanup must continue.
           */
        }
      }

      /*
       * ========================================================
       * USER SESSIONS
       * ========================================================
       */

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
          /*
           * user_sessions may not exist in every test database
           * version.
           */
        }
      }

      /*
       * ========================================================
       * USER ROLE
       * ========================================================
       */

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
          /*
           * Cleanup must continue.
           */
        }
      }

      /*
       * ========================================================
       * ROLE PERMISSIONS
       * ========================================================
       */

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
          /*
           * Cleanup must continue.
           */
        }
      }

      /*
       * ========================================================
       * USER
       * ========================================================
       */

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
          /*
           * Cleanup must continue.
           */
        }
      }

      /*
       * ========================================================
       * ROLE
       * ========================================================
       */

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
          /*
           * Cleanup must continue.
           */
        }
      }

      /*
       * ========================================================
       * TEST-CREATED PERMISSIONS
       * ========================================================
       *
       * Existing production permissions are never deleted.
       */

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
          /*
           * Cleanup must continue.
           */
        }
      }
    } finally {
      await pool.end();
    }
  });

  /*
   * ==========================================================================
   * AUTHENTICATION
   * ==========================================================================
   */

  it(
    "should have a valid pricing E2E creator authentication token",
    () => {
      expect(creatorAccessToken).toBeTruthy();
    }
  );

  /*
   * ==========================================================================
   * RATE CARD
   * ==========================================================================
   */

  it(
    "should create an active rate card for the pricing E2E scenario",
    async () => {
      const result = await pool.query<{
        id: number | string;
        placement_id: number | string;
        pricing_unit: string;
        rate_amount: string | number;
        currency_code: string;
        status: string;
      }>(
        `
        SELECT
          id,
          placement_id,
          pricing_unit,
          rate_amount,
          currency_code,
          status
        FROM advertisement_rate_cards
        WHERE id = $1
        LIMIT 1
        `,
        [rateCardId]
      );

      const row = result.rows[0];

      expect(row).toBeDefined();

      expect(Number(row?.id)).toBe(rateCardId);

      expect(
        Number(row?.placement_id)
      ).toBe(placementId);

      expect(row?.pricing_unit).toBe("DAY");

      expect(
        Number(row?.rate_amount)
      ).toBe(initialRateAmount);

      expect(row?.currency_code).toBe("INR");

      expect(row?.status).toBe("ACTIVE");
    }
  );

  /*
   * ==========================================================================
   * ADVERTISEMENT
   * ==========================================================================
   */

  it(
    "should create the advertisement used by the pricing E2E flow",
    async () => {
      const response = await request(app)
        .get(
          `/api/v1/advertisements/${advertisementId}`
        )
        .set(
          "Authorization",
          `Bearer ${creatorAccessToken}`
        );

      expect(
        response.status,
        `Advertisement retrieval failed: ${getErrorMessage(response)}`
      ).toBe(200);

      const data = getData<{
        id: number | string;
        pricingPlacementId?:
          | number
          | string
          | null;
        pricingUnit?: string | null;
        pricingQuantity?:
          | number
          | string
          | null;
        standardAmount?:
          | number
          | string
          | null;
        advertisementAmount?:
          | number
          | string
          | null;
        currencyCode?: string | null;
      }>(response);

      expect(Number(data.id)).toBe(
        advertisementId
      );

      expect(
        Number(data.pricingPlacementId)
      ).toBe(placementId);

      expect(data.pricingUnit).toBe("DAY");

      expect(
        Number(data.pricingQuantity)
      ).toBe(pricingQuantity);

      expect(
        Number(data.standardAmount)
      ).toBe(expectedStandardAmount);

      expect(
        data.advertisementAmount ?? null
      ).toBeNull();

      expect(data.currencyCode).toBe("INR");
    }
  );

  /*
   * ==========================================================================
   * PRICING SNAPSHOT
   * ==========================================================================
   */

  it(
    "should create a pricing snapshot from the active rate card",
    async () => {
      pricingSnapshotId =
        await createPricingSnapshot(
          rateCardId
        );

      expect(
        pricingSnapshotId
      ).toBeGreaterThan(0);
    }
  );

  it(
    "should preserve the rate-card pricing inside the snapshot",
    async () => {
      expect(
        pricingSnapshotId
      ).toBeGreaterThan(0);

      const snapshot =
        await getPricingSnapshot(
          pricingSnapshotId
        );

      expect(
        Number(snapshot.id)
      ).toBe(pricingSnapshotId);

      expect(
        Number(snapshot.advertisementId)
      ).toBe(advertisementId);

      expect(
        Number(snapshot.placementId)
      ).toBe(placementId);

      expect(
        Number(snapshot.rateCardId)
      ).toBe(rateCardId);

      expect(
        snapshot.pricingUnit
      ).toBe("DAY");

      expect(
        Number(snapshot.rateAmount)
      ).toBe(initialRateAmount);

      expect(
        snapshot.currencyCode
      ).toBe("INR");

      expect(
        Number(snapshot.quantity)
      ).toBe(pricingQuantity);

      expect(
        Number(snapshot.standardAmount)
      ).toBe(expectedStandardAmount);
    }
  );

  /*
   * ==========================================================================
   * STANDARD AMOUNT
   * ==========================================================================
   */

  it(
    "should calculate the standard amount from the advertisement pricing",
    async () => {
      const response = await request(app)
        .get(
          `/api/v1/advertisements/${advertisementId}`
        )
        .set(
          "Authorization",
          `Bearer ${creatorAccessToken}`
        );

      expect(
        response.status,
        `Advertisement pricing retrieval failed: ${getErrorMessage(response)}`
      ).toBe(200);

      const data = getData<{
        id: number | string;
        standardAmount?:
          | number
          | string
          | null;
        pricingPlacementId?:
          | number
          | string
          | null;
        pricingUnit?: string | null;
        pricingQuantity?:
          | number
          | string
          | null;
      }>(response);

      expect(Number(data.id)).toBe(
        advertisementId
      );

      expect(
        Number(data.pricingPlacementId)
      ).toBe(placementId);

      expect(data.pricingUnit).toBe("DAY");

      expect(
        Number(data.pricingQuantity)
      ).toBe(pricingQuantity);

      expect(
        Number(data.standardAmount)
      ).toBe(expectedStandardAmount);
    }
  );

  /*
   * ==========================================================================
   * ADVERTISEMENT AMOUNT
   * ==========================================================================
   */

  it(
    "should keep advertisement amount separate from the standard rate-card amount",
    async () => {
      await updateAdvertisementAmount(
        initialAgreedAmount
      );

      const response = await request(app)
        .get(
          `/api/v1/advertisements/${advertisementId}`
        )
        .set(
          "Authorization",
          `Bearer ${creatorAccessToken}`
        );

      expect(
        response.status,
        `Advertisement retrieval after advertisement amount update failed: ${getErrorMessage(
          response
        )}`
      ).toBe(200);

      const data = getData<{
        id: number | string;
        standardAmount?:
          | number
          | string
          | null;
        advertisementAmount?:
          | number
          | string
          | null;
        currencyCode?: string | null;
      }>(response);

      expect(Number(data.id)).toBe(
        advertisementId
      );

      expect(
        Number(data.standardAmount)
      ).toBe(expectedStandardAmount);

      expect(
        Number(data.advertisementAmount)
      ).toBe(initialAgreedAmount);

      expect(data.currencyCode).toBe("INR");

      expect(
        Number(data.advertisementAmount)
      ).not.toBe(
        expectedStandardAmount + 1
      );
    }
  );

  /*
   * ==========================================================================
   * RATE HISTORY / SNAPSHOT IMMUTABILITY
   * ==========================================================================
   */

  it(
    "should preserve the original snapshot after the rate card is changed",
    async () => {
      expect(
        pricingSnapshotId
      ).toBeGreaterThan(0);

      const beforeChange =
        await getPricingSnapshot(
          pricingSnapshotId
        );

      expect(
        Number(beforeChange.rateAmount)
      ).toBe(initialRateAmount);

      expect(
        beforeChange.currencyCode
      ).toBe("INR");

      expect(
        Number(beforeChange.standardAmount)
      ).toBe(expectedStandardAmount);

      await pool.query(
        `
        UPDATE advertisement_rate_cards
        SET
          rate_amount = $2,
          currency_code = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [
          rateCardId,
          changedRateAmount,
          changedRateCardCurrency
        ]
      );

      const afterChange =
        await getPricingSnapshot(
          pricingSnapshotId
        );

      expect(
        Number(afterChange.rateAmount)
      ).toBe(initialRateAmount);

      expect(
        afterChange.currencyCode
      ).toBe("INR");

      expect(
        Number(afterChange.quantity)
      ).toBe(pricingQuantity);

      expect(
        Number(afterChange.standardAmount)
      ).toBe(expectedStandardAmount);
    }
  );

  it(
    "should create a new snapshot using the updated rate card pricing",
    async () => {
      const newSnapshotId =
        await createPricingSnapshot(
          rateCardId
        );

      expect(
        newSnapshotId
      ).toBeGreaterThan(0);

      const latestResponse =
        await request(app)
          .get(
            `/api/v1/advertisements/pricing-snapshots/advertisement/${advertisementId}/latest`
          )
          .set(
            "Authorization",
            `Bearer ${creatorAccessToken}`
          );

      expect(
        latestResponse.status,
        `Latest pricing snapshot retrieval failed: ${getErrorMessage(
          latestResponse
        )}`
      ).toBe(200);

      const latest = getData<{
        id: number | string;
        advertisementId: number | string;
        placementId: number | string;
        rateCardId: number | string;
        pricingUnit: string;
        rateAmount: number | string;
        currencyCode: string;
        quantity: number | string;
        standardAmount: number | string;
      }>(latestResponse);

      expect(Number(latest.id)).toBe(
        newSnapshotId
      );

      expect(
        Number(latest.advertisementId)
      ).toBe(advertisementId);

      expect(
        Number(latest.placementId)
      ).toBe(placementId);

      expect(
        Number(latest.rateCardId)
      ).toBe(rateCardId);

      expect(
        latest.pricingUnit
      ).toBe("DAY");

      expect(
        Number(latest.rateAmount)
      ).toBe(changedRateAmount);

      expect(
        latest.currencyCode
      ).toBe(changedRateCardCurrency);

      expect(
        Number(latest.quantity)
      ).toBe(pricingQuantity);

      expect(
        Number(latest.standardAmount)
      ).toBe(
        changedRateAmount *
          pricingQuantity
      );
    }
  );

  /*
   * ==========================================================================
   * WRONG PLACEMENT RATE CARD
   * ==========================================================================
   */

  it(
    "should not allow a rate card from another placement to be used for the advertisement placement",
    async () => {
      const anotherPlacementResponse =
        await request(app)
          .post(
            "/api/v1/advertisements/placements"
          )
          .set(
            "Authorization",
            `Bearer ${creatorAccessToken}`
          )
          .send({
            code: `PRC-E2E-OTHER-${uniqueSuffix}`,
            displayName: `Pricing E2E Other Placement ${uniqueSuffix}`,
            description:
              "Temporary placement for negative pricing E2E testing.",
            pageType: "NEWS_DETAIL",
            placementType:
              "NEWS_DETAIL_TOP",
            insertionType: "FIXED",
            displayOrder: 2,
            isEnabled: true,
            collapseWhenEmpty: true,
            fallbackBehavior: "HIDE",
            displayFrequency: null,
            frequencyValue: null,
            autoCloseEnabled: false,
            autoCloseSeconds: null,
            closeButtonEnabled: true,
            closeOnOverlayClick: true,
            status: "ACTIVE"
          });

      expect(
        anotherPlacementResponse.status,
        `Other placement creation failed: ${getErrorMessage(
          anotherPlacementResponse
        )}`
      ).toBe(201);

      const anotherPlacementData =
        getData<{
          id: number | string;
        }>(anotherPlacementResponse);

      const anotherPlacementId =
        Number(anotherPlacementData.id);

      expect(
        anotherPlacementId
      ).toBeGreaterThan(0);

      const anotherRateCardResponse =
        await request(app)
          .post(
            "/api/v1/advertisements/rate-cards"
          )
          .set(
            "Authorization",
            `Bearer ${creatorAccessToken}`
          )
          .send({
            placementId:
              anotherPlacementId,
            pricingUnit: "DAY",
            rateAmount: 9000,
            currencyCode: "INR",
            effectiveFrom:
              rateEffectiveFrom.toISOString(),
            effectiveTo:
              rateEffectiveTo.toISOString(),
            status: "ACTIVE",
            notes:
              "Temporary rate card for negative pricing E2E testing."
          });

      expect(
        anotherRateCardResponse.status,
        `Other rate card creation failed: ${getErrorMessage(
          anotherRateCardResponse
        )}`
      ).toBe(201);

      const anotherRateCardData =
        getData<{
          id: number | string;
        }>(anotherRateCardResponse);

      const anotherRateCardId =
        Number(anotherRateCardData.id);

      expect(
        anotherRateCardId
      ).toBeGreaterThan(0);

      try {
        const snapshotResponse =
          await request(app)
            .post(
              "/api/v1/advertisements/pricing-snapshots"
            )
            .set(
              "Authorization",
              `Bearer ${creatorAccessToken}`
            )
            .send({
              advertisementId,
              placementId,
              rateCardId:
                anotherRateCardId
            });

        expect(
          snapshotResponse.status
        ).toBe(400);

        expect(
          getErrorMessage(
            snapshotResponse
          )
        ).toContain(
          "rate card does not belong to the specified placement"
        );
      } finally {
        await pool.query(
          `
          DELETE FROM advertisement_pricing_snapshots
          WHERE rate_card_id = $1
          `,
          [anotherRateCardId]
        );

        await pool.query(
          `
          DELETE FROM advertisement_rate_cards
          WHERE id = $1
          `,
          [anotherRateCardId]
        );

        await pool.query(
          `
          DELETE FROM advertisement_placements
          WHERE id = $1
          `,
          [anotherPlacementId]
        );
      }
    }
  );

  /*
   * ==========================================================================
   * INACTIVE RATE CARD
   * ==========================================================================
   */

  it(
    "should reject an inactive rate card for a new pricing snapshot",
    async () => {
      await pool.query(
        `
        UPDATE advertisement_rate_cards
        SET
          status = 'INACTIVE',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [rateCardId]
      );

      try {
        const response =
          await request(app)
            .post(
              "/api/v1/advertisements/pricing-snapshots"
            )
            .set(
              "Authorization",
              `Bearer ${creatorAccessToken}`
            )
            .send({
              advertisementId,
              placementId,
              rateCardId
            });

        expect(
          response.status
        ).toBe(400);

        expect(
          getErrorMessage(response)
        ).toContain(
          "Only an active rate card can be used to create a pricing snapshot"
        );
      } finally {
        await pool.query(
          `
          UPDATE advertisement_rate_cards
          SET
            status = 'ACTIVE',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          `,
          [rateCardId]
        );
      }
    }
  );

  /*
   * ==========================================================================
   * SNAPSHOT HISTORY
   * ==========================================================================
   */

  it(
    "should expose both historical pricing snapshots for the advertisement",
    async () => {
      const response =
        await request(app)
          .get(
            `/api/v1/advertisements/pricing-snapshots/advertisement/${advertisementId}`
          )
          .set(
            "Authorization",
            `Bearer ${creatorAccessToken}`
          );

      expect(
        response.status,
        `Pricing snapshot history retrieval failed: ${getErrorMessage(response)}`
      ).toBe(200);

      const data = getData<
        Array<{
          id: number | string;
          advertisementId:
            number | string;
          placementId:
            number | string;
          rateCardId:
            number | string;
          pricingUnit: string;
          rateAmount:
            number | string;
          currencyCode: string;
          quantity:
            number | string;
          standardAmount:
            number | string;
        }>
      >(response);

      expect(
        Array.isArray(data)
      ).toBe(true);

      expect(
        data.length
      ).toBeGreaterThanOrEqual(2);

      const matchingSnapshots =
        data.filter(
          (snapshot) =>
            Number(
              snapshot.advertisementId
            ) === advertisementId
        );

      expect(
        matchingSnapshots.length
      ).toBeGreaterThanOrEqual(2);

      const rateAmounts =
        matchingSnapshots.map(
          (snapshot) =>
            Number(snapshot.rateAmount)
        );

      expect(rateAmounts).toContain(
        initialRateAmount
      );

      expect(rateAmounts).toContain(
        changedRateAmount
      );

      const currencies =
        matchingSnapshots.map(
          (snapshot) =>
            snapshot.currencyCode
        );

      expect(currencies).toContain(
        "INR"
      );

      expect(currencies).toContain(
        changedRateCardCurrency
      );
    }
  );

  /*
   * ==========================================================================
   * ADVERTISEMENT AMOUNT INDEPENDENCE
   * ==========================================================================
   */

  it(
    "should keep the advertisement amount independent from later rate-card changes",
    async () => {
      const advertisementResponse =
        await request(app)
          .get(
            `/api/v1/advertisements/${advertisementId}`
          )
          .set(
            "Authorization",
            `Bearer ${creatorAccessToken}`
          );

      expect(
        advertisementResponse.status,
        `Advertisement retrieval failed: ${getErrorMessage(
          advertisementResponse
        )}`
      ).toBe(200);

      const data = getData<{
        id: number | string;
        standardAmount?:
          | number
          | string
          | null;
        advertisementAmount?:
          | number
          | string
          | null;
        currencyCode?: string | null;
      }>(advertisementResponse);

      expect(Number(data.id)).toBe(
        advertisementId
      );

      /*
       * The advertisement pricing projection remains based on:
       *
       * INR 5,000 × 9 = INR 45,000
       *
       * The rate card itself has subsequently changed to:
       *
       * USD 7,500/day
       */

      expect(
        Number(data.standardAmount)
      ).toBe(expectedStandardAmount);

      expect(
        Number(data.advertisementAmount)
      ).toBe(initialAgreedAmount);

      expect(data.currencyCode).toBe(
        "INR"
      );

      /*
       * Confirm that the current rate card has changed.
       */

      const rateCardResult =
        await pool.query<{
          rate_amount: string | number;
          currency_code: string;
        }>(
          `
          SELECT
            rate_amount,
            currency_code
          FROM advertisement_rate_cards
          WHERE id = $1
          LIMIT 1
          `,
          [rateCardId]
        );

      const rateCardRow =
        rateCardResult.rows[0];

      expect(rateCardRow).toBeDefined();

      expect(
        Number(
          rateCardRow?.rate_amount
        )
      ).toBe(changedRateAmount);

      expect(
        rateCardRow?.currency_code
      ).toBe(changedRateCardCurrency);

      /*
       * Negotiated/commercial amount remains INR 45,000 even though
       * the current rate card is USD 7,500/day.
       */

      expect(
        Number(data.advertisementAmount)
      ).toBe(initialAgreedAmount);

      expect(
        Number(data.advertisementAmount)
      ).not.toBe(
        changedRateAmount *
          pricingQuantity
      );
    }
  );
});