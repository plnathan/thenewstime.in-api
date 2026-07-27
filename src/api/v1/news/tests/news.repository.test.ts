import { beforeEach, describe, expect, it, vi } from "vitest";

//import { NewsRepository } from "../index.js";

import * as repository from "../news.repository.js";

import { pool } from "../../../../shared/config/db.js"; //"../../shared/config/db.js";

import { mockNews, mockNewsResponse } from "./mocks/news.repository.mock.js";

vi.mock("../../../../shared/config/db.js", () => ({
  pool: {
    query: vi.fn()
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("News Repository", () => {
  it("should create news", async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [
        {
          id: 1,

          news_number: 1001,

          title: mockNews.title,

          slug: mockNews.slug,

          summary: mockNews.summary,

          content: mockNews.content,

          news_scope: mockNews.newsScope,

          country_id: mockNews.countryId,

          state_id: mockNews.stateId,

          district_id: mockNews.districtId,

          category_id: mockNews.categoryId,

          status: mockNews.status,

          drafted_by: mockNews.draftedBy,

          approved_by: null,

          published_by: null,

          drafted_at: new Date(),

          approved_at: null,

          published_at: null,

          created_by: 1,

          updated_by: null,

          created_at: new Date(),

          updated_at: new Date()
        }
      ],

      rowCount: 1
    } as any);

    const result = await repository.create({
      categoryId: mockNewsResponse.categoryId,

      content: mockNews.content,

      countryId: mockNews.countryId!,
      districtId: mockNews.districtId!,
      draftedBy: mockNews.draftedBy,
      newsScope: mockNews.newsScope,
      slug: mockNews.slug,
      stateId: mockNews.stateId!,

      title: mockNews.title,
      createdBy: mockNews.createdBy,
      summary: mockNews.summary as string
    });

    expect(result.title).toBe(mockNews.title);

    expect(result.slug).toBe(mockNews.slug);
  });
});

describe("findById()", () => {
  it("should return a news item when id exists", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          news_number: 1001,
          title: mockNews.title,
          slug: mockNews.slug,
          summary: mockNews.summary,
          content: mockNews.content,
          news_scope: mockNews.newsScope,
          country_id: mockNews.countryId,
          state_id: mockNews.stateId,
          district_id: mockNews.districtId,
          category_id: mockNews.categoryId,
          status: mockNews.status,
          drafted_by: mockNews.draftedBy,
          approved_by: null,
          published_by: null,
          drafted_at: new Date(),
          approved_at: null,
          published_at: null,
          created_by: mockNews.createdBy,
          updated_by: null,
          created_at: new Date(),
          updated_at: new Date()
        }
      ],
      rowCount: 1
    } as never);

    const result = await repository.findById(1);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(1);
    expect(result?.title).toBe(mockNews.title);
  });
});

describe("findBySlug()", () => {
  it("should return news by slug", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          news_number: 1001,
          title: mockNews.title,
          slug: mockNews.slug,
          summary: mockNews.summary,
          content: mockNews.content,
          news_scope: mockNews.newsScope,
          country_id: mockNews.countryId,
          state_id: mockNews.stateId,
          district_id: mockNews.districtId,
          category_id: mockNews.categoryId,
          status: mockNews.status,
          drafted_by: mockNews.draftedBy,
          approved_by: null,
          published_by: null,
          drafted_at: new Date(),
          approved_at: null,
          published_at: null,
          created_by: mockNews.createdBy,
          updated_by: null,
          created_at: new Date(),
          updated_at: new Date()
        }
      ],
      rowCount: 1
    } as never);

    const result = await repository.findBySlug(mockNews.slug);

    expect(result).not.toBeNull();
    expect(result?.slug).toBe(mockNews.slug);
  });
});

describe("existsBySlug()", () => {
  it("should return true when slug exists", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          exists: true
        }
      ],
      rowCount: 1
    } as never);

    const result = await repository.existsBySlug(mockNews.slug);

    expect(result).toBe(true);
  });

  it("should return false when slug does not exist", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          exists: false
        }
      ],
      rowCount: 1
    } as never);

    const result = await repository.existsBySlug("invalid-slug");

    expect(result).toBe(false);
  });
});

