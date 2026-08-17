import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../shared/utils/response.js";

import * as service from "./location.service.js";

export const getCountries = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const countries = await service.getCountries();

    sendSuccess(res, "Countries retrieved successfully.", countries);
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
    const countryId =
      req.query.countryId !== undefined
        ? Number(req.query.countryId)
        : undefined;

    const states = await service.getStates(countryId);

    sendSuccess(res, "States retrieved successfully.", states);
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
    const stateId =
      req.query.stateId !== undefined ? Number(req.query.stateId) : undefined;

    const districts = await service.getDistricts(stateId);

    sendSuccess(res, "Districts retrieved successfully.", districts);
  } catch (error) {
    next(error);
  }
};
