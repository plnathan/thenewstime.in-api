import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import { sendSuccess } from "../../../../shared/utils/response.js";
import { idSchema } from "./sponsored-feed.validation.js";
import * as repo from "./upgrade-finance.repository.js";
function handler(work: (id: number, actor: number) => Promise<unknown>) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const id = idSchema.safeParse(req.params.id);
      const actor = req.user?.id;
      if (!id.success) throw new ApiError(400, "Invalid ID.");
      if (
        typeof actor !== "number" ||
        !Number.isSafeInteger(actor) ||
        actor <= 0
      )
        throw new ApiError(401, "Authentication required.");
      sendSuccess(res, "Success.", await work(id.data, actor));
    } catch (e) {
      next(e);
    }
  };
}
export const list = handler(repo.listUpgrades);
export const submit = handler(repo.submitFinance);
export const charge = handler(repo.charge);
export const complete = handler(repo.complete);
export const reject = handler(repo.rejectUncharged);
