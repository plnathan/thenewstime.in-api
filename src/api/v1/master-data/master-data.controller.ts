import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../shared/utils/response.js";

import * as service from "./master-data.service.js";

export const getCategories = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getCategories();

    sendSuccess(res, "Categories retrieved successfully.", data);
  } catch (error) {
    next(error);
  }
};

export const getCountries = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await service.getCountries();

    sendSuccess(res, "Countries retrieved successfully.", data);
  } catch (error) {
    next(error);
  }
};

export const getStates = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const countryId = Number(req.query.countryId);

    const data = await service.getStates(countryId);

    sendSuccess(res, "States retrieved successfully.", data);
  } catch (error) {
    next(error);
  }
};

export const getDistricts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stateId = Number(req.query.stateId);

    const data = await service.getDistricts(stateId);

    sendSuccess(res, "Districts retrieved successfully.", data);
  } catch (error) {
    next(error);
  }
};
