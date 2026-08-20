import type { NextFunction, Request, Response } from "express";

import { sendPaginated, sendSuccess } from "../../../shared/utils/response.js";

import * as newsService from "./news.service.js";

import {
  toNewsResponseDto,
  toNewsResponseDtoList
} from "../mappers/news.dto.mapper.js";

import { ApiError } from "../../../shared/utils/apiErrorInfo.js";

import type {
  CreateNewsInput,
  NewsSearchFilter,
  NewsStatus,
  UpdateNewsInput
} from "./news.types.js";

/**
 * ============================================================
 * PUBLIC
 * ============================================================
 *
 * These endpoints are intended for the public website.
 *
 * IMPORTANT:
 * Public endpoints MUST ONLY return PUBLISHED news.
 */

/**
 * ------------------------------------------------------------
 * PUBLIC
 * Get Published News List
 *
 * GET /api/v1/news/public
 * ------------------------------------------------------------
 */
export const getPublishedNewsList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filter: NewsSearchFilter = {
      page: Number(req.query.page ?? 1),

      pageSize: Number(req.query.pageSize ?? 20),

      search: req.query.search?.toString(),

      categoryId: req.query.categoryId
        ? Number(req.query.categoryId)
        : undefined,

      countryId: req.query.countryId ? Number(req.query.countryId) : undefined,

      scope: req.query.scope as NewsSearchFilter["scope"] | undefined,

      stateId: req.query.stateId ? Number(req.query.stateId) : undefined,

      districtId: req.query.districtId
        ? Number(req.query.districtId)
        : undefined,

      sortBy: req.query.sortBy?.toString(),

      sortOrder: req.query.sortOrder as "ASC" | "DESC" | undefined,

      /**
       * Public API always means PUBLISHED.
       *
       * Never trust a status supplied by the client.
       */
      status: "PUBLISHED"
    };

    const result = await newsService.getPublishedNewsList(filter);

    const dtoList = toNewsResponseDtoList(result.items);

    const totalPages =
      result.pageSize > 0
        ? Math.ceil(result.totalRecords / result.pageSize)
        : 0;

    sendPaginated(res, "Published news retrieved successfully.", dtoList, {
      page: result.page,
      pageSize: result.pageSize,
      totalRecords: result.totalRecords,
      totalPages,
      hasPrevious: result.page > 1,
      hasNext: result.page < totalPages
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * PUBLIC
 * Get Published News By Slug
 *
 * GET /api/v1/news/public/slug/:slug
 * ------------------------------------------------------------
 */
export const getPublishedNewsBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const slugParam = req.params.slug;

    if (typeof slugParam !== "string" || slugParam.trim().length === 0) {
      next(new ApiError(400, "News slug is required."));
      return;
    }

    const news = await newsService.getPublishedNewsBySlug(slugParam.trim());

    const dto = toNewsResponseDto(news);

    sendSuccess(res, "Published news retrieved successfully.", dto);
  } catch (error) {
    next(error);
  }
};

/**
 * ============================================================
 * ADMIN / INTERNAL
 * ============================================================
 */

/**
 * ------------------------------------------------------------
 * ADMIN
 * Create News
 * ------------------------------------------------------------
 */
