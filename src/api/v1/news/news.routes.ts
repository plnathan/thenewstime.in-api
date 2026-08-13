import { Router } from "express";

import * as newsController from "./news.controller.js";

import { validate } from "../../../shared/middleware/validate.middleware.js";

import {
  changeStatusSchema,
  createNewsSchema,
  idParamSchema,
  newsSearchSchema,
  newsSlugParamsSchema,
  updateNewsSchema
} from "./news.validation.js";

const router = Router();

/**
 * GET /api/v1/news
 *
 * Get News List
 */
router.get(
  "/",
  validate(newsSearchSchema, "query"),
  newsController.getNewsList
);

/**
 * GET /api/v1/news/slug/:slug
 *
 * Get News By Slug
 *
 * IMPORTANT:
 * This route must appear before /:id.
 */
router.get(
  "/slug/:slug",
  validate(newsSlugParamsSchema, "params"),
  newsController.getNewsBySlug
);

/**
 * PATCH /api/v1/news/:id/status
 *
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
 *
 * Get News By Id
 */
router.get(
  "/:id",
  validate(idParamSchema, "params"),
  newsController.getNewsById
);

// router.get(
//   "/slug/:slug",
//   validate(slugParamSchema, "params"),
//   newsController.getNewsBySlug
// );

/**
 * POST /api/v1/news
 *
 * Create News
 */
router.post("/", validate(createNewsSchema, "body"), newsController.createNews);

/**
 * PUT /api/v1/news/:id
 *
 * Update News
 */
router.put(
  "/:id",
  validate(updateNewsSchema, "body"),
  newsController.updateNews
);

/**
 * DELETE /api/v1/news/:id
 *
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

GET /
GET /slug/:slug
PATCH /:id/status
PATCH /:id/approve
PATCH /:id/publish
PATCH /:id/archive
GET /:id
POST /
PUT /:id
DELETE /:id

expect(response.body.success).toBe(true);

expect(response.body.data).toBeDefined();
expect(Array.isArray(response.body.data)).toBe(true);

expect(response.body.meta).toBeDefined();

expect(response.body.meta.page).toBe(1);
expect(response.body.meta.pageSize).toBe(20);
expect(response.body.meta.totalRecords).toBeDefined();
expect(response.body.meta.totalPages).toBeDefined();
*/
