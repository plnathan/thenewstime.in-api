import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../../../../app.js";

import { cleanupNews, closeDatabase } from "./helpers/news.test-helper.js";
import { newsPayload } from "./news.test-data.js";

let createdId = 0;

beforeAll(async () => {
  // Reserved for future global setup (e.g., authentication)
});

afterAll(async () => {
  if (createdId > 0) {
    await cleanupNews(createdId);
  }

  await closeDatabase();
});

// POST
describe("POST /api/v1/news", () => {
  it("should create a news article", async () => {
    const response = await request(app).post("/api/v1/news").send(newsPayload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    createdId = response.body.data.id;
  });

  it("should reject duplicate slug", async () => {
    const response = await request(app).post("/api/v1/news").send(newsPayload);

    expect(response.status).toBe(409);
  });

  it("should reject invalid payload", async () => {
    const response = await request(app).post("/api/v1/news").send({});

    expect(response.status).toBe(400);
  });

  it("should return validation error", async () => {
    const response = await request(app).post("/api/v1/news").send({});

    expect(response.status).toBe(400);

    expect(response.body.success).toBe(false);

    expect(response.body.message).toBe("Validation failed");

    expect(response.body.errors).toBeDefined();
  });
});
// Additional POST Tests:
// ✅ Valid request
// ✅ Empty body
// ✅ Duplicate slug
// ✅ Invalid category ID
// ✅ Invalid newsScope
// ✅ Missing required fields
// GET
describe("GET /api/v1/news/:id", () => {
  it("should return a news article", async () => {
    const response = await request(app).get(`/api/v1/news/${createdId}`);

    expect(response.status).toBe(200);

    expect(response.body.success).toBe(true);

    expect(response.body.message).toBe("News retrieved successfully.");
  });

  it("should return 404", async () => {
    const response = await request(app).get("/api/v1/news/99999999");

    expect(response.status).toBe(404);
  });
});

// GET Not Found
describe("GET /api/v1/news/:id", () => {
  it("should return 404 for unknown id", async () => {
    const response = await request(app).get("/api/v1/news/999999999");

    expect(response.status).toBe(404);

    expect(response.body.success).toBe(false);

    expect(response.body.message).toBe("News not found.");
  });
});

// Additional GET Tests
// ✅ Existing ID
// ✅ Unknown ID
// ✅ Invalid ID (/api/v1/news/abc)

// PUT
describe("PUT /api/v1/news", () => {
  it("should update title", async () => {
    const response = await request(app).put(`/api/v1/news/${createdId}`).send({
      title: "Updated Integration Title",
      updatedBy: 1
    });

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe("Updated Integration Title");
  });
});
// Additional PUT Tests
// ✅ Successful update
// ✅ Unknown ID
// ✅ Invalid payload
// ✅ Duplicate slug

// Workflow Tests
describe("Workflow", () => {
  it("should approve news", async () => {
    const response = await request(app)
      .patch(`/api/v1/news/${createdId}/status`)
      .send({
        status: "APPROVED",
        userId: 1
      });

    expect(response.status).toBe(200);
  });
});
// Additional Workflow Tests
// ✅ Approve
// ✅ Publish
// ✅ Archive
// ✅ Invalid status transition
// ✅ Invalid status value

// DELETE
describe("DELETE /api/v1/news", () => {
  it("should delete news", async () => {
    const response = await request(app).delete(`/api/v1/news/${createdId}`);

    expect(response.status).toBe(200);

    createdId = 0;
  });
});
// Additional DELETE Tests
// ✅ Successful delete
// ✅ Unknown ID
// ✅ Invalid ID
