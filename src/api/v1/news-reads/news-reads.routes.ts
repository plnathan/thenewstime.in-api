import { Router } from "express";

import { count, create, popular } from "./news-reads.controller.js";

const router = Router();

/**
 * Record a news read.
 *
 * POST /api/v1/news-reads
 */
router.post("/", create);

/**
 * Get read count for a news article.
 *
 * GET /api/v1/news-reads/news/:id/count
 */
router.get("/news/:id/count", count);

/**
 * Get popular news.
 *
 * GET /api/v1/news-reads/popular
 */
router.get("/popular", popular);

export default router;
