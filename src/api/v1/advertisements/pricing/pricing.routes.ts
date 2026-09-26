import { Router } from "express";

import { authenticate } from "../../security/middleware/authenticate.middleware.js";
import { authorize } from "../../security/middleware/authorize.middleware.js";

import * as controller from "./pricing.controller.js";

const router = Router();

router.use(authenticate);

router.get(
  "/standard-amount/:advertisementId",
  authorize("ADVERTISEMENT", "advertisements", "read"),
  controller.getStandardAmount
);

export default router;
