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
        const created = await service.submit(input);
        res.status(201).json({
          success: true,
          data: { ...created, status: "PENDING" },
          message: "Your enquiry has been received."
        });
      } catch (error) {
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
