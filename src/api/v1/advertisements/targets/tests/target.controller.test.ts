import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  listTargets: vi.fn(),
  addTarget: vi.fn(),
  editTarget: vi.fn(),
  removeTarget: vi.fn(),
  replaceTargets: vi.fn()
}));

vi.mock("../target.service.js", () => {
  class AdvertisementTargetServiceError extends Error {
    public readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
      super(message);
      this.name = "AdvertisementTargetServiceError";
      this.statusCode = statusCode;
    }
  }

  return {
    ...serviceMocks,
    AdvertisementTargetServiceError
  };
});

import * as targetService from "../target.service.js";
import {
  createTarget,
  deleteTarget,
  getTargets,
  replaceAllTargets,
  updateTarget
} from "../target.controller.js";

const sampleTarget = {
  id: 101,
  advertisementId: 202,
  targetType: "STATE" as const,
  targetValue: "tamil-nadu",
  isInclude: true,
  createdAt: new Date("2026-09-19T10:00:00.000Z"),
  updatedAt: new Date("2026-09-19T11:00:00.000Z")
};

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn()
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response;
}

function createRequest(
  params: Record<string, string> = {},
  body: unknown = {}
): Request {
  return {
    params,
    body
  } as unknown as Request;
}

function createNext() {
  return vi.fn<NextFunction>();
}

