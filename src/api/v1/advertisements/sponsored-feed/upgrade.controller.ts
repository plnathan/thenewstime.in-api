import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import { sendSuccess } from "../../../../shared/utils/response.js";
import { idSchema } from "./sponsored-feed.validation.js";
import { upgradeInput } from "./upgrade.validation.js";
import * as repo from "./upgrade.repository.js";
function actor(req: Request): number {
  const id = req.user?.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
    throw new ApiError(401, "Authentication required.");
  return id;
}
export async function save(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const r = upgradeInput.safeParse(req.body);
    if (!r.success)
      throw new ApiError(400, "Invalid upgrade request.", r.error.issues);
    sendSuccess(
      res,
      "Upgrade requests reserved.",
      await repo.requestUpgrades(r.data, actor(req))
    );
  } catch (e) {
    next(e);
  }
}
export async function cancel(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const r = idSchema.safeParse(req.params.id);
    if (!r.success) throw new ApiError(400, "Invalid upgrade ID.");
    sendSuccess(
      res,
      "Upgrade cancelled.",
      await repo.cancelRequest(r.data, actor(req))
    );
  } catch (e) {
    next(e);
  }
}
