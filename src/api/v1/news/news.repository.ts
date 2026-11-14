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
    d.display_order AS district_sort_order,

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
    n.show_on_homepage,
    n.display_priority,
    n.display_priority_until,
    n.drafted_by,
    COALESCE(NULLIF(TRIM(drafter.display_name), ''), NULLIF(TRIM(drafter.full_name), ''), drafter.username) AS drafted_by_name,
    n.approved_by,
    COALESCE(NULLIF(TRIM(approver.display_name), ''), NULLIF(TRIM(approver.full_name), ''), approver.username) AS approved_by_name,
    n.published_by,
    COALESCE(NULLIF(TRIM(publisher.display_name), ''), NULLIF(TRIM(publisher.full_name), ''), publisher.username) AS published_by_name,
    n.archived_by,
    n.drafted_at,
    n.approved_at,
    n.published_at,
    n.created_by,
    n.updated_by,
    n.created_at,
    n.updated_at

  FROM news n

  LEFT JOIN users drafter
    ON drafter.id = n.drafted_by

  LEFT JOIN users approver ON approver.id = n.approved_by
  LEFT JOIN users publisher ON publisher.id = n.published_by

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
      created_by,
      show_on_homepage
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
      $11,
      $12
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
    data.createdBy,
    data.showOnHomepage ?? false
  ];
  console.log("createNews insertSql:", insertSql);
  console.log("createNews values:", values);
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
      AND n.published_at <= NOW()
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

  if (data.showOnHomepage !== undefined) {
    addField("show_on_homepage", data.showOnHomepage);
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
  client?: PoolClient,
  publicationDate?: Date
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
          published_at = $4,
          updated_by = $2,
          updated_at = NOW()
        WHERE id = $3;
      `;

      values = [status, userId, id, publicationDate ?? new Date()];

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

  if (filter.homepageOnly) {
    conditions.push("n.show_on_homepage = TRUE");
  }

  // Public queries never expose future-dated published articles.
  if (filter.publicOrder || filter.popularOrder) {
    conditions.push("n.published_at <= NOW()");
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

/** Opaque, bounded district-news keyset cursor. */
type DistrictNewsCursor = { order: number; publishedAt: string; id: number };

function encodeDistrictNewsCursor(row: {
  district_sort_order: number | string;
  published_at: Date | string;
  id: number | string;
}): string {
  const publishedAt =
    row.published_at instanceof Date
      ? row.published_at.toISOString()
      : new Date(row.published_at).toISOString();
  return Buffer.from(
    JSON.stringify({
      order: Number(row.district_sort_order),
      publishedAt,
      id: Number(row.id)
    } satisfies DistrictNewsCursor),
    "utf8"
  ).toString("base64url");
}

export function decodeDistrictNewsCursor(value: string): DistrictNewsCursor {
  if (!value || value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new RangeError("Invalid district news cursor");
  }
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    );
    if (!decoded || typeof decoded !== "object")
      throw new Error("Invalid cursor");
    const data = decoded as Record<string, unknown>;
    if (
      !Number.isSafeInteger(data.order) ||
      Number(data.order) < 0 ||
      !Number.isSafeInteger(data.id) ||
      Number(data.id) <= 0 ||
      typeof data.publishedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(data.publishedAt) ||
      !Number.isFinite(Date.parse(data.publishedAt))
    ) {
      throw new Error("Invalid cursor");
    }
    return {
      order: Number(data.order),
      id: Number(data.id),
      publishedAt: data.publishedAt
    };
  } catch {
    throw new RangeError("Invalid district news cursor");
  }
}

/** District page: one bounded batch of visible sections, with five news per section.
 * District ordering 1..4 is reserved for the Chennai metropolitan group.
 * The migration must be applied before enabling this endpoint.
 */
export async function findDistrictSections(
  sectionOffset = 0,
  sectionLimit = 8,
  newsLimit = 5
) {
  const sectionsSql = `
    WITH eligible AS (
      SELECT d.id, d.display_name, d.display_order,
        CASE WHEN d.display_order BETWEEN 1 AND 4 THEN 'chennai-group'
             ELSE 'district-' || d.id::text END AS section_key
      FROM districts d
      JOIN states s ON s.id = d.state_id
      WHERE d.status = 'ACTIVE' AND upper(s.code) = 'TN'
        AND EXISTS (
          SELECT 1 FROM news n
          WHERE n.district_id = d.id AND n.news_scope = 'DISTRICT'
            AND n.status = 'PUBLISHED' AND n.published_at <= NOW()
        )
    )
    SELECT section_key AS key, MIN(display_order)::int AS sort_order,
      CASE WHEN section_key = 'chennai-group'
        THEN 'சென்னை, செங்கல்பட்டு, காஞ்சிபுரம், திருவள்ளூர்'
        ELSE MIN(display_name) END AS title,
      ARRAY_AGG(id ORDER BY display_order, id)::int[] AS district_ids
    FROM eligible GROUP BY section_key
    ORDER BY MIN(display_order), section_key
    LIMIT $1 OFFSET $2
  `;
  const sectionResult = await pool.query(sectionsSql, [
    sectionLimit + 1,
    sectionOffset
  ]);
  const selected = sectionResult.rows.slice(0, sectionLimit) as Array<{
    key: string;
    title: string;
    district_ids: number[];
    sort_order: number;
  }>;
  if (selected.length === 0) {
    return { sections: [], hasMoreSections: false, nextSectionOffset: null };
  }
  const ids = selected.flatMap((section) => section.district_ids);
  // Limit each district BEFORE ranking the section. A section contains at most
  // four districts; no district can contribute more than (newsLimit + 1) rows
  // to the first (newsLimit + 1) results of its section.
  const sql = `
    WITH candidates AS (
      SELECT picked.id, picked.published_at, d.display_order,
        CASE WHEN d.display_order BETWEEN 1 AND 4 THEN 'chennai-group'
             ELSE 'district-' || d.id::text END AS section_key
      FROM districts d
      JOIN LATERAL (
        SELECT n0.id, n0.published_at
        FROM news n0
        WHERE n0.district_id = d.id AND n0.news_scope = 'DISTRICT'
          AND n0.status = 'PUBLISHED' AND n0.published_at <= NOW()
        ORDER BY n0.published_at DESC, n0.id DESC
        LIMIT $2
      ) picked ON TRUE
      WHERE d.id = ANY($1::int[])
    ), ranked AS (
      SELECT id, section_key,
        ROW_NUMBER() OVER (
          PARTITION BY section_key
          ORDER BY display_order ASC, published_at DESC, id DESC
        ) AS rank
      FROM candidates
    )
    ${NEWS_SELECT}
    JOIN ranked r ON r.id = n.id
    WHERE r.rank <= $2
    ORDER BY r.section_key, r.rank
  `;
  const newsResult = await pool.query(sql, [ids, newsLimit + 1]);
  const rows = newsResult.rows;
  const sections = selected.map((section) => {
    const sectionRows = rows.filter((row) =>
      section.district_ids.includes(Number(row.district_id))
    );
    return {
      key: section.key,
      title: section.title,
      news: sectionRows.slice(0, newsLimit).map(mapNews),
      hasMoreNews: sectionRows.length > newsLimit,
      nextNewsOffset: sectionRows.length > newsLimit ? newsLimit : null,
      nextNewsCursor:
        sectionRows.length > newsLimit
          ? encodeDistrictNewsCursor(sectionRows[newsLimit - 1])
          : null
    };
  });
  return {
    sections,
    hasMoreSections: sectionResult.rows.length > sectionLimit,
    nextSectionOffset:
      sectionResult.rows.length > sectionLimit
        ? sectionOffset + sectionLimit
        : null
  };
}

export async function findDistrictSectionNews(
  key: string,
  offset = 0,
  limit = 5
) {
  const districtSql = `
    SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id
    WHERE d.status = 'ACTIVE' AND upper(s.code) = 'TN' AND
      (CASE WHEN d.display_order BETWEEN 1 AND 4 THEN 'chennai-group'
            ELSE 'district-' || d.id::text END) = $1
    ORDER BY d.display_order, d.id
  `;
  const districtResult = await pool.query(districtSql, [key]);
  const ids = districtResult.rows.map((row) => Number(row.id));
  if (!ids.length)
    return { news: [], hasMoreNews: false, nextNewsOffset: null };
  const sql = `
    ${NEWS_SELECT}
    WHERE n.district_id = ANY($1::int[]) AND n.news_scope = 'DISTRICT'
      AND n.status = 'PUBLISHED' AND n.published_at <= NOW()
    ORDER BY d.display_order, n.published_at DESC, n.id DESC
    LIMIT $2 OFFSET $3
  `;
  const result = await pool.query(sql, [ids, limit + 1, offset]);
  const hasMoreNews = result.rows.length > limit;
  return {
    news: result.rows.slice(0, limit).map(mapNews),
    hasMoreNews,
    nextNewsOffset: hasMoreNews ? offset + limit : null
  };
}

/** Cursor pagination avoids OFFSET drift for newly published articles. */
export async function findDistrictSectionNewsByCursor(
  key: string,
  cursor: string,
  limit = 5
) {
  const position = decodeDistrictNewsCursor(cursor);
  const districtResult = await pool.query(
    `
    SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id
    WHERE d.status = 'ACTIVE' AND upper(s.code) = 'TN'
      AND (CASE WHEN d.display_order BETWEEN 1 AND 4 THEN 'chennai-group'
                ELSE 'district-' || d.id::text END) = $1
    ORDER BY d.display_order, d.id
  `,
    [key]
  );
  const ids = districtResult.rows.map((row) => Number(row.id));
  if (!ids.length)
    return {
      news: [],
      hasMoreNews: false,
      nextNewsOffset: null,
      nextNewsCursor: null
    };
  const result = await pool.query(
    `
    ${NEWS_SELECT}
    WHERE n.district_id = ANY($1::int[]) AND n.news_scope = 'DISTRICT'
      AND n.status = 'PUBLISHED' AND n.published_at <= NOW()
      AND (d.display_order > $2 OR
        (d.display_order = $2 AND (n.published_at, n.id) < ($3::timestamptz, $4::int)))
    ORDER BY d.display_order ASC, n.published_at DESC, n.id DESC
    LIMIT $5
  `,
    [ids, position.order, position.publishedAt, position.id, limit + 1]
  );
  const hasMoreNews = result.rows.length > limit;
  const pageRows = result.rows.slice(0, limit);
  return {
    news: pageRows.map(mapNews),
    hasMoreNews,
    nextNewsOffset: null,
    nextNewsCursor:
      hasMoreNews && pageRows.length
        ? encodeDistrictNewsCursor(pageRows[pageRows.length - 1])
        : null
  };
}
