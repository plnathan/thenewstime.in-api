import type { NextFunction, Request, Response } from "express";

import {
  sendPaginated,
  sendSuccess
} from "../../../../shared/utils/response.js";

import * as service from "./schedule.service.js";

export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const query = req.query as {
      advertisementId?: number;
      placementId?: number;
      placementRuleId?: number;
      status?: "SCHEDULED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
    };

    const schedules = await service.getAll({
      ...(query.advertisementId !== undefined
        ? {
            advertisementId: query.advertisementId
          }
        : {}),
      ...(query.placementId !== undefined
        ? {
            placementId: query.placementId
          }
        : {}),
      ...(query.placementRuleId !== undefined
        ? {
            placementRuleId: query.placementRuleId
          }
        : {}),
      ...(query.status !== undefined
        ? {
            status: query.status
          }
        : {})
    });

    sendPaginated(
      res,
      "Advertisement schedules retrieved successfully",
      schedules,
      {
        page: 1,
        pageSize: schedules.length,
        totalRecords: schedules.length,
        totalPages: schedules.length > 0 ? 1 : 0,
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

    const schedule = await service.getById(id);

    sendSuccess(res, "Advertisement schedule retrieved successfully", schedule);
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

    const schedule = await service.create(req.body, createdBy);

    sendSuccess(
      res,
      "Advertisement schedule created successfully",
      schedule,
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

    const schedule = await service.update(id, req.body, updatedBy);

    sendSuccess(res, "Advertisement schedule updated successfully", schedule);
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
    const id = Number(req.params.id);
    const updatedBy = Number(req.user?.id);

    const schedule = await service.activate(id, updatedBy);

    sendSuccess(res, "Advertisement schedule activated successfully", schedule);
  } catch (error) {
    next(error);
  }
};

export const pause = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const updatedBy = Number(req.user?.id);

    const schedule = await service.pause(id, updatedBy);

    sendSuccess(res, "Advertisement schedule paused successfully", schedule);
  } catch (error) {
    next(error);
  }
};

export const resume = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const updatedBy = Number(req.user?.id);

    const schedule = await service.resume(id, updatedBy);

    sendSuccess(res, "Advertisement schedule resumed successfully", schedule);
  } catch (error) {
    next(error);
  }
};

export const complete = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const updatedBy = Number(req.user?.id);

    const schedule = await service.complete(id, updatedBy);

    sendSuccess(res, "Advertisement schedule completed successfully", schedule);
  } catch (error) {
    next(error);
  }
};

export const cancel = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const updatedBy = Number(req.user?.id);

    const schedule = await service.cancel(id, updatedBy);

    sendSuccess(res, "Advertisement schedule cancelled successfully", schedule);
  } catch (error) {
    next(error);
  }
};
