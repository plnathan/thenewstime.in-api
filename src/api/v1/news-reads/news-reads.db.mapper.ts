import type { NewsRead, PopularNewsItem } from "./news-reads.types.js";

export const mapNewsRead = (row: Record<string, unknown>): NewsRead => ({
  id: Number(row.id),
  newsId: Number(row.news_id),
  sessionId: String(row.session_id),
  visitorId: row.visitor_id ? String(row.visitor_id) : null,
  ipHash: row.ip_hash ? String(row.ip_hash) : null,
  browser: row.browser ? String(row.browser) : null,
  operatingSystem: row.operating_system ? String(row.operating_system) : null,
  deviceType: row.device_type ? String(row.device_type) : null,
  userAgent: row.user_agent ? String(row.user_agent) : null,
  readAt: new Date(String(row.read_at))
});

export const mapPopularNewsItem = (
  row: Record<string, unknown>
): PopularNewsItem => ({
  newsId: Number(row.news_id),
  readCount: Number(row.read_count)
});
