import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import { sendSuccess } from "../../../../shared/utils/response.js";

import * as service from "./rate-card.service.js";

import type {
  AdvertisementRateCardPricingUnit,
  AdvertisementRateCardStatus,
  CreateAdvertisementRateCardInput,
  UpdateAdvertisementRateCardInput
} from "./rate-card.types.js";

const getParamString = (
  value: string | string[] | undefined,
  fieldName: string
): string | undefined => {
  if (Array.isArray(value)) {
    throw new ApiError(400, `Invalid ${fieldName} parameter.`);
  }

  return value;
};

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

export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as {
      placementId?: string;
      pricingUnit?: string;
      status?: string;
    };

    const filters: {
      placementId?: number;
      pricingUnit?: AdvertisementRateCardPricingUnit;
      status?: AdvertisementRateCardStatus;
    } = {};

    if (query.placementId !== undefined) {
      filters.placementId = getPositiveInteger(
        query.placementId,
        "placementId"
      );
    }

    if (query.pricingUnit !== undefined) {
      filters.pricingUnit =
        query.pricingUnit as AdvertisementRateCardPricingUnit;
    }

    if (query.status !== undefined) {
      filters.status = query.status as AdvertisementRateCardStatus;
    }

    const rateCards = await service.getAll(filters);

    sendSuccess(
      res,
      "Advertisement rate cards retrieved successfully.",
      rateCards
    );
  } catch (error) {
    next(error);
  }
};

export const getById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = getPositiveInteger(getParamString(req.params.id, "id"), "id");

    const rateCard = await service.getById(id);

    sendSuccess(
      res,
      "Advertisement rate card retrieved successfully.",
      rateCard
    );
  } catch (error) {
    next(error);
  }
};

export const getByPlacementId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const placementId = getPositiveInteger(
      getParamString(req.params.placementId, "placementId"),
      "placementId"
    );

    const rateCards = await service.getByPlacementId(placementId);

    sendSuccess(
      res,
      "Advertisement rate cards retrieved successfully.",
      rateCards
    );
  } catch (error) {
    next(error);
  }
};

export const getEffectiveRate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const placementId = getPositiveInteger(
      getParamString(req.params.placementId, "placementId"),
      "placementId"
    );

    const pricingUnit = getParamString(
      req.params.pricingUnit,
      "pricingUnit"
    ) as AdvertisementRateCardPricingUnit;

    const effectiveAt =
      typeof req.query.effectiveAt === "string"
        ? req.query.effectiveAt
        : new Date();

    const rateCard = await service.getEffectiveRate(
      placementId,
      pricingUnit,
      effectiveAt
    );

    if (rateCard === null) {
      throw new ApiError(
        404,
        "No effective active advertisement rate card was found."
      );
    }

    sendSuccess(
      res,
      "Effective advertisement rate card retrieved successfully.",
      rateCard
    );
  } catch (error) {
    next(error);
  }
};

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as CreateAdvertisementRateCardInput;

    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, "Authenticated user is required.");
    }

    const rateCard = await service.create(input, userId);

    sendSuccess(
      res,
      "Advertisement rate card created successfully.",
      rateCard,
      201
    );
  } catch (error) {
    next(error);
  }
};

export const update = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = getPositiveInteger(getParamString(req.params.id, "id"), "id");

    const input = req.body as UpdateAdvertisementRateCardInput;

    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, "Authenticated user is required.");
    }

    const rateCard = await service.update(id, input, userId);

    sendSuccess(res, "Advertisement rate card updated successfully.", rateCard);
  } catch (error) {
    next(error);
  }
};

export const deactivate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = getPositiveInteger(getParamString(req.params.id, "id"), "id");

    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, "Authenticated user is required.");
    }

    const rateCard = await service.deactivate(id, userId);

    sendSuccess(
      res,
      "Advertisement rate card deactivated successfully.",
      rateCard
    );
  } catch (error) {
    next(error);
  }
};

export const archive = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = getPositiveInteger(getParamString(req.params.id, "id"), "id");

    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, "Authenticated user is required.");
    }

    const rateCard = await service.archive(id, userId);

    sendSuccess(
      res,
      "Advertisement rate card archived successfully.",
      rateCard
    );
  } catch (error) {
    next(error);
  }
};
