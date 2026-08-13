import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as newsController from "../news.controller.js"; //"../../controllers/news.controller";
import * as newsService from "../news.service.js"; //"../../services/news.service";

import { ApiError } from "../../../../shared/utils/apiErrorInfo.js"; //"../../shared/utils/ApiError";
import {
  sendPaginated,
  sendSuccess
} from "../../../../shared/utils/response.js"; //"../../shared/utils/apiResponse";
import * as newsDtoMapper from "../../mappers/news.dto.mapper.js"; //"../../mappers/news.dto.mapper";
import { mockNews, mockNewsResponse } from "./mocks/news.repository.mock.js";

// Mock Service
vi.mock("../news.service.js");

vi.mock("../../mappers/news.dto.mapper.js", () => ({
  toNewsResponseDto: vi.fn(),
  toNewsResponseDtoList: vi.fn()
}));

// Mock Response Helpers
vi.mock("../../../../shared/utils/response.js", () => ({
  sendSuccess: vi.fn(),
  sendCreated: vi.fn(),
  sendPaginated: vi.fn(),
  sendError: vi.fn()
}));

// Mock Request
const req = {} as Request;

// Mock Response
const res = {} as Response;

// Mock Next
const next: NextFunction = vi.fn();

// Reset
beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(newsDtoMapper.toNewsResponseDto).mockReturnValue(mockNewsResponse);

  vi.mocked(newsDtoMapper.toNewsResponseDtoList).mockReturnValue([
    mockNewsResponse
  ]);
});

describe("createNews()", () => {
  it("should create news successfully", async () => {
    req.body = {
      title: mockNews.title,

      slug: mockNews.slug
    };

    vi.mocked(newsService.createNews).mockResolvedValue(mockNews);

    await newsController.createNews(
      req,

      res,

      next
    );

    expect(newsService.createNews).toHaveBeenCalledOnce();

    expect(sendSuccess).toHaveBeenCalledWith(
      res,

      "News created successfully.",

      mockNewsResponse,

      201
    );
  });
});

describe("updateNews()", () => {
  it("should update news", async () => {
    req.params = {
      id: "1"
    };

    req.body = {
      title: "Updated News"
    };

    vi.mocked(newsService.updateNews).mockResolvedValue({
      ...mockNews,

      title: "Updated News"
    });

    await newsController.updateNews(
      req,

      res,

      next
    );

    expect(newsService.updateNews).toHaveBeenCalledWith(
      1,

      req.body
    );
  });
});

describe("getNewsById()", () => {
  it("should return news", async () => {
    req.params = {
      id: "1"
    };

    vi.mocked(newsService.getNewsById).mockResolvedValue(mockNews);

    await newsController.getNewsById(
      req,

      res,

      next
    );

    expect(sendSuccess).toHaveBeenCalled();
  });
});

describe("deleteNews()", () => {
  it("should delete news", async () => {
    req.params = {
      id: "1"
    };

    vi.mocked(newsService.deleteNews).mockResolvedValue();

    await newsController.deleteNews(
      req,

      res,

      next
    );

    expect(newsService.deleteNews).toHaveBeenCalledWith(1);

    expect(sendSuccess).toHaveBeenCalled();
  });
});

describe("getNewsList()", () => {
  it("should return paginated news", async () => {
    req.query = {
      page: "1",

      pageSize: "20"
    };

    vi.mocked(newsService.getNewsList).mockResolvedValue({
      items: [mockNews],

      totalRecords: 1,

      page: 1,

      pageSize: 20
    });

    await newsController.getNewsList(
      req,

      res,

      next
    );

    expect(sendPaginated).toHaveBeenCalledOnce();
  });
});

// Error Handling
describe("Controller Errors", () => {
  it("should call next(error)", async () => {
    req.params = {
      id: "100"
    };

    const error = new ApiError(404, "News not found.");

    vi.mocked(newsService.getNewsById).mockRejectedValue(error);

    await newsController.getNewsById(
      req,

      res,

      next
    );

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("changeStatus()", () => {
  it("should change news status successfully", async () => {
    req.params = {
      id: "1"
    };

    req.body = {
      status: "APPROVED",
      userId: 10
    };

    vi.mocked(newsService.changeStatus).mockResolvedValue();

    await newsController.changeStatus(req, res, next);

    expect(newsService.changeStatus).toHaveBeenCalledWith(1, "APPROVED", 10);

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "News status updated successfully."
    );
  });
});

describe("approveNews()", () => {
  it("should approve news successfully", async () => {
    req.params = {
      id: "1"
    };

    req.body = {
      approvedBy: 10
    };

    vi.mocked(newsService.approveNews).mockResolvedValue();

    await newsController.approveNews(req, res, next);

    expect(newsService.approveNews).toHaveBeenCalledWith(1, 10);

    expect(sendSuccess).toHaveBeenCalled();
  });
});

describe("publishNews()", () => {
  it("should publish news successfully", async () => {
    req.params = {
      id: "1"
    };

    req.body = {
      publishedBy: 10
    };

    vi.mocked(newsService.publishNews).mockResolvedValue();

    await newsController.publishNews(req, res, next);

    expect(newsService.publishNews).toHaveBeenCalledWith(1, 10);

    expect(sendSuccess).toHaveBeenCalled();
  });
});

describe("archiveNews()", () => {
  it("should archive news successfully", async () => {
    req.params = {
      id: "1"
    };

    req.body = {
      archivedBy: 10
    };

    vi.mocked(newsService.archiveNews).mockResolvedValue();

    await newsController.archiveNews(req, res, next);

    expect(newsService.archiveNews).toHaveBeenCalledWith(1, 10);

    expect(sendSuccess).toHaveBeenCalled();
  });
});

// Service Exception
describe("Controller Service Exception", () => {
  it("should forward ApiError to next()", async () => {
    req.params = {
      id: "1"
    };

    const error = new ApiError(409, "Slug already exists.");

    vi.mocked(newsService.updateNews).mockRejectedValue(error);

    await newsController.updateNews(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

// Unexpected Exception
describe("Unexpected Exception", () => {
  it("should forward unexpected error", async () => {
    req.params = {
      id: "1"
    };

    const error = new Error("Unexpected Error");

    vi.mocked(newsService.deleteNews).mockRejectedValue(error);

    await newsController.deleteNews(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

// Response Verification
describe("Response Helper Verification", () => {
  it("should use sendSuccess()", async () => {
    req.params = {
      id: "1"
    };

    vi.mocked(newsService.getNewsById).mockResolvedValue(mockNews);

    await newsController.getNewsById(req, res, next);

    expect(sendSuccess).toHaveBeenCalledTimes(1);
  });

  it("should use sendPaginated()", async () => {
    req.query = {
      page: "1",
      pageSize: "20"
    };

    vi.mocked(newsService.getNewsList).mockResolvedValue({
      items: [mockNews],
      totalRecords: 1,
      page: 1,
      pageSize: 20
    });

    await newsController.getNewsList(req, res, next);

    expect(sendPaginated).toHaveBeenCalledTimes(1);
  });
});

// Invalid Route Parameter
describe("Invalid Route Parameter", () => {
  it("should forward error for invalid id", async () => {
    req.params = {
      id: "abc"
    };

    vi.mocked(newsService.getNewsById).mockRejectedValue(
      new ApiError(400, "Invalid id.")
    );

    await newsController.getNewsById(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