describe("update()", () => {
  it("should update a news item", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          news_number: 1001,
          title: "Updated Title",
          slug: "updated-title",
          summary: "Updated Summary",
          content: "Updated Content",
          news_scope: "STATE",
          country_id: 1,
          state_id: 33,
          district_id: 601,
          category_id: 5,
          status: "DRAFT",
          drafted_by: 1,
          approved_by: null,
          published_by: null,
          drafted_at: new Date(),
          approved_at: null,
          published_at: null,
          created_by: 1,
          updated_by: 1,
          created_at: new Date(),
          updated_at: new Date()
        }
      ],
      rowCount: 1
    } as never);

    const result = await repository.update(1, {
      title: "Updated Title",

      slug: "updated-title",

      updatedBy: 1
    });

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Updated Title");
  });
});

describe("deleteNews()", () => {
  it("should delete a news item", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [],
      rowCount: 1
    } as never);

    const result = await repository.deleteNews(1);

    expect(result).toBe(true);
  });
});

describe("changeStatus()", () => {
  it("should change news status", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [],
      rowCount: 1
    } as never);

    await repository.changeStatus(1, "APPROVED", 10);

    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe("findAll()", () => {
  it("should return paginated news list", async () => {
    vi.mocked(pool.query)

      .mockResolvedValueOnce({
        rows: [
          {
            total: 1
          }
        ],
        rowCount: 1
      } as never)

      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            news_number: 1001,
            title: mockNews.title,
            slug: mockNews.slug,
            summary: mockNews.summary,
            content: mockNews.content,
            news_scope: mockNews.newsScope,
            country_id: mockNews.countryId,
            state_id: mockNews.stateId,
            district_id: mockNews.districtId,
            category_id: mockNews.categoryId,
            status: mockNews.status,
            drafted_by: mockNews.draftedBy,
            approved_by: null,
            published_by: null,
            drafted_at: new Date(),
            approved_at: null,
            published_at: null,
            created_by: mockNews.createdBy,
            updated_by: null,
            created_at: new Date(),
            updated_at: new Date()
          }
        ],
        rowCount: 1
      } as never);

    const result = await repository.findAll({
      page: 1,

      pageSize: 20
    });

    expect(result.totalRecords).toBe(1);

    expect(result.page).toBe(1);

    expect(result.pageSize).toBe(20);

    expect(result.items.length).toBe(1);
  });
});

describe("findAll() - Search", () => {
  it("should search news by title", async () => {
    vi.mocked(pool.query)

      .mockResolvedValueOnce({
        rows: [{ total: 1 }],
        rowCount: 1
      } as never)

      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            news_number: 1001,
            title: "Budget News",
            slug: "budget-news",
            summary: "",
            content: "",
            news_scope: "STATE",
            country_id: 1,
            state_id: 33,
            district_id: 601,
            category_id: 5,
            status: "DRAFT",
            drafted_by: 1,
            approved_by: null,
            published_by: null,
            drafted_at: new Date(),
            approved_at: null,
            published_at: null,
            created_by: 1,
            updated_by: null,
            created_at: new Date(),
            updated_at: new Date()
          }
        ],
        rowCount: 1
      } as never);

    const result = await repository.findAll({
      page: 1,

      pageSize: 20,

      search: "Budget"
    });

    expect(result.items.length).toBe(1);
  });
});

describe("findAll() - Empty Result", () => {
  it("should return empty list", async () => {
    vi.mocked(pool.query)

      .mockResolvedValueOnce({
        rows: [
          {
            total: 0
          }
        ],

        rowCount: 1
      } as never)

      .mockResolvedValueOnce({
        rows: [],

        rowCount: 0
      } as never);

    const result = await repository.findAll({
      page: 1,

      pageSize: 20
    });

    expect(result.totalRecords).toBe(0);

    expect(result.items).toEqual([]);
  });
});

describe("Repository Errors", () => {
  it("should throw database error", async () => {
    vi.mocked(pool.query).mockRejectedValueOnce(new Error("Database Error"));

    await expect(repository.findById(1)).rejects.toThrow("Database Error");
  });
});

describe("deleteNews()", () => {
  it("should return false when record does not exist", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [],

      rowCount: 0
    } as never);

    const result = await repository.deleteNews(999);

    expect(result).toBe(false);
  });
});

describe("update()", () => {
  it("should return null when news does not exist", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [],

      rowCount: 0
    } as never);

    const result = await repository.update(
      999,

      {
        title: "Invalid",

        updatedBy: 1
      }
    );

    expect(result).toBeNull();
  });
});
// -------------
