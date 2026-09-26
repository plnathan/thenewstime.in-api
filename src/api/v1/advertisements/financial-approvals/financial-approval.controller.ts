import type { NextFunction, Request, Response } from "express";

import {
  sendPaginated,
  sendSuccess
} from "../../../../shared/utils/response.js";

import * as service from "./financial-approval.service.js";

export const createFinancialApproval = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const approval = await service.create(req.body, req.user.id);

    sendSuccess(res, "Financial approval created successfully.", approval, 201);
  } catch (error) {
    next(error);
  }
};

export const getFinancialApprovalById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const approval = await service.getById(Number(req.params.id));

    sendSuccess(res, "Financial approval retrieved successfully.", approval);
  } catch (error) {
    next(error);
  }
};

export const updateFinancialApprovalRemarks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const approval = await service.updateApprovalRemarks(
      Number(req.params.id),
      req.body.approvalRemarks ?? null
    );

    sendSuccess(
      res,
      "Financial approval remarks updated successfully.",
      approval
    );
  } catch (error) {
    next(error);
  }
};

export const holdFinancialApproval = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const approval = await service.hold(
      Number(req.params.id),
      req.body,
      req.user.id
    );

    sendSuccess(
      res,
      "Financial approval placed on hold successfully.",
      approval
    );
  } catch (error) {
    next(error);
  }
};

export const rejectFinancialApproval = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const approval = await service.reject(
      Number(req.params.id),
      req.body,
      req.user.id
    );

    sendSuccess(res, "Financial approval rejected successfully.", approval);
  } catch (error) {
    next(error);
  }
};

export const approveFinancialApproval = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const approval = await service.approve(
      Number(req.params.id),
      req.body,
      req.user.id
    );

    sendSuccess(res, "Financial approval approved successfully.", approval);
  } catch (error) {
    next(error);
  }
};

export const resubmitFinancialApproval = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const approval = await service.resubmit(
      Number(req.params.id),
      req.body,
      req.user.id
    );

    sendSuccess(res, "Financial approval resubmitted successfully.", approval);
  } catch (error) {
    next(error);
  }
};

export const getFinancialApprovalHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const history = await service.getHistory(Number(req.params.id));

    sendSuccess(
      res,
      "Financial approval history retrieved successfully.",
      history
    );
  } catch (error) {
    next(error);
  }
};

export const getFinancialApprovals = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filters = {
      page: Number(req.query.page ?? 1),
      pageSize: Number(req.query.pageSize ?? 20),

      ...(req.query.advertisementId
        ? {
            advertisementId: Number(req.query.advertisementId)
          }
        : {}),

      ...(req.query.clientId
        ? {
            clientId: Number(req.query.clientId)
          }
        : {}),

      ...(req.query.paymentId
        ? {
            paymentId: Number(req.query.paymentId)
          }
        : {}),

      ...(req.query.approvalType
        ? {
            approvalType: req.query.approvalType as
              "DISCOUNT" | "ADJUSTMENT" | "REFUND" | "PARTIAL_REFUND"
          }
        : {}),

      ...(req.query.status
        ? {
            status: req.query.status as
              "SUBMITTED" | "HOLD" | "APPROVED" | "REJECTED"
          }
        : {}),

      ...(req.query.requestedBy
        ? {
            requestedBy: Number(req.query.requestedBy)
          }
        : {}),

      ...(req.query.reviewedBy
        ? {
            reviewedBy: Number(req.query.reviewedBy)
          }
        : {})
    };

    const result = await service.list(filters);

    const totalPages =
      filters.pageSize > 0 ? Math.ceil(result.total / filters.pageSize) : 0;

    sendPaginated(
      res,
      "Financial approvals retrieved successfully.",
      result.items,
      {
        page: filters.page,
        pageSize: filters.pageSize,
        totalRecords: result.total,
        totalPages,
        hasPrevious: filters.page > 1,
        hasNext: filters.page < totalPages
      }
    );
  } catch (error) {
    next(error);
  }
};

export const checkFinancialApprovalExists = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const exists = await service.exists(Number(req.params.id));

    sendSuccess(res, "Financial approval existence checked successfully.", {
      exists
    });
  } catch (error) {
    next(error);
  }
};

export const checkFinancialApprovalExistsForAdvertisement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const exists = await service.existsForAdvertisement(
      Number(req.params.advertisementId)
    );

    sendSuccess(
      res,
      "Advertisement financial approval existence checked successfully.",
      {
        exists
      }
    );
  } catch (error) {
    next(error);
  }
};

export const getLatestFinancialApprovalByAdvertisementId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const approval = await service.getLatestByAdvertisementId(
      Number(req.params.advertisementId)
    );

    sendSuccess(
      res,
      "Latest financial approval retrieved successfully.",
      approval
    );
  } catch (error) {
    next(error);
  }
};

export const getPendingFinancialApprovalByAdvertisementId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const approval = await service.getPendingByAdvertisementId(
      Number(req.params.advertisementId)
    );

    sendSuccess(
      res,
      "Pending financial approval retrieved successfully.",
      approval
    );
  } catch (error) {
    next(error);
  }
};

export const getPendingFinancialApprovalByPaymentId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const approval = await service.getPendingByPaymentId(
      Number(req.params.paymentId)
    );

    sendSuccess(
      res,
      "Pending financial approval for payment retrieved successfully.",
      approval
    );
  } catch (error) {
    next(error);
  }
};
