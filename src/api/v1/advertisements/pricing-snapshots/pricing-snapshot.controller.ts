import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import { sendSuccess } from "../../../../shared/utils/response.js";

import * as service from "./pricing-snapshot.service.js";

const getPositiveInteger = (
  value: string | undefined,
  fieldName: string
): number => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer.`);
  }

  return parsed;
};

const getParamString = (
  value: string | string[] | undefined,
  fieldName: string
): string | undefined => {
  if (Array.isArray(value)) {
    throw new ApiError(400, `Invalid ${fieldName} parameter.`);
  }

  return value;
};

export const createPricingSnapshot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, "Authenticated user is required.");
    }

    const snapshot = await service.createFromRateCard(
      getPositiveInteger(String(req.body.advertisementId), "advertisementId"),
      getPositiveInteger(String(req.body.placementId), "placementId"),
      getPositiveInteger(String(req.body.rateCardId), "rateCardId"),
      userId
    );

    sendSuccess(res, "Pricing snapshot created successfully.", snapshot, 201);
  } catch (error) {
    next(error);
  }
};

export const getPricingSnapshot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = getPositiveInteger(getParamString(req.params.id, "id"), "id");

    const snapshot = await service.getById(id);

    if (!snapshot) {
      throw new ApiError(404, "Pricing snapshot not found.");
    }

    sendSuccess(res, "Pricing snapshot retrieved successfully.", snapshot);
  } catch (error) {
    next(error);
  }
};

export const getPricingSnapshotsByAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const advertisementId = getPositiveInteger(
      getParamString(req.params.advertisementId, "advertisementId"),
      "advertisementId"
    );

    const snapshots = await service.getByAdvertisementId(advertisementId);

    sendSuccess(res, "Pricing snapshots retrieved successfully.", snapshots);
  } catch (error) {
    next(error);
  }
};

export const getLatestPricingSnapshot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const advertisementId = getPositiveInteger(
      getParamString(req.params.advertisementId, "advertisementId"),
      "advertisementId"
    );

    const snapshot = await service.getLatestByAdvertisementId(advertisementId);

    if (!snapshot) {
      throw new ApiError(404, "Pricing snapshot not found for advertisement.");
    }

    sendSuccess(
      res,
      "Latest pricing snapshot retrieved successfully.",
      snapshot
    );
  } catch (error) {
    next(error);
  }
};

export const getLatestPricingSnapshotByPlacement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const advertisementId = getPositiveInteger(
      getParamString(req.params.advertisementId, "advertisementId"),
      "advertisementId"
    );

    const placementId = getPositiveInteger(
      getParamString(req.params.placementId, "placementId"),
      "placementId"
    );

    const snapshot = await service.getLatestByAdvertisementAndPlacement(
      advertisementId,
      placementId
    );

    if (!snapshot) {
      throw new ApiError(
        404,
        "Pricing snapshot not found for advertisement and placement."
      );
    }

    sendSuccess(
      res,
      "Latest placement pricing snapshot retrieved successfully.",
      snapshot
    );
  } catch (error) {
    next(error);
  }
};
