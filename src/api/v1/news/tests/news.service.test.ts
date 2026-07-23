import { beforeEach, describe, expect, it, vi } from "vitest";

import * as newsService from "../news.service.js"; //"../../services/news.service";
import * as newsRepository from "../news.repository.js";
//import { NewsRepository, NewsService } from "../index.js";

import { mockNews } from "./mocks/news.repository.mock.js";

import { ApiError } from "../../../../shared/utils/ApiError.js"; //"../../shared/utils/ApiError";

import { pool } from "../../../../shared/config/db.js";

// Mock Repository
// vi.mock("../../api/v1/modules/news/news.repository.js");
vi.mock("../news.repository.js", () => ({
  existsBySlug: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  deleteNews: vi.fn(),
  findAll: vi.fn(),
  changeStatus: vi.fn()
}));

// Mock Database
vi.mock("../../../../shared/config/db.js", () => ({
  pool: {
    connect: vi.fn()
  }
}));

// Mock Client
const mockClient = {
  query: vi.fn().mockResolvedValue({}),

  release: vi.fn()
};

// Repository Alias
const repository = vi.mocked(newsRepository);

// Setup
beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(pool.connect).mockResolvedValue(mockClient as never);
});

// createNews()
describe("createNews()", () => {
  it("should create news successfully", async () => {
    repository.existsBySlug.mockResolvedValue(false);

    repository.create.mockResolvedValue(mockNews);

    const result = await newsService.createNews({
      title: mockNews.title,

      slug: mockNews.slug,

      summary: mockNews.summary as string,

      content: mockNews.content,

      newsScope: mockNews.newsScope,

      countryId: mockNews.countryId!,

      stateId: mockNews.stateId!,

      districtId: mockNews.districtId!,

      categoryId: mockNews.categoryId,

      draftedBy: mockNews.draftedBy,

      createdBy: mockNews.createdBy
    });

    expect(result).toEqual(mockNews);

    expect(repository.existsBySlug).toHaveBeenCalledWith(
      mockNews.slug,
      mockClient
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.any(Object),
      mockClient
    );

    expect(mockClient.query).toHaveBeenNthCalledWith(1, "BEGIN");

    expect(mockClient.query).toHaveBeenNthCalledWith(2, "COMMIT");

    expect(mockClient.release).toHaveBeenCalledOnce();
  });
});

// Duplicate Slug
describe("Duplicate Slug", () => {
  it("should throw 409", async () => {
    repository.existsBySlug.mockResolvedValue(true);

    await expect(
      newsService.createNews({
        title: mockNews.title,

        slug: mockNews.slug,

        summary: mockNews.summary as string,

        content: mockNews.content,

        newsScope: mockNews.newsScope,

        categoryId: mockNews.categoryId,

        draftedBy: mockNews.draftedBy,

        createdBy: mockNews.createdBy
      })
    ).rejects.toBeInstanceOf(ApiError);

    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });
});

describe("getNewsById()", () => {
  it("should return news", async () => {
    repository.findById.mockResolvedValue(mockNews);

    const result = await newsService.getNewsById(1);

    expect(result).toEqual(mockNews);
  });
});

