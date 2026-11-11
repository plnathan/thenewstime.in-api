import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import * as placementRepository from "../placements/placement.repository.js";

import * as deliveryService from "./delivery.service.js";

import type {
  AdvertisementDeliveryContext,
  AdvertisementDeliveryRequest
} from "./delivery.types.js";

import type {
  AdvertisementPageDeliveryQueryInput,
  AdvertisementDeliveryQueryInput
} from "./delivery.validation.js";

function buildContext(
  query: AdvertisementDeliveryQueryInput | AdvertisementPageDeliveryQueryInput
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

/** Public, read-only placement identity discovery. Never exposes administrative fields. */
export const getPublicPlacementSlots = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pageType = String(req.query.pageType ?? "");
    const placementType = String(req.query.placementType ?? "");
    if (
      !["HOME", "NEWS_LIST", "NEWS_DETAIL"].includes(pageType) ||
      !/^(HOME|NEWS_LIST|NEWS_DETAIL)_[A-Z_]+$/.test(placementType) ||
      !placementType.startsWith(`${pageType}_`)
    ) {
      res
        .status(400)
        .json({ success: false, message: "Invalid placement query" });
      return;
    }
    const placements = await placementRepository.findAll();
    const slots = placements
      .filter(
        (placement) =>
          placement.pageType === pageType &&
          placement.placementType === placementType &&
          placement.status === "ACTIVE" &&
          placement.isEnabled
      )
      .map((placement) => ({
        id: placement.id,
        code: placement.code,
        displayOrder: placement.displayOrder,
        fallbackBehavior: placement.fallbackBehavior
      }));
    sendSuccess(res, "Public placement slots retrieved.", slots);
  } catch (error) {
    next(error);
  }
};

/**
 * Page-level response includes every enabled placement, even if empty.
 * Reuse the established per-placement delivery service so manual activation,
 * targeting, rotation membership and house-ad fallback rules stay identical.
 */
export const getPublicPageDelivery = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as unknown as AdvertisementPageDeliveryQueryInput;
    const placements = (await placementRepository.findAll()).filter(
      (placement) =>
        placement.pageType === query.pageType &&
        placement.status === "ACTIVE" &&
        placement.isEnabled
    );
    const context = buildContext(query);
    const deliveries: Record<
      string,
      Awaited<ReturnType<typeof deliveryService.getEligibleAdvertisements>>
    > = {};

    // Sequential processing avoids a burst of database queries for each page view.
    for (const placement of placements) {
      const request: AdvertisementDeliveryRequest = {
        pageType: query.pageType,
        placementType: placement.placementType,
        placementId: placement.id
      };
      if (context !== undefined) request.context = context;
      deliveries[String(placement.id)] =
        await deliveryService.getEligibleAdvertisements(request);
    }

    sendSuccess(res, "Public page advertisements retrieved.", {
      pageType: query.pageType,
      slots: placements.map((placement) => ({
        id: placement.id,
        code: placement.code,
        placementType: placement.placementType,
        displayOrder: placement.displayOrder,
        fallbackBehavior: placement.fallbackBehavior
      })),
      deliveries
    });
  } catch (error) {
    next(error);
  }
};
