import { Router } from "express";

import * as newsController from "./news.controller.js";

import { validate } from "../../../shared/middleware/validate.middleware.js"; //"../../../../middlewares/validate.middleware.js";

import {
  createNewsSchema,
  updateNewsSchema,
  changeStatusSchema,
  newsSearchSchema,
  idParamSchema
} from "./news.validation.js";

const router = Router();

/**
 * GET /api/v1/news
 * Get News List
 */
router.get(
  "/",
  validate(newsSearchSchema, "query"),
  newsController.getNewsList
);

/**
 * PATCH /api/v1/news/:id/status
 * Change Status
 */
router.patch(
  "/:id/status",
  validate(changeStatusSchema, "body"),
  newsController.changeStatus
);

/**
 * PATCH /api/v1/news/:id/approve
 */
router.patch("/:id/approve", newsController.approveNews);

/**
 * PATCH /api/v1/news/:id/publish
 */
router.patch("/:id/publish", newsController.publishNews);

/**
 * PATCH /api/v1/news/:id/archive
 */
router.patch("/:id/archive", newsController.archiveNews);
/**
 * GET /api/v1/news/:id
 * Get News By Id
 */
//router.get("/:id", newsController.getNewsById);
router.get(
  "/:id",
  validate(idParamSchema, "params"),
  newsController.getNewsById
);

/**
 * POST /api/v1/news
 * Create News
 */
router.post("/", validate(createNewsSchema, "body"), newsController.createNews);

/**
 * PUT /api/v1/news/:id
 * Update News
 */
router.put(
  "/:id",
  validate(updateNewsSchema, "body"),
  newsController.updateNews
);

/**
 * DELETE /api/v1/news/:id
 * Delete News
 */
router.delete("/:id", newsController.deleteNews);

export default router;

/*
const router = Router();

router.get(
  "/",
  validate(newsListQuerySchema, "query"),
  asyncHandler(getAllNews)
);
router.get("/:id", asyncHandler(getNewsById));
router.post("/", validate(createNewsSchema), asyncHandler(createNews));
router.put("/:id", validate(updateNewsSchema), asyncHandler(updateNews));
router.patch("/:id", validate(updateNewsSchema), asyncHandler(patchNews));
router.delete("/:id", asyncHandler(deleteNews));

// router.get("/", getAllNews);
// router.get("/:id", getNewsById);
// router.post("/", createNews);
// router.put("/:id", updateNews);
// router.patch("/:id", patchNews);
// router.delete("/:id", deleteNews);

export default router;
*/
