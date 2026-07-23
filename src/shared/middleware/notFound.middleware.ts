import { type Request, type Response } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export const notFoundHandler = (_req: Request, res: Response) => {
  return res
    .status(HTTP_STATUS.NOT_FOUND)
    .json({ success: false, message: "Route not found" });
};
