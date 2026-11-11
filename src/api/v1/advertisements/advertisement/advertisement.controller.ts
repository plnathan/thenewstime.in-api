import type { NextFunction, Request, Response } from "express";

import {
  sendPaginated,
  sendSuccess
} from "../../../../shared/utils/response.js";

import * as service from "./advertisement.service.js";
import { pool } from "../../../../shared/config/db.js";

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
              "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED"
          }
        : {}),
      ...(req.query.operationalCondition
        ? {
            operationalCondition: req.query.operationalCondition as
              | "ACTIVE"
              | "PAUSED"
              | "COMPLETED"
              | "ON_HOLD"
              | "STOPPED"
              | "ARCHIVED"
          }
        : {}),
      ...(req.query.placementType
        ? { placementType: req.query.placementType.toString() }
        : {}),
      ...(req.query.startDate
        ? { startDate: req.query.startDate.toString() }
        : {}),
      ...(req.query.endDate ? { endDate: req.query.endDate.toString() } : {})
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

export const pauseAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.pauseAdvertisement(
      Number(req.params.id),
      req.user.id,
      req.body
    );
    sendSuccess(res, "Advertisement paused successfully.", result);
  } catch (error) {
    next(error);
  }
};

export const stopAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.stopAdvertisement(
      Number(req.params.id),
      req.user.id,
      req.body
    );
    sendSuccess(res, "Advertisement stopped successfully.", result);
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

export const resumeDeliveryAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.resumeDeliveryAdvertisement(
      Number(req.params.id),
      req.user.id,
      req.body
    );
    sendSuccess(res, "Advertisement delivery resumed successfully.", result);
  } catch (error) {
    next(error);
  }
};

/** Read-only operational events for the Advertisement List audit modal. */
export const getAdvertisementOperationalHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const result = await pool.query<{
      event_type: string;
      performed_by: number | null;
      performed_at: string | null;
    }>(
      `SELECT event_type, performed_by,
              COALESCE(to_jsonb(a)->>'performed_at', to_jsonb(a)->>'created_at') AS performed_at
       FROM public.advertisement_operational_audit a
       WHERE advertisement_id = $1
       ORDER BY COALESCE(to_jsonb(a)->>'performed_at', to_jsonb(a)->>'created_at') DESC NULLS LAST`,
      [id]
    );
    sendSuccess(
      res,
      "Operational history retrieved successfully",
      result.rows.map((row) => ({
        eventType: row.event_type,
        performedBy: row.performed_by,
        performedAt: row.performed_at
      }))
    );
  } catch (error) {
    next(error);
  }
};
