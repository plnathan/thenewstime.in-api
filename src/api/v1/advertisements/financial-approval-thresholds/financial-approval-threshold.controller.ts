import type { NextFunction, Request, Response } from "express";

import {
  sendPaginated,
  sendSuccess
} from "../../../../shared/utils/response.js";

import * as service from "./financial-approval-threshold.service.js";

import type {
  FinancialApprovalThresholdApprovalType,
  FinancialApprovalThresholdStatus
} from "./financial-approval-threshold.types.js";

const getAuthenticatedUserId = (req: Request): number => {
  const userId = req.user?.id;

  if (typeof userId !== "number") {
    throw new Error("Authenticated user ID is required.");
  }

  return userId;
};

export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const approvalType =
      typeof req.query.approvalType === "string"
        ? (req.query.approvalType as FinancialApprovalThresholdApprovalType)
        : undefined;

    const status =
      typeof req.query.status === "string"
        ? (req.query.status as FinancialApprovalThresholdStatus)
        : undefined;

    const page =
      typeof req.query.page === "string" ? Number(req.query.page) : 1;

    const pageSize =
      typeof req.query.pageSize === "string" ? Number(req.query.pageSize) : 20;

    const items = await service.list({
      approvalType,
      status
    });

    const safePage = Number.isInteger(page) && page > 0 ? page : 1;

    const safePageSize =
      Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 20;

    const totalRecords = items.length;

    const totalPages =
      totalRecords === 0 ? 0 : Math.ceil(totalRecords / safePageSize);

    const startIndex = (safePage - 1) * safePageSize;

    const paginatedItems = items.slice(startIndex, startIndex + safePageSize);

    sendPaginated(
      res,
      "Financial approval thresholds retrieved successfully.",
      paginatedItems,
      {
        page: safePage,
        pageSize: safePageSize,
        totalRecords,
        totalPages,
        hasPrevious: safePage > 1,
        hasNext: safePage < totalPages
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

    const threshold = await service.getById(id);

    sendSuccess(
      res,
      "Financial approval threshold retrieved successfully.",
      threshold
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
    const userId = getAuthenticatedUserId(req);

    const threshold = await service.create(req.body, userId);

    sendSuccess(
      res,
      "Financial approval threshold created successfully.",
      threshold,
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
    const userId = getAuthenticatedUserId(req);
    const id = Number(req.params.id);

    const threshold = await service.update(id, req.body, userId);

    sendSuccess(
      res,
      "Financial approval threshold updated successfully.",
      threshold
    );
  } catch (error) {
    next(error);
  }
};

export const activate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);
    const id = Number(req.params.id);

    const threshold = await service.activate(id, userId);

    sendSuccess(
      res,
      "Financial approval threshold activated successfully.",
      threshold
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
    const userId = getAuthenticatedUserId(req);
    const id = Number(req.params.id);

    const threshold = await service.deactivate(id, userId);

    sendSuccess(
      res,
      "Financial approval threshold deactivated successfully.",
      threshold
    );
  } catch (error) {
    next(error);
  }
};