// getNewsById() Not Found
describe("getNewsById() Not Found", () => {
  it("should throw 404", async () => {
    repository.findById.mockResolvedValue(null);

    await expect(newsService.getNewsById(99)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("updateNews()", () => {
  it("should update news successfully", async () => {
    repository.findById.mockResolvedValue(mockNews);

    repository.existsBySlug.mockResolvedValue(false);

    repository.update.mockResolvedValue({
      ...mockNews,
      title: "Updated News"
    });

    const result = await newsService.updateNews(1, {
      title: "Updated News",
      updatedBy: 1
    });

    expect(result.title).toBe("Updated News");

    expect(repository.findById).toHaveBeenCalledWith(1, mockClient);

    expect(repository.update).toHaveBeenCalledWith(
      1,
      {
        title: "Updated News",
        updatedBy: 1
      },
      mockClient
    );

    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
  });
});

// Update - News Not Found
describe("updateNews() - Not Found", () => {
  it("should throw 404", async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      newsService.updateNews(999, {
        updatedBy: 1
      })
    ).rejects.toBeInstanceOf(ApiError);

    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });
});

describe("deleteNews()", () => {
  it("should delete successfully", async () => {
    repository.findById.mockResolvedValue(mockNews);

    repository.deleteNews.mockResolvedValue(true);

    await expect(newsService.deleteNews(1)).resolves.not.toThrow();

    expect(repository.deleteNews).toHaveBeenCalledWith(1, mockClient);

    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
  });
});

// deleteNews() - Not Found
describe("deleteNews() - Not Found", () => {
  it("should throw 404", async () => {
    repository.findById.mockResolvedValue(null);

    await expect(newsService.deleteNews(999)).rejects.toBeInstanceOf(ApiError);

    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });
});

describe("getNewsList()", () => {
  it("should return paginated result", async () => {
    repository.findAll.mockResolvedValue({
      items: [mockNews],

      total: 1,

      page: 1,

      pageSize: 20
    });

    const result = await newsService.getNewsList({
      page: 1,

      pageSize: 20
    });

    expect(result.total).toBe(1);

    expect(result.items).toHaveLength(1);

    expect(repository.findAll).toHaveBeenCalledOnce();
  });
});

describe("changeStatus()", () => {
  it("should change status", async () => {
    repository.findById.mockResolvedValue(mockNews);

    repository.changeStatus.mockResolvedValue(undefined);

    await expect(
      newsService.changeStatus(1, "APPROVED", 10)
    ).resolves.not.toThrow();

    expect(repository.changeStatus).toHaveBeenCalledWith(
      1,
      "APPROVED",
      10,
      mockClient
    );

    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
  });
});

describe("approveNews()", () => {
  it("should approve news", async () => {
    repository.findById.mockResolvedValue(mockNews);

    repository.changeStatus.mockResolvedValue(undefined);

    await expect(newsService.approveNews(1, 10)).resolves.not.toThrow();
  });
});

describe("publishNews()", () => {
  it("should publish approved news", async () => {
    repository.findById.mockResolvedValue({
      ...mockNews,

      status: "APPROVED"
    });

    repository.changeStatus.mockResolvedValue(undefined);

    await expect(newsService.publishNews(1, 10)).resolves.not.toThrow();
  });
});

describe("archiveNews()", () => {
  it("should archive published news", async () => {
    repository.findById.mockResolvedValue({
      ...mockNews,

      status: "PUBLISHED"
    });

    repository.changeStatus.mockResolvedValue(undefined);

    await expect(newsService.archiveNews(1, 10)).resolves.not.toThrow();
  });
});

// Test - Invalid Workflow Transition
describe("Workflow Validation", () => {
  it("should reject invalid transition", async () => {
    repository.findById.mockResolvedValue({
      ...mockNews,

      status: "DRAFT"
    });

    await expect(
      newsService.changeStatus(1, "PUBLISHED", 10)
    ).rejects.toBeInstanceOf(ApiError);

    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });
});

// Test - Repository Exception
describe("Repository Failure", () => {
  it("should rollback transaction", async () => {
    repository.existsBySlug.mockResolvedValue(false);

    repository.create.mockRejectedValue(new Error("Database Failure"));

    await expect(
      newsService.createNews({
        title: mockNews.title,

        slug: mockNews.slug,

        summary: mockNews.summary as string,

        content: mockNews.content,

        newsScope: mockNews.newsScope,

        categoryId: mockNews.categoryId,

        draftedBy: mockNews.draftedBy,

        createdBy: mockNews.createdBy
      })
    ).rejects.toThrow("Database Failure");

    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });
});

// Test - Transaction Verification
describe("Transaction Verification", () => {
  it("should begin and commit transaction", async () => {
    repository.existsBySlug.mockResolvedValue(false);

    repository.create.mockResolvedValue(mockNews);

    await newsService.createNews({
      title: mockNews.title,

      slug: mockNews.slug,

      summary: mockNews.summary as string,

      content: mockNews.content,

      newsScope: mockNews.newsScope,

      categoryId: mockNews.categoryId,

      draftedBy: mockNews.draftedBy,

      createdBy: mockNews.createdBy
    });

    expect(mockClient.query).toHaveBeenNthCalledWith(1, "BEGIN");

    expect(mockClient.query).toHaveBeenNthCalledWith(2, "COMMIT");
  });
});

// Test - Rollback on Error
describe("Rollback", () => {
  it("should execute ROLLBACK on failure", async () => {
    vi.mocked(newsRepository.existsBySlug).mockResolvedValue(false);

    vi.mocked(newsRepository.create).mockRejectedValue(new Error("DB Error"));

    await expect(
      newsService.createNews({
        title: mockNews.title,

        slug: mockNews.slug,

        summary: mockNews.summary as string,

        content: mockNews.content,

        newsScope: mockNews.newsScope,

        countryId: mockNews.countryId!,

        stateId: mockNews.stateId!,

        districtId: mockNews.districtId!,

        categoryId: mockNews.categoryId,

        draftedBy: mockNews.draftedBy,

        createdBy: mockNews.createdBy
      })
    ).rejects.toThrow();

    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });
});
// --------------------
