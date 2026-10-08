import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

const CREATOR_USERNAME = process.env.CREATIVE_TEST_USERNAME ?? "";
const CREATOR_PASSWORD = process.env.CREATIVE_TEST_PASSWORD ?? "";

const CONFIGURED_ADVERTISEMENT_ID = Number(
  process.env.CREATIVE_TEST_ADVERTISEMENT_ID ?? "0"
);

const CONFIGURED_FORMAT_ID = Number(
  process.env.CREATIVE_TEST_FORMAT_ID ?? "0"
);

const BASE_PATH = "/api/v1/advertisements";

describe("Advertisement Creative Integration", () => {
  let accessToken = "";

  let advertisementId = 0;
  let formatId = 0;

  let creativeWidthPx = 728;
  let creativeHeightPx = 90;

  let createdCreativeId = 0;

  beforeAll(async () => {
    if (!CREATOR_USERNAME || !CREATOR_PASSWORD) {
      throw new Error(
        "Creative integration test requires CREATIVE_TEST_USERNAME and CREATIVE_TEST_PASSWORD."
      );
    }

    if (
      !Number.isInteger(CONFIGURED_ADVERTISEMENT_ID) ||
      CONFIGURED_ADVERTISEMENT_ID < 0
    ) {
      throw new Error(
        "Creative integration test requires CREATIVE_TEST_ADVERTISEMENT_ID to be a valid non-negative number."
      );
    }

    if (
      !Number.isInteger(CONFIGURED_FORMAT_ID) ||
      CONFIGURED_FORMAT_ID < 0
    ) {
      throw new Error(
        "Creative integration test requires CREATIVE_TEST_FORMAT_ID to be a valid non-negative number."
      );
    }

    /*
     * ------------------------------------------------------------
     * Authenticate Creative test user
     * ------------------------------------------------------------
     */
    const authenticationResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: CREATOR_USERNAME,
        password: CREATOR_PASSWORD
      });

    if (authenticationResponse.status !== 200) {
      throw new Error(
        `Creative integration authentication failed: ${JSON.stringify(
          authenticationResponse.body
        )}`
      );
    }

    accessToken =
      authenticationResponse.body?.data?.tokens?.accessToken ??
      authenticationResponse.body?.tokens?.accessToken ??
      authenticationResponse.body?.data?.accessToken ??
      authenticationResponse.body?.accessToken ??
      "";

    if (!accessToken) {
      throw new Error(
        `Creative integration authentication did not return an access token: ${JSON.stringify(
          authenticationResponse.body
        )}`
      );
    }

    /*
     * ------------------------------------------------------------
     * Resolve Advertisement
     * ------------------------------------------------------------
     *
     * Prefer the configured advertisement when it exists.
     *
     * If the configured ID is stale/deleted, find the latest
     * DRAFT/REJECTED advertisement that has a persisted active
     * placement.
     */
    if (CONFIGURED_ADVERTISEMENT_ID > 0) {
      const configuredAdvertisementResult = await pool.query<{
        id: number | string;
        workflow_status: string;
      }>(
        `
        SELECT
          id,
          workflow_status
        FROM advertisements
        WHERE id = $1
        LIMIT 1
        `,
        [CONFIGURED_ADVERTISEMENT_ID]
      );

      const configuredAdvertisement =
        configuredAdvertisementResult.rows[0];

      if (configuredAdvertisement) {
        /*
         * PostgreSQL numeric values may be returned as strings
         * depending on the column type/driver configuration.
         * Always normalize database IDs before using them in
         * numeric request payloads/assertions.
         */
        advertisementId = Number(configuredAdvertisement.id);
      }
    }

    if (advertisementId === 0) {
      const fallbackAdvertisementResult = await pool.query<{
        id: number | string;
        workflow_status: string;
      }>(
        `
        SELECT
          a.id,
          a.workflow_status
        FROM advertisements a
        INNER JOIN advertisement_placement_rules apr
          ON apr.advertisement_id = a.id
        INNER JOIN advertisement_placements ap
          ON ap.id = apr.placement_id
        WHERE a.workflow_status IN ('DRAFT', 'REJECTED')
          AND ap.status = 'ACTIVE'
          AND ap.is_enabled = TRUE
        ORDER BY a.id DESC
        LIMIT 1
        `
      );

      const fallbackAdvertisement =
        fallbackAdvertisementResult.rows[0];

      if (!fallbackAdvertisement) {
        throw new Error(
          `Creative integration test could not find a valid DRAFT/REJECTED advertisement with a persisted active placement. Configured advertisement ID: ${CONFIGURED_ADVERTISEMENT_ID}.`
        );
      }

      advertisementId = Number(fallbackAdvertisement.id);
    }

    if (!Number.isInteger(advertisementId) || advertisementId <= 0) {
      throw new Error(
        `Creative integration test resolved an invalid advertisement ID: ${String(
          advertisementId
        )}.`
      );
    }

    /*
     * Final advertisement validation.
     */
    const advertisementResult = await pool.query<{
      id: number | string;
      workflow_status: string;
    }>(
      `
      SELECT
        id,
        workflow_status
      FROM advertisements
      WHERE id = $1
      LIMIT 1
      `,
      [advertisementId]
    );

    const advertisement = advertisementResult.rows[0];

    if (!advertisement) {
      throw new Error(`Advertisement ${advertisementId} does not exist.`);
    }

    /*
     * Normalize the database ID even in the final validation
     * because PostgreSQL may return it as a string.
     */
    advertisementId = Number(advertisement.id);

    if (!Number.isInteger(advertisementId) || advertisementId <= 0) {
      throw new Error(
        `Advertisement ${String(
          advertisement.id
        )} returned an invalid numeric ID.`
      );
    }

    if (
      advertisement.workflow_status !== "DRAFT" &&
      advertisement.workflow_status !== "REJECTED"
    ) {
      throw new Error(
        `Advertisement ${advertisementId} must be DRAFT or REJECTED for Creative integration tests. Current workflow status: ${advertisement.workflow_status}`
      );
    }

    /*
     * ------------------------------------------------------------
     * Verify persisted active placement
     * ------------------------------------------------------------
     */
    const placementResult = await pool.query<{
      placement_id: number | string;
    }>(
      `
      SELECT
        apr.placement_id
      FROM advertisement_placement_rules apr
      INNER JOIN advertisement_placements ap
        ON ap.id = apr.placement_id
      WHERE apr.advertisement_id = $1
        AND ap.status = 'ACTIVE'
        AND ap.is_enabled = TRUE
      ORDER BY apr.id
      LIMIT 1
      `,
      [advertisementId]
    );

    const placement = placementResult.rows[0];

    if (!placement) {
      throw new Error(
        `Advertisement ${advertisementId} does not have a persisted active placement.`
      );
    }

    const persistedPlacementId = Number(placement.placement_id);

    if (
      !Number.isInteger(persistedPlacementId) ||
      persistedPlacementId <= 0
    ) {
      throw new Error(
        `Advertisement ${advertisementId} has an invalid persisted placement ID: ${String(
          placement.placement_id
        )}.`
      );
    }

    /*
     * ------------------------------------------------------------
     * Resolve Advertisement Format
     * ------------------------------------------------------------
     *
     * Prefer the configured format when it exists and is ACTIVE.
     *
     * If the configured format is stale/deleted, automatically
     * select the first ACTIVE format.
     */
    if (CONFIGURED_FORMAT_ID > 0) {
      const configuredFormatResult = await pool.query<{
        id: number | string;
        status: string;
        width_px: number | string | null;
        height_px: number | string | null;
      }>(
        `
        SELECT
          id,
          status,
          width_px,
          height_px
        FROM advertisement_formats
        WHERE id = $1
        LIMIT 1
        `,
        [CONFIGURED_FORMAT_ID]
      );

      const configuredFormat = configuredFormatResult.rows[0];

      if (configuredFormat) {
        if (configuredFormat.status !== "ACTIVE") {
          throw new Error(
            `Advertisement format ${CONFIGURED_FORMAT_ID} must be ACTIVE. Current status: ${configuredFormat.status}`
          );
        }

        formatId = Number(configuredFormat.id);

        creativeWidthPx =
          configuredFormat.width_px === null
            ? 0
            : Number(configuredFormat.width_px);

        creativeHeightPx =
          configuredFormat.height_px === null
            ? 0
            : Number(configuredFormat.height_px);
      }
    }

    /*
     * Fallback to the first ACTIVE format when the configured
     * format no longer exists.
     */
    if (formatId === 0) {
      const fallbackFormatResult = await pool.query<{
        id: number | string;
        status: string;
        width_px: number | string | null;
        height_px: number | string | null;
      }>(
        `
        SELECT
          id,
          status,
          width_px,
          height_px
        FROM advertisement_formats
        WHERE status = 'ACTIVE'
        ORDER BY id
        LIMIT 1
        `
      );

      const fallbackFormat = fallbackFormatResult.rows[0];

      if (!fallbackFormat) {
        throw new Error(
          `Creative integration test could not find an ACTIVE advertisement format. Configured format ID: ${CONFIGURED_FORMAT_ID}.`
        );
      }

      formatId = Number(fallbackFormat.id);

      creativeWidthPx =
        fallbackFormat.width_px === null
          ? 0
          : Number(fallbackFormat.width_px);

      creativeHeightPx =
        fallbackFormat.height_px === null
          ? 0
          : Number(fallbackFormat.height_px);
    }

    /*
     * ------------------------------------------------------------
     * Final Format Validation
     * ------------------------------------------------------------
     */
    const formatResult = await pool.query<{
      id: number | string;
      status: string;
      width_px: number | string | null;
      height_px: number | string | null;
    }>(
      `
      SELECT
        id,
        status,
        width_px,
        height_px
      FROM advertisement_formats
      WHERE id = $1
      LIMIT 1
      `,
      [formatId]
    );

    const format = formatResult.rows[0];

    if (!format) {
      throw new Error(`Advertisement format ${formatId} does not exist.`);
    }

    /*
     * Normalize the format ID before it is sent through the API.
     */
    formatId = Number(format.id);

    if (!Number.isInteger(formatId) || formatId <= 0) {
      throw new Error(
        `Advertisement format returned an invalid numeric ID: ${String(
          format.id
        )}.`
      );
    }

    if (format.status !== "ACTIVE") {
      throw new Error(
        `Advertisement format ${formatId} must be ACTIVE.`
      );
    }

    /*
     * Normalize dimensions because PostgreSQL can return numeric
     * database values as strings.
     */
    creativeWidthPx =
      format.width_px === null ? 0 : Number(format.width_px);

    creativeHeightPx =
      format.height_px === null ? 0 : Number(format.height_px);

    if (
      !Number.isInteger(creativeWidthPx) ||
      creativeWidthPx <= 0 ||
      !Number.isInteger(creativeHeightPx) ||
      creativeHeightPx <= 0
    ) {
      throw new Error(
        `Advertisement format ${formatId} has invalid dimensions: ${String(
          format.width_px
        )}x${String(format.height_px)}.`
      );
    }
  });

  afterAll(async () => {
    if (createdCreativeId > 0) {
      await pool.query(
        `
        UPDATE advertisement_creatives
        SET
          status = 'INACTIVE',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [createdCreativeId]
      );
    }
  });

  function authenticatedRequest(
    method: "get" | "post" | "patch" | "delete",
    path: string
  ) {
    return request(app)[method](path).set(
      "Authorization",
      `Bearer ${accessToken}`
    );
  }

  it("should authenticate the configured Creative test user", () => {
    expect(accessToken).toBeTruthy();

    expect(advertisementId).toBeGreaterThan(0);
    expect(Number.isInteger(advertisementId)).toBe(true);

    expect(formatId).toBeGreaterThan(0);
    expect(Number.isInteger(formatId)).toBe(true);
  });

  it("should reject unauthenticated creative access", async () => {
    const response = await request(app).get(
      `${BASE_PATH}/${advertisementId}/creatives`
    );

    expect([401, 403]).toContain(response.status);
  });

  it("should list creatives for the advertisement", async () => {
    const response = await authenticatedRequest(
      "get",
      `${BASE_PATH}/${advertisementId}/creatives`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Advertisement creatives retrieved successfully."
    );

    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("should return advertisement preview", async () => {
    const response = await authenticatedRequest(
      "get",
      `${BASE_PATH}/${advertisementId}/creatives/preview`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Advertisement creative previews retrieved successfully."
    );

    expect(response.body.data).toHaveProperty("desktop");
    expect(response.body.data).toHaveProperty("mobile");
  });

  it("should reject an invalid advertisement id", async () => {
    const response = await authenticatedRequest(
      "get",
      `${BASE_PATH}/0/creatives`
    );

    expect(response.status).toBe(400);
  });

  it("should create an IMAGE desktop creative", async () => {
    const response = await authenticatedRequest(
      "post",
      `${BASE_PATH}/${advertisementId}/creatives`
    ).send({
      formatId,
      creativeType: "IMAGE",
      variant: "DESKTOP",
      title: "Creative Integration Test",
      altText: "Creative integration test",
      mediaUrl: "https://cdn.example.com/creative-integration-test.jpg",
      thumbnailUrl:
        "https://cdn.example.com/creative-integration-test-thumb.jpg",
      widthPx: creativeWidthPx,
      heightPx: creativeHeightPx,
      displayOrder: 100,
      isPrimary: true,
      status: "ACTIVE"
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Advertisement creative created successfully."
    );

    expect(response.body.data).toMatchObject({
      advertisementId,
      creativeType: "IMAGE",
      variant: "DESKTOP",
      mediaUrl: "https://cdn.example.com/creative-integration-test.jpg",
      widthPx: creativeWidthPx,
      heightPx: creativeHeightPx,
      isPrimary: true,
      status: "ACTIVE"
    });

    createdCreativeId = Number(response.body.data.id);

    expect(createdCreativeId).toBeGreaterThan(0);
    expect(Number.isInteger(createdCreativeId)).toBe(true);
  });

  it("should retrieve the created creative", async () => {
    expect(createdCreativeId).toBeGreaterThan(0);

    const response = await authenticatedRequest(
      "get",
      `${BASE_PATH}/${advertisementId}/creatives/${createdCreativeId}`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Advertisement creative retrieved successfully."
    );

    expect(response.body.data).toMatchObject({
      id: createdCreativeId,
      advertisementId,
      creativeType: "IMAGE",
      variant: "DESKTOP"
    });
  });

  it("should retrieve the created creative preview", async () => {
    expect(createdCreativeId).toBeGreaterThan(0);

    const response = await authenticatedRequest(
      "get",
      `${BASE_PATH}/${advertisementId}/creatives/${createdCreativeId}/preview`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Advertisement creative preview retrieved successfully."
    );

    expect(response.body.data).toMatchObject({
      creativeId: createdCreativeId,
      advertisementId,
      creativeType: "IMAGE",
      variant: "DESKTOP",
      previewUrl: "https://cdn.example.com/creative-integration-test.jpg"
    });
  });

  it("should update the created creative", async () => {
    expect(createdCreativeId).toBeGreaterThan(0);

    const response = await authenticatedRequest(
      "patch",
      `${BASE_PATH}/${advertisementId}/creatives/${createdCreativeId}`
    ).send({
      title: "Updated Creative Integration Test",
      altText: "Updated creative",
      displayOrder: 101
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Advertisement creative updated successfully."
    );

    expect(response.body.data).toMatchObject({
      id: createdCreativeId,
      title: "Updated Creative Integration Test",
      altText: "Updated creative",
      displayOrder: 101
    });
  });

  it("should reject an update with only width", async () => {
    expect(createdCreativeId).toBeGreaterThan(0);

    const response = await authenticatedRequest(
      "patch",
      `${BASE_PATH}/${advertisementId}/creatives/${createdCreativeId}`
    ).send({
      widthPx: 320
    });

    expect(response.status).toBe(400);
  });

  it("should reject an update with only height", async () => {
    expect(createdCreativeId).toBeGreaterThan(0);

    const response = await authenticatedRequest(
      "patch",
      `${BASE_PATH}/${advertisementId}/creatives/${createdCreativeId}`
    ).send({
      heightPx: 100
    });

    expect(response.status).toBe(400);
  });

  it("should reject an invalid creative id", async () => {
    const response = await authenticatedRequest(
      "get",
      `${BASE_PATH}/${advertisementId}/creatives/0`
    );

    expect(response.status).toBe(400);
  });

  it("should reject a creative that belongs to another advertisement", async () => {
    expect(createdCreativeId).toBeGreaterThan(0);

    const response = await authenticatedRequest(
      "get",
      `${BASE_PATH}/999999/creatives/${createdCreativeId}`
    );

    expect([400, 404]).toContain(response.status);
  });

  it("should deactivate the created creative", async () => {
    expect(createdCreativeId).toBeGreaterThan(0);

    const response = await authenticatedRequest(
      "delete",
      `${BASE_PATH}/${advertisementId}/creatives/${createdCreativeId}`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Advertisement creative deactivated successfully."
    );

    expect(response.body.data).toMatchObject({
      id: createdCreativeId,
      status: "INACTIVE"
    });
  });

  it("should not return the deactivated creative as an active creative", async () => {
    const response = await authenticatedRequest(
      "get",
      `${BASE_PATH}/${advertisementId}/creatives`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const creatives = response.body.data as Array<{
      id: number | string;
      status: string;
    }>;

    const deactivated = creatives.find(
      (creative) => Number(creative.id) === createdCreativeId
    );

    if (deactivated) {
      expect(deactivated.status).toBe("INACTIVE");
    }
  });
});