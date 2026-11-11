import { Router } from "express";

import { validate } from "../../../shared/middleware/validate.middleware.js";

import * as controller from "./category.controller.js";

import {
  categoryIdParamsSchema,
  createCategorySchema,
  updateCategorySchema
} from "./category.validation.js";
import { authenticate } from "../security/middleware/authenticate.middleware.js";
import { authorize } from "../security/middleware/authorize.middleware.js";

const router = Router();

router.get("/", controller.getCategories);
router.post(
  "/",
  authenticate,
  authorize("NEWS", "news.category", "create"),
  validate(createCategorySchema, "body"),
  controller.createCategory
);
router.patch(
  "/:id",
  authenticate,
  authorize("NEWS", "news.category", "update"),
  validate(categoryIdParamsSchema, "params"),
  validate(updateCategorySchema, "body"),
  controller.updateCategory
);

router.get(
  "/:id",
  validate(categoryIdParamsSchema, "params"),
  controller.getCategoryById
);

export default router;
