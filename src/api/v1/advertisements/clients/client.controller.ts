import type { NextFunction, Request, Response } from "express";

import {
  sendPaginated,
  sendSuccess
} from "../../../../shared/utils/response.js";

import * as service from "./client.service.js";

import type {
  AdvertisementClientSearchFilters,
  CreateAdvertisementClientInput,
  UpdateAdvertisementClientInput
} from "./client.types.js";

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as CreateAdvertisementClientInput;

    const client = await service.createClient(input, req.user.id);

    sendSuccess(res, "Advertisement client created successfully.", client, 201);
  } catch (error) {
    next(error);
  }
};

export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filters: AdvertisementClientSearchFilters = {
      page: Number(req.query.page ?? 1),
      pageSize: Number(req.query.pageSize ?? 20),
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      status:
        typeof req.query.status === "string"
          ? (req.query.status as AdvertisementClientSearchFilters["status"])
          : undefined,
      businessTypeId:
        req.query.businessTypeId !== undefined
          ? Number(req.query.businessTypeId)
          : undefined
    };

    const result = await service.getClients(filters);

    const totalPages =
      filters.pageSize > 0 ? Math.ceil(result.total / filters.pageSize) : 0;

    sendPaginated(
      res,
      "Advertisement clients retrieved successfully.",
      result.items,
      {
        page: filters.page,
        pageSize: filters.pageSize,
        totalRecords: result.total,
        totalPages,
        hasPrevious: filters.page > 1,
        hasNext: filters.page < totalPages
      }
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
    const client = await service.getClientById(Number(req.params.id));

    sendSuccess(res, "Advertisement client retrieved successfully.", client);
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
    const input = req.body as UpdateAdvertisementClientInput;

    const client = await service.updateClient(
      Number(req.params.id),
      input,
      req.user.id
    );

    sendSuccess(res, "Advertisement client updated successfully.", client);
  } catch (error) {
    next(error);
  }
};
