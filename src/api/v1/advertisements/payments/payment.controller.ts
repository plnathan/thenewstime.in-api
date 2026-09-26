import type { NextFunction, Request, Response } from "express";

import {
  sendPaginated,
  sendSuccess
} from "../../../../shared/utils/response.js";

import * as service from "./payment.service.js";

import type {
  AdvertisementPaymentFilters,
  CreateAdvertisementPaymentInput,
  CreateAdvertisementPaymentRefundInput,
  UpdateAdvertisementPaymentInput
} from "./payment.types.js";

export const createPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as CreateAdvertisementPaymentInput;

    const payment = await service.createPayment(input, req.user.id);

    sendSuccess(
      res,
      "Advertisement payment created successfully.",
      payment,
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getPaymentById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payment = await service.getPaymentById(Number(req.params.id));

    sendSuccess(res, "Advertisement payment retrieved successfully.", payment);
  } catch (error) {
    next(error);
  }
};

export const updatePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as UpdateAdvertisementPaymentInput;

    const payment = await service.updatePayment(Number(req.params.id), input);

    sendSuccess(res, "Advertisement payment updated successfully.", payment);
  } catch (error) {
    next(error);
  }
};

export const listPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filters = req.query as unknown as AdvertisementPaymentFilters & {
      page: number;
      pageSize: number;
    };

    const page =
      typeof filters.page === "number"
        ? filters.page
        : Number(filters.page ?? 1);

    const pageSize =
      typeof filters.pageSize === "number"
        ? filters.pageSize
        : Number(filters.pageSize ?? 20);

    const result = await service.listPayments(
      {
        advertisementId: filters.advertisementId,

        paymentType: filters.paymentType,

        paymentStatus: filters.paymentStatus,

        paymentMethod: filters.paymentMethod,

        fromDate: filters.fromDate,

        toDate: filters.toDate,

        search: filters.search
      },
      page,
      pageSize
    );

    const totalPages = result.pagination.totalPages;

    sendPaginated(
      res,
      "Advertisement payments retrieved successfully.",
      result.items,
      {
        page: result.pagination.page,

        pageSize: result.pagination.pageSize,

        totalRecords: result.pagination.total,

        totalPages,

        hasPrevious: result.pagination.page > 1,

        hasNext: result.pagination.page < totalPages
      }
    );
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payment = await service.verifyPayment(
      Number(req.params.id),
      req.user.id
    );

    sendSuccess(res, "Advertisement payment verified successfully.", payment);
  } catch (error) {
    next(error);
  }
};

export const cancelPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { cancellationReason } = req.body as {
      cancellationReason: string;
    };

    const payment = await service.cancelPayment(
      Number(req.params.id),
      req.user.id,
      cancellationReason
    );

    sendSuccess(res, "Advertisement payment cancelled successfully.", payment);
  } catch (error) {
    next(error);
  }
};

export const getPaymentRefunds = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refunds = await service.getPaymentRefunds(Number(req.params.id));

    sendSuccess(
      res,
      "Advertisement payment refunds retrieved successfully.",
      refunds
    );
  } catch (error) {
    next(error);
  }
};

export const createPaymentRefund = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const body = req.body as Omit<
      CreateAdvertisementPaymentRefundInput,
      "paymentId"
    >;

    const refund = await service.createPaymentRefund(
      {
        paymentId: Number(req.params.id),
        amount: body.amount,

        ...(body.refundDate !== undefined
          ? { refundDate: body.refundDate }
          : {}),

        ...(body.refundReference !== undefined
          ? {
              refundReference: body.refundReference
            }
          : {}),

        ...(body.refundReason !== undefined
          ? {
              refundReason: body.refundReason
            }
          : {})
      },
      req.user.id
    );

    sendSuccess(
      res,
      "Advertisement payment refund created successfully.",
      refund,
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getPaymentSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const summary = await service.getPaymentSummary(Number(req.params.id));

    sendSuccess(
      res,
      "Advertisement payment summary retrieved successfully.",
      summary
    );
  } catch (error) {
    next(error);
  }
};
