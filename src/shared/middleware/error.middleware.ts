import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { ApiError } from "../utils/apiErrorInfo.js";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error("Global error:", err);

  /**
   * Zod validation errors
   *
   * Controllers use schema.parse(), which throws ZodError
   * when request data is invalid.
   *
   * These are client errors, therefore they must return 400.
   */
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: err.issues
    });
  }

  /**
   * Application/API errors
   */
  if (err instanceof ApiError) {
    const isValidationError =
      Array.isArray(err.details) &&
      err.details.every(
        (item: unknown) =>
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

  /**
   * Unexpected/unhandled errors
   */
  return res.status(500).json({
    success: false,
    message: "Internal server error",
    details: null
  });
};
