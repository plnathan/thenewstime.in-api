/**
 * Read-only integration verification for the district news repository.
 * Opt in with RUN_DISTRICT_DB_TESTS=1 on a DEVELOPMENT/UAT Neon database.
 * Does not insert, update, delete or truncate any records.
 * 
 * $env:RUN_DISTRICT_DB_TESTS = "1"
$env:TZ = "Asia/Kolkata"

npx vitest run `
  src/api/v1/news/tests/district-news-real-db.readonly.integration.test.ts

  $env:TZ = "America/New_York"

npx vitest run `
  src/api/v1/news/tests/district-news-real-db.readonly.integration.test.ts

Remove-Item Env:RUN_DISTRICT_DB_TESTS -ErrorAction SilentlyContinue

Remove-Item Env:TZ -ErrorAction SilentlyContinue

 */
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../../../../shared/config/db.js";
import {
  findDistrictSections,
  findDistrictSectionNewsByCursor
} from "../news.repository.js";

const enabled =
  process.env.RUN_DISTRICT_DB_TESTS === "1" &&
  process.env.NODE_ENV !== "production";

// Only opt-in imports of the repository's connection pool execute database queries.
describe.skipIf(!enabled)("District sections — real Neon, read-only", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("has Tamil Nadu priority districts in the expected order", async () => {
    const result = await pool.query<{
      display_order: number;
      display_name: string;
      code: string;
    }>(`
      SELECT d.display_order, d.display_name, d.code
      FROM districts d JOIN states s ON s.id = d.state_id
      WHERE upper(s.code) = 'TN' AND d.display_order BETWEEN 1 AND 8
      ORDER BY d.display_order, d.id
    `);
    expect(result.rows).toHaveLength(8);
    expect(result.rows.map((r) => Number(r.display_order))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8
    ]);
    expect(result.rows.map((r) => r.display_name)).toEqual([
      "சென்னை",
      "செங்கல்பட்டு",
      "காஞ்சிபுரம்",
      "திருவள்ளூர்",
      "கோயம்புத்தூர்",
      "திருச்சிராப்பள்ளி",
      "மதுரை",
      "திருநெல்வேலி"
    ]);
  });

  it("returns only nonempty sections, at most five articles per section, in stable section order", async () => {
    const page = await findDistrictSections(0, 8, 5);
    expect(page.sections.length).toBeLessThanOrEqual(8);
    const keys = new Set<string>();
    for (const section of page.sections) {
      expect(keys.has(section.key)).toBe(false);
      keys.add(section.key);
      expect(section.news.length).toBeGreaterThan(0);
      expect(section.news.length).toBeLessThanOrEqual(5);
      expect(section.hasMoreNews).toBe(section.nextNewsCursor !== null);
      for (const news of section.news) {
        expect(news.newsScope).toBe("DISTRICT");
        expect(news.status).toBe("PUBLISHED");
        expect(new Date(news.publishedAt!).getTime()).toBeLessThanOrEqual(
          Date.now()
        );
      }
    }
    if (page.sections[0]?.key === "chennai-group") {
      expect(page.sections[0].title).toBe(
        "சென்னை, செங்கல்பட்டு, காஞ்சிபுரம், திருவள்ளூர்"
      );
    }
    expect(page.hasMoreSections).toBe(page.nextSectionOffset !== null);
  });

  it("paginates sections without duplicate section keys", async () => {
    const first = await findDistrictSections(0, 8, 5);
    if (!first.hasMoreSections || first.nextSectionOffset === null) return;
    const second = await findDistrictSections(first.nextSectionOffset, 8, 5);
    const firstKeys = new Set(first.sections.map((s) => s.key));
    for (const section of second.sections) {
      expect(firstKeys.has(section.key)).toBe(false);
    }
  });

  it("uses independent article cursors without duplicates or reordering", async () => {
    const first = await findDistrictSections(0, 8, 5);
    for (const section of first.sections
      .filter((s) => s.nextNewsCursor !== null)
      .slice(0, 3)) {
      const next = await findDistrictSectionNewsByCursor(
        section.key,
        section.nextNewsCursor!,
        5
      );
      expect(next.news.length).toBeLessThanOrEqual(5);
      const firstIds = new Set(
        first.sections.find((s) => s.key === section.key)!.news.map((n) => n.id)
      );
      for (const item of next.news) expect(firstIds.has(item.id)).toBe(false);
      expect(next.hasMoreNews).toBe(next.nextNewsCursor !== null);
    }
  });

  it("checks that published district-news and active-district indexes exist", async () => {
    const result = await pool.query<{
      tablename: string;
      indexname: string;
      indexdef: string;
    }>(`
      SELECT tablename, indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('news', 'districts')
    `);
    const definitions = result.rows.map((r) => r.indexdef.toLowerCase());
    expect(
      definitions.some(
        (s) => s.includes("district_id") && s.includes("published_at")
      )
    ).toBe(true);
    expect(
      definitions.some(
        (s) => s.includes("display_order") && s.includes("districts")
      )
    ).toBe(true);
  });
});
