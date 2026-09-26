import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../../app.js";
import { pool } from "../../../../../shared/config/db.js";

describe("Advertisement Delivery API Integration", () => {
  const timestamp = Date.now();

  const clientCode = `DELIVERY${timestamp}`;
  const placementCode = `DELIVERY_TEST_${timestamp}`;

  const clientName = `Delivery Integration Test Client ${timestamp}`;

  let testClientId = 0;
  let placementId = 0;

  let eligibleAdvertisementId = 0;
  let eligibleRuleId = 0;
  let eligibleScheduleId = 0;
  let eligibleCreativeId = 0;

  let targetedAdvertisementId = 0;
  let targetedRuleId = 0;
  let targetedScheduleId = 0;
  let targetedTargetId = 0;
  let targetedCreativeId = 0;

  let excludedAdvertisementId = 0;
  let excludedRuleId = 0;
  let excludedScheduleId = 0;
  let excludedTargetId = 0;

  beforeAll(async () => {
    const clientResult = await pool.query<{ id: number }>(
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
          $1,
          'Delivery Integration Test Contact',
          $2,
          '9876543210',
          $3,
          false,
          NULL,
          'ACTIVE'
        )
        RETURNING id
      `,
      [clientName, `delivery-${timestamp}@example.com`, clientCode]
    );

    expect(clientResult.rows.length).toBe(1);

    testClientId = Number(clientResult.rows[0]!.id);
    expect(testClientId).toBeGreaterThan(0);

    const placementResult = await pool.query<{ id: number }>(
      `
        INSERT INTO advertisement_placements
        (
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
          status
        )
        VALUES
        (
          $1,
          'Delivery Integration Test Placement',
          'Temporary placement used by Advertisement Delivery API integration tests',
          'HOME',
          'HOME_TOP',
          'FIXED',
          1,
          true,
          true,
          'HIDE',
          NULL,
          NULL,
          false,
          NULL,
          true,
          true,
          'ACTIVE'
        )
        RETURNING id
      `,
      [placementCode]
    );

    expect(placementResult.rows.length).toBe(1);

    placementId = Number(placementResult.rows[0]!.id);
    expect(placementId).toBeGreaterThan(0);

    const eligibleAdvertisementResult = await pool.query<{
      id: number;
    }>(
      `
        INSERT INTO advertisements
        (
          client_id,
          is_house_ad,
          name,
          internal_name,
          advertisement_type,
          destination_url,
          priority,
          status,
          start_at,
          end_at,
          is_clickable,
          open_in_new_tab,
          workflow_status
        )
        VALUES
        (
          $1,
          false,
          $2,
          $3,
          'DISPLAY',
          'https://example.com/delivery-eligible',
          100,
          'ACTIVE',
          NOW() - INTERVAL '1 hour',
          NOW() + INTERVAL '1 day',
          true,
          true,
          'APPROVED'
        )
        RETURNING id
      `,
      [
        testClientId,
        `Delivery Eligible Advertisement ${timestamp}`,
        `delivery-eligible-${timestamp}`
      ]
    );

    expect(eligibleAdvertisementResult.rows.length).toBe(1);

    eligibleAdvertisementId = Number(eligibleAdvertisementResult.rows[0]!.id);
    expect(eligibleAdvertisementId).toBeGreaterThan(0);

    const eligibleRuleResult = await pool.query<{ id: number }>(
      `
        INSERT INTO advertisement_placement_rules
        (
          advertisement_id,
          placement_id,
          display_order,
          insertion_type,
          insertion_position,
          max_impressions,
          status
        )
        VALUES
        (
          $1,
          $2,
          1,
          'FIXED',
          NULL,
          NULL,
          'ACTIVE'
        )
        RETURNING id
      `,
      [eligibleAdvertisementId, placementId]
    );

    expect(eligibleRuleResult.rows.length).toBe(1);

    eligibleRuleId = Number(eligibleRuleResult.rows[0]!.id);
    expect(eligibleRuleId).toBeGreaterThan(0);

    const eligibleScheduleResult = await pool.query<{ id: number }>(
      `
        INSERT INTO advertisement_schedules
        (
          advertisement_id,
          placement_id,
          placement_rule_id,
          start_at,
          end_at,
          status,
          priority
        )
        VALUES
        (
          $1,
          $2,
          $3,
          NOW() - INTERVAL '1 hour',
          NOW() + INTERVAL '1 day',
          'ACTIVE',
          100
        )
        RETURNING id
      `,
      [eligibleAdvertisementId, placementId, eligibleRuleId]
    );

    expect(eligibleScheduleResult.rows.length).toBe(1);

    eligibleScheduleId = Number(eligibleScheduleResult.rows[0]!.id);
    expect(eligibleScheduleId).toBeGreaterThan(0);

    const eligibleCreativeResult = await pool.query<{ id: number }>(
      `
        INSERT INTO advertisement_creatives
        (
          advertisement_id,
          creative_type,
          title,
          alt_text,
          media_url,
          thumbnail_url,
          width_px,
          height_px,
          display_order,
          is_primary,
          status
        )
        VALUES
        (
          $1,
          'IMAGE',
          'Delivery Eligible Creative',
          'Delivery Eligible Advertisement',
          'https://example.com/delivery-eligible.jpg',
          NULL,
          1200,
          300,
          1,
          true,
          'ACTIVE'
        )
        RETURNING id
      `,
      [eligibleAdvertisementId]
    );

    expect(eligibleCreativeResult.rows.length).toBe(1);

    eligibleCreativeId = Number(eligibleCreativeResult.rows[0]!.id);
    expect(eligibleCreativeId).toBeGreaterThan(0);

    const targetedAdvertisementResult = await pool.query<{
      id: number;
    }>(
      `
        INSERT INTO advertisements
        (
          client_id,
          is_house_ad,
          name,
          internal_name,
          advertisement_type,
          destination_url,
          priority,
          status,
          start_at,
          end_at,
          is_clickable,
          open_in_new_tab,
          workflow_status
        )
        VALUES
        (
          $1,
          false,
          $2,
          $3,
          'BANNER',
          'https://example.com/delivery-targeted',
          50,
          'ACTIVE',
          NOW() - INTERVAL '1 hour',
          NOW() + INTERVAL '1 day',
          true,
          true,
          'APPROVED'
        )
        RETURNING id
      `,
      [
        testClientId,
        `Delivery Targeted Advertisement ${timestamp}`,
        `delivery-targeted-${timestamp}`
      ]
    );

    expect(targetedAdvertisementResult.rows.length).toBe(1);

    targetedAdvertisementId = Number(targetedAdvertisementResult.rows[0]!.id);
    expect(targetedAdvertisementId).toBeGreaterThan(0);

    const targetedRuleResult = await pool.query<{ id: number }>(
      `
        INSERT INTO advertisement_placement_rules
        (
          advertisement_id,
          placement_id,
          display_order,
          insertion_type,
          insertion_position,
          max_impressions,
          status
        )
        VALUES
        (
          $1,
          $2,
          2,
          'FIXED',
          NULL,
          NULL,
          'ACTIVE'
        )
        RETURNING id
      `,
      [targetedAdvertisementId, placementId]
    );

    expect(targetedRuleResult.rows.length).toBe(1);

    targetedRuleId = Number(targetedRuleResult.rows[0]!.id);
    expect(targetedRuleId).toBeGreaterThan(0);

    const targetedScheduleResult = await pool.query<{
      id: number;
    }>(
      `
        INSERT INTO advertisement_schedules
        (
          advertisement_id,
          placement_id,
          placement_rule_id,
          start_at,
          end_at,
          status,
          priority
        )
        VALUES
        (
          $1,
          $2,
          $3,
          NOW() - INTERVAL '1 hour',
          NOW() + INTERVAL '1 day',
          'ACTIVE',
          50
        )
        RETURNING id
      `,
      [targetedAdvertisementId, placementId, targetedRuleId]
    );

    expect(targetedScheduleResult.rows.length).toBe(1);

    targetedScheduleId = Number(targetedScheduleResult.rows[0]!.id);
    expect(targetedScheduleId).toBeGreaterThan(0);

    const targetedCreativeResult = await pool.query<{ id: number }>(
      `
        INSERT INTO advertisement_creatives
        (
          advertisement_id,
          creative_type,
          title,
          alt_text,
          media_url,
          thumbnail_url,
          width_px,
          height_px,
          display_order,
          is_primary,
          status
        )
        VALUES
        (
          $1,
          'IMAGE',
          'Delivery Targeted Creative',
          'Delivery Targeted Advertisement',
          'https://example.com/delivery-targeted.jpg',
          NULL,
          1200,
          300,
          1,
          true,
          'ACTIVE'
        )
        RETURNING id
      `,
      [targetedAdvertisementId]
    );

    expect(targetedCreativeResult.rows.length).toBe(1);

    targetedCreativeId = Number(targetedCreativeResult.rows[0]!.id);
    expect(targetedCreativeId).toBeGreaterThan(0);

    const targetedTargetResult = await pool.query<{
      id: number;
    }>(
      `
        INSERT INTO advertisement_targets
        (
          advertisement_id,
          target_type,
          target_value,
          is_include
        )
        VALUES
        (
          $1,
          'STATE',
          'tamil-nadu',
          true
        )
        RETURNING id
      `,
      [targetedAdvertisementId]
    );

    expect(targetedTargetResult.rows.length).toBe(1);

    targetedTargetId = Number(targetedTargetResult.rows[0]!.id);
    expect(targetedTargetId).toBeGreaterThan(0);

    const excludedAdvertisementResult = await pool.query<{
      id: number;
    }>(
      `
        INSERT INTO advertisements
        (
          client_id,
          is_house_ad,
          name,
          internal_name,
          advertisement_type,
          destination_url,
          priority,
          status,
          start_at,
          end_at,
          is_clickable,
          open_in_new_tab,
          workflow_status
        )
        VALUES
        (
          $1,
          false,
          $2,
          $3,
          'DISPLAY',
          'https://example.com/delivery-excluded',
          25,
          'ACTIVE',
          NOW() - INTERVAL '1 hour',
          NOW() + INTERVAL '1 day',
          true,
          true,
          'APPROVED'
        )
        RETURNING id
      `,
      [
        testClientId,
        `Delivery Excluded Advertisement ${timestamp}`,
        `delivery-excluded-${timestamp}`
      ]
    );

    expect(excludedAdvertisementResult.rows.length).toBe(1);

    excludedAdvertisementId = Number(excludedAdvertisementResult.rows[0]!.id);
    expect(excludedAdvertisementId).toBeGreaterThan(0);

    const excludedRuleResult = await pool.query<{ id: number }>(
      `
        INSERT INTO advertisement_placement_rules
        (
          advertisement_id,
          placement_id,
          display_order,
          insertion_type,
          insertion_position,
          max_impressions,
          status
        )
        VALUES
        (
          $1,
          $2,
          3,
          'FIXED',
          NULL,
          NULL,
          'ACTIVE'
        )
        RETURNING id
      `,
      [excludedAdvertisementId, placementId]
    );

    expect(excludedRuleResult.rows.length).toBe(1);

    excludedRuleId = Number(excludedRuleResult.rows[0]!.id);
    expect(excludedRuleId).toBeGreaterThan(0);

    const excludedScheduleResult = await pool.query<{ id: number }>(
      `
        INSERT INTO advertisement_schedules
        (
          advertisement_id,
          placement_id,
          placement_rule_id,
          start_at,
          end_at,
          status,
          priority
        )
        VALUES
        (
          $1,
          $2,
          $3,
          NOW() - INTERVAL '1 hour',
          NOW() + INTERVAL '1 day',
          'ACTIVE',
          25
        )
        RETURNING id
      `,
      [excludedAdvertisementId, placementId, excludedRuleId]
    );

    expect(excludedScheduleResult.rows.length).toBe(1);

    excludedScheduleId = Number(excludedScheduleResult.rows[0]!.id);
    expect(excludedScheduleId).toBeGreaterThan(0);

    const excludedTargetResult = await pool.query<{
      id: number;
    }>(
      `
        INSERT INTO advertisement_targets
        (
          advertisement_id,
          target_type,
          target_value,
          is_include
        )
        VALUES
        (
          $1,
          'STATE',
          'kerala',
          true
        )
        RETURNING id
      `,
      [excludedAdvertisementId]
    );

    expect(excludedTargetResult.rows.length).toBe(1);

    excludedTargetId = Number(excludedTargetResult.rows[0]!.id);
    expect(excludedTargetId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    if (eligibleCreativeId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_creatives
          WHERE id = $1
        `,
        [eligibleCreativeId]
      );
    }

    if (targetedCreativeId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_creatives
          WHERE id = $1
        `,
        [targetedCreativeId]
      );
    }

    if (targetedTargetId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_targets
          WHERE id = $1
        `,
        [targetedTargetId]
      );
    }

    if (excludedTargetId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_targets
          WHERE id = $1
        `,
        [excludedTargetId]
      );
    }

    if (eligibleScheduleId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_schedules
          WHERE id = $1
        `,
        [eligibleScheduleId]
      );
    }

    if (targetedScheduleId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_schedules
          WHERE id = $1
        `,
        [targetedScheduleId]
      );
    }

    if (excludedScheduleId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_schedules
          WHERE id = $1
        `,
        [excludedScheduleId]
      );
    }

    if (eligibleRuleId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_placement_rules
          WHERE id = $1
        `,
        [eligibleRuleId]
      );
    }

    if (targetedRuleId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_placement_rules
          WHERE id = $1
        `,
        [targetedRuleId]
      );
    }

    if (excludedRuleId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_placement_rules
          WHERE id = $1
        `,
        [excludedRuleId]
      );
    }

    if (eligibleAdvertisementId > 0) {
      await pool.query(
        `
          DELETE FROM advertisements
          WHERE id = $1
        `,
        [eligibleAdvertisementId]
      );
    }

    if (targetedAdvertisementId > 0) {
      await pool.query(
        `
          DELETE FROM advertisements
          WHERE id = $1
        `,
        [targetedAdvertisementId]
      );
    }

    if (excludedAdvertisementId > 0) {
      await pool.query(
        `
          DELETE FROM advertisements
          WHERE id = $1
        `,
        [excludedAdvertisementId]
      );
    }

    if (placementId > 0) {
      await pool.query(
        `
          DELETE FROM advertisement_placements
          WHERE id = $1
        `,
        [placementId]
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
  });

  it("GET /api/v1/advertisements/delivery - should be publicly accessible without authentication", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/delivery?pageType=HOME&placementType=HOME_TOP&placementId=${placementId}`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });

  it("GET /api/v1/advertisements/delivery - should return the requested placement", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/delivery?pageType=HOME&placementType=HOME_TOP&placementId=${placementId}`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(Number(response.body.data.placement.id)).toBe(placementId);
    expect(response.body.data.placement.pageType).toBe("HOME");
    expect(response.body.data.placement.placementType).toBe("HOME_TOP");
    expect(response.body.data.placement.code).toBe(placementCode);
  });

  it("GET /api/v1/advertisements/delivery - should return an eligible approved and active advertisement", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/delivery?pageType=HOME&placementType=HOME_TOP&placementId=${placementId}`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.advertisements)).toBe(true);

    const advertisement = response.body.data.advertisements.find(
      (item: { advertisementId: number | string }) =>
        Number(item.advertisementId) === eligibleAdvertisementId
    );

    expect(advertisement).toBeDefined();
    expect(advertisement.advertisementId).toBe(eligibleAdvertisementId);
    expect(advertisement.name).toContain("Delivery Eligible Advertisement");
    expect(advertisement.destinationUrl).toBe(
      "https://example.com/delivery-eligible"
    );
    expect(advertisement.isClickable).toBe(true);
    expect(advertisement.openInNewTab).toBe(true);
    expect(Number(advertisement.schedulePriority)).toBe(100);
    expect(Number(advertisement.placementRuleId)).toBe(eligibleRuleId);
  });

  it("GET /api/v1/advertisements/delivery - should not return an advertisement with a non-matching target", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/delivery?pageType=HOME&placementType=HOME_TOP&placementId=${placementId}&state=tamil-nadu`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const advertisementIds = response.body.data.advertisements.map(
      (item: { advertisementId: number | string }) =>
        Number(item.advertisementId)
    );

    expect(advertisementIds).not.toContain(excludedAdvertisementId);
  });

  it("GET /api/v1/advertisements/delivery - should return an included targeted advertisement when the context matches", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/delivery?pageType=HOME&placementType=HOME_TOP&placementId=${placementId}&state=tamil-nadu`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const advertisement = response.body.data.advertisements.find(
      (item: { advertisementId: number | string }) =>
        Number(item.advertisementId) === targetedAdvertisementId
    );

    expect(advertisement).toBeDefined();
    expect(advertisement.advertisementId).toBe(targetedAdvertisementId);
  });

  it("GET /api/v1/advertisements/delivery - should not return an included targeted advertisement when the context does not match", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/delivery?pageType=HOME&placementType=HOME_TOP&placementId=${placementId}&state=kerala`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const advertisementIds = response.body.data.advertisements.map(
      (item: { advertisementId: number | string }) =>
        Number(item.advertisementId)
    );

    expect(advertisementIds).not.toContain(targetedAdvertisementId);
  });

  it("GET /api/v1/advertisements/delivery - should reject a missing pageType", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/delivery?placementType=HOME_TOP&placementId=${placementId}`
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/delivery - should reject an invalid pageType", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/delivery?pageType=INVALID&placementType=HOME_TOP&placementId=${placementId}`
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/delivery - should reject an invalid placementType", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/delivery?pageType=HOME&placementType=INVALID&placementId=${placementId}`
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/delivery - should reject a non-positive placementId", async () => {
    const response = await request(app).get(
      "/api/v1/advertisements/delivery?pageType=HOME&placementType=HOME_TOP&placementId=0"
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("GET /api/v1/advertisements/delivery - should coerce placementId from a query string", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/delivery?pageType=HOME&placementType=HOME_TOP&placementId=${String(
        placementId
      )}`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Number(response.body.data.placement.id)).toBe(placementId);
  });

  it("GET /api/v1/advertisements/delivery - should return an empty advertisement list for a valid placement with no matching placement", async () => {
    const response = await request(app).get(
      "/api/v1/advertisements/delivery?pageType=NEWS_LIST&placementType=NEWS_LIST_TOP"
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.advertisements)).toBe(true);
    expect(response.body.data.advertisements).toHaveLength(0);
  });

  it("GET /api/v1/advertisements/delivery - should reject a non-existent placementId", async () => {
    const response = await request(app).get(
      "/api/v1/advertisements/delivery?pageType=HOME&placementType=HOME_TOP&placementId=999999999"
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.placement).toBeNull();
    expect(response.body.data.advertisements).toEqual([]);
  });

  it("GET /api/v1/advertisements/delivery - should ignore unknown query fields", async () => {
    const response = await request(app).get(
      `/api/v1/advertisements/delivery?pageType=HOME&placementType=HOME_TOP&placementId=${placementId}&unknownField=ignored`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });
});
