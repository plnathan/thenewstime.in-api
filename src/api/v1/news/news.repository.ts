import type { PoolClient, QueryResult } from "pg";

import { pool } from "../../../shared/config/db.js";

import type {
  CreateNewsInput,
  News,
  NewsSearchFilter,
  NewsStatus,
  PaginatedNews,
  UpdateNewsInput
} from "./news.types.js";

import { mapNews } from "./news.db.mapper.js";

/**
 * Shared SELECT used by all news read operations.
 *
 * This ensures that every News object contains:
 *
 * - category
 * - country
 * - state
 * - district
 *
 * in addition to their foreign-key IDs.
 */
const NEWS_SELECT = `
  SELECT
    n.id,
    (
      SELECT COUNT(*)::BIGINT
      FROM news_reads nr
      WHERE nr.news_id = n.id
    ) AS view_count,
    n.news_number,
    n.title,
    n.slug,
    n.summary,
    n.content,
    n.news_scope,

    n.category_id,

    c.code AS category_code,
    c.display_name AS category_display_name,
    c.url_name AS category_url_name,

    n.country_id,

    co.code AS country_code,
    co.display_name AS country_display_name,
    co.url_name AS country_url_name,
    co.iso_code AS country_iso_code,

    n.state_id,

    s.country_id AS state_country_id,
    s.code AS state_code,
    s.display_name AS state_display_name,
    s.url_name AS state_url_name,

    n.district_id,

    d.state_id AS district_state_id,
    d.code AS district_code,
    d.display_name AS district_display_name,
    d.url_name AS district_url_name,

    COALESCE(
    (
    SELECT json_agg(
      json_build_object(
        'id', nm.id,
        'mediaAssetId', ma.id,
        'provider', ma.provider,
        'assetType', ma.asset_type,
        'mediaRole', nm.media_role,
        'displayOrder', nm.display_order,
        'publicId', ma.public_id,
        'originalFileName', ma.original_file_name,
        'mimeType', ma.mime_type,
        'fileExtension', ma.file_extension,
        'fileSizeBytes', ma.file_size_bytes,
        'width', ma.width,
        'height', ma.height,
        'altText', ma.alt_text,
        'caption', ma.caption,
        'fileUrl', ma.file_url,
        'thumbnailUrl', ma.thumbnail_url
      )
      ORDER BY
        nm.display_order ASC,
        nm.id ASC
    )

    FROM news_media nm

    INNER JOIN media_assets ma
      ON ma.id = nm.media_asset_id

    WHERE nm.news_id = n.id

      AND ma.status = 'ACTIVE'
      ),
      '[]'::json
    ) AS media,

    n.status,
    n.display_priority,
    n.display_priority_until,
    n.drafted_by,
    n.approved_by,
    n.published_by,
    n.archived_by,
    n.drafted_at,
    n.approved_at,
    n.published_at,
    n.created_by,
    n.updated_by,
    n.created_at,
    n.updated_at

  FROM news n

  INNER JOIN categories c
    ON c.id = n.category_id

  LEFT JOIN countries co
    ON co.id = n.country_id

  LEFT JOIN states s
    ON s.id = n.state_id

  LEFT JOIN districts d
    ON d.id = n.district_id
`;

/**
 * Create News
 */
export const create = async (
  data: CreateNewsInput,
  client?: PoolClient
): Promise<News> => {
  const db = client ?? pool;

  const insertSql = `
    INSERT INTO news
    (
      title,
      slug,
      summary,
      content,
      news_scope,
      country_id,
      state_id,
      district_id,
      category_id,
      drafted_by,
      created_by
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
      $8,
      $9,
      $10,
      $11
    )
    RETURNING id;
  `;

  const values = [
    data.title,
    data.slug,
    data.summary ?? null,
    data.content,
    data.newsScope,
    data.countryId ?? null,
    data.stateId ?? null,
    data.districtId ?? null,
    data.categoryId,
    data.draftedBy,
    data.createdBy
  ];

  const result: QueryResult = await db.query(insertSql, values);

  const newsId = Number(result.rows[0].id);

  const news = await findById(newsId, client);

  if (!news) {
    throw new Error("News was created but could not be retrieved.");
  }

  return news;
};

/**
 * Find News by Primary Key
 */
