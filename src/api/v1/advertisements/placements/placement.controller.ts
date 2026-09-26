import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import * as service from "./placement.service.js";

import type {
  CreateAdvertisementPlacementInput,
  UpdateAdvertisementPlacementInput
} from "./placement.types.js";

export const getAll = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const placements = await service.getAll();

    sendSuccess(res, "Advertisement placements retrieved successfully.", placements);
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
    const placement = await service.getById(Number(req.params.id));

    sendSuccess(res, "Advertisement placement retrieved successfully.", placement);
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
    const input = req.body as CreateAdvertisementPlacementInput;

    const placement = await service.create(input, req.user.id);

    sendSuccess(
      res,
      "Advertisement placement created successfully.",
      placement,
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
    const input = req.body as UpdateAdvertisementPlacementInput;

    const placement = await service.update(
      Number(req.params.id),
      input,
      req.user.id
    );

    sendSuccess(
      res,
      "Advertisement placement updated successfully.",
      placement
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
    const placement = await service.deactivate(
      Number(req.params.id),
      req.user.id
    );

    sendSuccess(
      res,
      "Advertisement placement deactivated successfully.",
      placement
    );
  } catch (error) {
    next(error);
  }
};

export const enable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const placement = await service.enable(Number(req.params.id), req.user.id);

    sendSuccess(
      res,
      "Advertisement placement enabled successfully.",
      placement
    );
  } catch (error) {
    next(error);
  }
};

export const disable = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const placement = await service.disable(Number(req.params.id), req.user.id);

    sendSuccess(
      res,
      "Advertisement placement disabled successfully.",
      placement
    );
  } catch (error) {
    next(error);
  }
};