import type { NextFunction, Request, Response } from "express";
import * as newsService from "./news.service.js";
//import { NewsService } from "../news/index.js";
import {
  sendSuccess,
  sendPaginatedSuccess
} from "../../../shared/utils/response.js";
import type {
  CreateNewsInput,
  NewsSearchFilter,
  UpdateNewsInput,
  NewsStatus
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

    sendSuccess(res, "News created successfully.", news, 201);
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

    sendSuccess(res, "News updated successfully.", news);
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

    sendSuccess(res, "News retrieved successfully.", news);
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

    sendPaginatedSuccess(
      res,

      "News retrieved successfully.",

      result.items,

      {
        total: result.total,

        page: result.page,

        limit: result.pageSize,

        totalPages: Math.ceil(result.total / result.pageSize)
      }
    );
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