export const createNews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = req.body as CreateNewsInput;

    const news = await newsService.createNews(payload);

    const dto = toNewsResponseDto(news);

    sendSuccess(res, "News created successfully.", dto, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Update News
 * ------------------------------------------------------------
 */
export const updateNews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const payload = req.body as UpdateNewsInput;

    const news = await newsService.updateNews(id, payload);

    const dto = toNewsResponseDto(news);

    sendSuccess(res, "News updated successfully.", dto);
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Get News By ID
 *
 * Returns all statuses.
 * ------------------------------------------------------------
 */
export const getNewsById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const news = await newsService.getNewsById(id);

    const dto = toNewsResponseDto(news);

    sendSuccess(res, "News retrieved successfully.", dto);
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Get News By Slug
 *
 * IMPORTANT:
 * This is an ADMIN/INTERNAL lookup.
 *
 * It intentionally uses getNewsBySlug() so that draft,
 * approved, published etc. articles can be inspected.
 *
 * Public clients must use:
 *
 * /api/v1/news/public/slug/:slug
 * ------------------------------------------------------------
 */
export const getNewsBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const slugParam = req.params.slug;

    if (typeof slugParam !== "string" || slugParam.trim().length === 0) {
      next(new ApiError(400, "News slug is required."));
      return;
    }

    const news = await newsService.getNewsBySlug(slugParam.trim());

    const dto = toNewsResponseDto(news);

    sendSuccess(res, "News retrieved successfully.", dto);
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Delete News
 * ------------------------------------------------------------
 */
export const deleteNews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    await newsService.deleteNews(id);

    sendSuccess(res, "News deleted successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Get News List
 *
 * This endpoint can return all statuses.
 * ------------------------------------------------------------
 */
export const getNewsList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filter: NewsSearchFilter = {
      page: Number(req.query.page ?? 1),

      pageSize: Number(req.query.pageSize ?? 20),

      search: req.query.search?.toString(),

      status: req.query.status as NewsStatus | undefined,

      categoryId: req.query.categoryId
        ? Number(req.query.categoryId)
        : undefined,

      countryId: req.query.countryId ? Number(req.query.countryId) : undefined,

      scope: req.query.scope as NewsSearchFilter["scope"] | undefined,

      stateId: req.query.stateId ? Number(req.query.stateId) : undefined,

      districtId: req.query.districtId
        ? Number(req.query.districtId)
        : undefined,

      sortBy: req.query.sortBy?.toString(),

      sortOrder: req.query.sortOrder as "ASC" | "DESC" | undefined
    };

    const result = await newsService.getNewsList(filter);

    const dtoList = toNewsResponseDtoList(result.items);

    const totalPages =
      result.pageSize > 0
        ? Math.ceil(result.totalRecords / result.pageSize)
        : 0;

    sendPaginated(res, "News retrieved successfully.", dtoList, {
      page: result.page,
      pageSize: result.pageSize,
      totalRecords: result.totalRecords,
      totalPages,
      hasPrevious: result.page > 1,
      hasNext: result.page < totalPages
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Change Status
 * ------------------------------------------------------------
 */
export const changeStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const { status, userId } = req.body as {
      status: NewsStatus;
      userId: number;
    };

    await newsService.changeStatus(id, status, userId);

    sendSuccess(res, "News status updated successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Submit For Review
 * ------------------------------------------------------------
 */
export const submitNewsForReview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const { submittedBy } = req.body as {
      submittedBy: number;
    };

    await newsService.submitNewsForReview(id, submittedBy);

    sendSuccess(res, "News submitted for review successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Approve News
 * ------------------------------------------------------------
 */
export const approveNews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const { approvedBy } = req.body as {
      approvedBy: number;
    };

    await newsService.approveNews(id, approvedBy);

    sendSuccess(res, "News approved successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Reject News
 * ------------------------------------------------------------
 */
export const rejectNews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const { rejectedBy } = req.body as {
      rejectedBy: number;
    };

    await newsService.rejectNews(id, rejectedBy);

    sendSuccess(res, "News rejected successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Publish News
 * ------------------------------------------------------------
 */
export const publishNews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const { publishedBy } = req.body as {
      publishedBy: number;
    };

    await newsService.publishNews(id, publishedBy);

    sendSuccess(res, "News published successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Archive News
 * ------------------------------------------------------------
 */
export const archiveNews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const { archivedBy } = req.body as {
      archivedBy: number;
    };

    await newsService.archiveNews(id, archivedBy);

    sendSuccess(res, "News archived successfully.");
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Activate Archived News
 *
 * ARCHIVED -> DRAFT
 * ------------------------------------------------------------
 */
export const activateNews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const { activatedBy } = req.body as {
      activatedBy: number;
    };

    const news = await newsService.activateNews(
      id,
      activatedBy
    );

    const dto = toNewsResponseDto(news);

    sendSuccess(
      res,
      "News activated successfully.",
      dto
    );
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Promote News
 * ------------------------------------------------------------
 */
export const promoteNews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const { promotedBy, durationDays } = req.body as {
      promotedBy: number;
      durationDays: 3;
    };

    const news = await newsService.promoteNews(id, promotedBy, durationDays);

    const dto = toNewsResponseDto(news);

    sendSuccess(res, "News promoted successfully.", dto);
  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------------
 * ADMIN
 * Remove Promotion
 * ------------------------------------------------------------
 */
export const removePromotion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const { updatedBy } = req.body as {
      updatedBy: number;
    };

    const news = await newsService.removePromotion(id, updatedBy);

    const dto = toNewsResponseDto(news);

    sendSuccess(res, "News promotion removed successfully.", dto);
  } catch (error) {
    next(error);
  }
};