export const findById = async (
  id: number,
  client?: PoolClient
): Promise<News | null> => {
  const db = client ?? pool;

  const sql = `
    ${NEWS_SELECT}
    WHERE n.id = $1
    LIMIT 1;
  `;

  const result = await db.query(sql, [id]);

  if (result.rowCount === 0) {
    return null;
  }

  return mapNews(result.rows[0]);
};

/**
 * Find News by Slug
 */
export const findBySlug = async (
  slug: string,
  client?: PoolClient
): Promise<News | null> => {
  const db = client ?? pool;

  const sql = `
    ${NEWS_SELECT}
    WHERE n.slug = $1
    LIMIT 1;
  `;

  const result = await db.query(sql, [slug]);

  if (result.rowCount === 0) {
    return null;
  }

  return mapNews(result.rows[0]);
};

/**
 * Find Published News by Slug
 *
 * PUBLIC ONLY
 *
 * This query guarantees that only PUBLISHED articles
 * can be returned through the public news detail API.
 */
export const findPublishedBySlug = async (
  slug: string,
  client?: PoolClient
): Promise<News | null> => {
  const db = client ?? pool;

  const sql = `
    ${NEWS_SELECT}
    WHERE n.slug = $1
      AND n.status = 'PUBLISHED'
    LIMIT 1;
  `;

  const result = await db.query(sql, [slug]);

  if (result.rowCount === 0) {
    return null;
  }

  return mapNews(result.rows[0]);
};

/**
 * Find News by Business Number
 */
export const findByNewsNumber = async (
  newsNumber: number,
  client?: PoolClient
): Promise<News | null> => {
  const db = client ?? pool;

  const sql = `
    ${NEWS_SELECT}
    WHERE n.news_number = $1
    LIMIT 1;
  `;

  const result = await db.query(sql, [newsNumber]);

  if (result.rowCount === 0) {
    return null;
  }

  return mapNews(result.rows[0]);
};

/**
 * Check Slug Exists
 */
export const existsBySlug = async (
  slug: string,
  client?: PoolClient
): Promise<boolean> => {
  const db = client ?? pool;

  const sql = `
    SELECT EXISTS (
      SELECT 1
      FROM news n
      WHERE n.slug = $1
    ) AS exists;
  `;

  const result = await db.query(sql, [slug]);

  return Boolean(result.rows[0].exists);
};

/**
 * Update News
 */
export const update = async (
  id: number,
  data: UpdateNewsInput,
  client?: PoolClient
): Promise<News | null> => {
  const db = client ?? pool;

  const updates: string[] = [];
  const values: unknown[] = [];

  const addField = (column: string, value: unknown): void => {
    values.push(value);

    updates.push(`${column} = $${values.length}`);
  };

  if (data.title !== undefined) {
    addField("title", data.title);
  }

  if (data.slug !== undefined) {
    addField("slug", data.slug);
  }

  if (data.summary !== undefined) {
    addField("summary", data.summary);
  }

  if (data.content !== undefined) {
    addField("content", data.content);
  }

  if (data.newsScope !== undefined) {
    addField("news_scope", data.newsScope);
  }

  if (data.countryId !== undefined) {
    addField("country_id", data.countryId);
  }

  if (data.stateId !== undefined) {
    addField("state_id", data.stateId);
  }

  if (data.districtId !== undefined) {
    addField("district_id", data.districtId);
  }

  if (data.categoryId !== undefined) {
    addField("category_id", data.categoryId);
  }

  addField("updated_by", data.updatedBy);

  updates.push("updated_at = NOW()");

  values.push(id);

  const idIndex = values.length;

  const sql = `
    UPDATE news
    SET
      ${updates.join(", ")}
    WHERE id = $${idIndex}
    RETURNING id;
  `;

  const result: QueryResult = await db.query(sql, values);

  if (result.rowCount === 0) {
    return null;
  }

  const news = await findById(id, client);

  if (!news) {
    return null;
  }

  return news;
};

/**
 * Promote News
 *
 * Promotes a published article for the requested duration.
 *
 * The current business rule supports a 3-day promotion.
 *
 * A higher display priority is assigned than any currently
 * active promotion, which means the most recently promoted
 * article appears first.
 */
