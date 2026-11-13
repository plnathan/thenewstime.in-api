/**
 * News publication timezone — real PostgreSQL + public API integration tests.
 *
 * Explicit opt-in for a dedicated test database OR an existing development database.
 * Never run against production. The suite creates and deletes only its own news fixtures.
 *
 * Required environment variables:
 *   RUN_REAL_DB_NEWS_TESTS=true
 *   TEST_DATABASE_URL=<same connection as DATABASE_URL>
 *   DATABASE_URL=<development database URL>
 *   ALLOW_DEV_DB_NEWS_TESTS=true  (when database name is not test/uat/ci)
 *   NEWS_TEST_DB_ENVIRONMENT=development (independent confirmation)
 *
 * Set the environment variables in PowerShell before invoking Vitest.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../../../../app.js";
import { pool } from "../../../../shared/config/db.js";
import { newsPayload } from "./news.test-data.js";

const ids: number[] = [];
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const configuredUrl = process.env.DATABASE_URL;
const enabled = process.env.RUN_REAL_DB_NEWS_TESTS === "true";
const devOptIn = process.env.ALLOW_DEV_DB_NEWS_TESTS === "true";
const environmentConfirmation =
  process.env.NEWS_TEST_DB_ENVIRONMENT === "development";
const isProduction = process.env.NODE_ENV?.toLowerCase() === "production";

function databaseName(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return null;
  }
}

const database = databaseName(testDatabaseUrl);
const isTestNamedDatabase =
  !!database && /(?:test|testing|uat|ci)/i.test(database);
const safe =
  enabled &&
  !isProduction &&
  !!testDatabaseUrl &&
  !!configuredUrl &&
  testDatabaseUrl === configuredUrl &&
  (isTestNamedDatabase || (devOptIn && environmentConfirmation));

// Deliberately skip unless every safety requirement is met.
describe.skipIf(!safe)(
  "News publication timezone — real PostgreSQL and public API",
  () => {
    beforeAll(async () => {
      if (!safe || !database) {
        throw new Error(
          "News integration tests are not authorized for this database"
        );
      }
      const result = await pool.query<{ name: string }>(
        "SELECT current_database() AS name"
      );
      const actualDatabase = result.rows[0]?.name;
      if (actualDatabase !== database) {
        throw new Error(
          `Database mismatch: expected ${database}, connected to ${actualDatabase ?? "unknown"}`
        );
      }
      if (!isTestNamedDatabase && !(devOptIn && environmentConfirmation)) {
        throw new Error(
          "Explicit development database authorization is missing"
        );
      }
    });

    afterAll(async () => {
      for (const id of [...ids].reverse()) {
        // Only test-created records are deleted. No truncation or shared fixture cleanup.
        await pool.query("DELETE FROM news WHERE id = $1", [id]);
      }
      await pool.end();
    });

    async function createApproved(slug: string): Promise<number> {
      const created = await request(app)
        .post("/api/v1/news")
        .send({
          ...newsPayload,
          slug,
          title: `Timezone integration ${slug}`
        });
      expect(created.status).toBe(201);
      const id = Number(created.body.data.id);
      expect(Number.isSafeInteger(id) && id > 0).toBe(true);
      ids.push(id);
      const row = await pool.query(
        "SELECT status, published_at FROM news WHERE id=$1",
        [id]
      );
      expect(row.rows[0]?.status).toBe("DRAFT");
      expect(row.rows[0]?.published_at).toBeNull();
      const approved = await request(app)
        .patch(`/api/v1/news/${id}/approve`)
        .send({ approvedBy: 1 });
      expect(approved.status).toBe(200);
      const approvedRow = await pool.query(
        "SELECT status, published_at FROM news WHERE id=$1",
        [id]
      );
      expect(approvedRow.rows[0]?.status).toBe("APPROVED");
      expect(approvedRow.rows[0]?.published_at).toBeNull();
      return id;
    }

    it("draft -> approve -> immediate publish persists now and is publicly visible", async () => {
      const slug = `tz-now-${suffix}`;
      const id = await createApproved(slug);
      const before = Date.now();
      const published = await request(app)
        .patch(`/api/v1/news/${id}/publish`)
        .send({ publishedBy: 1 });
      const after = Date.now();
      expect(published.status).toBe(200);
      const result = await pool.query(
        "SELECT status, published_at FROM news WHERE id=$1",
        [id]
      );
      expect(result.rows[0]?.status).toBe("PUBLISHED");
      const instant = new Date(result.rows[0]?.published_at).getTime();
      expect(instant).toBeGreaterThanOrEqual(before - 1000);
      expect(instant).toBeLessThanOrEqual(after + 1000);
      const publicDetail = await request(app).get(
        `/api/v1/news/public/slug/${slug}`
      );
      expect(publicDetail.status).toBe(200);
      expect(publicDetail.body.data.id).toBe(id);
    });

    it("future IST timestamp persists the correct UTC instant and remains hidden until due", async () => {
      const slug = `tz-future-${suffix}`;
      const id = await createApproved(slug);
      const future = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const istOffset = 330 * 60 * 1000;
      const istClock = new Date(future.getTime() + istOffset);
      const localIso = istClock.toISOString().slice(0, 19) + "+05:30";
      const published = await request(app)
        .patch(`/api/v1/news/${id}/publish`)
        .send({ publishedBy: 1, publishedAt: localIso });
      expect(published.status).toBe(200);
      const stored = await pool.query(
        "SELECT status, published_at FROM news WHERE id=$1",
        [id]
      );
      expect(stored.rows[0]?.status).toBe("PUBLISHED");
      expect(new Date(stored.rows[0]?.published_at).getTime()).toBe(
        Math.floor(future.getTime() / 1000) * 1000
      );
      const hidden = await request(app).get(`/api/v1/news/public/slug/${slug}`);
      expect(hidden.status).toBe(404);
      const listBefore = await request(app)
        .get("/api/v1/news/public")
        .query({ page: 1, pageSize: 100 });
      expect(listBefore.status).toBe(200);
      expect(JSON.stringify(listBefore.body.data)).not.toContain(slug);
      await pool.query(
        "UPDATE news SET published_at = NOW() - INTERVAL '1 second' WHERE id=$1",
        [id]
      );
      const visible = await request(app).get(
        `/api/v1/news/public/slug/${slug}`
      );
      expect(visible.status).toBe(200);
      expect(visible.body.data.id).toBe(id);
    });

    it("rejects timezone-less publication timestamps without changing approved news", async () => {
      const id = await createApproved(`tz-invalid-${suffix}`);
      const response = await request(app)
        .patch(`/api/v1/news/${id}/publish`)
        .send({
          publishedBy: 1,
          publishedAt: "2035-01-01T00:10:00"
        });
      expect(response.status).toBe(400);
      const stored = await pool.query(
        "SELECT status, published_at FROM news WHERE id=$1",
        [id]
      );
      expect(stored.rows[0]?.status).toBe("APPROVED");
      expect(stored.rows[0]?.published_at).toBeNull();
    });
  }
);
