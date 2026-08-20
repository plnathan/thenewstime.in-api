import { pool } from "../../../shared/config/db.js";

import { ApiError } from "../../../shared/utils/apiErrorInfo.js";

import * as newsRepository from "./news.repository.js";

import type {
  CreateNewsInput,
  News,
  NewsSearchFilter,
  NewsStatus,
  UpdateNewsInput
} from "./news.types.js";

/**
 * ============================================================
 * CREATE NEWS
 * ============================================================
 */
export const createNews = async (data: CreateNewsInput): Promise<News> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const slugExists = await newsRepository.existsBySlug(data.slug, client);

    if (slugExists) {
      throw new ApiError(409, "Slug already exists.");
    }

    const news = await newsRepository.create(data, client);

    await client.query("COMMIT");

    return news;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * ============================================================
 * UPDATE NEWS
 * ============================================================
 */
export const updateNews = async (
  id: number,
  data: UpdateNewsInput
): Promise<News> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingNews = await newsRepository.findById(id, client);

    if (!existingNews) {
      throw new ApiError(404, "News not found.");
    }

    if (data.slug !== undefined && data.slug !== existingNews.slug) {
      const slugExists = await newsRepository.existsBySlug(data.slug, client);

      if (slugExists) {
        throw new ApiError(409, "Slug already exists.");
      }
    }

    const updatedNews = await newsRepository.update(id, data, client);

    if (!updatedNews) {
      throw new ApiError(404, "Unable to update news.");
    }

    await client.query("COMMIT");

    return updatedNews;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * ============================================================
 * GET NEWS BY ID
 *
 * ADMIN / INTERNAL
 *
 * Returns any status.
 * ============================================================
 */
export const getNewsById = async (id: number): Promise<News> => {
  const news = await newsRepository.findById(id);

  if (!news) {
    throw new ApiError(404, "News not found.");
  }

  return news;
};

/**
 * ============================================================
 * GET NEWS BY SLUG
 *
 * ADMIN / INTERNAL
 *
 * Returns any status.
 *
 * IMPORTANT:
 * Public clients must NOT use this method.
 * They must use getPublishedNewsBySlug().
 * ============================================================
 */
export const getNewsBySlug = async (slug: string): Promise<News> => {
  const news = await newsRepository.findBySlug(slug);

  if (!news) {
    throw new ApiError(404, "News not found.");
  }

  return news;
};

/**
 * ============================================================
 * GET PUBLISHED NEWS BY SLUG
 *
 * PUBLIC
 *
 * Only PUBLISHED articles are returned.
 * ============================================================
 */
export const getPublishedNewsBySlug = async (slug: string): Promise<News> => {
  const news = await newsRepository.findPublishedBySlug(slug);

  if (!news) {
    throw new ApiError(404, "News not found.");
  }

  return news;
};

/**
 * ============================================================
 * GET ADMIN NEWS LIST
 *
 * ADMIN / INTERNAL
 *
 * Can return any status.
 * ============================================================
 */
export const getNewsList = async (filter: NewsSearchFilter) => {
  return newsRepository.findAll(filter);
};

/**
 * ============================================================
 * GET PUBLIC NEWS LIST
 *
 * PUBLIC
 *
 * The service forcibly applies PUBLISHED.
 *
 * Client cannot override this using:
 *
 * ?status=DRAFT
 * ?status=APPROVED
 * etc.
 * ============================================================
 */
export const getPublishedNewsList = async (filter: NewsSearchFilter) => {
  return newsRepository.findPublishedAll(filter);
};

/**
 * ============================================================
 * DELETE NEWS
 * ============================================================
 */
