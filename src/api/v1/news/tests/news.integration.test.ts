import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../app.js";

import { cleanupNews, closeDatabase } from "./helpers/news.test-helper.js";

import { newsPayload } from "./news.test-data.js";

let createdId = 0;

const createdTestIds: number[] = [];

const uniqueSuffix = Date.now();

const testSlugs = {
  world: `integration-world-news-${uniqueSuffix}`,
  india: `integration-india-news-${uniqueSuffix}`,
  state: `integration-state-news-${uniqueSuffix}`,
  district: `integration-district-news-${uniqueSuffix}`
};

let worldNewsId = 0;
let indiaNewsId = 0;
let stateNewsId = 0;
let districtNewsId = 0;

beforeAll(async () => {
  // Reserved for future authentication/global setup.
});

afterAll(async () => {
  const ids = [
    createdId,
    worldNewsId,
    indiaNewsId,
    stateNewsId,
    districtNewsId,
    ...createdTestIds
  ].filter((id, index, array) => {
    return id > 0 && array.indexOf(id) === index;
  });

  for (const id of ids) {
    try {
      await cleanupNews(id);
    } catch {
      // Cleanup should not make the test suite fail.
    }
  }

  await closeDatabase();
});

/**
 * ============================================================
 * POST /api/v1/news
 * ============================================================
 */
