import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import { calculateAgreedAmount } from "./agreed-amount.service.js";

/**
 * --------------------------------------------------------------------------
 * Calculate Advertisement Agreed Amount
 * --------------------------------------------------------------------------
 *
 * POST /api/v1/advertisements/agreed-amount/calculate
 *
 * This endpoint compares the system-calculated standard amount with the
 * negotiated/agreed advertisement amount.
 *
 * IMPORTANT:
 *
 * This controller does NOT persist agreed_amount.
 *
 * Persistence remains part of the advertisement workflow and is intentionally
 * separate from the pricing calculation API.
 */
export const calculateAdvertisementAgreedAmount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = calculateAgreedAmount(req.body);

    sendSuccess(
      res,
      "Advertisement agreed amount calculated successfully.",
      result
    );
  } catch (error) {
    next(error);
  }
};