export const deleteNews = async (id: number): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingNews = await newsRepository.findById(id, client);

    if (!existingNews) {
      throw new ApiError(404, "News not found.");
    }

    const deleted = await newsRepository.deleteNews(id, client);

    if (!deleted) {
      throw new ApiError(500, "Unable to delete news.");
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * ============================================================
 * NEWS WORKFLOW
 * ============================================================
 *
 * Primary publishing workflow:
 *
 * DRAFT
 *   ↓
 * APPROVED
 *   ↓
 * PUBLISHED
 *   ↓
 * ARCHIVED
 *
 * Rejection workflow:
 *
 * IN_REVIEW
 *   ↓
 * REJECTED
 *   ↓
 * DRAFT
 *
 * IN_REVIEW is retained for future moderation/review UI.
 *
 * IMPORTANT:
 * The current API/test workflow expects a newly-created
 * DRAFT article to be directly approvable.
 * ============================================================
 */
const workflow: Record<NewsStatus, NewsStatus[]> = {
  DRAFT: ["APPROVED", "IN_REVIEW"],

  IN_REVIEW: ["APPROVED", "REJECTED"],

  APPROVED: ["PUBLISHED"],

  PUBLISHED: ["ARCHIVED"],

  ARCHIVED: [],

  REJECTED: ["DRAFT"]
};

/**
 * ============================================================
 * VALIDATE STATUS TRANSITION
 * ============================================================
 */
const validateStatusTransition = (
  currentStatus: NewsStatus,
  nextStatus: NewsStatus
): void => {
  if (currentStatus === nextStatus) {
    throw new ApiError(400, `News is already in '${currentStatus}' status.`);
  }

  const allowedStatuses = workflow[currentStatus];

  if (!allowedStatuses.includes(nextStatus)) {
    throw new ApiError(
      400,
      `Invalid status transition from '${currentStatus}' to '${nextStatus}'.`
    );
  }
};

/**
 * ============================================================
 * CHANGE NEWS STATUS
 * ============================================================
 */
export const changeStatus = async (
  id: number,
  status: NewsStatus,
  userId: number
): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const news = await newsRepository.findById(id, client);

    if (!news) {
      throw new ApiError(404, "News not found.");
    }

    validateStatusTransition(news.status, status);

    await newsRepository.changeStatus(id, status, userId, client);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * ============================================================
 * WORKFLOW HELPERS
 * ============================================================
 */

export const submitNewsForReview = async (
  id: number,
  submittedBy: number
): Promise<void> => {
  await changeStatus(id, "IN_REVIEW", submittedBy);
};

export const approveNews = async (
  id: number,
  approvedBy: number
): Promise<void> => {
  await changeStatus(id, "APPROVED", approvedBy);
};

export const rejectNews = async (
  id: number,
  rejectedBy: number
): Promise<void> => {
  await changeStatus(id, "REJECTED", rejectedBy);
};

export const publishNews = async (
  id: number,
  publishedBy: number
): Promise<void> => {
  await changeStatus(id, "PUBLISHED", publishedBy);
};

export const archiveNews = async (
  id: number,
  archivedBy: number
): Promise<void> => {
  await changeStatus(id, "ARCHIVED", archivedBy);
};

/**
 * ============================================================
 * ACTIVATE ARCHIVED NEWS
 *
 * ARCHIVED -> DRAFT
 *
 * This is intentionally a dedicated workflow action.
 * It must not be possible through the generic status endpoint.
 * ============================================================
 */
export const activateNews = async (
  id: number,
  activatedBy: number
): Promise<News> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingNews = await newsRepository.findById(id, client);

    if (!existingNews) {
      throw new ApiError(404, "News not found.");
    }

    if (existingNews.status !== "ARCHIVED") {
      throw new ApiError(
        400,
        "Only archived news can be activated."
      );
    }

    const activatedNews = await newsRepository.activate(
      id,
      activatedBy,
      client
    );

    if (!activatedNews) {
      throw new ApiError(
        400,
        "Unable to activate news."
      );
    }

    await client.query("COMMIT");

    return activatedNews;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * ============================================================
 * PROMOTE NEWS
 * ============================================================
 */
export const promoteNews = async (
  id: number,
  promotedBy: number,
  durationDays: number
): Promise<News> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const news = await newsRepository.findById(id, client);

    if (!news) {
      throw new ApiError(404, "News not found.");
    }

    if (news.status !== "PUBLISHED") {
      throw new ApiError(400, "Only published news can be promoted.");
    }

    if (durationDays !== 3) {
      throw new ApiError(
        400,
        "News promotion duration must be exactly 3 days."
      );
    }

    const promotedNews = await newsRepository.promote(
      id,
      promotedBy,
      durationDays,
      client
    );

    if (!promotedNews) {
      throw new ApiError(400, "Unable to promote news.");
    }

    await client.query("COMMIT");

    return promotedNews;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * ============================================================
 * REMOVE NEWS PROMOTION
 * ============================================================
 */
export const removePromotion = async (
  id: number,
  updatedBy: number
): Promise<News> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const news = await newsRepository.findById(id, client);

    if (!news) {
      throw new ApiError(404, "News not found.");
    }

    const updatedNews = await newsRepository.removePromotion(
      id,
      updatedBy,
      client
    );

    if (!updatedNews) {
      throw new ApiError(500, "Unable to remove news promotion.");
    }

    await client.query("COMMIT");

    return updatedNews;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
