import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../../../../../app.js";

const basePath = "/api/v1/advertisement-clients";

describe("Advertisement Client API Integration", () => {
  describe("Authentication", () => {
    it("rejects GET clients without authentication", async () => {
      const response = await request(app).get(basePath);

      expect(response.status).toBe(401);
    });

    it("rejects GET client by id without authentication", async () => {
      const response = await request(app).get(`${basePath}/1`);

      expect(response.status).toBe(401);
    });

    it("rejects POST client without authentication", async () => {
      const response = await request(app).post(basePath).send({
        clientCode: "TEST-CLIENT-001",
        name: "Test Client"
      });

      expect(response.status).toBe(401);
    });

    it("rejects PATCH client without authentication", async () => {
      const response = await request(app).patch(`${basePath}/1`).send({
        name: "Updated Client"
      });

      expect(response.status).toBe(401);
    });
  });

  describe("Route availability", () => {
    it("registers the client collection route", async () => {
      const response = await request(app).get(basePath);

      expect(response.status).not.toBe(404);
    });

    it("registers the client by id route", async () => {
      const response = await request(app).get(`${basePath}/1`);

      expect(response.status).not.toBe(404);
    });

    it("registers the client creation route", async () => {
      const response = await request(app).post(basePath).send({
        clientCode: "TEST-CLIENT-001",
        name: "Test Client"
      });

      expect(response.status).not.toBe(404);
    });

    it("registers the client update route", async () => {
      const response = await request(app).patch(`${basePath}/1`).send({
        name: "Updated Client"
      });

      expect(response.status).not.toBe(404);
    });
  });
});
