import { DuplicateEnquiryError } from "./advertisement-enquiry.repository.js";
import { enquiryFingerprintKey } from "./advertisement-enquiry.spam.js";
import { EnquiryRateLimitError } from "./advertisement-enquiry.rate-limit.js";
import type { RequestHandler } from "express";
import { ZodError } from "zod";
import { createAdvertisementEnquirySchema } from "./advertisement-enquiry.validation.js";
import type { createAdvertisementEnquiryService } from "./advertisement-enquiry.service.js";

export function createAdvertisementEnquiryController(
  service: ReturnType<typeof createAdvertisementEnquiryService>
): {
  submit: RequestHandler;
} {
  return {
    submit: async (req, res, next) => {
      try {
        const input = createAdvertisementEnquirySchema.parse(req.body);
        const fingerprint = res.locals[enquiryFingerprintKey];
        if (typeof fingerprint !== "string" || !fingerprint)
          throw new Error("Missing enquiry security context");
        const created = await service.submit(input, fingerprint);
        res.status(201).json({
          success: true,
          data: { ...created, status: "PENDING" },
          message: "Your enquiry has been received."
        });
      } catch (error) {
        if (error instanceof DuplicateEnquiryError) {
          res
            .status(409)
            .json({
              success: false,
              code: "DUPLICATE_ENQUIRY",
              message: error.message
            });
          return;
        }
        if (error instanceof EnquiryRateLimitError) {
          res.setHeader("Retry-After", String(error.retryAfter));
          res
            .status(429)
            .json({
              success: false,
              message: error.message,
              retryAfter: error.retryAfter
            });
          return;
        }
        if (error instanceof ZodError) {
          res.status(400).json({
            success: false,
            message: "Invalid advertisement enquiry",
            errors: error.flatten()
          });
          return;
        }
        next(error);
      }
    }
  };
}
