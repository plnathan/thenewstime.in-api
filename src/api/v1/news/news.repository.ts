import type { PoolClient, QueryResult } from "pg";

import { pool } from "../../../shared/config/db.js"; //"../database/db";

import type {
  CreateNewsInput,
  UpdateNewsInput,
  News,
  NewsSearchFilter,
  PaginatedNews,
  NewsStatus
} from "./news.types.js";

import { mapNews } from "./news.db.mapper.js";

/**
 * Create News
 */
export const create = async (
  data: CreateNewsInput,
  client?: PoolClient
): Promise<News> => {
  const db = client ?? pool;

  const sql = `
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
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
        )
        RETURNING *;
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

  console.log("INSERT VALUES:");
  console.log(values);

  console.log({
    newsScope: data.newsScope,
    countryId: data.countryId,
    stateId: data.stateId,
    districtId: data.districtId
  });

  const result: QueryResult = await db.query(sql, values);

  return mapNews(result.rows[0]);
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
        SELECT *
        FROM news
        WHERE id = $1
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
        SELECT *
        FROM news
        WHERE slug = $1
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
        SELECT *
        FROM news
        WHERE news_number = $1
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
        SELECT EXISTS
        (
            SELECT 1
            FROM news
            WHERE slug = $1
        ) AS exists;
    `;

  const result = await db.query(sql, [slug]);

  return result.rows[0].exists;
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

  const addField = (column: string, value: unknown) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };

  if (data.title !== undefined) addField("title", data.title);
  if (data.slug !== undefined) addField("slug", data.slug);
  if (data.summary !== undefined) addField("summary", data.summary);
  if (data.content !== undefined) addField("content", data.content);
  if (data.newsScope !== undefined) addField("news_scope", data.newsScope);
  if (data.countryId !== undefined) addField("country_id", data.countryId);
  if (data.stateId !== undefined) addField("state_id", data.stateId);
  if (data.districtId !== undefined) addField("district_id", data.districtId);
  if (data.categoryId !== undefined) addField("category_id", data.categoryId);

  addField("updated_by", data.updatedBy);

  updates.push("updated_at = NOW()");

  values.push(id);

  const sql = `
        UPDATE news
        SET
            ${updates.join(", ")}
        WHERE id = $${values.length}
        RETURNING *;
    `;

  const result: QueryResult = await db.query(sql, values);

  if (result.rowCount === 0) {
    return null;
  }

  return mapNews(result.rows[0]);
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
                    status=$1,
                    approved_by=$2,
                    approved_at=NOW(),
                    updated_by=$2,
                    updated_at=NOW()
                WHERE id=$3;
            `;
      values = [status, userId, id];
      break;

    case "PUBLISHED":
      sql = `
                UPDATE news
                SET
                    status=$1,
                    published_by=$2,
                    published_at=NOW(),
                    updated_by=$2,
                    updated_at=NOW()
                WHERE id=$3;
            `;
      values = [status, userId, id];
      break;

    default:
      sql = `
                UPDATE news
                SET
                    status=$1,
                    updated_by=$2,
                    updated_at=NOW()
                WHERE id=$3;
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

  if (filter.search) {
    values.push(`%${filter.search}%`);

    conditions.push(`
            (
                title ILIKE $${values.length}
                OR summary ILIKE $${values.length}
                OR content ILIKE $${values.length}
            )
        `);
  }

  if (filter.status) {
    values.push(filter.status);

    conditions.push(`status = $${values.length}`);
  }

  if (filter.categoryId) {
    values.push(filter.categoryId);

    conditions.push(`category_id = $${values.length}`);
  }

  if (filter.scope) {
    values.push(filter.scope);

    conditions.push(`news_scope = $${values.length}`);
  }

  if (filter.stateId) {
    values.push(filter.stateId);

    conditions.push(`state_id = $${values.length}`);
  }

  if (filter.districtId) {
    values.push(filter.districtId);

    conditions.push(`district_id = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const allowedSortColumns = [
    "title",
    "status",
    "news_number",
    "drafted_at",
    "published_at",
    "created_at",
    "updated_at"
  ];

  const sortBy = allowedSortColumns.includes(filter.sortBy ?? "")
    ? filter.sortBy!
    : "created_at";

  const sortOrder = filter.sortOrder === "ASC" ? "ASC" : "DESC";

  const page = filter.page <= 0 ? 1 : filter.page;

  const pageSize = filter.pageSize <= 0 ? 20 : filter.pageSize;

  const offset = (page - 1) * pageSize;

  const countSql = `
        SELECT COUNT(*)::INT AS total
        FROM news
        ${whereClause};
    `;

  const countResult = await db.query(countSql, values);

  values.push(pageSize);

  const limitIndex = values.length;

  values.push(offset);

  const offsetIndex = values.length;

  const sql = `
        SELECT *
        FROM news
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex};
    `;

  const result = await db.query(sql, values);

  return {
    items: result.rows.map(mapNews),
    total: countResult.rows[0].total,
    page,
    pageSize
  };
};
/*
import { pool } from "../../config/db.js";
import type { CreateNewsInput, UpdateNewsInput } from "./news.types.js";

export class NewsRepository {
  async findAll(params: {
    page: number;
    limit: number;
    offset: number;
    search?: string | undefined;
  }) {
    const { page, limit, offset, search } = params;
    const filters: string[] = [];
    const values: unknown[] = [];
    let index = 1;
    if (search) {
      filters.push(`title ILIKE $${index}`);
      values.push(`%${search}%`);
      index++;
    }
    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const countQuery = ` SELECT COUNT(*)::int AS total FROM public.news ${whereClause} `;
    const dataQuery = ` SELECT id, title, news_content, content_order, drafted_by, drafted_date, approved_by, approved_date, thumbnail_path_id, is_active FROM public.news ${whereClause} ORDER BY id DESC LIMIT $${index} OFFSET $${index + 1} `;
    const countResult = await pool.query(countQuery, values);
    const dataValues = [...values, limit, offset];
    const dataResult = await pool.query(dataQuery, dataValues);
    return {
      items: dataResult.rows,
      total: countResult.rows[0].total,
      page,
      limit
    };
  }
  async findById(id: string) {
    const query = ` SELECT id, title, news_content, content_order, drafted_by, drafted_date, approved_by, approved_date, thumbnail_path_id, is_active FROM public.news WHERE id = $1 `;
    const result = await pool.query(query, [id]);
    return result.rows[0] ?? null;
  }
  async create(payload: CreateNewsInput) {
    const query = ` INSERT INTO public.news ( title, news_content, content_order, drafted_by, drafted_date, approved_by, approved_date, thumbnail_path_id, is_active ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, title, news_content, content_order, drafted_by, drafted_date, approved_by, approved_date, thumbnail_path_id, is_active `;
    const values = [
      payload.title ?? null,
      payload.news_content ?? null,
      payload.content_order ?? null,
      payload.drafted_by ?? null,
      payload.drafted_date ?? null,
      payload.approved_by ?? null,
      payload.approved_date ?? null,
      payload.thumbnail_path_id ?? null,
      payload.is_active ?? null
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }
  async update(id: string, payload: UpdateNewsInput) {
    const query = ` UPDATE public.news SET title = $1, news_content = $2, content_order = $3, drafted_by = $4, drafted_date = $5, approved_by = $6, approved_date = $7, thumbnail_path_id = $8, is_active = $9 WHERE id = $10 RETURNING id, title, news_content, content_order, drafted_by, drafted_date, approved_by, approved_date, thumbnail_path_id, is_active `;
    const values = [
      payload.title ?? null,
      payload.news_content ?? null,
      payload.content_order ?? null,
      payload.drafted_by ?? null,
      payload.drafted_date ?? null,
      payload.approved_by ?? null,
      payload.approved_date ?? null,
      payload.thumbnail_path_id ?? null,
      payload.is_active ?? null,
      id
    ];
    const result = await pool.query(query, values);
    return result.rows[0] ?? null;
  }
  async patch(id: string, payload: UpdateNewsInput) {
    const existing = await this.findById(id);
    if (!existing) return null;
    const mergedPayload: UpdateNewsInput = {
      title: payload.title !== undefined ? payload.title : existing.title,
      news_content:
        payload.news_content !== undefined
          ? payload.news_content
          : existing.news_content,
      content_order:
        payload.content_order !== undefined
          ? payload.content_order
          : existing.content_order,
      drafted_by:
        payload.drafted_by !== undefined
          ? payload.drafted_by
          : existing.drafted_by,
      drafted_date:
        payload.drafted_date !== undefined
          ? payload.drafted_date
          : existing.drafted_date,
      approved_by:
        payload.approved_by !== undefined
          ? payload.approved_by
          : existing.approved_by,
      approved_date:
        payload.approved_date !== undefined
          ? payload.approved_date
          : existing.approved_date,
      thumbnail_path_id:
        payload.thumbnail_path_id !== undefined
          ? payload.thumbnail_path_id
          : existing.thumbnail_path_id,
      is_active:
        payload.is_active !== undefined ? payload.is_active : existing.is_active
    };
    return this.update(id, mergedPayload);
  }
  async delete(id: string) {
    const query = ` DELETE FROM public.news WHERE id = $1 RETURNING id `;
    const result = await pool.query(query, [id]);
    return result.rows[0] ?? null;
  }
}
*/
