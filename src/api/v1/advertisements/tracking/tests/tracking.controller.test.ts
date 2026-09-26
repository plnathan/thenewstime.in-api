import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as service from "../tracking.service.js";
import * as controller from "../tracking.controller.js";

vi.mock("../tracking.service.js", () => ({
  trackImpression: vi.fn(),
  trackClick: vi.fn(),
  getMetrics: vi.fn()
}));

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: vi.fn()
}));

import { sendSuccess } from "../../../../../shared/utils/response.js";

const mockedSendSuccess = vi.mocked(sendSuccess);

const baseBody = {
  advertisementId: 101,
  placementId: 201,
  placementRuleId: 301,
  scheduleId: 401,
  creativeId: 501,
  pageType: "HOME",
  placementType: "HOME_TOP"
};

function createMockResponse(): Response {
  return {} as Response;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe("tracking.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("trackImpression", () => {
    it("passes the request body and metadata to the service", async () => {
      const result = {
        tracked: true,
        eventId: 9001,
        eventAt: new Date("2026-09-22T10:00:00Z")
      };

      vi.mocked(service.trackImpression).mockResolvedValueOnce(result);

      const req = {
        body: baseBody,
        headers: {
          "x-forwarded-for": "203.0.113.10",
          "user-agent": "Mozilla/5.0",
          "x-session-id": "session-101",
          "x-visitor-id": "550e8400-e29b-41d4-a716-446655440000"
        },
        ip: "127.0.0.1"
      } as unknown as Request;

      const res = createMockResponse();
      const next = createMockNext();

      await controller.trackImpression(req, res, next);

      expect(service.trackImpression).toHaveBeenCalledWith(
        expect.objectContaining(baseBody),
        {
          ipAddress: "203.0.113.10",
          userAgent: "Mozilla/5.0",
          sessionId: "session-101",
          visitorId: "550e8400-e29b-41d4-a716-446655440000"
        }
      );

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement impression tracked successfully.",
        result
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("uses req.ip when x-forwarded-for is unavailable", async () => {
      vi.mocked(service.trackImpression).mockResolvedValueOnce({
        tracked: true,
        eventId: 9002,
        eventAt: new Date()
      });

      const req = {
        body: baseBody,
        headers: {},
        ip: "127.0.0.1"
      } as unknown as Request;

      const res = createMockResponse();
      const next = createMockNext();

      await controller.trackImpression(req, res, next);

      expect(service.trackImpression).toHaveBeenCalledWith(
        expect.objectContaining(baseBody),
        {
          ipAddress: "127.0.0.1"
        }
      );
    });

    it("forwards service errors to next", async () => {
      const error = new Error("Tracking failed");

      vi.mocked(service.trackImpression).mockRejectedValueOnce(error);

      const req = {
        body: baseBody,
        headers: {},
        ip: "127.0.0.1"
      } as unknown as Request;

      const res = createMockResponse();
      const next = createMockNext();

      await controller.trackImpression(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("trackClick", () => {
    it("passes the request body and metadata to the service", async () => {
      const result = {
        tracked: true,
        eventId: 9101,
        eventAt: new Date("2026-09-22T10:05:00Z")
      };

      vi.mocked(service.trackClick).mockResolvedValueOnce(result);

      const req = {
        body: baseBody,
        headers: {
          "x-forwarded-for": "203.0.113.20",
          "user-agent": "Mozilla/5.0",
          "x-session-id": "session-202",
          "x-visitor-id": "550e8400-e29b-41d4-a716-446655440001"
        },
        ip: "127.0.0.1"
      } as unknown as Request;

      const res = createMockResponse();
      const next = createMockNext();

      await controller.trackClick(req, res, next);

      expect(service.trackClick).toHaveBeenCalledWith(
        expect.objectContaining(baseBody),
        {
          ipAddress: "203.0.113.20",
          userAgent: "Mozilla/5.0",
          sessionId: "session-202",
          visitorId: "550e8400-e29b-41d4-a716-446655440001"
        }
      );

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement click tracked successfully.",
        result
      );
    });

    it("forwards service errors to next", async () => {
      const error = new Error("Click tracking failed");

      vi.mocked(service.trackClick).mockRejectedValueOnce(error);

      const req = {
        body: baseBody,
        headers: {},
        ip: "127.0.0.1"
      } as unknown as Request;

      const res = createMockResponse();
      const next = createMockNext();

      await controller.trackClick(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockedSendSuccess).not.toHaveBeenCalled();
    });
  });

  describe("getMetrics", () => {
    it("parses parameters and returns metrics", async () => {
      const metrics = {
        advertisementId: 101,
        period: {
          from: null,
          to: null
        },
        totals: {
          impressions: 100,
          clicks: 10,
          uniqueImpressionVisitors: 80,
          uniqueClickVisitors: 9,
          clickThroughRate: 10
        },
        daily: [],
        placements: [],
        creatives: []
      };

      vi.mocked(service.getMetrics).mockResolvedValueOnce(metrics);

      const req = {
        params: {
          advertisementId: "101"
        },
        query: {}
      } as unknown as Request;

      const res = createMockResponse();
      const next = createMockNext();

      await controller.getMetrics(req, res, next);

      expect(service.getMetrics).toHaveBeenCalledWith(101, {});

      expect(mockedSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement metrics retrieved successfully.",
        metrics
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("passes date filters to the service", async () => {
      vi.mocked(service.getMetrics).mockResolvedValueOnce({
        advertisementId: 101,
        period: {
          from: new Date("2026-09-01T00:00:00Z"),
          to: new Date("2026-09-22T00:00:00Z")
        },
        totals: {
          impressions: 10,
          clicks: 1,
          uniqueImpressionVisitors: 8,
          uniqueClickVisitors: 1,
          clickThroughRate: 10
        },
        daily: [],
        placements: [],
        creatives: []
      });

      const req = {
        params: {
          advertisementId: "101"
        },
        query: {
          from: "2026-09-01T00:00:00.000Z",
          to: "2026-09-22T00:00:00.000Z"
        }
      } as unknown as Request;

      const res = createMockResponse();
      const next = createMockNext();

      await controller.getMetrics(req, res, next);

      expect(service.getMetrics).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          from: expect.any(Date),
          to: expect.any(Date)
        })
      );
    });

    it("forwards service errors to next", async () => {
      const error = new Error("Metrics failed");

      vi.mocked(service.getMetrics).mockRejectedValueOnce(error);

      const req = {
        params: {
          advertisementId: "101"
        },
        query: {}
      } as unknown as Request;

      const res = createMockResponse();
      const next = createMockNext();

      await controller.getMetrics(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
