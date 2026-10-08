import type { NextFunction, Request, Response } from "express";

import {
  sendPaginated,
  sendSuccess
} from "../../../../shared/utils/response.js";

import * as service from "./placement-rule.service.js";

type PlacementRuleStatus = "ACTIVE" | "INACTIVE";

interface PlacementRuleQueryRequest {
  advertisementId?: unknown;
  placementId?: unknown;
  status?: unknown;
}

const parseOptionalPositiveInteger = (
  value: unknown
): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const parseOptionalStatus = (
  value: unknown
): PlacementRuleStatus | undefined => {
  if (value === "ACTIVE" || value === "INACTIVE") {
    return value;
  }

  return undefined;
};

export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as PlacementRuleQueryRequest;

    const advertisementId = parseOptionalPositiveInteger(
      query.advertisementId
    );

    const placementId = parseOptionalPositiveInteger(query.placementId);

    const status = parseOptionalStatus(query.status);

    const rules = await service.getAll({
      ...(advertisementId !== undefined ? { advertisementId } : {}),
      ...(placementId !== undefined ? { placementId } : {}),
      ...(status !== undefined ? { status } : {})
    });

    sendPaginated(
      res,
      "Advertisement placement rules retrieved successfully",
      rules,
      {
        page: 1,
        pageSize: rules.length,
        totalRecords: rules.length,
        totalPages: rules.length > 0 ? 1 : 0,
        hasPrevious: false,
        hasNext: false
      }
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
    const id = Number(req.params.id);

    const rule = await service.getById(id);

    sendSuccess(
      res,
      "Advertisement placement rule retrieved successfully",
      rule
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
    const createdBy = Number(req.user?.id);

    const rule = await service.create(req.body, createdBy);

    sendSuccess(
      res,
      "Advertisement placement rule created successfully",
      rule,
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
    const id = Number(req.params.id);
    const updatedBy = Number(req.user?.id);

    const rule = await service.update(id, req.body, updatedBy);

    sendSuccess(
      res,
      "Advertisement placement rule updated successfully",
      rule
    );
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
    const id = Number(req.params.id);
    const updatedBy = Number(req.user?.id);

    const rule = await service.deactivate(id, updatedBy);

    sendSuccess(
      res,
      "Advertisement placement rule deactivated successfully",
      rule
    );
  } catch (error) {
    next(error);
  }
};