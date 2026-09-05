import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import * as controller from "./auth.controller.js";

import {
  loginSchema,
  refreshTokenSchema,
  registerSchema
} from "./auth.validation.js";

import { authenticate } from "../middleware/authenticate.middleware.js";

const router = Router();

router.post("/register", validate(registerSchema), controller.register);

router.post("/login", validate(loginSchema), controller.login);

router.post("/refresh", validate(refreshTokenSchema), controller.refresh);

router.post("/logout", validate(refreshTokenSchema), controller.logout);

router.get("/me", authenticate, controller.me);

export default router;
