import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  serviceMocks,
  authorizeMock,
  authorizationConfigurations,
  AdvertisementTargetServiceError
} = vi.hoisted(() => {
  class AdvertisementTargetServiceError extends Error {
    public readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
      super(message);
      this.name = "AdvertisementTargetServiceError";
      this.statusCode = statusCode;
    }
  }

  return {
    serviceMocks: {
      listTargets: vi.fn(),
      addTarget: vi.fn(),
      editTarget: vi.fn(),
      removeTarget: vi.fn(),
      replaceTargets: vi.fn()
    },
    authorizeMock: vi.fn(),
    authorizationConfigurations: [] as unknown[][],
    AdvertisementTargetServiceError
  };
});

const authenticatedUserId = 1;

vi.mock("../../../security/middleware/authorize.middleware.js", () => ({
  authorize: (...args: unknown[]) => {
    authorizationConfigurations.push(args);
    authorizeMock(...args);

    return (
      request: express.Request,
      _response: express.Response,
      next: express.NextFunction
    ) => {
      // Simulate the authenticated request context supplied by the
      // real authentication middleware before the controller executes.
      Object.assign(request, {
        user: {
          id: authenticatedUserId
        }
      });

      next();
    };
  }
}));

vi.mock("../target.service.js", () => ({
  ...serviceMocks,
  AdvertisementTargetServiceError
}));

import targetRoutes from "../target.routes.js";

const sampleTarget = {
  id: 101,
  advertisementId: 202,
  targetType: "STATE" as const,
  targetValue: "tamil-nadu",
  isInclude: true,
  createdAt: "2026-09-19T10:00:00.000Z",
  updatedAt: "2026-09-19T11:00:00.000Z"
};

function createApp() {
  const app = express();

  app.use(express.json());
  app.use("/api/v1/advertisements", targetRoutes);

  // Test-only error handler for unexpected errors passed by controllers.
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction
    ) => {
      response.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Internal server error."
      });
    }
  );

  return app;
}

