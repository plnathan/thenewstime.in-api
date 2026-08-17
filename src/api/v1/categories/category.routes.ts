import { Router } from "express";

import { validate } from "../../../shared/middleware/validate.middleware.js";

import * as controller from "./category.controller.js";

import { categoryIdParamsSchema } from "./category.validation.js";

const router = Router();

router.get("/", controller.getCategories);

router.get(
  "/:id",
  validate(categoryIdParamsSchema, "params"),
  controller.getCategoryById
);

export default router;
