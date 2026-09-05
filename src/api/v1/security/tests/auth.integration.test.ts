import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import app from "../../../../app.js";
import { pool } from "../../../../shared/config/db.js";

describe("Authentication API", () => {
  const testUser = {
    fullName: "Auth Integration Test User",
    displayName: "Auth Test User",
    username: `auth_test_${Date.now()}`,
    email: `auth_test_${Date.now()}@example.com`,
    mobile: `98765${Date.now().toString().slice(-5)}`,
    password: "Test@12345"
  };

  let userId = 0;
  let accessToken = "";
  let refreshToken = "";

  afterAll(async () => {
    if (userId > 0) {
      await pool.query(`DELETE FROM user_sessions WHERE user_id = $1`, [
        userId
      ]);

      await pool.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);

      await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    }
  });

  // ---------------------------------------------------------------------------
  // REGISTER
  // ---------------------------------------------------------------------------

  it("POST /api/v1/auth/register - should register a valid user", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send(testUser);

    expect(response.status).toBe(201);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.username).toBe(testUser.username);
    expect(response.body.data.fullName).toBe(testUser.fullName);
    expect(response.body.data.displayName).toBe(testUser.displayName);
    expect(response.body.data.roles).toBeDefined();

    userId = Number(response.body.data.id);

    expect(userId).toBeGreaterThan(0);
  });

  it("POST /api/v1/auth/register - should reject duplicate username", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send(testUser);

    expect(response.status).toBe(409);
  });

  it("POST /api/v1/auth/register - should reject invalid registration payload", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      fullName: "",
      displayName: "",
      username: "a",
      password: "123"
    });

    expect(response.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------------------------

  it("POST /api/v1/auth/login - should login with valid credentials", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      username: testUser.username,
      password: testUser.password
    });

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.user).toBeDefined();
    expect(response.body.data.tokens).toBeDefined();

    expect(response.body.data.user.username).toBe(testUser.username);

    expect(response.body.data.tokens.accessToken).toBeDefined();
    expect(response.body.data.tokens.refreshToken).toBeDefined();
    expect(response.body.data.tokens.expiresIn).toBeDefined();

    accessToken = response.body.data.tokens.accessToken;
    refreshToken = response.body.data.tokens.refreshToken;

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  it("POST /api/v1/auth/login - should reject invalid password", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      username: testUser.username,
      password: "WrongPassword@123"
    });

    expect(response.status).toBe(401);
  });

  it("POST /api/v1/auth/login - should reject unknown username", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        username: `unknown_user_${Date.now()}`,
        password: testUser.password
      });

    expect(response.status).toBe(401);
  });

  it("POST /api/v1/auth/login - should reject invalid login payload", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      username: "",
      password: ""
    });

    expect(response.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // ME
  // ---------------------------------------------------------------------------

  it("GET /api/v1/auth/me - should return authenticated user", async () => {
    expect(accessToken).toBeTruthy();

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(Number(response.body.data.id)).toBe(userId);
    expect(response.body.data.username).toBe(testUser.username);
  });

  it("GET /api/v1/auth/me - should reject missing token", async () => {
    const response = await request(app).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
  });

  it("GET /api/v1/auth/me - should reject invalid token", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
  });

  it("GET /api/v1/auth/me - should reject invalid authorization header", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Basic invalid-token");

    expect(response.status).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // REFRESH TOKEN
  // ---------------------------------------------------------------------------

  it("POST /api/v1/auth/refresh - should refresh a valid refresh token", async () => {
    expect(refreshToken).toBeTruthy();

    const response = await request(app).post("/api/v1/auth/refresh").send({
      refreshToken
    });

    expect(response.status).toBe(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.user).toBeDefined();
    expect(response.body.data.tokens).toBeDefined();

    expect(response.body.data.user.username).toBe(testUser.username);

    expect(response.body.data.tokens.accessToken).toBeDefined();
    expect(response.body.data.tokens.refreshToken).toBeDefined();
    expect(response.body.data.tokens.expiresIn).toBeDefined();

    accessToken = response.body.data.tokens.accessToken;
    refreshToken = response.body.data.tokens.refreshToken;

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  it("POST /api/v1/auth/refresh - should reject invalid refresh token", async () => {
    const response = await request(app).post("/api/v1/auth/refresh").send({
      refreshToken: "invalid-refresh-token"
    });

    expect(response.status).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------------------------

  it("POST /api/v1/auth/logout - should logout successfully", async () => {
    expect(refreshToken).toBeTruthy();

    const response = await request(app).post("/api/v1/auth/logout").send({
      refreshToken
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
  });

  it("POST /api/v1/auth/refresh - should reject revoked refresh token after logout", async () => {
    const response = await request(app).post("/api/v1/auth/refresh").send({
      refreshToken
    });

    expect(response.status).toBe(401);
  });
});
