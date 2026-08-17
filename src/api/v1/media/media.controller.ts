import type { NextFunction, Request, Response } from "express";

import { sendCreated, sendSuccess } from "../../../shared/utils/response.js";

import * as service from "./media.service.js";

export const getNewsMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const media = await service.getNewsMedia(Number(req.params.newsId));

    sendSuccess(res, "News media retrieved successfully.", media);
  } catch (error) {
    next(error);
  }
};

export const uploadNewsMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const files = (req.files ?? []) as Express.Multer.File[];

    const uploadedBy = Number(req.body.uploadedBy);

    const items = await service.uploadNewsMedia(
      Number(req.params.newsId),
      files,
      uploadedBy,
      req.body.metadata
    );

    sendCreated(res, "News images uploaded successfully.", items);
  } catch (error) {
    next(error);
  }
};

export const reorderNewsMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const items = req.body.items as {
      mediaId: number;
      displayOrder: number;
    }[];

    const media = await service.reorderNewsMedia(
      Number(req.params.newsId),
      items
    );

    sendSuccess(res, "News image order updated successfully.", media);
  } catch (error) {
    next(error);
  }
};

export const deleteNewsMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await service.deleteNewsMedia(
      Number(req.params.newsId),
      Number(req.params.mediaId)
    );

    sendSuccess(res, "News image removed successfully.");
  } catch (error) {
    next(error);
  }
};
