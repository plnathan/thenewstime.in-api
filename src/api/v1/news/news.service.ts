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
 * Create News
 */
export const createNews = async (data: CreateNewsInput): Promise<News> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /**
     * Slug must be unique.
     *
     * The database UNIQUE constraint is the final
     * protection; this check gives the API a friendly
     * 409 response before attempting the INSERT.
     */
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
 * Update News
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

    /**
     * Only check slug uniqueness when the slug
     * is actually changing.
     */
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
 * Get News by ID
 *
 * Used mainly by admin/internal operations.
 */
export const getNewsById = async (id: number): Promise<News> => {
  const news = await newsRepository.findById(id);

  if (!news) {
    throw new ApiError(404, "News not found.");
  }

  return news;
};

/**
 * Get News by Slug
 *
 * This is the public-friendly lookup used by
 * the frontend news detail page.
 */
export const getNewsBySlug = async (slug: string): Promise<News> => {
  const news = await newsRepository.findBySlug(slug);

  if (!news) {
    throw new ApiError(404, "News not found.");
  }

  return news;
};

/**
 * Delete News
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
 * Get News List
 */
export const getNewsList = async (filter: NewsSearchFilter) => {
  return newsRepository.findAll(filter);
};

/**
 * Change News Status
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
 * Approve News
 */
export const approveNews = async (
  id: number,
  approvedBy: number
): Promise<void> => {
  await changeStatus(id, "APPROVED", approvedBy);
};

/**
 * Publish News
 */
export const publishNews = async (
  id: number,
  publishedBy: number
): Promise<void> => {
  await changeStatus(id, "PUBLISHED", publishedBy);
};

/**
 * Archive News
 */
export const archiveNews = async (
  id: number,
  archivedBy: number
): Promise<void> => {
  await changeStatus(id, "ARCHIVED", archivedBy);
};

/**
 * News workflow
 */
const workflow: Record<NewsStatus, NewsStatus[]> = {
  DRAFT: ["IN_REVIEW", "APPROVED", "ARCHIVED"],

  IN_REVIEW: ["APPROVED", "REJECTED", "ARCHIVED"],

  APPROVED: ["PUBLISHED", "ARCHIVED"],

  PUBLISHED: ["ARCHIVED"],

  ARCHIVED: [],

  REJECTED: ["DRAFT"]
};

/**
 * Validate News status transition.
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
