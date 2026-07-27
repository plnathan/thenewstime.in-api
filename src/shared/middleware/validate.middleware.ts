import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../utils/apiErrorInfo.js"; //"../shared/utils/ApiError.js";

type ValidateTarget = "body" | "query" | "params";

export const validate =
  (schema: z.ZodTypeAny, target: ValidateTarget = "body") =>
  (req: Request, _res: Response, next: NextFunction) => {
    const value = req[target];

    if (target === "body" && (value === undefined || value === null)) {
      return next(
        new ApiError(400, "Request body is missing", [
          {
            code: "missing_body",
            path: ["body"],
            message:
              "Request body is missing. Send JSON body with Content-Type: application/json"
          }
        ])
      );
    }

    const result = schema.safeParse(value);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message
      }));

      return next(new ApiError(400, "Validation failed", errors));
    }

    if (target === "body") {
      req.body = result.data;
    } else if (target === "query") {
      Object.keys(req.query).forEach((key) => {
        delete (req.query as Record<string, unknown>)[key];
      });
      Object.assign(req.query as Record<string, unknown>, result.data);
    } else if (target === "params") {
      Object.keys(req.params).forEach((key) => {
        delete (req.params as Record<string, string>)[key];
      });
      Object.assign(req.params as Record<string, string>, result.data);
    }

    next();
  };
