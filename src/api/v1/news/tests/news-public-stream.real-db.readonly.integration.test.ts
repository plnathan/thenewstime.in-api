/**
 * Read-only Neon integration verification of the ordinary public news stream.
 * Run only against DEVELOPMENT/UAT Neon with RUN_NEWS_STREAM_DB_TESTS=1.
 * No INSERT, UPDATE, DELETE, DDL or TRUNCATE operations are performed.
 */
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../../../../shared/config/db.js";
import {
  findPublicStream,
  findPublicHomepageHero,
  type PublicStreamFilter
} from "../news.repository.js";

const enabled =
  process.env.RUN_NEWS_STREAM_DB_TESTS === "1" &&
  process.env.NODE_ENV !== "production";

const key = (item: { publishedAt?: string | Date | null; id: number }) => {
  if (!item.publishedAt)
    throw new Error(`Article ${item.id} has no publication timestamp`);
  return { publishedAt: new Date(item.publishedAt).getTime(), id: item.id };
};

const verifyPage = (
  items: Awaited<ReturnType<typeof findPublicStream>>["items"],
  limit: number
) => {
  expect(items.length).toBeLessThanOrEqual(limit);
  expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  for (const item of items) {
    expect(item.status).toBe("PUBLISHED");
    expect(key(item).publishedAt).toBeLessThanOrEqual(Date.now());
  }
  for (let i = 1; i < items.length; i += 1) {
    const previous = key(items[i - 1]!);
    const current = key(items[i]!);
    expect(
      previous.publishedAt > current.publishedAt ||
        (previous.publishedAt === current.publishedAt &&
          previous.id > current.id)
    ).toBe(true);
  }
};

const continuation = async (filter: PublicStreamFilter, initialLimit = 20) => {
  const first = await findPublicStream({ ...filter, limit: initialLimit });
  verifyPage(first.items, initialLimit);
  const last = first.items.at(-1);
  if (!first.hasMore) return;
  expect(last).toBeDefined();
  const next = await findPublicStream({
    ...filter,
    limit: 5,
    afterPublishedAt: new Date(last!.publishedAt!).toISOString(),
    afterId: last!.id
  });
  verifyPage(next.items, 5);
  expect(next.items.length).toBeGreaterThan(0);
  const firstIds = new Set(first.items.map((item) => item.id));
  for (const item of next.items) {
    expect(firstIds.has(item.id)).toBe(false);
    const a = key(last!);
    const b = key(item);
    expect(
      b.publishedAt < a.publishedAt ||
        (b.publishedAt === a.publishedAt && b.id < a.id)
    ).toBe(true);
  }
  return { first, next };
};

describe.skipIf(!enabled)("Public news stream — real Neon (read-only)", () => {
  afterAll(async () => {
    if (enabled) await pool.end();
  });

  it("returns at most 20 published, currently visible articles in stable order", async () => {
    const result = await findPublicStream({ limit: 20 });
    verifyPage(result.items, 20);
    expect(typeof result.hasMore).toBe("boolean");
    if (result.items.length < 20) expect(result.hasMore).toBe(false);
  });

  it("continues by five articles without duplicates or skipped rows on a stable dataset", async () => {
    await continuation({ limit: 20 });
  });

  it.each([
    ["தமிழ்நாடு", "STATE"],
    ["இந்தியா", "INDIA"],
    ["உலகம்", "WORLD"]
  ] as const)(
    "%s: scope filter and cursor continuation",
    async (_label, scope) => {
      const filter: PublicStreamFilter = { scope, limit: 20 };
      const first = await findPublicStream(filter);
      verifyPage(first.items, 20);
      for (const item of first.items) expect(item.newsScope).toBe(scope);
      await continuation(filter);
    }
  );

  it("Tamil Nadu state slug limits results to the selected state", async () => {
    const states = await pool.query<{ id: number }>(
      `SELECT id FROM states WHERE url_name = 'tamil-nadu' LIMIT 1`
    );
    expect(states.rows.length).toBe(1);
    const stateId = Number(states.rows[0]!.id);
    const filter: PublicStreamFilter = {
      scope: "STATE",
      stateSlug: "tamil-nadu",
      limit: 20
    };
    const result = await findPublicStream(filter);
    verifyPage(result.items, 20);
    for (const item of result.items) {
      expect(item.newsScope).toBe("STATE");
      expect(item.stateId).toBe(stateId);
    }
    await continuation(filter);
  });

  it.each([
    ["அரசியல்", "politics"],
    ["வணிகம்", "business"],
    ["விளையாட்டு", "sports"],
    ["தொழில்நுட்பம்", "technology"],
    ["சினிமா", "cinema"]
  ] as const)(
    "%s: category filter and cursor continuation",
    async (_label, slug) => {
      const categories = await pool.query<{ id: number }>(
        "SELECT id FROM categories WHERE url_name = $1 LIMIT 1",
        [slug]
      );
      expect(categories.rows.length, `Missing category slug: ${slug}`).toBe(1);
      const categoryId = Number(categories.rows[0]!.id);
      const filter: PublicStreamFilter = { categoryId, limit: 20 };
      const result = await findPublicStream(filter);
      verifyPage(result.items, 20);
      for (const item of result.items) expect(item.categoryId).toBe(categoryId);
      await continuation(filter);
    }
  );

  it("all-news hero exclusion matches the published homepage hero snapshot", async () => {
    const hero = await findPublicHomepageHero();
    verifyPage(hero, 5);
    const stream = await findPublicStream({
      limit: 20,
      excludeHomepageHero: true
    });
    verifyPage(stream.items, 20);
    const heroIds = new Set(hero.map((item) => item.id));
    for (const item of stream.items) expect(heroIds.has(item.id)).toBe(false);
    await continuation({ limit: 20, excludeHomepageHero: true });
  });

  it("never returns future-scheduled or non-PUBLISHED news", async () => {
    const excluded = await pool.query<{ id: number }>(`
      SELECT id FROM news WHERE status <> 'PUBLISHED'
         OR published_at IS NULL OR published_at > NOW()
      ORDER BY id DESC LIMIT 100
    `);
    const result = await findPublicStream({ limit: 20 });
    const excludedIds = new Set(excluded.rows.map((r) => Number(r.id)));
    for (const item of result.items)
      expect(excludedIds.has(item.id)).toBe(false);
    verifyPage(result.items, 20);
  });

  it("returns correct hasMore metadata for a bounded initial page", async () => {
    const count = await pool.query<{ total: string }>(`
      SELECT COUNT(*)::text AS total FROM news
      WHERE status = 'PUBLISHED' AND published_at IS NOT NULL AND published_at <= NOW()
    `);
    const total = Number(count.rows[0]!.total);
    const first = await findPublicStream({ limit: 20 });
    expect(first.items.length).toBe(Math.min(total, 20));
    expect(first.hasMore).toBe(total > 20);
    const five = await findPublicStream({ limit: 5 });
    expect(five.items.length).toBe(Math.min(total, 5));
    expect(five.hasMore).toBe(total > 5);
  });
});
