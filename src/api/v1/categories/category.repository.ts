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
      url_name AS "urlName"
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
        url_name AS "urlName"
      FROM categories
      WHERE id = $1
      LIMIT 1;
    `,
    [id]
  );

  return result.rows[0] ?? null;
};
