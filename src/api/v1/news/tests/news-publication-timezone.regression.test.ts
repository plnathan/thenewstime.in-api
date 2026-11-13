/**
 * News publication timezone regression tests.
 * Service-level integration using mocked repository/transaction boundary.
 * No live database is required; public SQL visibility is covered by a contract assertion.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as repository from "../news.repository.js";
import * as service from "../news.service.js";
import { pool } from "../../../../shared/config/db.js";
import { mockNews } from "./mocks/news.repository.mock.js";

vi.mock("../news.repository.js", () => ({
  existsBySlug: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  deleteNews: vi.fn(),
  findAll: vi.fn(),
  changeStatus: vi.fn(),
  activate: vi.fn(),
  promote: vi.fn(),
  removePromotion: vi.fn()
}));
vi.mock("../../../../shared/config/db.js", () => ({
  pool: { connect: vi.fn() }
}));

const repo = vi.mocked(repository);
const database = vi.mocked(pool);
const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
const release = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T18:40:00.000Z"));
  vi.clearAllMocks();
  query.mockResolvedValue({ rows: [], rowCount: 0 });
  database.connect.mockResolvedValue({ query, release } as never);
  repo.findById.mockResolvedValue({ ...mockNews, status: "DRAFT" });
  repo.existsBySlug.mockResolvedValue(false);
  repo.create.mockResolvedValue({ ...mockNews, status: "DRAFT" });
  repo.changeStatus.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("News draft, approval and publication timezone regression", () => {
  it("creates a draft without a publication instant", async () => {
    await service.createNews({
      title: mockNews.title,
      slug: mockNews.slug,
      ...(mockNews.summary != null ? { summary: mockNews.summary } : {}),
      content: mockNews.content,
      newsScope: mockNews.newsScope,
      countryId: mockNews.countryId!,
      stateId: mockNews.stateId!,
      districtId: mockNews.districtId!,
      categoryId: mockNews.categoryId,
      draftedBy: mockNews.draftedBy,
      createdBy: mockNews.createdBy
    });
    expect(repo.create).toHaveBeenCalledOnce();
    expect(repo.changeStatus).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith("COMMIT");
  });

  it("approves a draft without assigning a publication date", async () => {
    await service.approveNews(1, 42);
    expect(repo.changeStatus).toHaveBeenCalledWith(
      1,
      "APPROVED",
      42,
      expect.anything(),
      undefined
    );
    expect(query).toHaveBeenCalledWith("COMMIT");
  });

  it("publishes immediately at the current UTC instant", async () => {
    repo.findById.mockResolvedValue({ ...mockNews, status: "APPROVED" });
    await service.publishNews(1, 42);
    const args = repo.changeStatus.mock.calls.at(0);
    expect(args).toBeDefined();
    if (!args) throw new Error("Expected changeStatus to be called");
    expect(args[1]).toBe("PUBLISHED");
    expect(args[4]).toBeInstanceOf(Date);
    expect(args[4]?.toISOString()).toBe("2026-11-12T18:40:00.000Z");
  });

  it("preserves the exact UTC instant of a future IST schedule", async () => {
    repo.findById.mockResolvedValue({ ...mockNews, status: "APPROVED" });
    await service.publishNews(1, 42, "2026-11-13T01:10:00+05:30");
    const args = repo.changeStatus.mock.calls.at(0);
    expect(args).toBeDefined();
    if (!args) throw new Error("Expected changeStatus to be called");
    const date = args[4];
    expect(date?.toISOString()).toBe("2026-11-12T19:40:00.000Z");
  });

  it("accepts an equivalent Z timestamp without shifting the instant", async () => {
    repo.findById.mockResolvedValue({ ...mockNews, status: "APPROVED" });
    await service.publishNews(1, 42, "2026-11-12T19:40:00.000Z");
    const args = repo.changeStatus.mock.calls.at(0);
    expect(args).toBeDefined();
    if (!args) throw new Error("Expected changeStatus to be called");
    expect(args[4]?.toISOString()).toBe("2026-11-12T19:40:00.000Z");
  });

  it("rejects a timezone-less datetime and rolls back", async () => {
    repo.findById.mockResolvedValue({ ...mockNews, status: "APPROVED" });
    await expect(
      service.publishNews(1, 42, "2026-11-13T01:10:00")
    ).rejects.toThrow("timezone");
    expect(repo.changeStatus).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("rejects a scheduled time more than one minute in the past", async () => {
    repo.findById.mockResolvedValue({ ...mockNews, status: "APPROVED" });
    await expect(
      service.publishNews(1, 42, "2026-11-12T18:38:59Z")
    ).rejects.toThrow("past");
    expect(repo.changeStatus).not.toHaveBeenCalled();
  });

  it("rejects publication before approval", async () => {
    await expect(service.publishNews(1, 42)).rejects.toThrow(
      "Invalid status transition"
    );
    expect(repo.changeStatus).not.toHaveBeenCalled();
  });
});
