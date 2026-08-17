import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../shared/utils/response.js";

import * as service from "./category.service.js";

export const getCategories = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categories = await service.getCategories();

    sendSuccess(res, "Categories retrieved successfully.", categories);
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const category = await service.getCategoryById(Number(req.params.id));

    sendSuccess(res, "Category retrieved successfully.", category);
  } catch (error) {
    next(error);
  }
};
