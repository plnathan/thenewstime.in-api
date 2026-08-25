/**
 * -----------------------------------------------------------------------------
 * Project     : thenewstime.in
 * Module      : News Reads Integration Tests
 * -----------------------------------------------------------------------------
 */

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../app.js";
import { pool } from "../../../../shared/config/db.js";

import * as newsRepository from "../../news/news.repository.js";

describe("News Reads API", () => {
  let publishedNewsId: number;
  let draftNewsId: number;
  let archivedNewsId: number;

  let categoryId: number;
  let stateId: number;

  const testNewsIds: number[] = [];

  /**
   * Existing integration tests use user ID 1 for workflow operations.
   */
  const testUserId = 1;

  beforeAll(async () => {
    /**
     * -------------------------------------------------------------------------
     * Get valid master-data IDs
     * -------------------------------------------------------------------------
     *
     * Do not assume that category/state ID 1 exists.
     */
    const categoryResult = await pool.query(`
      SELECT id
      FROM categories
      ORDER BY id
      LIMIT 1;
    `);

    if (categoryResult.rowCount === 0) {
      throw new Error(
        "News Reads integration test requires at least one category."
      );
    }

    categoryId = Number(categoryResult.rows[0].id);

    const stateResult = await pool.query(`
      SELECT id
      FROM states
      ORDER BY id
      LIMIT 1;
    `);

    if (stateResult.rowCount === 0) {
      throw new Error(
        "News Reads integration test requires at least one state."
      );
    }

    stateId = Number(stateResult.rows[0].id);

    const timestamp = Date.now();

    /**
     * -------------------------------------------------------------------------
     * Create PUBLISHED test news
     * -------------------------------------------------------------------------
     */
    const publishedNews = await newsRepository.create({
      title: `News Reads Published Test ${timestamp}`,
      slug: `news-reads-published-test-${timestamp}`,
      summary: "News reads integration test",
      content: "News reads integration test content.",
      newsScope: "STATE",
      stateId,
      categoryId,
      draftedBy: testUserId,
      createdBy: testUserId
    });

    publishedNewsId = publishedNews.id;

    testNewsIds.push(publishedNewsId);

    /**
     * DRAFT -> APPROVED -> PUBLISHED
     */
    await newsRepository.changeStatus(publishedNewsId, "APPROVED", testUserId);

    await newsRepository.changeStatus(publishedNewsId, "PUBLISHED", testUserId);

    /**
     * -------------------------------------------------------------------------
     * Create DRAFT test news
     * -------------------------------------------------------------------------
     */
    const draftNews = await newsRepository.create({
      title: `News Reads Draft Test ${timestamp}`,
      slug: `news-reads-draft-test-${timestamp}`,
      summary: "News reads draft integration test",
      content: "News reads draft integration test content.",
      newsScope: "STATE",
      stateId,
      categoryId,
      draftedBy: testUserId,
      createdBy: testUserId
    });

    draftNewsId = draftNews.id;

    testNewsIds.push(draftNewsId);

    /**
     * -------------------------------------------------------------------------
     * Create ARCHIVED test news
     * -------------------------------------------------------------------------
     */
    const archivedNews = await newsRepository.create({
      title: `News Reads Archived Test ${timestamp}`,
      slug: `news-reads-archived-test-${timestamp}`,
      summary: "News reads archived integration test",
      content: "News reads archived integration test content.",
      newsScope: "STATE",
      stateId,
      categoryId,
      draftedBy: testUserId,
      createdBy: testUserId
    });

    archivedNewsId = archivedNews.id;

    testNewsIds.push(archivedNewsId);

    /**
     * DRAFT -> ARCHIVED
     */
    await newsRepository.changeStatus(archivedNewsId, "ARCHIVED", testUserId);
  });

  afterAll(async () => {
    /**
     * Remove only the records created by this test.
     */
    if (testNewsIds.length > 0) {
      await pool.query(
        `
          DELETE FROM news_reads
          WHERE news_id = ANY($1::bigint[]);
        `,
        [testNewsIds]
      );

      await pool.query(
        `
          DELETE FROM news
          WHERE id = ANY($1::bigint[]);
        `,
        [testNewsIds]
      );
    }
  });

  describe("POST /api/news-reads", () => {
    it("should create a news read for published news", async () => {
      const response = await request(app).post("/api/news-reads").send({
        newsId: publishedNewsId,
        sessionId: "news-reads-session-001",
        browser: "Chrome",
        operatingSystem: "Windows",
        deviceType: "DESKTOP",
        userAgent: "Vitest Browser"
      });

      expect(response.status).toBe(201);

      expect(response.body.data).toBeDefined();

      expect(response.body.data.newsId).toBe(publishedNewsId);

      expect(response.body.data.sessionId).toBe("news-reads-session-001");

      expect(response.body.data.id).toBeDefined();
    });

    it("should ignore duplicate read from the same session", async () => {
      const response = await request(app).post("/api/news-reads").send({
        newsId: publishedNewsId,
        sessionId: "news-reads-session-001"
      });

      expect(response.status).toBe(200);

      expect(response.body.message).toContain("already recorded");

      expect(response.body.data).toBeNull();
    });

    it("should allow a different session to read the same article", async () => {
      const response = await request(app).post("/api/news-reads").send({
        newsId: publishedNewsId,
        sessionId: "news-reads-session-002"
      });

      expect(response.status).toBe(201);

      expect(response.body.data.newsId).toBe(publishedNewsId);

      expect(response.body.data.sessionId).toBe("news-reads-session-002");
    });

    it("should allow the same session to read a different article", async () => {
      const response = await request(app).post("/api/news-reads").send({
        newsId: draftNewsId,
        sessionId: "news-reads-session-001"
      });

      /**
       * The article is DRAFT, therefore this must be rejected.
       */
      expect(response.status).toBe(400);
    });

    it("should reject draft news", async () => {
      const response = await request(app).post("/api/news-reads").send({
        newsId: draftNewsId,
        sessionId: "news-reads-draft-session"
      });

      expect(response.status).toBe(400);
    });

    it("should reject archived news", async () => {
      const response = await request(app).post("/api/news-reads").send({
        newsId: archivedNewsId,
        sessionId: "news-reads-archived-session"
      });

      expect(response.status).toBe(400);
    });

    it("should reject nonexistent news", async () => {
      const response = await request(app).post("/api/news-reads").send({
        newsId: 999999999,
        sessionId: "news-reads-invalid-session"
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/news-reads/news/:id/count", () => {
    it("should return total reads for published news", async () => {
      const response = await request(app).get(
        `/api/news-reads/news/${publishedNewsId}/count`
      );

      expect(response.status).toBe(200);

      expect(response.body.data.newsId).toBe(publishedNewsId);

      expect(response.body.data.readCount).toBe(2);
    });

    it("should return 404 for nonexistent news", async () => {
      const response = await request(app).get(
        "/api/news-reads/news/999999999/count"
      );

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/news-reads/popular", () => {
    it("should return popular news ordered by read count", async () => {
      const response = await request(app).get(
        "/api/news-reads/popular?limit=5"
      );

      expect(response.status).toBe(200);

      expect(Array.isArray(response.body.data)).toBe(true);

      const publishedItem = response.body.data.find(
        (item: { newsId: number; readCount: number }) =>
          item.newsId === publishedNewsId
      );

      expect(publishedItem).toBeDefined();

      expect(publishedItem.readCount).toBe(2);
    });

    it("should return only published news", async () => {
      const response = await request(app).get(
        "/api/news-reads/popular?limit=100"
      );

      expect(response.status).toBe(200);

      const returnedNewsIds = response.body.data.map(
        (item: { newsId: number }) => item.newsId
      );

      expect(returnedNewsIds).toContain(publishedNewsId);

      expect(returnedNewsIds).not.toContain(draftNewsId);

      expect(returnedNewsIds).not.toContain(archivedNewsId);
    });

    it("should respect the limit parameter", async () => {
      const response = await request(app).get(
        "/api/news-reads/popular?limit=1"
      );

      expect(response.status).toBe(200);

      expect(response.body.data.length).toBeLessThanOrEqual(1);
    });
  });

  describe("Validation", () => {
    it("should reject missing sessionId", async () => {
      const response = await request(app).post("/api/news-reads").send({
        newsId: publishedNewsId
      });

      expect(response.status).toBe(400);
    });

    it("should reject invalid newsId", async () => {
      const response = await request(app).post("/api/news-reads").send({
        newsId: -1,
        sessionId: "invalid-news-id"
      });

      expect(response.status).toBe(400);
    });

    it("should reject invalid visitorId UUID", async () => {
      const response = await request(app).post("/api/news-reads").send({
        newsId: publishedNewsId,
        sessionId: "uuid-test-session",
        visitorId: "not-a-valid-uuid"
      });

      expect(response.status).toBe(400);
    });

    it("should reject invalid popular limit", async () => {
      const response = await request(app).get(
        "/api/news-reads/popular?limit=200"
      );

      expect(response.status).toBe(400);
    });
  });
});
