// 1. External packages
import type { NextFunction, Request, Response } from "express";
// 3. Feature services
import * as newsService from "./news.service.js";
//import { NewsService } from "../news/index.js";
// 2. Shared modules
import { sendPaginated, sendSuccess } from "../../../shared/utils/response.js";
// 4. Feature mappers
import {
  toNewsResponseDto,
  toNewsResponseDtoList
} from "../mappers/news.dto.mapper.js";
// 5. Feature types
import type {
  CreateNewsInput,
  NewsSearchFilter,
  NewsStatus,
  UpdateNewsInput
} from "./news.types.js";

export const createNews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = req.body as CreateNewsInput;
    console.log(req.body);
    const news = await newsService.createNews(payload);
    const dto = toNewsResponseDto(news);

    sendSuccess(res, "News created successfully.", dto, 201);
  } catch (error) {
    next(error);
  }
};

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

export const getNewsById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    //const { id } = req.params as { id: number };

    const news = await newsService.getNewsById(id);

    const dto = toNewsResponseDto(news);

    sendSuccess(res, "News retrieved successfully.", dto);
  } catch (error) {
    next(error);
  }
};

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

      status: req.query.status as any,

      categoryId: req.query.categoryId
        ? Number(req.query.categoryId)
        : undefined,

      scope: req.query.scope as any,

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
