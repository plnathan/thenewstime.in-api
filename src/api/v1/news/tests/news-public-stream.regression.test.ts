/** Read-only unit/regression tests: no database connection or writes. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  stream: vi.fn(),
  hero: vi.fn()
}));

vi.mock("../../../../shared/config/db.js", () => ({
  pool: { query: mocks.query }
}));
vi.mock("../news.db.mapper.js", () => ({ mapNews: (row: unknown) => row }));
vi.mock("../news.service.js", () => ({
  getPublishedNewsStream: mocks.stream,
  getPublicHomepageHero: mocks.hero
}));
vi.mock("../../mappers/news.dto.mapper.js", () => ({
  toNewsResponseDtoList: (items: unknown[]) => items,
  toNewsResponseDto: (item: unknown) => item
}));

import {
  findPublicStream,
  findPublicHomepageHero
} from "../news.repository.js";
import { getPublishedNewsStream } from "../news.controller.js";

const rows = (count: number, start = 100) =>
  Array.from({ length: count }, (_, index) => ({
    id: start - index,
    publishedAt: new Date(
      Date.UTC(2026, 10, 14, 12, 0, 0) - index * 1000
    ).toISOString()
  }));

const execute = async (query: Record<string, string> = {}) => {
  const req = { query } as unknown as Request;
  let statusCode = 200;
  let body: any;
  const res = {
    status: vi.fn((code: number) => {
      statusCode = code;
      return res;
    }),
    json: vi.fn((value: unknown) => {
      body = value;
      return res;
    })
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  await getPublishedNewsStream(req, res, next);
  return { body, statusCode, next: vi.mocked(next) };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hero.mockResolvedValue([]);
  mocks.stream.mockResolvedValue({ items: rows(5), hasMore: false });
});

describe("public stream repository: SQL safety and cursor", () => {
  it("limits initial results to 20 and reads one extra row to detect continuation", async () => {
    mocks.query.mockResolvedValueOnce({ rows: rows(21) });
    const result = await findPublicStream({ limit: 20 });
    expect(result.items).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/ORDER BY n\.published_at DESC, n\.id DESC LIMIT/);
    expect(params.at(-1)).toBe(21);
    expect(sql).not.toMatch(/OFFSET|COUNT\(\*\)\s+FROM news n/i);
  });

  it("applies every scope, category and geographic filter as bound parameters", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });
    await findPublicStream({
      limit: 5,
      scope: "STATE",
      categoryId: 7,
      countryId: 1,
      stateId: 31,
      districtId: 9,
      stateSlug: "tamil-nadu"
    });
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    for (const column of [
      "news_scope",
      "category_id",
      "country_id",
      "state_id",
      "district_id"
    ])
      expect(sql).toContain(`n.${column} = $`);
    expect(sql).toContain("st.url_name = $");
    expect(params).toEqual(["STATE", 7, 1, 31, 9, "tamil-nadu", 6]);
  });

  it("enforces published status and publication cutoff at the database", async () => {
    mocks.query.mockResolvedValueOnce({ rows: [] });
    await findPublicStream({ limit: 5 });
    const sql = String(mocks.query.mock.calls[0]?.[0]);
    expect(sql).toContain("n.status = 'PUBLISHED'");
    expect(sql).toContain("n.published_at IS NOT NULL");
    expect(sql).toContain("n.published_at <= NOW()");
  });

  it("uses strict keyset cursor to prevent repeats and OFFSET drift", async () => {
    mocks.query.mockResolvedValueOnce({ rows: rows(6, 90) });
    const result = await findPublicStream({
      limit: 5,
      afterPublishedAt: "2026-11-14T12:00:00.000Z",
      afterId: 100
    });
    expect(result.items).toHaveLength(5);
    expect(result.hasMore).toBe(true);
    const [sql, params] = mocks.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(
      "(n.published_at, n.id) < ($1::timestamptz, $2::integer)"
    );
    expect(params).toEqual(["2026-11-14T12:00:00.000Z", 100, 6]);
  });

  it("excludes homepage hero only when requested and returns separate published hero rows", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: rows(5) });
    await findPublicStream({ limit: 20, excludeHomepageHero: true });
    const sql = String(mocks.query.mock.calls[0]?.[0]);
    expect(sql).toContain("n.id NOT IN");
    expect(sql).toContain("hero.status = 'PUBLISHED'");
    expect(sql).toContain("hero.published_at <= NOW()");
    const hero = await findPublicHomepageHero();
    expect(hero).toHaveLength(5);
    expect(String(mocks.query.mock.calls[1]?.[0])).toContain(
      "n.published_at <= NOW()"
    );
  });
});

describe("GET /api/v1/news/public/stream: controller contract", () => {
  it("returns response metadata and a base64url cursor for the last displayed item", async () => {
    mocks.stream.mockResolvedValueOnce({ items: rows(20), hasMore: true });
    const { body, statusCode, next } = await execute({ limit: "20" });
    expect(next).not.toHaveBeenCalled();
    expect(statusCode).toBe(200);
    expect(body).toMatchObject({
      success: true,
      errors: null,
      meta: { hasNext: true }
    });
    expect(body.data).toHaveLength(20);
    expect(
      JSON.parse(
        Buffer.from(body.meta.nextCursor, "base64url").toString("utf8")
      )
    ).toEqual({ publishedAt: rows(20).at(-1)?.publishedAt, id: 81 });
  });

  it("passes the decoded cursor and filters to the service for subsequent pages", async () => {
    const cursor = Buffer.from(
      JSON.stringify({ publishedAt: "2026-11-14T12:00:00.000Z", id: 100 })
    ).toString("base64url");
    const { next } = await execute({
      limit: "5",
      cursor,
      scope: "INDIA",
      categoryId: "4",
      state: "tamil-nadu"
    });
    expect(next).not.toHaveBeenCalled();
    expect(mocks.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 5,
        scope: "INDIA",
        categoryId: 4,
        stateSlug: "tamil-nadu",
        afterId: 100,
        afterPublishedAt: "2026-11-14T12:00:00.000Z"
      })
    );
  });

  it("returns null cursor when no more articles exist", async () => {
    const { body } = await execute({ limit: "5" });
    expect(body.meta).toEqual({ hasNext: false, nextCursor: null });
  });

  it("bundles hero only on the first excluded-hero request", async () => {
    mocks.hero.mockResolvedValue(rows(5, 200));
    const first = await execute({ excludeHomepageHero: "true" });
    expect(first.body.hero).toHaveLength(5);
    expect(mocks.hero).toHaveBeenCalledTimes(1);
    const cursor = Buffer.from(
      JSON.stringify({ publishedAt: "2026-11-14T12:00:00.000Z", id: 100 })
    ).toString("base64url");
    const next = await execute({
      excludeHomepageHero: "true",
      cursor,
      limit: "5"
    });
    expect(next.body.hero).toEqual([]);
    expect(mocks.hero).toHaveBeenCalledTimes(1);
  });

  it.each([
    { limit: "0" },
    { limit: "21" },
    { limit: "abc" },
    { scope: "UNKNOWN" },
    { categoryId: "-1" },
    { stateId: "1.5" },
    { state: "INVALID!" },
    { cursor: "not-valid-json" }
  ])("rejects invalid input: %j", async (query) => {
    const { next } = await execute(query);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});
