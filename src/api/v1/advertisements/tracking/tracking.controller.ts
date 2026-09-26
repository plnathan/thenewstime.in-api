import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import * as service from "./tracking.service.js";
import {
  advertisementMetricsParamsSchema,
  advertisementMetricsQuerySchema,
  advertisementTrackingSchema
} from "./tracking.validation.js";

function getClientIp(req: Request): string | undefined {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0]?.trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0]?.trim();
  }

  return req.ip;
}

function getOptionalHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value) && value.length > 0) {
    const firstValue = value[0]?.trim();

    if (firstValue) {
      return firstValue;
    }
  }

  return undefined;
}

function getTrackingRequestMetadata(req: Request): {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  visitorId?: string;
} {
  const metadata: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    visitorId?: string;
  } = {};

  const ipAddress = getClientIp(req);
  const userAgent = getOptionalHeader(req, "user-agent");
  const sessionId = getOptionalHeader(req, "x-session-id");
  const visitorId = getOptionalHeader(req, "x-visitor-id");

  if (ipAddress !== undefined) {
    metadata.ipAddress = ipAddress;
  }

  if (userAgent !== undefined) {
    metadata.userAgent = userAgent;
  }

  if (sessionId !== undefined) {
    metadata.sessionId = sessionId;
  }

  if (visitorId !== undefined) {
    metadata.visitorId = visitorId;
  }

  return metadata;
}

export const trackImpression = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = advertisementTrackingSchema.parse(req.body);

    const result = await service.trackImpression(
      input,
      getTrackingRequestMetadata(req)
    );

    sendSuccess(res, "Advertisement impression tracked successfully.", result);
  } catch (error) {
    next(error);
  }
};

export const trackClick = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = advertisementTrackingSchema.parse(req.body);

    const result = await service.trackClick(
      input,
      getTrackingRequestMetadata(req)
    );

    sendSuccess(res, "Advertisement click tracked successfully.", result);
  } catch (error) {
    next(error);
  }
};

export const getMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const params = advertisementMetricsParamsSchema.parse(req.params);
    const query = advertisementMetricsQuerySchema.parse(req.query);

    const result = await service.getMetrics(params.advertisementId, query);

    sendSuccess(res, "Advertisement metrics retrieved successfully.", result);
  } catch (error) {
    next(error);
  }
};
