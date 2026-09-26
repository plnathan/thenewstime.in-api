import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import * as service from "./pricing.service.js";

export const getStandardAmount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const advertisementId = Number(req.params.advertisementId);

    if (!Number.isInteger(advertisementId) || advertisementId <= 0) {
      const error = new Error("advertisementId must be a positive integer.");

      Object.assign(error, {
        statusCode: 400
      });

      throw error;
    }

    const result = await service.getStandardAmount(advertisementId);

    sendSuccess(
      res,
      "Advertisement standard amount retrieved successfully.",
      result
    );
  } catch (error) {
    next(error);
  }
};
