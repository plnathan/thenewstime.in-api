import type { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../../../shared/utils/response.js";
import * as service from "./sponsored-feed.service.js";
export async function getCard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(
      res,
      "Sponsored card retrieved.",
      await service.getCard(req.params.advertisementId)
    );
  } catch (e) {
    next(e);
  }
}
export async function putCard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(
      res,
      "Sponsored card saved.",
      await service.putCard(req.params.advertisementId, req.body, req.user?.id)
    );
  } catch (e) {
    next(e);
  }
}
export async function listBatches(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    sendSuccess(
      res,
      "Sponsored batches retrieved.",
      await service.listBatches()
    );
  } catch (e) {
    next(e);
  }
}