export const promote = async (
  id: number,
  promotedBy: number,
  durationDays: number,
  client?: PoolClient
): Promise<News | null> => {
  const db = client ?? pool;

  const sql = `
    UPDATE news
    SET
      display_priority = (
        SELECT COALESCE(MAX(active_news.display_priority), 0) + 1
        FROM news AS active_news
        WHERE active_news.display_priority_until IS NOT NULL
          AND active_news.display_priority_until > NOW()
          AND active_news.status = 'PUBLISHED'
      ),

      display_priority_until =
        NOW() + ($2 * INTERVAL '1 day'),

      updated_by = $3,

      updated_at = NOW()

    WHERE id = $1
      AND status = 'PUBLISHED'

    RETURNING id;
  `;

  const result: QueryResult = await db.query(sql, [
    id,
    durationDays,
    promotedBy
  ]);

  if (result.rowCount === 0) {
    return null;
  }

  return findById(id, client);
};

/**
 * Remove News Promotion
 *
 * Resets the article to normal published ordering.
 */
export const removePromotion = async (
  id: number,
  updatedBy: number,
  client?: PoolClient
): Promise<News | null> => {
  const db = client ?? pool;

  const sql = `
    UPDATE news
    SET
      display_priority = 0,
      display_priority_until = NULL,
      updated_by = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING id;
  `;

  const result: QueryResult = await db.query(sql, [id, updatedBy]);

  if (result.rowCount === 0) {
    return null;
  }

  return findById(id, client);
};

/**
 * Delete News
 */
export const deleteNews = async (
  id: number,
  client?: PoolClient
): Promise<boolean> => {
  const db = client ?? pool;

  const sql = `
    DELETE
    FROM news
    WHERE id = $1;
  `;

  const result = await db.query(sql, [id]);

  return (result.rowCount ?? 0) > 0;
};

/**
 * Change News Status
 */
export const changeStatus = async (
  id: number,
  status: NewsStatus,
  userId: number,
  client?: PoolClient
): Promise<void> => {
  const db = client ?? pool;

  let sql = "";
  let values: unknown[] = [];

  switch (status) {
    case "APPROVED":
      sql = `
        UPDATE news
        SET
          status = $1,
          approved_by = $2,
          approved_at = NOW(),
          updated_by = $2,
          updated_at = NOW()
        WHERE id = $3;
      `;

      values = [status, userId, id];

      break;

    case "PUBLISHED":
      sql = `
        UPDATE news
        SET
          status = $1,
          published_by = $2,
          published_at = NOW(),
          updated_by = $2,
          updated_at = NOW()
        WHERE id = $3;
      `;

      values = [status, userId, id];

      break;

    default:
      sql = `
        UPDATE news
        SET
          status = $1::news_status,

          archived_by =
            CASE
              WHEN $1::news_status = 'ARCHIVED' THEN $2
              ELSE archived_by
            END,

          display_priority =
            CASE
              WHEN $1::news_status = 'ARCHIVED' THEN 0
              ELSE display_priority
            END,

          display_priority_until =
            CASE
              WHEN $1::news_status = 'ARCHIVED' THEN NULL
              ELSE display_priority_until
            END,

          updated_by = $2,
          updated_at = NOW()

        WHERE id = $3;
      `;

      values = [status, userId, id];

      break;
  }

  await db.query(sql, values);
};

/**
 * Activate Archived News
 *
 * ARCHIVED -> DRAFT
 *
 * Activation intentionally resets the publishing workflow fields
 * so the article must go through the normal workflow again.
 */
export const activate = async (
  id: number,
  activatedBy: number,
  client?: PoolClient
): Promise<News | null> => {
  const db = client ?? pool;

  const sql = `
    UPDATE news
    SET
      status = 'DRAFT',

      drafted_by = $2,
      drafted_at = NOW(),

      approved_by = NULL,
      approved_at = NULL,

      published_by = NULL,
      published_at = NULL,

      archived_by = NULL,

      display_priority = 0,
      display_priority_until = NULL,

      updated_by = $2,
      updated_at = NOW()

    WHERE id = $1
      AND status = 'ARCHIVED'

    RETURNING id;
  `;

  const result: QueryResult = await db.query(sql, [id, activatedBy]);

  if (result.rowCount === 0) {
    return null;
  }

  return findById(id, client);
};

/**
 * Search News
 */
