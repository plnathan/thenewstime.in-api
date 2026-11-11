import type { PoolClient } from "pg";

import { pool } from "../../../shared/config/db.js";

import type { Category } from "./category.types.js";

export const findAll = async (client?: PoolClient): Promise<Category[]> => {
  const db = client ?? pool;

  const result = await db.query<Category>(`
    SELECT
      id,
      code,
      display_name AS "displayName",
      url_name AS "urlName",
      status
    FROM categories
    ORDER BY display_name ASC, id ASC;
  `);

  return result.rows;
};

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<Category | null> => {
  const db = client ?? pool;

  const result = await db.query<Category>(
    `
      SELECT
        id,
        code,
        display_name AS "displayName",
        url_name AS "urlName",
      status
      FROM categories
      WHERE id = $1
      LIMIT 1;
    `,
    [id]
  );

  return result.rows[0] ?? null;
};

export const createCategory = async (data: {
  code: string;
  displayName: string;
  urlName: string;
}): Promise<Category> => {
  const result = await pool.query<Category>(
    `INSERT INTO categories (code, display_name, url_name, status) VALUES ($1,$2,$3,'ACTIVE') RETURNING id, code, display_name AS "displayName", url_name AS "urlName", status`,
    [data.code, data.displayName, data.urlName]
  );
  return result.rows[0]!;
};
export const updateCategory = async (
  id: number,
  data: {
    code?: string;
    displayName?: string;
    urlName?: string;
    status?: "ACTIVE" | "INACTIVE";
  }
): Promise<Category | null> => {
  const result = await pool.query<Category>(
    `UPDATE categories SET code = COALESCE($2,code), display_name = COALESCE($3,display_name), url_name = COALESCE($4,url_name), status = COALESCE($5,status) WHERE id=$1 RETURNING id, code, display_name AS "displayName", url_name AS "urlName", status`,
    [
      id,
      data.code ?? null,
      data.displayName ?? null,
      data.urlName ?? null,
      data.status ?? null
    ]
  );
  return result.rows[0] ?? null;
};