describe("Advertisement Targeting routes", () => {
  const app = createApp();

  beforeEach(() => {
    // Reset service behavior and call history between tests.
    // Authorization configurations are recorded when the router
    // initializes, so retain those registration records.
    serviceMocks.listTargets.mockReset();
    serviceMocks.addTarget.mockReset();
    serviceMocks.editTarget.mockReset();
    serviceMocks.removeTarget.mockReset();
    serviceMocks.replaceTargets.mockReset();
  });

  describe("GET /api/v1/advertisements/:advertisementId/targets", () => {
    it("returns targeting rules for a valid advertisement", async () => {
      serviceMocks.listTargets.mockResolvedValueOnce([sampleTarget]);

      const response = await request(app)
        .get("/api/v1/advertisements/202/targets")
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Advertisement targeting rules retrieved successfully.",
        data: [sampleTarget],
        errors: null,
        meta: null
      });

      expect(serviceMocks.listTargets).toHaveBeenCalledWith(202);

      expect(authorizationConfigurations).toContainEqual([
        "ADVERTISEMENT",
        "advertisements.targets",
        "read"
      ]);
    });

    it("returns 400 for an invalid advertisement ID", async () => {
      const response = await request(app)
        .get("/api/v1/advertisements/invalid/targets")
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: "Invalid advertisement ID.",
        data: null
      });

      expect(serviceMocks.listTargets).not.toHaveBeenCalled();
    });

    it("returns an empty array when there are no targeting rules", async () => {
      serviceMocks.listTargets.mockResolvedValueOnce([]);

      const response = await request(app)
        .get("/api/v1/advertisements/202/targets")
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe("POST /api/v1/advertisements/:advertisementId/targets", () => {
    it("creates a targeting rule", async () => {
      serviceMocks.addTarget.mockResolvedValueOnce(sampleTarget);

      const response = await request(app)
        .post("/api/v1/advertisements/202/targets")
        .send({
          targetType: "STATE",
          targetValue: "tamil-nadu"
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: "Advertisement targeting rule created successfully.",
        data: sampleTarget
      });

      expect(serviceMocks.addTarget).toHaveBeenCalledWith(
        202,
        {
          targetType: "STATE",
          targetValue: "tamil-nadu",
          isInclude: true
        },
        authenticatedUserId
      );

      expect(authorizationConfigurations).toContainEqual([
        "ADVERTISEMENT",
        "advertisements.targets",
        "create"
      ]);
    });

    it("trims the target value before passing it to the service", async () => {
      serviceMocks.addTarget.mockResolvedValueOnce(sampleTarget);

      await request(app)
        .post("/api/v1/advertisements/202/targets")
        .send({
          targetType: "STATE",
          targetValue: "  tamil-nadu  "
        })
        .expect(201);

      expect(serviceMocks.addTarget).toHaveBeenCalledWith(
        202,
        {
          targetType: "STATE",
          targetValue: "tamil-nadu",
          isInclude: true
        },
        authenticatedUserId
      );
    });

    it("returns 400 for an unsupported target type", async () => {
      const response = await request(app)
        .post("/api/v1/advertisements/202/targets")
        .send({
          targetType: "CITY",
          targetValue: "chennai"
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: "Invalid advertisement targeting request."
      });

      expect(serviceMocks.addTarget).not.toHaveBeenCalled();
    });

    it("returns 400 for a blank target value", async () => {
      await request(app)
        .post("/api/v1/advertisements/202/targets")
        .send({
          targetType: "STATE",
          targetValue: "   "
        })
        .expect(400);

      expect(serviceMocks.addTarget).not.toHaveBeenCalled();
    });
  });

  describe("PUT /api/v1/advertisements/:advertisementId/targets", () => {
    it("replaces the complete targeting configuration", async () => {
      serviceMocks.replaceTargets.mockResolvedValueOnce([sampleTarget]);

      const response = await request(app)
        .put("/api/v1/advertisements/202/targets")
        .send({
          targets: [
            {
              targetType: "STATE",
              targetValue: "tamil-nadu"
            }
          ]
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Advertisement targeting configuration saved successfully.",
        data: [sampleTarget]
      });

      expect(serviceMocks.replaceTargets).toHaveBeenCalledWith(
        202,
        [
          {
            targetType: "STATE",
            targetValue: "tamil-nadu",
            isInclude: true
          }
        ],
        authenticatedUserId
      );

      expect(authorizationConfigurations).toContainEqual([
        "ADVERTISEMENT",
        "advertisements.targets",
        "update"
      ]);
    });

    it("allows an empty array to clear the targeting configuration", async () => {
      serviceMocks.replaceTargets.mockResolvedValueOnce([]);

      const response = await request(app)
        .put("/api/v1/advertisements/202/targets")
        .send({ targets: [] })
        .expect(200);

      expect(serviceMocks.replaceTargets).toHaveBeenCalledWith(
        202,
        [],
        authenticatedUserId
      );

      expect(response.body.data).toEqual([]);
    });

    it("returns 400 when targets is not an array", async () => {
      await request(app)
        .put("/api/v1/advertisements/202/targets")
        .send({ targets: "tamil-nadu" })
        .expect(400);

      expect(serviceMocks.replaceTargets).not.toHaveBeenCalled();
    });

    it("returns 400 when one replacement rule is invalid", async () => {
      await request(app)
        .put("/api/v1/advertisements/202/targets")
        .send({
          targets: [
            {
              targetType: "UNKNOWN",
              targetValue: "invalid"
            }
          ]
        })
        .expect(400);

      expect(serviceMocks.replaceTargets).not.toHaveBeenCalled();
    });

    it("returns 400 when more than 100 rules are submitted", async () => {
      const targets = Array.from({ length: 101 }, (_, index) => ({
        targetType: "STATE",
        targetValue: `state-${index + 1}`
      }));

      await request(app)
        .put("/api/v1/advertisements/202/targets")
        .send({ targets })
        .expect(400);

      expect(serviceMocks.replaceTargets).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/v1/advertisements/:advertisementId/targets/:targetId", () => {
    it("updates a targeting rule", async () => {
      const updatedTarget = {
        ...sampleTarget,
        targetValue: "kerala"
      };

      serviceMocks.editTarget.mockResolvedValueOnce(updatedTarget);

      const response = await request(app)
        .patch("/api/v1/advertisements/202/targets/101")
        .send({
          targetValue: "kerala"
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Advertisement targeting rule updated successfully.",
        data: updatedTarget
      });

      expect(serviceMocks.editTarget).toHaveBeenCalledWith(
        202,
        101,
        {
          targetValue: "kerala"
        },
        authenticatedUserId
      );

      expect(authorizationConfigurations).toContainEqual([
        "ADVERTISEMENT",
        "advertisements.targets",
        "update"
      ]);
    });

    it("returns 400 for an invalid target ID", async () => {
      await request(app)
        .patch("/api/v1/advertisements/202/targets/invalid")
        .send({
          targetValue: "kerala"
        })
        .expect(400);

      expect(serviceMocks.editTarget).not.toHaveBeenCalled();
    });

    it("returns 400 when the update contains no fields", async () => {
      await request(app)
        .patch("/api/v1/advertisements/202/targets/101")
        .send({})
        .expect(400);

      expect(serviceMocks.editTarget).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid update field", async () => {
      await request(app)
        .patch("/api/v1/advertisements/202/targets/101")
        .send({
          targetValue: ""
        })
        .expect(400);

      expect(serviceMocks.editTarget).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/v1/advertisements/:advertisementId/targets/:targetId", () => {
    it("deletes a targeting rule", async () => {
      serviceMocks.removeTarget.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete("/api/v1/advertisements/202/targets/101")
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Advertisement targeting rule deleted successfully.",
        data: {
          id: 101
        }
      });

      expect(serviceMocks.removeTarget).toHaveBeenCalledWith(202, 101);

      expect(authorizationConfigurations).toContainEqual([
        "ADVERTISEMENT",
        "advertisements.targets",
        "delete"
      ]);
    });

    it("returns 400 for an invalid advertisement ID", async () => {
      await request(app)
        .delete("/api/v1/advertisements/invalid/targets/101")
        .expect(400);

      expect(serviceMocks.removeTarget).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid target ID", async () => {
      await request(app)
        .delete("/api/v1/advertisements/202/targets/0")
        .expect(400);

      expect(serviceMocks.removeTarget).not.toHaveBeenCalled();
    });
  });

  describe("service error responses", () => {
    it("returns the service error status and message", async () => {
      const error = new AdvertisementTargetServiceError(
        "Advertisement not found.",
        404
      );

      serviceMocks.listTargets.mockRejectedValueOnce(error);

      const response = await request(app)
        .get("/api/v1/advertisements/202/targets")
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "Advertisement not found.",
        data: null
      });
    });

    it("passes unexpected service errors to the Express error handler", async () => {
      serviceMocks.listTargets.mockRejectedValueOnce(
        new Error("unexpected failure")
      );

      const response = await request(app)
        .get("/api/v1/advertisements/202/targets")
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: "unexpected failure"
      });
    });
  });
});
