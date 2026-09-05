import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type { CreateRoleInput, Role, UpdateRoleInput } from "./role.types.js";

const mapRole = (row: any): Role => ({
  id: Number(row.id),
  code: row.code,
  displayName: row.display_name,
  description: row.description,
  displayOrder: Number(row.display_order),
  status: row.status,
  createdBy: row.created_by === null ? null : Number(row.created_by),
  createdAt: row.created_at,
  updatedBy: row.updated_by === null ? null : Number(row.updated_by),
  updatedAt: row.updated_at
});

export const findAll = async (): Promise<Role[]> => {
  const result = await pool.query(
    `
        SELECT
          id,
          code,
          display_name,
          description,
          display_order,
          status,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM roles
        ORDER BY
          display_order ASC,
          id ASC
        `
  );

  return result.rows.map(mapRole);
};

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<Role | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
        SELECT
          id,
          code,
          display_name,
          description,
          display_order,
          status,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM roles
        WHERE id = $1
        LIMIT 1
        `,
    [id]
  );

  return result.rows[0] ? mapRole(result.rows[0]) : null;
};

export const findByCode = async (code: string): Promise<Role | null> => {
  const result = await pool.query(
    `
        SELECT
          id,
          code,
          display_name,
          description,
          display_order,
          status,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM roles
        WHERE code = $1
        LIMIT 1
        `,
    [code]
  );

  return result.rows[0] ? mapRole(result.rows[0]) : null;
};

export const create = async (
  input: CreateRoleInput,
  userId: number
): Promise<Role> => {
  const result = await pool.query(
    `
        INSERT INTO roles
        (
          code,
          display_name,
          description,
          display_order,
          status,
          created_by,
          updated_by
        )
        VALUES
        (
          $1,
          $2,
          $3,
          COALESCE($4, 0),
          'ACTIVE',
          $5,
          $5
        )
        RETURNING
          id,
          code,
          display_name,
          description,
          display_order,
          status,
          created_by,
          created_at,
          updated_by,
          updated_at
        `,
    [
      input.code,
      input.displayName,
      input.description ?? null,
      input.displayOrder ?? 0,
      userId
    ]
  );

  return mapRole(result.rows[0]);
};

export const update = async (
  id: number,
  input: UpdateRoleInput,
  userId: number
): Promise<Role | null> => {
  const result = await pool.query(
    `
        UPDATE roles
        SET
          display_name =
            COALESCE(
              $1,
              display_name
            ),

          description =
            COALESCE(
              $2,
              description
            ),

          display_order =
            COALESCE(
              $3,
              display_order
            ),

          status =
            COALESCE(
              $4,
              status
            ),

          updated_by = $5,
          updated_at = NOW()

        WHERE id = $6

        RETURNING
          id,
          code,
          display_name,
          description,
          display_order,
          status,
          created_by,
          created_at,
          updated_by,
          updated_at
        `,
    [
      input.displayName ?? null,
      input.description ?? null,
      input.displayOrder ?? null,
      input.status ?? null,
      userId,
      id
    ]
  );

  return result.rows[0] ? mapRole(result.rows[0]) : null;
};

/*
|--------------------------------------------------------------------------
| USER ↔ ROLE
|--------------------------------------------------------------------------
*/

export const assignUserRole = async (
  userId: number,
  roleId: number,
  createdBy: number,
  client?: PoolClient
): Promise<void> => {
  const db = client ?? pool;

  await db.query(
    `
      INSERT INTO user_roles
      (
        user_id,
        role_id,
        created_by
      )
      VALUES
      (
        $1,
        $2,
        $3
      )
      ON CONFLICT
      (
        user_id,
        role_id
      )
      DO NOTHING
      `,
    [userId, roleId, createdBy]
  );
};

export const removeUserRole = async (
  userId: number,
  roleId: number
): Promise<void> => {
  await pool.query(
    `
      DELETE FROM user_roles
      WHERE user_id = $1
        AND role_id = $2
      `,
    [userId, roleId]
  );
};

export const findUserRoles = async (userId: number): Promise<Role[]> => {
  const result = await pool.query(
    `
        SELECT
          r.id,
          r.code,
          r.display_name,
          r.description,
          r.display_order,
          r.status,
          r.created_by,
          r.created_at,
          r.updated_by,
          r.updated_at
        FROM user_roles ur
        INNER JOIN roles r
          ON r.id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY
          r.display_order ASC,
          r.id ASC
        `,
    [userId]
  );

  return result.rows.map(mapRole);
};
