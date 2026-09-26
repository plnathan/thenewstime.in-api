import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

import * as agreedAmountService from "../../agreed-amount/agreed-amount.service.js";
import * as pricingSnapshotService from "../../pricing-snapshots/pricing-snapshot.service.js";
import * as rateCardService from "../../rate-cards/rate-card.service.js";
import * as standardAmountService from "../../standard-amount/standard-amount.service.js";

describe("Advertisement Pricing Integration", () => {
  let accessToken = "";

  let testUserId = 0;
  let superAdminRoleId = 0;
  let testRoleId = 0;

  let testClientId = 0;
  let testAdvertisementId = 0;
  let testPlacementId = 0;

  let testRateCardId = 0;
  let testPricingSnapshotId = 0;

  const timestamp = Date.now();

  const testUsername = `advertisement_pricing_test_user_${timestamp}`;
  const testEmail = `advertisement-pricing-test-user-${timestamp}@example.com`;
  const testRoleCode = `TEST_AD_PRICING_ROLE_${timestamp}`;
  const testClientCode = `TEST-PRICING-${timestamp}`;

  const password = "Advertisement_Pricing_Test@123";

  const pricingQuantity = 10;
  const rateAmount = 2500;
  const expectedStandardAmount = 25000;

  const rateEffectiveFrom = new Date("2026-09-01T00:00:00.000Z");
  const rateEffectiveTo = new Date("2026-12-31T23:59:59.000Z");

  /*
   * ==========================================================================
   * TEST SETUP
   * ==========================================================================
   */

  beforeAll(async () => {
    /*
     * ------------------------------------------------------------------------
     * Find SUPER_ADMIN role.
     * ------------------------------------------------------------------------
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
     * ------------------------------------------------------------------------
     * Create temporary test user.
     * ------------------------------------------------------------------------
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
        "Advertisement Pricing Integration Test User",
        "Advertisement Pricing Test User",
        superAdminRoleId
      ]
    );

    testUserId = Number(userResult.rows[0].id);

    expect(testUserId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create temporary test role.
     * ------------------------------------------------------------------------
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
        `Advertisement Pricing Integration Role ${timestamp}`,
        "Temporary role for Advertisement Pricing integration tests.",
        testUserId
      ]
    );

    testRoleId = Number(roleResult.rows[0].id);

    expect(testRoleId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Replace SUPER_ADMIN role with the temporary test role.
     * ------------------------------------------------------------------------
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
     * ------------------------------------------------------------------------
     * Find required Advertisement permissions dynamically.
     * ------------------------------------------------------------------------
     */

    const permissionsResult = await pool.query(
      `
      SELECT
        id,
        resource,
        action
      FROM permissions
      WHERE
        LOWER(module) = LOWER('ADVERTISEMENT')
        AND status = 'ACTIVE'
        AND
        (
          (
            LOWER(resource) = LOWER('advertisements')
            AND LOWER(action) IN (
              LOWER('read'),
              LOWER('create'),
              LOWER('update')
            )
          )
          OR
          (
            LOWER(resource) = LOWER('advertisements.placements')
            AND LOWER(action) IN (
              LOWER('read'),
              LOWER('create'),
              LOWER('update')
            )
          )
        )
      ORDER BY id ASC
      `
    );

    const requiredPermissions = [
      {
        resource: "advertisements",
        action: "read"
      },
      {
        resource: "advertisements",
        action: "create"
      },
      {
        resource: "advertisements",
        action: "update"
      },
      {
        resource: "advertisements.placements",
        action: "read"
      },
      {
        resource: "advertisements.placements",
        action: "create"
      },
      {
        resource: "advertisements.placements",
        action: "update"
      }
    ];

    for (const requiredPermission of requiredPermissions) {
      const permission = permissionsResult.rows.find(
        (row) =>
          String(row.resource).toLowerCase() ===
            requiredPermission.resource.toLowerCase() &&
          String(row.action).toLowerCase() ===
            requiredPermission.action.toLowerCase()
      );

      expect(permission).toBeDefined();

      const permissionId = Number(permission?.id);

      expect(permissionId).toBeGreaterThan(0);

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
        [testRoleId, permissionId, testUserId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Create temporary Advertisement Client.
     * ------------------------------------------------------------------------
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
        `Advertisement Pricing Integration Client ${timestamp}`,
        `Pricing Integration Client ${timestamp}`,
        testUserId
      ]
    );

    testClientId = Number(clientResult.rows[0].id);

    expect(testClientId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Authenticate through the real Authentication API.
     * ------------------------------------------------------------------------
     */

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      username: testUsername,
      password
    });

    expect(loginResponse.status).toBe(200);

    accessToken = loginResponse.body.data.tokens.accessToken;

    expect(accessToken).toBeTruthy();

    /*
     * ------------------------------------------------------------------------
     * Create the placement fixture through the real Placement API.
     * ------------------------------------------------------------------------
     */

    const placementResponse = await request(app)
      .post("/api/v1/advertisements/placements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: `PRICING_TEST_HOME_TOP_${timestamp}`,
        displayName: `Pricing Test Home Top ${timestamp}`,
        description: "Temporary placement for Advertisement Pricing tests.",
        pageType: "HOME",
        placementType: "HOME_TOP",
        insertionType: "FIXED",
        displayOrder: 999,
        isEnabled: true,
        collapseWhenEmpty: true,
        fallbackBehavior: "HIDE",
        displayFrequency: "ONCE_PER_DAY",
        autoCloseEnabled: false,
        closeButtonEnabled: true,
        closeOnOverlayClick: true,
        status: "ACTIVE"
      });

    expect(placementResponse.status).toBe(201);
    expect(placementResponse.body.success).toBe(true);
    expect(placementResponse.body.data).toBeDefined();

    testPlacementId = Number(placementResponse.body.data.id);

    expect(testPlacementId).toBeGreaterThan(0);

    /*
     * ------------------------------------------------------------------------
     * Create the ACTIVE rate-card fixture BEFORE creating the advertisement.
     * ------------------------------------------------------------------------
     *
     * The current Advertisement service resolves the active rate card during
     * advertisement creation whenever pricing configuration is supplied.
     *
     * Therefore this fixture must exist before POST /advertisements.
     * ------------------------------------------------------------------------
     */

    const rateCard = await rateCardService.create(
      {
        placementId: testPlacementId,
        pricingUnit: "DAY",
        rateAmount,
        currencyCode: "inr",
        effectiveFrom: rateEffectiveFrom,
        effectiveTo: rateEffectiveTo,
        status: "ACTIVE"
      },
      testUserId
    );

    testRateCardId = rateCard.id;

    expect(testRateCardId).toBeGreaterThan(0);

    expect(rateCard).toMatchObject({
      id: testRateCardId,
      placementId: testPlacementId,
      pricingUnit: "DAY",
      rateAmount,
      currencyCode: "INR",
      status: "ACTIVE"
    });

    expect(rateCard.effectiveFrom).toEqual(rateEffectiveFrom);
    expect(rateCard.effectiveTo).toEqual(rateEffectiveTo);
    expect(rateCard.createdBy).toBe(testUserId);

    /*
     * ------------------------------------------------------------------------
     * Create the advertisement fixture through the real Advertisement API.
     * ------------------------------------------------------------------------
     *
     * The pricing configuration references the placement and pricing unit.
     * The Advertisement service resolves the active rate card created above
     * and derives the standard amount from:
     *
     *     rateAmount × quantity
     *
     * Therefore:
     *
     *     2,500 × 10 = 25,000 INR
     *
     * The agreed amount remains the separate negotiated commercial amount.
     * ------------------------------------------------------------------------
     */

    const advertisementResponse = await request(app)
      .post("/api/v1/advertisements")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        clientId: testClientId,
        name: `Pricing Integration Advertisement ${timestamp}`,
        internalName: `pricing-integration-ad-${timestamp}`,
        advertisementType: "DISPLAY",
        destinationUrl: "https://example.com/pricing-integration-test",
        priority: 10,
        isClickable: true,
        openInNewTab: true,
        notes:
          "Temporary advertisement for Advertisement Pricing integration tests.",
        agreedAmount: 10000,
        currencyCode: "INR",
        pricing: {
          placementId: testPlacementId,
          pricingUnit: "DAY",
          quantity: pricingQuantity
        }
      });

    expect(advertisementResponse.status).toBe(201);
    expect(advertisementResponse.body.success).toBe(true);
    expect(advertisementResponse.body.data).toBeDefined();

    expect(Number(advertisementResponse.body.data.pricingPlacementId)).toBe(
      testPlacementId
    );

    expect(advertisementResponse.body.data.pricingUnit).toBe("DAY");

    expect(Number(advertisementResponse.body.data.pricingQuantity)).toBe(
      pricingQuantity
    );

    expect(Number(advertisementResponse.body.data.standardAmount)).toBe(
      expectedStandardAmount
    );

    testAdvertisementId = Number(advertisementResponse.body.data.id);

    expect(testAdvertisementId).toBeGreaterThan(0);
  });

  /*
   * ==========================================================================
   * TEST CLEANUP
   * ==========================================================================
   */

  afterAll(async () => {
    /*
     * ------------------------------------------------------------------------
     * Remove pricing snapshots first.
     * ------------------------------------------------------------------------
     */

    if (testAdvertisementId > 0) {
      await pool.query(
        `
        DELETE FROM advertisement_pricing_snapshots
        WHERE advertisement_id = $1
        `,
        [testAdvertisementId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Remove rate cards.
     * ------------------------------------------------------------------------
     */

    if (testPlacementId > 0) {
      await pool.query(
        `
        DELETE FROM advertisement_rate_cards
        WHERE placement_id = $1
        `,
        [testPlacementId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Remove advertisement.
     * ------------------------------------------------------------------------
     */

    if (testAdvertisementId > 0) {
      await pool.query(
        `
        DELETE FROM advertisements
        WHERE id = $1
        `,
        [testAdvertisementId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Remove placement.
     * ------------------------------------------------------------------------
     */

    if (testPlacementId > 0) {
      await pool.query(
        `
        DELETE FROM advertisement_placements
        WHERE id = $1
        `,
        [testPlacementId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Remove Advertisement Client.
     * ------------------------------------------------------------------------
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
     * ------------------------------------------------------------------------
     * Remove role-permission relationships.
     * ------------------------------------------------------------------------
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
     * ------------------------------------------------------------------------
     * Remove temporary user's sessions.
     * ------------------------------------------------------------------------
     */

    if (testUserId > 0) {
      await pool.query(
        `
        DELETE FROM user_sessions
        WHERE user_id = $1
        `,
        [testUserId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Remove temporary user's role relationships.
     * ------------------------------------------------------------------------
     */

    if (testUserId > 0) {
      await pool.query(
        `
        DELETE FROM user_roles
        WHERE user_id = $1
        `,
        [testUserId]
      );
    }

    /*
     * ------------------------------------------------------------------------
     * Remove temporary role.
     * ------------------------------------------------------------------------
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
     * ------------------------------------------------------------------------
     * Remove temporary user.
     * ------------------------------------------------------------------------
     *
     * Do not call pool.end(). The shared PostgreSQL pool is used by other
     * integration suites as well.
     * ------------------------------------------------------------------------
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
   * RATE CARD
   * ==========================================================================
   */

  it("should have an active DAY rate card for the test placement", async () => {
    expect(testRateCardId).toBeGreaterThan(0);

    const rateCard = await rateCardService.getById(testRateCardId);

    expect(rateCard).toMatchObject({
      id: testRateCardId,
      placementId: testPlacementId,
      pricingUnit: "DAY",
      rateAmount,
      currencyCode: "INR",
      status: "ACTIVE"
    });

    expect(rateCard.effectiveFrom).toEqual(rateEffectiveFrom);
    expect(rateCard.effectiveTo).toEqual(rateEffectiveTo);
    expect(rateCard.createdBy).toBe(testUserId);
  });

  it("should retrieve the effective rate for the test placement", async () => {
    const effectiveAt = new Date("2026-10-15T12:00:00.000Z");

    const effectiveRate = await rateCardService.getEffectiveRate(
      testPlacementId,
      "DAY",
      effectiveAt
    );

    expect(effectiveRate).not.toBeNull();

    expect(effectiveRate?.id).toBe(testRateCardId);
    expect(effectiveRate?.placementId).toBe(testPlacementId);
    expect(effectiveRate?.pricingUnit).toBe("DAY");
    expect(effectiveRate?.rateAmount).toBe(rateAmount);
    expect(effectiveRate?.currencyCode).toBe("INR");
    expect(effectiveRate?.status).toBe("ACTIVE");
  });

  /*
   * ==========================================================================
   * PRICING SNAPSHOT
   * ==========================================================================
   */

  it("should create a pricing snapshot from the active rate card", async () => {
    const snapshot = await pricingSnapshotService.createFromRateCard(
      testAdvertisementId,
      testPlacementId,
      testRateCardId,
      testUserId
    );

    testPricingSnapshotId = snapshot.id;

    expect(testPricingSnapshotId).toBeGreaterThan(0);

    expect(snapshot).toMatchObject({
      id: testPricingSnapshotId,
      advertisementId: testAdvertisementId,
      placementId: testPlacementId,
      rateCardId: testRateCardId,
      pricingUnit: "DAY",
      rateAmount,
      currencyCode: "INR",
      quantity: pricingQuantity,
      standardAmount: expectedStandardAmount,
      createdBy: testUserId
    });

    expect(snapshot.rateEffectiveFrom).toEqual(rateEffectiveFrom);

    expect(snapshot.rateEffectiveTo).toEqual(rateEffectiveTo);

    expect(snapshot.snapshotAt).toBeInstanceOf(Date);
  });

  it("should retrieve the latest pricing snapshot for the advertisement", async () => {
    const snapshot =
      await pricingSnapshotService.getLatestByAdvertisementId(
        testAdvertisementId
      );

    expect(snapshot).not.toBeNull();

    expect(snapshot?.id).toBe(testPricingSnapshotId);
    expect(snapshot?.advertisementId).toBe(testAdvertisementId);
    expect(snapshot?.placementId).toBe(testPlacementId);
    expect(snapshot?.rateCardId).toBe(testRateCardId);
    expect(snapshot?.pricingUnit).toBe("DAY");
    expect(snapshot?.rateAmount).toBe(rateAmount);
    expect(snapshot?.currencyCode).toBe("INR");
    expect(snapshot?.quantity).toBe(pricingQuantity);
    expect(snapshot?.standardAmount).toBe(expectedStandardAmount);
  });

  it("should retrieve the latest pricing snapshot for the advertisement and placement", async () => {
    const snapshot =
      await pricingSnapshotService.getLatestByAdvertisementAndPlacement(
        testAdvertisementId,
        testPlacementId
      );

    expect(snapshot).not.toBeNull();

    expect(snapshot?.id).toBe(testPricingSnapshotId);
    expect(snapshot?.advertisementId).toBe(testAdvertisementId);
    expect(snapshot?.placementId).toBe(testPlacementId);
    expect(snapshot?.rateCardId).toBe(testRateCardId);
    expect(snapshot?.quantity).toBe(pricingQuantity);
    expect(snapshot?.standardAmount).toBe(expectedStandardAmount);
  });

  /*
   * ==========================================================================
   * STANDARD AMOUNT
   * ==========================================================================
   */

  it("should calculate standard amount from the pricing snapshot rate and quantity", async () => {
    const snapshot = await pricingSnapshotService.getById(
      testPricingSnapshotId
    );

    expect(snapshot.quantity).not.toBeNull();

    const result = standardAmountService.calculateStandardAmount({
      pricingUnit: snapshot.pricingUnit,
      rateAmount: snapshot.rateAmount,
      quantity: snapshot.quantity ?? 0,
      currencyCode: snapshot.currencyCode
    });

    expect(result).toEqual({
      pricingUnit: "DAY",
      rateAmount,
      quantity: pricingQuantity,
      standardAmount: expectedStandardAmount,
      currencyCode: "INR"
    });

    expect(snapshot.standardAmount).toBe(expectedStandardAmount);
  });

  it("should preserve two-decimal currency precision during standard amount calculation", () => {
    const result = standardAmountService.calculateStandardAmount({
      pricingUnit: "DAY",
      rateAmount: 1250.755,
      quantity: 3,
      currencyCode: "inr"
    });

    expect(result.rateAmount).toBe(1250.76);
    expect(result.quantity).toBe(3);
    expect(result.standardAmount).toBe(3752.27);
    expect(result.currencyCode).toBe("INR");
  });

  /*
   * ==========================================================================
   * AGREED AMOUNT
   * ==========================================================================
   */

  it("should calculate agreed amount variance against the standard amount", () => {
    const standardAmountResult = standardAmountService.calculateStandardAmount({
      pricingUnit: "DAY",
      rateAmount,
      quantity: pricingQuantity,
      currencyCode: "INR"
    });

    const result = agreedAmountService.calculateAgreedAmount({
      standardAmount: standardAmountResult.standardAmount,
      agreedAmount: 22000,
      currencyCode: standardAmountResult.currencyCode
    });

    expect(result).toEqual({
      standardAmount: expectedStandardAmount,
      agreedAmount: 22000,
      varianceAmount: -3000,
      variancePercentage: -12,
      currencyCode: "INR"
    });
  });

  it("should calculate a positive variance when the agreed amount exceeds the standard amount", () => {
    const result = agreedAmountService.calculateAgreedAmount({
      standardAmount: expectedStandardAmount,
      agreedAmount: 27500,
      currencyCode: "inr"
    });

    expect(result.standardAmount).toBe(expectedStandardAmount);
    expect(result.agreedAmount).toBe(27500);
    expect(result.varianceAmount).toBe(2500);
    expect(result.variancePercentage).toBe(10);
    expect(result.currencyCode).toBe("INR");
  });

  /*
   * ==========================================================================
   * RATE HISTORY / SNAPSHOT IMMUTABILITY
   * ==========================================================================
   */

  it("should preserve the original rate in the pricing snapshot after the rate card is updated", async () => {
    const updatedRateCard = await rateCardService.update(
      testRateCardId,
      {
        rateAmount: 3000
      },
      testUserId
    );

    expect(updatedRateCard.id).toBe(testRateCardId);
    expect(updatedRateCard.rateAmount).toBe(3000);

    const currentRateCard = await rateCardService.getById(testRateCardId);

    expect(currentRateCard.rateAmount).toBe(3000);

    const snapshot = await pricingSnapshotService.getById(
      testPricingSnapshotId
    );

    /*
     * The snapshot must retain the historical rate that was effective when
     * the snapshot was created. It must not dynamically follow the rate-card
     * update.
     */

    expect(snapshot.rateAmount).toBe(rateAmount);
    expect(snapshot.currencyCode).toBe("INR");
    expect(snapshot.rateCardId).toBe(testRateCardId);
    expect(snapshot.quantity).toBe(pricingQuantity);
    expect(snapshot.standardAmount).toBe(expectedStandardAmount);

    const standardAmountFromSnapshot =
      standardAmountService.calculateStandardAmount({
        pricingUnit: snapshot.pricingUnit,
        rateAmount: snapshot.rateAmount,
        quantity: snapshot.quantity ?? 0,
        currencyCode: snapshot.currencyCode
      });

    expect(standardAmountFromSnapshot.standardAmount).toBe(
      expectedStandardAmount
    );

    const standardAmountFromCurrentRate =
      standardAmountService.calculateStandardAmount({
        pricingUnit: currentRateCard.pricingUnit,
        rateAmount: currentRateCard.rateAmount,
        quantity: pricingQuantity,
        currencyCode: currentRateCard.currencyCode
      });

    expect(standardAmountFromCurrentRate.standardAmount).toBe(30000);

    expect(standardAmountFromSnapshot.standardAmount).not.toBe(
      standardAmountFromCurrentRate.standardAmount
    );
  });

  /*
   * ==========================================================================
   * SNAPSHOT HISTORY VERIFICATION
   * ==========================================================================
   */

  it("should expose the updated rate card separately from the historical pricing snapshot", async () => {
    const rateCards = await rateCardService.getByPlacementId(testPlacementId);

    expect(rateCards.length).toBeGreaterThanOrEqual(1);

    const currentRateCard = rateCards.find(
      (rateCard) => rateCard.id === testRateCardId
    );

    expect(currentRateCard).toBeDefined();
    expect(currentRateCard?.rateAmount).toBe(3000);

    const snapshots =
      await pricingSnapshotService.getByAdvertisementId(testAdvertisementId);

    expect(snapshots.length).toBeGreaterThanOrEqual(1);

    const historicalSnapshot = snapshots.find(
      (snapshot) => snapshot.id === testPricingSnapshotId
    );

    expect(historicalSnapshot).toBeDefined();
    expect(historicalSnapshot?.rateAmount).toBe(rateAmount);
    expect(historicalSnapshot?.quantity).toBe(pricingQuantity);
    expect(historicalSnapshot?.standardAmount).toBe(expectedStandardAmount);
  });

  /*
   * ==========================================================================
   * ZERO STANDARD AMOUNT VARIANCE EDGE CASE
   * ==========================================================================
   */

  it("should return null variance percentage when the standard amount is zero", () => {
    const result = agreedAmountService.calculateAgreedAmount({
      standardAmount: 0,
      agreedAmount: 500,
      currencyCode: "INR"
    });

    expect(result.standardAmount).toBe(0);
    expect(result.agreedAmount).toBe(500);
    expect(result.varianceAmount).toBe(500);
    expect(result.variancePercentage).toBeNull();
    expect(result.currencyCode).toBe("INR");
  });
});
