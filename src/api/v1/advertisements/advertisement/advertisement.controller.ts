import type { NextFunction, Request, Response } from "express";

import {
  sendPaginated,
  sendSuccess
} from "../../../../shared/utils/response.js";

import * as service from "./advertisement.service.js";

export const createAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const advertisement = await service.createAdvertisement(
      req.body,
      req.user.id
    );

    sendSuccess(res, "Advertisement created successfully.", advertisement, 201);
  } catch (error) {
    next(error);
  }
};

export const getAdvertisementById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const advertisement = await service.getAdvertisementById(
      Number(req.params.id)
    );

    sendSuccess(res, "Advertisement retrieved successfully.", advertisement);
  } catch (error) {
    next(error);
  }
};

export const getAdvertisements = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filters = {
      page: Number(req.query.page ?? 1),
      pageSize: Number(req.query.pageSize ?? 20),
      ...(req.query.search
        ? {
            search: req.query.search.toString()
          }
        : {}),
      ...(req.query.clientId
        ? {
            clientId: Number(req.query.clientId)
          }
        : {}),
      ...(req.query.workflowStatus
        ? {
            workflowStatus: req.query.workflowStatus as
              | "DRAFT"
              | "SUBMITTED"
              | "APPROVED"
              | "REJECTED"
              | "ON_HOLD"
              | "ARCHIVED"
          }
        : {}),
      ...(req.query.status
        ? {
            status: req.query.status as
              | "DRAFT"
              | "ACTIVE"
              | "INACTIVE"
              | "ARCHIVED"
          }
        : {})
    };

    const result = await service.getAdvertisements(filters);

    const totalPages =
      filters.pageSize > 0 ? Math.ceil(result.total / filters.pageSize) : 0;

    sendPaginated(res, "Advertisements retrieved successfully.", result.items, {
      page: filters.page,
      pageSize: filters.pageSize,
      totalRecords: result.total,
      totalPages,
      hasPrevious: filters.page > 1,
      hasNext: filters.page < totalPages
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const advertisement = await service.updateAdvertisement(
      Number(req.params.id),
      req.body,
      req.user.id
    );

    sendSuccess(res, "Advertisement updated successfully.", advertisement);
  } catch (error) {
    next(error);
  }
};

export const submitAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.submitAdvertisement(
      Number(req.params.id),
      req.user.id,
      req.body
    );

    sendSuccess(
      res,
      "Advertisement submitted for approval successfully.",
      result.advertisement
    );
  } catch (error) {
    next(error);
  }
};

export const approveAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.approveAdvertisement(
      Number(req.params.id),
      req.user.id,
      req.body
    );

    sendSuccess(
      res,
      "Advertisement approved successfully.",
      result.advertisement
    );
  } catch (error) {
    next(error);
  }
};

export const rejectAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.rejectAdvertisement(
      Number(req.params.id),
      req.user.id,
      req.body
    );

    sendSuccess(
      res,
      "Advertisement rejected successfully.",
      result.advertisement
    );
  } catch (error) {
    next(error);
  }
};

export const holdAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.holdAdvertisement(
      Number(req.params.id),
      req.user.id,
      req.body
    );

    sendSuccess(
      res,
      "Advertisement placed on hold successfully.",
      result.advertisement
    );
  } catch (error) {
    next(error);
  }
};

export const resumeAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.resumeAdvertisement(
      Number(req.params.id),
      req.user.id,
      req.body
    );

    sendSuccess(
      res,
      "Advertisement resumed successfully.",
      result.advertisement
    );
  } catch (error) {
    next(error);
  }
};

export const activateAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.activateAdvertisement(
      Number(req.params.id),
      req.user.id,
      req.body
    );

    sendSuccess(res, "Advertisement activated successfully.", result);
  } catch (error) {
    next(error);
  }
};

export const archiveAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.archiveAdvertisement(
      Number(req.params.id),
      req.user.id,
      req.body
    );

    sendSuccess(
      res,
      "Advertisement archived successfully.",
      result.advertisement
    );
  } catch (error) {
    next(error);
  }
};

export const getAdvertisementWorkflowHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const history = await service.getAdvertisementWorkflowHistory(
      Number(req.params.id)
    );

    sendSuccess(
      res,
      "Advertisement workflow history retrieved successfully.",
      history
    );
  } catch (error) {
    next(error);
  }
};