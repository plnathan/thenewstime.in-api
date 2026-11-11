/**
 * Real PostgreSQL impression cap concurrency integration tests.
 *
 * Run only against a disposable Neon test branch:
 *   RUN_TRACKING_DB_CONCURRENCY_TESTS=true
 *   TRACKING_TEST_DATABASE_URL=<test-branch URL>
 *   TRACKING_TEST_DATABASE_NAME=<expected database name>
 *   npx vitest run src/api/v1/advertisements/tracking/tests/tracking.cap-concurrency.integration.test.ts
 *
 * The test creates temporary ad/rule/schedule/creative records, uses a preexisting
 * ACTIVE and enabled non-rotating placement, and removes its own records afterward.
 * Do not point this test at production or a shared UAT database.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { Pool as PgPool } from "pg";
import type { AdvertisementTrackingInput } from "../tracking.validation.js";

const enabled = process.env.RUN_TRACKING_DB_CONCURRENCY_TESTS === "true";
const testUrl = process.env.TRACKING_TEST_DATABASE_URL;
const expectedDb = process.env.TRACKING_TEST_DATABASE_NAME;

// Dynamic imports ensure the application's normal DATABASE_URL pool is never
// initialized before the explicit test DB safety checks.
let db: PgPool;
let trackBatch: typeof import("../tracking.service.js").trackImpressionBatch;
let trackSingle: typeof import("../tracking.service.js").trackImpression;
let fixture: {
  adId: number;
  placementId: number;
  ruleId: number;
  scheduleId: number;
  creativeId: number;
  pageType: AdvertisementTrackingInput["pageType"];
  placementType: AdvertisementTrackingInput["placementType"];
} | null = null;

const testSuite = enabled ? describe : describe.skip;

function assertSafeDatabaseUrl(): string {
  if (!testUrl || !expectedDb) {
    throw new Error(
      "Set TRACKING_TEST_DATABASE_URL and TRACKING_TEST_DATABASE_NAME for an isolated test database."
    );
  }
  const parsed = new URL(testUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!databaseName || databaseName !== expectedDb) {
    throw new Error(
      `Database name mismatch: expected ${expectedDb}, URL targets ${databaseName}`
    );
  }
  if (/prod|production|live/i.test(`${parsed.hostname}/${databaseName}`)) {
    throw new Error(
      "Refusing to run against a database or hostname containing prod/production/live."
    );
  }
  return testUrl;
}

async function impressionCount(): Promise<number> {
  if (!fixture) throw new Error("Fixture missing");
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM advertisement_impressions
     WHERE schedule_id = $1 AND placement_rule_id = $2`,
    [fixture.scheduleId, fixture.ruleId]
  );
  return Number(result.rows[0]?.count ?? 0);
}

function event() {
  if (!fixture) throw new Error("Fixture missing");
  return {
    advertisementId: fixture.adId,
    placementId: fixture.placementId,
    placementRuleId: fixture.ruleId,
    scheduleId: fixture.scheduleId,
    creativeId: fixture.creativeId,
    pageType: fixture.pageType,
    placementType: fixture.placementType,
    pageUrl: "https://tracking-concurrency-test.invalid/",
    clientEventId: randomUUID(),
    visitorId: randomUUID()
  };
}

async function setCap(cap: number | null): Promise<void> {
  if (!fixture) throw new Error("Fixture missing");
  await db.query(
    "UPDATE advertisement_placement_rules SET max_impressions = $1 WHERE id = $2",
    [cap, fixture.ruleId]
  );
}

async function resetImpressions(): Promise<void> {
  if (!fixture) throw new Error("Fixture missing");
  await db.query(
    "DELETE FROM advertisement_impressions WHERE schedule_id = $1 AND placement_rule_id = $2",
    [fixture.scheduleId, fixture.ruleId]
  );
}

async function runParallel(count: number) {
  const results = await Promise.all(
    Array.from({ length: count }, () => trackBatch([event()], {}))
  );
  return {
    accepted: results.reduce((sum, r) => sum + r.accepted, 0),
    rejected: results.reduce((sum, r) => sum + r.rejected, 0),
    duplicatesOrCapped: results.reduce(
      (sum, r) => sum + r.duplicatesOrCapped,
      0
    )
  };
}

testSuite("real PostgreSQL advertisement impression cap concurrency", () => {
  beforeAll(async () => {
    const url = assertSafeDatabaseUrl();
    // The application service uses process.env.DATABASE_URL at module load.
    // Force it to use the same explicitly validated disposable database.
    process.env.DATABASE_URL = url;
    const { pool } = await import("../../../../../shared/config/db.js");
    db = pool;
    const service = await import("../tracking.service.js");
    trackBatch = service.trackImpressionBatch;
    trackSingle = service.trackImpression;

    const actual = await db.query<{ current_database: string }>(
      "SELECT current_database()"
    );
    if (actual.rows[0]?.current_database !== expectedDb) {
      throw new Error(
        "Connected database does not match TRACKING_TEST_DATABASE_NAME"
      );
    }

    // Reuse only a nonrotating, active, enabled placement. Never modify it.
    const placement = await db.query<{
      id: string;
      page_type: AdvertisementTrackingInput["pageType"];
      placement_type: AdvertisementTrackingInput["placementType"];
    }>(
      `SELECT id::text, page_type, placement_type
       FROM advertisement_placements
       WHERE status = 'ACTIVE' AND is_enabled = TRUE
         AND COALESCE(rotation_enabled, FALSE) = FALSE
       ORDER BY id LIMIT 1`
    );
    if (!placement.rows[0]) {
      throw new Error(
        "No ACTIVE, enabled, nonrotating placement found in isolated test DB"
      );
    }
    const p = placement.rows[0];
    const placementId = Number(p.id);
    const marker = `DB_CAP_TEST_${randomUUID()}`;

    // Minimal rows satisfy the supplied DDL. Additional local triggers or
    // constraints may require adjusting the fixture to your actual database.
    const ad = await db.query<{ id: string }>(
      `INSERT INTO advertisements
        (name, internal_name, advertisement_type, status, workflow_status,
         start_at, end_at, is_house_ad, priority)
       VALUES ($1, $1, 'DISPLAY', 'ACTIVE', 'APPROVED',
               now() - interval '1 hour', now() + interval '1 day', TRUE, 1)
       RETURNING id::text`,
      [marker]
    );
    const adId = Number(ad.rows[0]!.id);
    // Assign immediately so afterAll can clean up if later setup fails.
    fixture = {
      adId,
      placementId,
      ruleId: 0,
      scheduleId: 0,
      creativeId: 0,
      pageType: p.page_type,
      placementType: p.placement_type
    };
    const rule = await db.query<{ id: string }>(
      `INSERT INTO advertisement_placement_rules
        (advertisement_id, placement_id, insertion_type, max_impressions, status)
       VALUES ($1, $2, 'FIXED', 1, 'ACTIVE') RETURNING id::text`,
      [adId, placementId]
    );
    fixture.ruleId = Number(rule.rows[0]!.id);
    const schedule = await db.query<{ id: string }>(
      `INSERT INTO advertisement_schedules
        (advertisement_id, placement_id, placement_rule_id, start_at, end_at, status)
       VALUES ($1, $2, $3, now() - interval '1 hour', now() + interval '1 day', 'ACTIVE')
       RETURNING id::text`,
      [adId, placementId, fixture.ruleId]
    );
    fixture.scheduleId = Number(schedule.rows[0]!.id);
    const creative = await db.query<{ id: string }>(
      `INSERT INTO advertisement_creatives
        (advertisement_id, media_url, status, variant, creative_type)
       VALUES ($1, 'https://tracking-concurrency-test.invalid/ad.png', 'ACTIVE', 'DESKTOP', 'IMAGE')
       RETURNING id::text`,
      [adId]
    );
    fixture.creativeId = Number(creative.rows[0]!.id);
  }, 30_000);

  afterAll(async () => {
    if (db && fixture) {
      // Cleanup order respects foreign keys. Only delete this fixture's rows.
      try {
        if (fixture.scheduleId && fixture.ruleId) await resetImpressions();
        if (fixture.scheduleId) {
          await db.query("DELETE FROM advertisement_schedules WHERE id = $1", [
            fixture.scheduleId
          ]);
        }
        if (fixture.creativeId) {
          await db.query("DELETE FROM advertisement_creatives WHERE id = $1", [
            fixture.creativeId
          ]);
        }
        if (fixture.ruleId) {
          await db.query(
            "DELETE FROM advertisement_placement_rules WHERE id = $1",
            [fixture.ruleId]
          );
        }
        await db.query("DELETE FROM advertisements WHERE id = $1", [
          fixture.adId
        ]);
      } finally {
        await db.end();
      }
    } else if (db) {
      await db.end();
    }
  }, 30_000);

  it("accepts only one of two concurrent distinct events when cap = 1", async () => {
    await resetImpressions();
    await setCap(1);
    const result = await runParallel(2);
    expect(result).toEqual({ accepted: 1, rejected: 0, duplicatesOrCapped: 1 });
    expect(await impressionCount()).toBe(1);
  }, 30_000);

  it("accepts only three of ten concurrent distinct events when cap = 3", async () => {
    await resetImpressions();
    await setCap(3);
    const result = await runParallel(10);
    expect(result).toEqual({ accepted: 3, rejected: 0, duplicatesOrCapped: 7 });
    expect(await impressionCount()).toBe(3);
  }, 45_000);

  it("deduplicates the same client event ID under concurrent requests", async () => {
    await resetImpressions();
    await setCap(null);
    const same = event();
    const results = await Promise.all([
      trackBatch([same], {}),
      trackBatch([same], {})
    ]);
    expect(results.reduce((n, r) => n + r.accepted, 0)).toBe(1);
    expect(results.reduce((n, r) => n + r.duplicatesOrCapped, 0)).toBe(1);
    expect(await impressionCount()).toBe(1);
  }, 30_000);

  it("accepts two distinct concurrent events with no cap", async () => {
    await resetImpressions();
    await setCap(null);
    const result = await runParallel(2);
    expect(result).toEqual({ accepted: 2, rejected: 0, duplicatesOrCapped: 0 });
    expect(await impressionCount()).toBe(2);
  }, 30_000);

  it("enforces cap for multiple distinct events within one batch", async () => {
    await resetImpressions();
    await setCap(2);
    const result = await trackBatch([event(), event(), event()], {});
    expect(result).toEqual({ accepted: 2, rejected: 0, duplicatesOrCapped: 1 });
    expect(await impressionCount()).toBe(2);
  }, 30_000);

  it("serializes single and batch impression paths against the final cap slot", async () => {
    await resetImpressions();
    await setCap(1);
    const [single, batch] = await Promise.all([
      trackSingle(event(), {}),
      trackBatch([event()], {})
    ]);
    const accepted = Number(single.tracked) + batch.accepted;
    expect(accepted).toBe(1);
    expect(await impressionCount()).toBe(1);
  }, 30_000);
});