describe("target.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTargets", () => {
    it("returns targeting rules for a valid advertisement ID", async () => {
      serviceMocks.listTargets.mockResolvedValueOnce([sampleTarget]);

      const response = createResponse();
      const next = vi.fn();

      await getTargets(
        createRequest({ advertisementId: "202" }),
        response as unknown as Response,
        next
      );

      expect(serviceMocks.listTargets).toHaveBeenCalledWith(202);
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        success: true,
        message: "Advertisement targeting rules retrieved successfully.",
        data: [sampleTarget],
        errors: null,
        meta: null
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid advertisement ID", async () => {
      const response = createResponse();
      const next = vi.fn();

      await getTargets(
        createRequest({ advertisementId: "invalid" }),
        response as unknown as Response,
        next
      );

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid advertisement ID.",
        data: null,
        errors: null,
        meta: null
      });
      expect(serviceMocks.listTargets).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("passes unexpected errors to Express error middleware", async () => {
      const error = new Error("database failure");
      serviceMocks.listTargets.mockRejectedValueOnce(error);

      const response = createResponse();
      const next = vi.fn();

      await getTargets(
        createRequest({ advertisementId: "202" }),
        response as unknown as Response,
        next
      );

      expect(next).toHaveBeenCalledWith(error);
    });

    it("returns a service error using its status code", async () => {
      const error = new targetService.AdvertisementTargetServiceError(
        "Advertisement not found.",
        404
      );

      serviceMocks.listTargets.mockRejectedValueOnce(error);

      const response = createResponse();
      const next = vi.fn();

      await getTargets(
        createRequest({ advertisementId: "202" }),
        response as unknown as Response,
        next
      );

      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: "Advertisement not found.",
        data: null,
        errors: null,
        meta: null
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("createTarget", () => {
    it("creates a targeting rule and returns 201", async () => {
      serviceMocks.addTarget.mockResolvedValueOnce(sampleTarget);

      const response = createResponse();
      const next = vi.fn();

      await createTarget(
        createRequest(
          { advertisementId: "202" },
          {
            targetType: "STATE",
            targetValue: "tamil-nadu",
            isInclude: true
          }
        ),
        response as unknown as Response,
        next
      );

      expect(serviceMocks.addTarget).toHaveBeenCalledWith(202, {
        targetType: "STATE",
        targetValue: "tamil-nadu",
        isInclude: true
      });
      expect(response.status).toHaveBeenCalledWith(201);
      expect(response.json).toHaveBeenCalledWith({
        success: true,
        message: "Advertisement targeting rule created successfully.",
        data: sampleTarget,
        errors: null,
        meta: null
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 400 when the request body is invalid", async () => {
      const response = createResponse();
      const next = vi.fn();

      await createTarget(
        createRequest(
          { advertisementId: "202" },
          {
            targetType: "INVALID",
            targetValue: ""
          }
        ),
        response as unknown as Response,
        next
      );

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid advertisement targeting request.",
        data: null,
        errors: null,
        meta: null
      });
      expect(serviceMocks.addTarget).not.toHaveBeenCalled();
    });

    it("passes unexpected errors to Express error middleware", async () => {
      const error = new Error("database failure");
      serviceMocks.addTarget.mockRejectedValueOnce(error);

      const response = createResponse();
      const next = vi.fn();

      await createTarget(
        createRequest(
          { advertisementId: "202" },
          {
            targetType: "STATE",
            targetValue: "tamil-nadu"
          }
        ),
        response as unknown as Response,
        next
      );

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateTarget", () => {
    it("updates only the supplied fields", async () => {
      serviceMocks.editTarget.mockResolvedValueOnce({
        ...sampleTarget,
        targetValue: "kerala"
      });

      const response = createResponse();
      const next = vi.fn();

      await updateTarget(
        createRequest(
          {
            advertisementId: "202",
            targetId: "101"
          },
          {
            targetValue: "kerala"
          }
        ),
        response as unknown as Response,
        next
      );

      expect(serviceMocks.editTarget).toHaveBeenCalledWith(202, 101, {
        targetValue: "kerala"
      });
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        success: true,
        message: "Advertisement targeting rule updated successfully.",
        data: {
          ...sampleTarget,
          targetValue: "kerala"
        },
        errors: null,
        meta: null
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid identifiers", async () => {
      const response = createResponse();
      const next = vi.fn();

      await updateTarget(
        createRequest(
          {
            advertisementId: "0",
            targetId: "invalid"
          },
          {
            targetValue: "kerala"
          }
        ),
        response as unknown as Response,
        next
      );

      expect(response.status).toHaveBeenCalledWith(400);
      expect(serviceMocks.editTarget).not.toHaveBeenCalled();
    });

    it("returns 400 when no update fields are supplied", async () => {
      const response = createResponse();
      const next = vi.fn();

      await updateTarget(
        createRequest(
          {
            advertisementId: "202",
            targetId: "101"
          },
          {}
        ),
        response as unknown as Response,
        next
      );

      expect(response.status).toHaveBeenCalledWith(400);
      expect(serviceMocks.editTarget).not.toHaveBeenCalled();
    });

    it("handles service errors", async () => {
      serviceMocks.editTarget.mockRejectedValueOnce(
        new targetService.AdvertisementTargetServiceError(
          "Targeting rule not found for this advertisement.",
          404
        )
      );

      const response = createResponse();
      const next = vi.fn();

      await updateTarget(
        createRequest(
          {
            advertisementId: "202",
            targetId: "101"
          },
          {
            targetValue: "kerala"
          }
        ),
        response as unknown as Response,
        next
      );

      expect(response.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("deleteTarget", () => {
    it("deletes a targeting rule and returns its ID", async () => {
      serviceMocks.removeTarget.mockResolvedValueOnce(undefined);

      const response = createResponse();
      const next = vi.fn();

      await deleteTarget(
        createRequest({
          advertisementId: "202",
          targetId: "101"
        }),
        response as unknown as Response,
        next
      );

      expect(serviceMocks.removeTarget).toHaveBeenCalledWith(202, 101);
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        success: true,
        message: "Advertisement targeting rule deleted successfully.",
        data: { id: 101 },
        errors: null,
        meta: null
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid identifiers", async () => {
      const response = createResponse();
      const next = vi.fn();

      await deleteTarget(
        createRequest({
          advertisementId: "202",
          targetId: "-1"
        }),
        response as unknown as Response,
        next
      );

      expect(response.status).toHaveBeenCalledWith(400);
      expect(serviceMocks.removeTarget).not.toHaveBeenCalled();
    });

    it("passes unexpected errors to Express error middleware", async () => {
      const error = new Error("database failure");
      serviceMocks.removeTarget.mockRejectedValueOnce(error);

      const response = createResponse();
      const next = vi.fn();

      await deleteTarget(
        createRequest({
          advertisementId: "202",
          targetId: "101"
        }),
        response as unknown as Response,
        next
      );

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("replaceAllTargets", () => {
    it("replaces targeting rules and returns the saved list", async () => {
      serviceMocks.replaceTargets.mockResolvedValueOnce([sampleTarget]);

      const response = createResponse();
      const next = vi.fn();

      await replaceAllTargets(
        createRequest(
          { advertisementId: "202" },
          {
            targets: [
              {
                targetType: "STATE",
                targetValue: "tamil-nadu",
                isInclude: true
              }
            ]
          }
        ),
        response as unknown as Response,
        next
      );

      expect(serviceMocks.replaceTargets).toHaveBeenCalledWith(202, [
        {
          targetType: "STATE",
          targetValue: "tamil-nadu",
          isInclude: true
        }
      ]);
      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        success: true,
        message: "Advertisement targeting configuration saved successfully.",
        data: [sampleTarget],
        errors: null,
        meta: null
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("allows an empty target list to clear existing rules", async () => {
      serviceMocks.replaceTargets.mockResolvedValueOnce([]);

      const response = createResponse();
      const next = vi.fn();

      await replaceAllTargets(
        createRequest({ advertisementId: "202" }, { targets: [] }),
        response as unknown as Response,
        next
      );

      expect(serviceMocks.replaceTargets).toHaveBeenCalledWith(202, []);
      expect(response.status).toHaveBeenCalledWith(200);
    });

    it("returns 400 when replacement data is invalid", async () => {
      const response = createResponse();
      const next = vi.fn();

      await replaceAllTargets(
        createRequest(
          { advertisementId: "202" },
          {
            targets: [
              {
                targetType: "UNKNOWN",
                targetValue: ""
              }
            ]
          }
        ),
        response as unknown as Response,
        next
      );

      expect(response.status).toHaveBeenCalledWith(400);
      expect(serviceMocks.replaceTargets).not.toHaveBeenCalled();
    });

    it("passes unexpected errors to Express error middleware", async () => {
      const error = new Error("database failure");
      serviceMocks.replaceTargets.mockRejectedValueOnce(error);

      const response = createResponse();
      const next = vi.fn();

      await replaceAllTargets(
        createRequest({ advertisementId: "202" }, { targets: [] }),
        response as unknown as Response,
        next
      );

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
