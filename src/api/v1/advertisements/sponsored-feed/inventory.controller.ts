import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import { sendSuccess } from "../../../../shared/utils/response.js";
import { idSchema } from "./sponsored-feed.validation.js";
import {
  batchInput,
  rateInput,
  assignmentInput
} from "./inventory.validation.js";
import * as repo from "./inventory.repository.js";
import type { z } from "zod";
function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value);
  if (!r.success)
    throw new ApiError(400, "Invalid inventory request.", r.error.issues);
  return r.data;
}
function actor(req: Request): number {
  const id = req.user?.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
    throw new ApiError(401, "Authentication required.");
  return id;
}
export async function createBatch(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(
      res,
      "Batch created.",
      await repo.createBatch(parse(batchInput, req.body), actor(req))
    );
  } catch (e) {
    next(e);
  }
}
export async function createRate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(
      res,
      "Rate created.",
      await repo.createRate(
        parse(idSchema, req.params.batchId),
        parse(rateInput, req.body),
        actor(req)
      )
    );
  } catch (e) {
    next(e);
  }
}
export async function listRates(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(
      res,
      "Rates retrieved.",
      await repo.listRates(parse(idSchema, req.params.batchId))
    );
  } catch (e) {
    next(e);
  }
}
export async function assign(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(
      res,
      "Inventory reserved.",
      await repo.assign(
        parse(idSchema, req.params.advertisementId),
        parse(assignmentInput, req.body).batchId,
        actor(req)
      )
    );
  } catch (e) {
    next(e);
  }
}
export async function readAssignment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(
      res,
      "Reservation retrieved.",
      await repo.readAssignment(parse(idSchema, req.params.advertisementId))
    );
  } catch (e) {
    next(e);
  }
}
