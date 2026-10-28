import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import * as service from "./creative-rotation.service.js";

export const getCreativeConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.getCreativeRotationConfig(
      Number(req.params.advertisementId)
    );

    sendSuccess(
      res,
      "Creative rotation configuration retrieved successfully.",
      result
    );
  } catch (error) {
    next(error);
  }
};

export const updateCreativeConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await service.updateCreativeRotationConfig(
      Number(req.params.advertisementId),
      req.body
    );

    sendSuccess(
      res,
      "Creative rotation configuration updated successfully.",
      result
    );
  } catch (error) {
    next(error);
  }
};
