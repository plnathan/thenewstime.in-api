import type { Express } from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

let testApp: Express;

let advertisementId: number;
let placementId: number;
let placementRuleId: number;
let scheduleId: number;
let creativeId: number;

describe("advertisement tracking integration", () => {
  beforeAll(() => {
    testApp = app;
  });

  beforeEach(async () => {
    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const clientResult = await client.query<{
        id: number;
      }>(
        `
        INSERT INTO advertisement_clients (
          name,
          display_name,
          client_code
        )
        VALUES ($1, $2, $3)
        RETURNING id
      `,
        [
          `Tracking Test Client ${uniqueSuffix}`,
          `Tracking Test Client ${uniqueSuffix}`,
          `TRK-${uniqueSuffix}`
        ]
      );

      const advertisementClientId = clientResult.rows[0]?.id;

      if (advertisementClientId === undefined) {
        throw new Error("Failed to create advertisement test client.");
      }

      // Keep the campaign active before and after the tracking requests.
      const campaignStart = new Date(Date.now() - 60 * 60 * 1000);
      const campaignEnd = new Date(Date.now() + 60 * 60 * 1000);

      const advertisementResult = await client.query<{
        id: number;
      }>(
        `
        INSERT INTO advertisements (
          client_id,
          name,
          advertisement_type,
          destination_url,
          priority,
          status,
          workflow_status,
          is_clickable,
          open_in_new_tab,
          is_house_ad,
          start_at,
          end_at
        )
        VALUES (
          $1,
          $2,
          'BANNER',
          'https://www.thenewstime.in/',
          10,
          'ACTIVE',
          'APPROVED',
          true,
          true,
          false,
          $3,
          $4
        )
        RETURNING id
      `,
        [
          advertisementClientId,
          `Tracking Advertisement ${uniqueSuffix}`,
          campaignStart,
          campaignEnd
        ]
      );

      advertisementId = advertisementResult.rows[0]?.id ?? 0;

      if (advertisementId === 0) {
        throw new Error("Failed to create advertisement test record.");
      }

      const placementResult = await client.query<{
        id: number;
      }>(
        `
        INSERT INTO advertisement_placements (
          code,
          display_name,
          page_type,
          placement_type,
          insertion_type,
          display_order,
          is_enabled,
          collapse_when_empty,
          fallback_behavior,
          display_frequency,
          status
        )
        VALUES (
          $1,
          $2,
          'HOME',
          'HOME_TOP',
          'FIXED',
          1,
          true,
          true,
          'HIDE',
          'EVERY_VISIT',
          'ACTIVE'
        )
        RETURNING id
      `,
        [
          `tracking-test-${uniqueSuffix}`,
          `Tracking Test Placement ${uniqueSuffix}`
        ]
      );

      placementId = placementResult.rows[0]?.id ?? 0;

      if (placementId === 0) {
        throw new Error("Failed to create placement test record.");
      }

      const ruleResult = await client.query<{
        id: number;
      }>(
        `
        INSERT INTO advertisement_placement_rules (
          advertisement_id,
          placement_id,
          display_order,
          insertion_type,
          insertion_position,
          max_impressions,
          status
        )
        VALUES (
          $1,
          $2,
          1,
          'FIXED',
          NULL,
          100,
          'ACTIVE'
        )
        RETURNING id
      `,
        [advertisementId, placementId]
      );

      placementRuleId = ruleResult.rows[0]?.id ?? 0;

      if (placementRuleId === 0) {
        throw new Error("Failed to create placement rule test record.");
      }

      const creativeResult = await client.query<{
        id: number;
      }>(
        `
        INSERT INTO advertisement_creatives (
          advertisement_id,
          creative_type,
          title,
          alt_text,
          media_url,
          display_order,
          is_primary,
          status
        )
        VALUES (
          $1,
          'IMAGE',
          $2,
          $3,
          'https://res.cloudinary.com/test/image/upload/tracking-test.jpg',
          1,
          true,
          'ACTIVE'
        )
        RETURNING id
      `,
        [
          advertisementId,
          `Tracking Test Creative ${uniqueSuffix}`,
          "Tracking test advertisement"
        ]
      );

      creativeId = creativeResult.rows[0]?.id ?? 0;

      if (creativeId === 0) {
        throw new Error("Failed to create creative test record.");
      }

      const scheduleStart = new Date(Date.now() - 60 * 60 * 1000);
      const scheduleEnd = new Date(Date.now() + 60 * 60 * 1000);

      const scheduleResult = await client.query<{
        id: number;
      }>(
        `
        INSERT INTO advertisement_schedules (
          advertisement_id,
          placement_id,
          placement_rule_id,
          start_at,
          end_at,
          status,
          priority
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'ACTIVE',
          10
        )
        RETURNING id
      `,
        [
          advertisementId,
          placementId,
          placementRuleId,
          scheduleStart,
          scheduleEnd
        ]
      );

      scheduleId = scheduleResult.rows[0]?.id ?? 0;

      if (scheduleId === 0) {
        throw new Error("Failed to create schedule test record.");
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  it("tracks an impression through the public endpoint", async () => {
    const response = await request(testApp)
      .post("/api/v1/advertisements/tracking/impression")
      .set("x-session-id", `integration-session-${Date.now()}`)
      .set("x-visitor-id", "550e8400-e29b-41d4-a716-446655440010")
      .set("user-agent", "Vitest Integration Test")
      .send({
        advertisementId,
        placementId,
        placementRuleId,
        scheduleId,
        creativeId,
        pageType: "HOME",
        placementType: "HOME_TOP",
        pageUrl: "https://www.thenewstime.in/",
        referrerUrl: "https://www.google.com/"
      });

    console.log("Tracking response:", response.status, response.body);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        tracked: true,
        eventId: expect.any(Number)
      })
    );

    const result = await pool.query<{
      advertisement_id: number;
      placement_id: number;
      placement_rule_id: number;
      schedule_id: number;
      creative_id: number;
      page_type: string;
    }>(
      `
        SELECT
          advertisement_id,
          placement_id,
          placement_rule_id,
          schedule_id,
          creative_id,
          page_type
        FROM advertisement_impressions
        WHERE id = $1
      `,
      [response.body.data.eventId]
    );

    expect(result.rows[0]).toEqual({
      advertisement_id: advertisementId,
      placement_id: placementId,
      placement_rule_id: placementRuleId,
      schedule_id: scheduleId,
      creative_id: creativeId,
      page_type: "HOME"
    });
  });

  it("tracks a click through the public endpoint", async () => {
    const response = await request(testApp)
      .post("/api/v1/advertisements/tracking/click")
      .set("x-session-id", `integration-click-${Date.now()}`)
      .set("x-visitor-id", "550e8400-e29b-41d4-a716-446655440011")
      .set("user-agent", "Vitest Integration Test")
      .send({
        advertisementId,
        placementId,
        placementRuleId,
        scheduleId,
        creativeId,
        pageType: "HOME",
        placementType: "HOME_TOP",
        pageUrl: "https://www.thenewstime.in/"
      });

    console.log("Tracking response:", response.status, response.body);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        tracked: true,
        eventId: expect.any(Number)
      })
    );

    const result = await pool.query<{
      advertisement_id: number;
      placement_id: number;
      placement_rule_id: number;
      schedule_id: number;
      creative_id: number;
      page_type: string;
    }>(
      `
        SELECT
          advertisement_id,
          placement_id,
          placement_rule_id,
          schedule_id,
          creative_id,
          page_type
        FROM advertisement_clicks
        WHERE id = $1
      `,
      [response.body.data.eventId]
    );

    expect(result.rows[0]).toEqual({
      advertisement_id: advertisementId,
      placement_id: placementId,
      placement_rule_id: placementRuleId,
      schedule_id: scheduleId,
      creative_id: creativeId,
      page_type: "HOME"
    });
  });

  it("rejects an invalid tracking relationship", async () => {
    const response = await request(testApp)
      .post("/api/v1/advertisements/tracking/impression")
      .send({
        advertisementId,
        placementId,
        placementRuleId,
        scheduleId,
        creativeId: creativeId + 999999,
        pageType: "HOME",
        placementType: "HOME_TOP"
      });

    expect(response.status).toBe(400);
  });

  it("rejects an invalid page type", async () => {
    const response = await request(testApp)
      .post("/api/v1/advertisements/tracking/impression")
      .send({
        advertisementId,
        placementId,
        placementRuleId,
        scheduleId,
        creativeId,
        pageType: "NEWS_DETAIL",
        placementType: "HOME_TOP"
      });

    expect(response.status).toBe(400);
  });

  it("rejects missing required tracking fields", async () => {
    const response = await request(testApp)
      .post("/api/v1/advertisements/tracking/impression")
      .send({
        advertisementId,
        placementId
      });

    expect(response.status).toBe(400);
  });

  it("returns advertisement metrics through the protected endpoint", async () => {
    const response = await request(testApp).get(
      `/api/v1/advertisements/tracking/metrics/${advertisementId}`
    );

    expect([401, 403]).toContain(response.status);
  });
});
