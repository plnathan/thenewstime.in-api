import { Router } from "express";
import { pool } from "../../../shared/config/db.js";

const router = Router();
const ORIGIN = "https://www.thenewstime.in";
const escapeXml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;"
      })[char] ?? char
  );
const absoluteNewsUrl = (slug: string): string =>
  `${ORIGIN}/news/${encodeURIComponent(slug)}`;

router.get("/sitemap.xml", async (_req, res, next) => {
  try {
    const result = await pool.query<{
      slug: string;
      updated_at: Date | string;
    }>(`
      SELECT slug, COALESCE(updated_at, published_at) AS updated_at
      FROM news
      WHERE status = 'PUBLISHED'
        AND published_at IS NOT NULL
        AND published_at <= NOW()
        AND slug IS NOT NULL
        AND slug <> ''
      ORDER BY published_at DESC, id DESC
      LIMIT 45000
    `);
    const staticPages = [
      "/",
      "/news",
      "/news?scope=STATE",
      "/news?scope=INDIA",
      "/news?scope=WORLD",
      "/news?scope=DISTRICT"
    ];
    const urls = [
      ...staticPages.map(
        (path) => `<url><loc>${escapeXml(`${ORIGIN}${path}`)}</loc></url>`
      ),
      ...result.rows.map(
        ({ slug, updated_at }) =>
          `<url><loc>${escapeXml(absoluteNewsUrl(slug))}</loc><lastmod>${new Date(updated_at).toISOString()}</lastmod></url>`
      )
    ];
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    res
      .status(200)
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`
      );
  } catch (error) {
    next(error);
  }
});

router.get("/news-sitemap.xml", async (_req, res, next) => {
  try {
    const result = await pool.query<{
      slug: string;
      title: string;
      published_at: Date | string;
    }>(`
      SELECT slug, title, published_at FROM news
      WHERE status = 'PUBLISHED'
        AND published_at <= NOW()
        AND published_at >= NOW() - INTERVAL '2 days'
        AND slug IS NOT NULL AND slug <> ''
      ORDER BY published_at DESC, id DESC LIMIT 1000
    `);
    const urls = result.rows.map(
      ({ slug, title, published_at }) =>
        `<url><loc>${escapeXml(absoluteNewsUrl(slug))}</loc><news:news><news:publication><news:name>The News Time</news:name><news:language>ta</news:language></news:publication><news:publication_date>${new Date(published_at).toISOString()}</news:publication_date><news:title>${escapeXml(title)}</news:title></news:news></url>`
    );
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    res
      .status(200)
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${urls.join("")}</urlset>`
      );
  } catch (error) {
    next(error);
  }
});
export default router;
