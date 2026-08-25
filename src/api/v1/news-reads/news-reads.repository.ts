import type { PoolClient, QueryResult } from "pg";

import { pool } from "../../../shared/config/db.js";

import type {
  CreateNewsReadInput,
  NewsRead,
  PopularNewsItem,
  PopularNewsSearchFilter
} from "./news-reads.types.js";

import { mapNewsRead, mapPopularNewsItem } from "./news-reads.db.mapper.js";

/**
 * Create News Read
 */
export const create = async (
  data: CreateNewsReadInput,
  client?: PoolClient
): Promise<NewsRead> => {
  const db = client ?? pool;

  const sql = `
    INSERT INTO news_reads
    (
      news_id,
      session_id,
      visitor_id,
      ip_hash,
      browser,
      operating_system,
      device_type,
      user_agent
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8
    )
    RETURNING
      id,
      news_id,
      session_id,
      visitor_id,
      ip_hash,
      browser,
      operating_system,
      device_type,
      user_agent,
      read_at;
  `;

  const values = [
    data.newsId,
    data.sessionId,
    data.visitorId ?? null,
    data.ipHash ?? null,
    data.browser ?? null,
    data.operatingSystem ?? null,
    data.deviceType ?? null,
    data.userAgent ?? null
  ];

  const result: QueryResult = await db.query(sql, values);

  return mapNewsRead(result.rows[0]);
};

/**
 * Find News Read by Primary Key
 */
export const findById = async (
  id: number,
  client?: PoolClient
): Promise<NewsRead | null> => {
  const db = client ?? pool;

  const sql = `
    SELECT
      id,
      news_id,
      session_id,
      visitor_id,
      ip_hash,
      browser,
      operating_system,
      device_type,
      user_agent,
      read_at
    FROM news_reads
    WHERE id = $1
    LIMIT 1;
  `;

  const result = await db.query(sql, [id]);

  if (result.rowCount === 0) {
    return null;
  }

  return mapNewsRead(result.rows[0]);
};

/**
 * Count Reads for News
 */
export const countByNewsId = async (
  newsId: number,
  client?: PoolClient
): Promise<number> => {
  const db = client ?? pool;

  const sql = `
    SELECT COUNT(*)::BIGINT AS read_count
    FROM news_reads
    WHERE news_id = $1;
  `;

  const result = await db.query(sql, [newsId]);

  return Number(result.rows[0].read_count);
};

/**
 * Find Popular News
 *
 * Returns news ordered by the number of reads.
 *
 * If days is supplied, only reads from that period
 * are considered.
 */
export const findPopularNews = async (
  filter: PopularNewsSearchFilter,
  client?: PoolClient
): Promise<PopularNewsItem[]> => {
  const db = client ?? pool;

  const values: unknown[] = [];
  const conditions: string[] = [];

  if (filter.days !== undefined) {
    values.push(filter.days);

    conditions.push(
      `nr.read_at >= NOW() - ($${values.length} * INTERVAL '1 day')`
    );
  }

  values.push(filter.limit);

  const limitIndex = values.length;

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT
      nr.news_id,
      COUNT(*)::BIGINT AS read_count
    FROM news_reads nr
    INNER JOIN news n
      ON n.id = nr.news_id
    ${whereClause}
      ${whereClause ? "AND" : "WHERE"} n.status = 'PUBLISHED'
    GROUP BY nr.news_id
    ORDER BY
      COUNT(*) DESC,
      nr.news_id DESC
    LIMIT $${limitIndex};
  `;

  const result = await db.query(sql, values);

  return result.rows.map(mapPopularNewsItem);
};

/**
 * Check whether a session has already recorded a read
 * for a particular news article within the specified period.
 */
export const existsRecentRead = async (
  newsId: number,
  sessionId: string,
  minutes: number,
  client?: PoolClient
): Promise<boolean> => {
  const db = client ?? pool;

  const sql = `
    SELECT EXISTS (
      SELECT 1
      FROM news_reads
      WHERE news_id = $1
        AND session_id = $2
        AND read_at >= NOW() - ($3 * INTERVAL '1 minute')
    ) AS exists;
  `;

  const result = await db.query(sql, [newsId, sessionId, minutes]);

  return Boolean(result.rows[0].exists);
};
