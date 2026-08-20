import { Router } from "express";

import * as newsController from "./news.controller.js";

import { validate } from "../../../shared/middleware/validate.middleware.js";

import {
  activateNewsSchema,
  changeStatusSchema,
  createNewsSchema,
  idParamSchema,
  newsSearchSchema,
  newsSlugParamsSchema,
  promoteNewsSchema,
  removePromotionSchema,
  updateNewsSchema
} from "./news.validation.js";

const router = Router();

/**
 * ============================================================
 * PUBLIC API
 * ============================================================
 *
 * These routes are ONLY for the public website.
 *
 * They always return PUBLISHED news.
 */

/**
 * GET /api/v1/news/public
 *
 * Get published news list.
 */
router.get(
  "/public",
  validate(newsSearchSchema, "query"),
  newsController.getPublishedNewsList
);

/**
 * GET /api/v1/news/public/slug/:slug
 *
 * Get published news by slug.
 *
 * IMPORTANT:
 * This route must appear before any conflicting dynamic route.
 */
router.get(
  "/public/slug/:slug",
  validate(newsSlugParamsSchema, "params"),
  newsController.getPublishedNewsBySlug
);

/**
 * ============================================================
 * ADMIN / INTERNAL API
 * ============================================================
 */

/**
 * GET /api/v1/news
 *
 * Get News List
 *
 * Can return all statuses.
 */
router.get(
  "/",
  validate(newsSearchSchema, "query"),
  newsController.getNewsList
);

/**
 * GET /api/v1/news/slug/:slug
 *
 * Admin/internal lookup by slug.
 *
 * IMPORTANT:
 * This returns any status.
 *
 * Public clients must use:
 *
 * /api/v1/news/public/slug/:slug
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
 * PATCH /api/v1/news/:id/activate
 *
 * Activate archived news.
 *
 * ARCHIVED -> DRAFT
 */
router.patch(
  "/:id/activate",
  validate(idParamSchema, "params"),
  validate(activateNewsSchema, "body"),
  newsController.activateNews
);

/**
 * POST /api/v1/news/:id/promote
 *
 * Promote published news for 3 days.
 */
router.post(
  "/:id/promote",
  validate(idParamSchema, "params"),
  validate(promoteNewsSchema, "body"),
  newsController.promoteNews
);

/**
 * DELETE /api/v1/news/:id/promotion
 *
 * Remove active promotion.
 */
router.delete(
  "/:id/promotion",
  validate(idParamSchema, "params"),
  validate(removePromotionSchema, "body"),
  newsController.removePromotion
);

/**
 * GET /api/v1/news/:id
 *
 * Get News By ID
 *
 * Admin/internal only.
 */
router.get(
  "/:id",
  validate(idParamSchema, "params"),
  newsController.getNewsById
);

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
