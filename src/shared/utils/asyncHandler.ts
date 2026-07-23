import {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler
} from "express";

export const asyncHandler =
  (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
