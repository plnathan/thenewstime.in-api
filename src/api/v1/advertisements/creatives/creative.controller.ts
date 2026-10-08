import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import * as service from "./creative.service.js";

import type {
  CreateAdvertisementCreativeInput,
  UpdateAdvertisementCreativeInput
} from "./creative.types.js";

export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const advertisementId = Number(req.params.advertisementId);

    const creatives = await service.getAll(advertisementId);

    sendSuccess(
      res,
      "Advertisement creatives retrieved successfully.",
      creatives
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
    const advertisementId = Number(req.params.advertisementId);

    const creativeId = Number(req.params.creativeId);

    const creative = await service.getById(advertisementId, creativeId);

    sendSuccess(
      res,
      "Advertisement creative retrieved successfully.",
      creative
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
    const advertisementId = Number(req.params.advertisementId);

    const input = req.body as CreateAdvertisementCreativeInput;

    const creative = await service.create(advertisementId, input, req.user.id);

    sendSuccess(
      res,
      "Advertisement creative created successfully.",
      creative,
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
    const advertisementId = Number(req.params.advertisementId);

    const creativeId = Number(req.params.creativeId);

    const input = req.body as UpdateAdvertisementCreativeInput;

    const creative = await service.update(
      advertisementId,
      creativeId,
      input,
      req.user.id
    );

    sendSuccess(res, "Advertisement creative updated successfully.", creative);
  } catch (error) {
    next(error);
  }
};

export const remove = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const advertisementId = Number(req.params.advertisementId);

    const creativeId = Number(req.params.creativeId);

    const creative = await service.remove(
      advertisementId,
      creativeId,
      req.user.id
    );

    sendSuccess(
      res,
      "Advertisement creative deactivated successfully.",
      creative
    );
  } catch (error) {
    next(error);
  }
};

export const getPreview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const advertisementId = Number(req.params.advertisementId);

    const creativeId = Number(req.params.creativeId);

    const preview = await service.getPreview(advertisementId, creativeId);

    sendSuccess(
      res,
      "Advertisement creative preview retrieved successfully.",
      preview
    );
  } catch (error) {
    next(error);
  }
};

export const getAdvertisementPreview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const advertisementId = Number(req.params.advertisementId);

    const preview = await service.getAdvertisementPreview(advertisementId);

    sendSuccess(
      res,
      "Advertisement creative previews retrieved successfully.",
      preview
    );
  } catch (error) {
    next(error);
  }
};
