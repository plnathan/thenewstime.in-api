import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiErrorInfo.js"; //"../utils/ApiError.js";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error("Global error:", err);

  if (err instanceof ApiError) {
    const isValidationError =
      Array.isArray(err.details) &&
      err.details.every(
        (item:any) =>
          typeof item === "object" &&
          item !== null &&
          "code" in item &&
          "path" in item &&
          "message" in item
      );

    if (isValidationError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        errors: err.details
      });
    }

    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details ?? null
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    details: null
  });
};
