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

    n.status,
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
          status = $1,
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
    "drafted_at",
    "published_at",
    "created_at",
    "updated_at"
  ];

  const requestedSortBy = filter.sortBy ?? "created_at";

  const sortBy = allowedSortColumns.includes(requestedSortBy)
    ? `n.${requestedSortBy}`
    : "n.created_at";

  const sortOrder = filter.sortOrder === "ASC" ? "ASC" : "DESC";

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
   * Main query
   */
  const sql = `
    ${NEWS_SELECT}
    ${whereClause}
    ORDER BY ${sortBy} ${sortOrder}
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