export const findAll = async (
  filter: NewsSearchFilter,
  client?: PoolClient
): Promise<PaginatedNews> => {
  const db = client ?? pool;

  const conditions: string[] = [];
  const values: unknown[] = [];

  /**
   * Search
   */
  if (filter.search) {
    values.push(`%${filter.search}%`);

    const searchIndex = values.length;

    conditions.push(`
      (
        n.title ILIKE $${searchIndex}
        OR n.summary ILIKE $${searchIndex}
        OR n.content ILIKE $${searchIndex}
        OR n.slug ILIKE $${searchIndex}
      )
    `);
  }

  /**
   * Status
   */
  if (filter.status) {
    values.push(filter.status);

    conditions.push(`n.status = $${values.length}`);
  }

  /**
   * Category
   */
  if (filter.categoryId) {
    values.push(filter.categoryId);

    conditions.push(`n.category_id = $${values.length}`);
  }

  /**
   * Country
   */
  if (filter.countryId) {
    values.push(filter.countryId);

    conditions.push(`n.country_id = $${values.length}`);
  }

  /**
   * Scope
   */
  if (filter.scope) {
    values.push(filter.scope);

    conditions.push(`n.news_scope = $${values.length}`);
  }

  /**
   * State
   */
  if (filter.stateId) {
    values.push(filter.stateId);

    conditions.push(`n.state_id = $${values.length}`);
  }

  /**
   * District
   */
  if (filter.districtId) {
    values.push(filter.districtId);

    conditions.push(`n.district_id = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  /**
   * Sort
   */
  const allowedSortColumns = [
    "title",
    "status",
    "news_number",
    "display_priority",
    "drafted_at",
    "drafted_at",
    "published_at",
    "created_at",
    "updated_at"
  ];

  const requestedSortBy = filter.sortBy;

  const sortOrder = filter.sortOrder === "ASC" ? "ASC" : "DESC";

  const sortBy =
    requestedSortBy && allowedSortColumns.includes(requestedSortBy)
      ? `n.${requestedSortBy}`
      : null;

  /**
   * Pagination
   */
  const page = filter.page <= 0 ? 1 : filter.page;

  const pageSize = filter.pageSize <= 0 ? 20 : filter.pageSize;

  const offset = (page - 1) * pageSize;

  /**
   * Count
   *
   * Notice that the alias `n` is present here.
   * The previous implementation used `FROM news`
   * while the WHERE conditions referenced `n.*`.
   */
  const countSql = `
    SELECT COUNT(*)::INT AS total
    FROM news n
    ${whereClause};
  `;

  const countResult = await db.query(countSql, values);

  /**
   * Pagination values
   */
  const queryValues = [...values];

  queryValues.push(pageSize);

  const limitIndex = queryValues.length;

  queryValues.push(offset);

  const offsetIndex = queryValues.length;

  /**
   * Public/homepage ordering
   *
   * IMPORTANT:
   * Promotion/display priority must never override
   * chronological published_at ordering on the public website.
   */
  const orderByClause = filter.popularOrder
    ? `
    view_count DESC,

    n.published_at DESC NULLS LAST,

    n.id DESC
  `
    : filter.publicOrder
      ? `
      n.published_at DESC NULLS LAST,

      CASE n.news_scope
        WHEN 'STATE' THEN 1
        WHEN 'INDIA' THEN 2
        WHEN 'WORLD' THEN 3
        WHEN 'DISTRICT' THEN 4
        ELSE 5
      END ASC,

      n.id DESC
    `
      : `
      CASE
        WHEN n.display_priority_until IS NOT NULL
          AND n.display_priority_until > NOW()
          AND n.status = 'PUBLISHED'
        THEN n.display_priority
        ELSE 0
      END DESC,

      ${sortBy ? `${sortBy} ${sortOrder}` : "n.published_at DESC NULLS LAST"},

      n.id DESC
    `;

  /**
   * Main query
   */
  const sql = `
    ${NEWS_SELECT}
    ${whereClause}
    ORDER BY ${orderByClause}
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex};
  `;

  const result = await db.query(sql, queryValues);

  return {
    items: result.rows.map(mapNews),

    totalRecords: Number(countResult.rows[0].total),

    page,

    pageSize
  };
};

/**
 * Find Published News
 *
 * Public/homepage endpoint.
 *
 * The status is always forced to PUBLISHED.
 * The caller cannot override it.
 */
export const findPublishedAll = async (
  filter: Omit<NewsSearchFilter, "status">,
  client?: PoolClient
): Promise<PaginatedNews> => {
  return findAll(
    {
      ...filter,
      status: "PUBLISHED",
      publicOrder: true
    },
    client
  );
};
