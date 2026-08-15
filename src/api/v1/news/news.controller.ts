// 1. External packages
import type { NextFunction, Request, Response } from "express";

// 2. Shared modules
import { sendPaginated, sendSuccess } from "../../../shared/utils/response.js";

// 3. Feature services
import * as newsService from "./news.service.js";

// 4. Feature mappers
import {
  toNewsResponseDto,
  toNewsResponseDtoList
} from "../mappers/news.dto.mapper.js";

// 5. Feature types
import { ApiError } from "../../../shared/utils/apiErrorInfo.js";
import type {
  CreateNewsInput,
  NewsSearchFilter,
  NewsStatus,
  UpdateNewsInput
} from "./news.types.js";

/**
 * Create News
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
 * Update News
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
 * Get News by ID
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
 * Get News by Slug
 *
 * Public/news-detail endpoint.
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

    const slug = slugParam.trim();

    const news = await newsService.getNewsBySlug(slug);

    const dto = toNewsResponseDto(news);

    sendSuccess(res, "News retrieved successfully.", dto);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete News
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
 * Get News List
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

      /**
       * Country filter
       */
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

    const totalPages = Math.ceil(result.totalRecords / result.pageSize);

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
 * Change News Status
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
 * Approve News
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
 * Publish News
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
 * Archive News
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
 * Promote News
 *
 * POST /api/v1/news/:id/promote
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
 * Remove News Promotion
 *
 * DELETE /api/v1/news/:id/promotion
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
