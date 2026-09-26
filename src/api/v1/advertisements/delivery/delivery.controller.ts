import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import * as deliveryService from "./delivery.service.js";

import type {
  AdvertisementDeliveryContext,
  AdvertisementDeliveryRequest
} from "./delivery.types.js";

import type { AdvertisementDeliveryQueryInput } from "./delivery.validation.js";

function buildContext(
  query: AdvertisementDeliveryQueryInput
): AdvertisementDeliveryContext | undefined {
  const context: AdvertisementDeliveryContext = {};

  if (query.site !== undefined) {
    context.site = query.site;
  }

  if (query.newsId !== undefined) {
    context.newsId = query.newsId;
  }

  if (query.category !== undefined) {
    context.category = query.category;
  }

  if (query.state !== undefined) {
    context.state = query.state;
  }

  if (query.district !== undefined) {
    context.district = query.district;
  }

  if (query.country !== undefined) {
    context.country = query.country;
  }

  return Object.keys(context).length > 0 ? context : undefined;
}

export const getEligibleAdvertisements = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as unknown as AdvertisementDeliveryQueryInput;

    const request: AdvertisementDeliveryRequest = {
      pageType: query.pageType,
      placementType: query.placementType
    };

    if (query.placementId !== undefined) {
      request.placementId = query.placementId;
    }

    const context = buildContext(query);

    if (context !== undefined) {
      request.context = context;
    }

    const result = await deliveryService.getEligibleAdvertisements(request);

    sendSuccess(res, "Eligible advertisements retrieved successfully.", result);
  } catch (error) {
    next(error);
  }
};
