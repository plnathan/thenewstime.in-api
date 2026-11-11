import { Router } from "express";
import { createEnquirySpamProtection } from "./advertisement-enquiry.spam.js";
import type { Pool } from "pg";
import { createAdvertisementEnquiryController } from "./advertisement-enquiry.controller.js";
import { createAdvertisementEnquiryRepository } from "./advertisement-enquiry.repository.js";
import { createAdvertisementEnquiryService } from "./advertisement-enquiry.service.js";

/** Mount at /api/v1/advertisement-enquiries. Apply public rate limiting at mount point. */
export function createAdvertisementEnquiryRouter(pool: Pool): Router {
  const router = Router();
  const service = createAdvertisementEnquiryService(
    createAdvertisementEnquiryRepository(pool)
  );
  const controller = createAdvertisementEnquiryController(service);
  router.post("/", createEnquirySpamProtection(pool), controller.submit);
  return router;
}