describe("POST /api/v1/news", () => {
  it("should create a news article", async () => {
    const response = await request(app).post("/api/v1/news").send(newsPayload);

    console.log("CREATE RESPONSE:", response.status, response.body);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data).toBeDefined();

    expect(response.body.data.title).toBe(newsPayload.title);

    expect(response.body.data.slug).toBe(newsPayload.slug);

    expect(response.body.data.newsScope).toBe(newsPayload.newsScope);

    createdId = response.body.data.id;
  });

  it("should reject duplicate slug", async () => {
    const response = await request(app).post("/api/v1/news").send(newsPayload);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Slug already exists.");
  });

  it("should reject invalid slug format", async () => {
    const response = await request(app)
      .post("/api/v1/news")
      .send({
        ...newsPayload,
        slug: "Invalid Slug With Spaces"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject uppercase slug", async () => {
    const response = await request(app)
      .post("/api/v1/news")
      .send({
        ...newsPayload,
        slug: "Chennai-News-2026"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject invalid news scope", async () => {
    const response = await request(app)
      .post("/api/v1/news")
      .send({
        ...newsPayload,
        slug: `invalid-scope-${uniqueSuffix}`,
        newsScope: "INVALID"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject old GLOBAL scope", async () => {
    const response = await request(app)
      .post("/api/v1/news")
      .send({
        ...newsPayload,
        slug: `invalid-global-${uniqueSuffix}`,
        newsScope: "GLOBAL"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject missing required fields", async () => {
    const response = await request(app).post("/api/v1/news").send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");

    expect(response.body.errors).toBeDefined();
  });
});

/**
 * ============================================================
 * GET /api/v1/news/:id
 * ============================================================
 */
describe("GET /api/v1/news/:id", () => {
  it("should return a news article", async () => {
    expect(createdId).toBeGreaterThan(0);

    const response = await request(app).get(`/api/v1/news/${createdId}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.message).toBe("News retrieved successfully.");

    expect(response.body.data).toBeDefined();
    expect(response.body.data.id).toBe(createdId);
  });

  it("should return 404 for unknown id", async () => {
    const response = await request(app).get("/api/v1/news/999999999");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);

    expect(response.body.message).toBe("News not found.");
  });

  it("should reject invalid id", async () => {
    const response = await request(app).get("/api/v1/news/abc");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

/**
 * ============================================================
 * GET /api/v1/news/slug/:slug
 * ============================================================
 *
 * NOTE:
 * These tests require:
 *
 * controller.getNewsBySlug()
 * service.getNewsBySlug()
 * repository.findBySlug()
 * route /slug/:slug
 */
describe("GET /api/v1/news/slug/:slug", () => {
  it("should return a news article by slug", async () => {
    const response = await request(app).get(
      `/api/v1/news/slug/${newsPayload.slug}`
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.message).toBe("News retrieved successfully.");

    expect(response.body.data).toBeDefined();

    expect(response.body.data.id).toBe(createdId);

    expect(response.body.data.slug).toBe(newsPayload.slug);
  });

  it("should return 404 for unknown slug", async () => {
    const response = await request(app).get(
      "/api/v1/news/slug/this-slug-does-not-exist-999999"
    );

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);

    expect(response.body.message).toBe("News not found.");
  });

  it("should reject invalid slug format", async () => {
    const response = await request(app).get("/api/v1/news/slug/Invalid%20Slug");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

/**
 * ============================================================
 * PUT /api/v1/news/:id
 * ============================================================
 */
describe("PUT /api/v1/news/:id", () => {
  it("should update title", async () => {
    const response = await request(app).put(`/api/v1/news/${createdId}`).send({
      title: "Updated Integration Title",
      updatedBy: 1
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.title).toBe("Updated Integration Title");
  });

  it("should update slug", async () => {
    const newSlug = `updated-integration-slug-${uniqueSuffix}`;

    const response = await request(app).put(`/api/v1/news/${createdId}`).send({
      slug: newSlug,
      updatedBy: 1
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.slug).toBe(newSlug);
  });

  it("should reject invalid slug during update", async () => {
    const response = await request(app).put(`/api/v1/news/${createdId}`).send({
      slug: "INVALID SLUG",
      updatedBy: 1
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should return 404 for unknown id", async () => {
    const response = await request(app).put("/api/v1/news/999999999").send({
      title: "Unknown News",
      updatedBy: 1
    });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});

/**
 * ============================================================
 * Scope-specific CREATE tests
 * ============================================================
 */
describe("News Scope", () => {
  it("should create WORLD news", async () => {
    const response = await request(app)
      .post("/api/v1/news")
      .send({
        ...newsPayload,
        title: `World Integration News ${uniqueSuffix}`,
        slug: testSlugs.world,
        newsScope: "WORLD",
        countryId: newsPayload.countryId,
        stateId: undefined,
        districtId: undefined
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.newsScope).toBe("WORLD");

    worldNewsId = response.body.data.id;
  });

  it("should create INDIA news", async () => {
    const response = await request(app)
      .post("/api/v1/news")
      .send({
        ...newsPayload,
        title: `India Integration News ${uniqueSuffix}`,
        slug: testSlugs.india,
        newsScope: "INDIA",
        countryId: newsPayload.countryId,
        stateId: undefined,
        districtId: undefined
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.newsScope).toBe("INDIA");

    indiaNewsId = response.body.data.id;
  });

  it("should create STATE news", async () => {
    const response = await request(app)
      .post("/api/v1/news")
      .send({
        ...newsPayload,
        title: `State Integration News ${uniqueSuffix}`,
        slug: testSlugs.state,
        newsScope: "STATE",
        countryId: newsPayload.countryId,
        stateId: newsPayload.stateId,
        districtId: undefined
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.newsScope).toBe("STATE");

    stateNewsId = response.body.data.id;
  });

  it("should create DISTRICT news", async () => {
    const response = await request(app)
      .post("/api/v1/news")
      .send({
        ...newsPayload,
        title: `District Integration News ${uniqueSuffix}`,
        slug: testSlugs.district,
        newsScope: "DISTRICT",
        countryId: newsPayload.countryId,
        stateId: newsPayload.stateId,
        districtId: newsPayload.districtId
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    expect(response.body.data.newsScope).toBe("DISTRICT");

    districtNewsId = response.body.data.id;
  });
});

/**
 * ============================================================
 * GET /api/v1/news?scope=
 * ============================================================
 */
describe("GET /api/v1/news - Scope Filters", () => {
  it("should filter WORLD news", async () => {
    const response = await request(app).get("/api/v1/news").query({
      scope: "WORLD"
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    for (const item of response.body.data) {
      expect(item.newsScope).toBe("WORLD");
    }
  });

  it("should filter INDIA news", async () => {
    const response = await request(app).get("/api/v1/news").query({
      scope: "INDIA"
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    for (const item of response.body.data) {
      expect(item.newsScope).toBe("INDIA");
    }
  });

  it("should filter STATE news", async () => {
    const response = await request(app).get("/api/v1/news").query({
      scope: "STATE"
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    for (const item of response.body.data) {
      expect(item.newsScope).toBe("STATE");
    }
  });

  it("should filter DISTRICT news", async () => {
    const response = await request(app).get("/api/v1/news").query({
      scope: "DISTRICT"
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    for (const item of response.body.data) {
      expect(item.newsScope).toBe("DISTRICT");
    }
  });

  it("should reject old COUNTRY scope", async () => {
    const response = await request(app).get("/api/v1/news").query({
      scope: "COUNTRY"
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject deprecated GLOBAL scope", async () => {
    const response = await request(app).get("/api/v1/news").query({
      scope: "GLOBAL"
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("should reject old INTERNATIONAL scope", async () => {
    const response = await request(app).get("/api/v1/news").query({
      scope: "INTERNATIONAL"
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

/**
 * ============================================================
 * GET /api/v1/news - Geographic Filters
 * ============================================================
 */
describe("GET /api/v1/news - Geographic Filters", () => {
  it("should filter by countryId", async () => {
    const response = await request(app).get("/api/v1/news").query({
      countryId: newsPayload.countryId
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    for (const item of response.body.data) {
      expect(item.countryId).toBe(newsPayload.countryId);
    }
  });

  it("should filter by stateId", async () => {
    const response = await request(app).get("/api/v1/news").query({
      stateId: newsPayload.stateId
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    for (const item of response.body.data) {
      expect(item.stateId).toBe(newsPayload.stateId);
    }
  });

  it("should filter by districtId", async () => {
    const response = await request(app).get("/api/v1/news").query({
      districtId: newsPayload.districtId
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    for (const item of response.body.data) {
      expect(item.districtId).toBe(newsPayload.districtId);
    }
  });

  it("should support combined scope and state filter", async () => {
    const response = await request(app).get("/api/v1/news").query({
      scope: "STATE",
      stateId: newsPayload.stateId
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    for (const item of response.body.data) {
      expect(item.newsScope).toBe("STATE");
      expect(item.stateId).toBe(newsPayload.stateId);
    }
  });

  it("should support combined district filter", async () => {
    const response = await request(app).get("/api/v1/news").query({
      scope: "DISTRICT",
      stateId: newsPayload.stateId,
      districtId: newsPayload.districtId
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    for (const item of response.body.data) {
      expect(item.newsScope).toBe("DISTRICT");
      expect(item.stateId).toBe(newsPayload.stateId);
      expect(item.districtId).toBe(newsPayload.districtId);
    }
  });
});

/**
 * ============================================================
 * GET /api/v1/news - Pagination / Search
 * ============================================================
 */
describe("GET /api/v1/news", () => {
  it("should return paginated news", async () => {
    const response = await request(app).get("/api/v1/news").query({
      page: 1,
      pageSize: 20
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data).toBeDefined();
    expect(Array.isArray(response.body.data)).toBe(true);

    expect(response.body.meta).toBeDefined();
    expect(response.body.meta.page).toBe(1);
    expect(response.body.meta.pageSize).toBe(20);
    expect(response.body.meta.totalRecords).toBeDefined();
    expect(response.body.meta.totalPages).toBeDefined();
  });

  it("should search news", async () => {
    const response = await request(app).get("/api/v1/news").query({
      page: 1,
      pageSize: 20,
      search: "Integration"
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data).toBeDefined();
  });
});

/**
 * ============================================================
 * GET /api/v1/news/public
 * ============================================================
 */
describe("GET /api/v1/news/public", () => {
  it("should return PUBLISHED news only", async () => {
    const response = await request(app).get("/api/v1/news/public").query({
      page: 1,
      pageSize: 20
    });

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(Array.isArray(response.body.data)).toBe(true);

    for (const item of response.body.data) {
      expect(item.status).toBe("PUBLISHED");
    }
  });

  it("should ignore a client supplied status", async () => {
    const response = await request(app).get("/api/v1/news/public").query({
      page: 1,
      pageSize: 20,
      status: "DRAFT"
    });

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    for (const item of response.body.data) {
      expect(item.status).toBe("PUBLISHED");
    }
  });
});

/**
 * ============================================================
 * Workflow Tests
 * ============================================================
 */
describe("Workflow", () => {
  it("should approve news", async () => {
    const response = await request(app)
      .patch(`/api/v1/news/${createdId}/status`)
      .send({
        status: "APPROVED",
        userId: 1
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});

describe("POST /api/v1/news/:id/promote", () => {
  it("should promote a published news article for 3 days", async () => {
    expect(createdId).toBeGreaterThan(0);

    const publishResponse = await request(app)
      .patch(`/api/v1/news/${createdId}/publish`)
      .send({
        publishedBy: 1
      });

    expect(publishResponse.status).toBe(200);

    const response = await request(app)
      .post(`/api/v1/news/${createdId}/promote`)
      .send({
        promotedBy: 1,
        durationDays: 3
      });

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data).toBeDefined();

    expect(response.body.data.displayPriority).toBeGreaterThan(0);

    expect(response.body.data.displayPriorityUntil).toBeDefined();
  });

  it("should reject promotion duration other than 3 days", async () => {
    const response = await request(app)
      .post(`/api/v1/news/${createdId}/promote`)
      .send({
        promotedBy: 1,
        durationDays: 7
      });

    expect(response.status).toBe(400);

    expect(response.body.success).toBe(false);
  });
});

describe("DELETE /api/v1/news/:id/promotion", () => {
  it("should remove news promotion", async () => {
    const response = await request(app)
      .delete(`/api/v1/news/${createdId}/promotion`)
      .send({
        updatedBy: 1
      });

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.data).toBeDefined();

    expect(response.body.data.displayPriority).toBe(0);

    expect(response.body.data.displayPriorityUntil).toBeNull();
  });
});

describe("PATCH /api/v1/news/:id/archive", () => {
  it("should archive a published news article", async () => {
    const response = await request(app)
      .patch(`/api/v1/news/${createdId}/archive`)
      .send({
        archivedBy: 1
      });

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);
  });
});

/**
 * ============================================================
 * ARCHIVED -> DRAFT ACTIVATION
 * ============================================================
 */
describe("PATCH /api/v1/news/:id/activate", () => {
  it("should activate archived news back to DRAFT", async () => {
    expect(createdId).toBeGreaterThan(0);

    // The previous archive test has already moved this article:
    // PUBLISHED -> ARCHIVED

    const activateResponse = await request(app)
      .patch(`/api/v1/news/${createdId}/activate`)
      .send({
        activatedBy: 1
      });

    expect(activateResponse.status).toBe(200);

    expect(activateResponse.body.success).toBe(true);

    expect(activateResponse.body.data).toBeDefined();

    expect(activateResponse.body.data.status).toBe("DRAFT");

    expect(activateResponse.body.data.publishedAt).toBeNull();
  });

  it("should reject activation when news is not archived", async () => {
    // The previous test has already moved this article:
    // ARCHIVED -> DRAFT

    const response = await request(app)
      .patch(`/api/v1/news/${createdId}/activate`)
      .send({
        activatedBy: 1
      });

    expect(response.status).toBe(400);

    expect(response.body.success).toBe(false);

    expect(response.body.message).toBe("Only archived news can be activated.");
  });
});

/**
 * ============================================================
 * DELETE
 * ============================================================
 *
 * Keep deletion as the final test because the created article
 * is used by the previous ID/slug/update/workflow tests.
 */
describe("DELETE /api/v1/news/:id", () => {
  it("should delete news", async () => {
    const response = await request(app).delete(`/api/v1/news/${createdId}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    createdId = 0;
  });

  it("should return 404 for unknown id", async () => {
    const response = await request(app).delete("/api/v1/news/999999999");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});

// Additional POST Tests:
// ✅ Valid request
// ✅ Empty body
// ✅ Duplicate slug
// ✅ Invalid category ID
// ✅ Invalid newsScope
// ✅ Missing required fields
// Additional GET Tests
// ✅ Existing ID
// ✅ Unknown ID
// ✅ Invalid ID (/api/v1/news/abc)
// Additional PUT Tests
// ✅ Successful update
// ✅ Unknown ID
// ✅ Invalid payload
// ✅ Duplicate slug
// Additional Workflow Tests
// ✅ Approve
// ✅ Publish
// ✅ Archive
// ✅ Invalid status transition
// ✅ Invalid status value
// Additional POST Tests:
// ✅ Valid request
// ✅ Empty body
// ✅ Duplicate slug
// ✅ Invalid category ID
// ✅ Invalid newsScope
// ✅ Missing required fields
// Additional DELETE Tests
// ✅ Successful delete
// ✅ Unknown ID
// ✅ Invalid ID
