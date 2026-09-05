import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  CreatePermissionInput,
  Permission,
  UpdatePermissionInput
} from "./permission.types.js";

const mapPermission = (row: any): Permission => ({
  id: Number(row.id),
  code: row.code,
  displayName: row.display_name,
  description: row.description,
  module: row.module,
  resource: row.resource,
  action: row.action,
  displayOrder: Number(row.display_order),
  isSystemPermission: row.is_system_permission,
  status: row.status,
  createdBy: row.created_by === null ? null : Number(row.created_by),
  createdAt: row.created_at,
  updatedBy: row.updated_by === null ? null : Number(row.updated_by),
  updatedAt: row.updated_at
});

/*
|--------------------------------------------------------------------------
| FIND
|--------------------------------------------------------------------------
*/

export const findById = async (
  id: number,
  client?: PoolClient
): Promise<Permission | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT
      id,
      code,
      display_name,
      description,
      module,
      resource,
      action,
      display_order,
      is_system_permission,
      status,
      created_by,
      created_at,
      updated_by,
      updated_at
    FROM permissions
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapPermission(result.rows[0]);
};

export const findByCode = async (
  code: string,
  client?: PoolClient
): Promise<Permission | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT
      id,
      code,
      display_name,
      description,
      module,
      resource,
      action,
      display_order,
      is_system_permission,
      status,
      created_by,
      created_at,
      updated_by,
      updated_at
    FROM permissions
    WHERE code = $1
    LIMIT 1
    `,
    [code]
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapPermission(result.rows[0]);
};

/*
|--------------------------------------------------------------------------
| LIST
|--------------------------------------------------------------------------
*/

export const findAll = async (client?: PoolClient): Promise<Permission[]> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT
      id,
      code,
      display_name,
      description,
      module,
      resource,
      action,
      display_order,
      is_system_permission,
      status,
      created_by,
      created_at,
      updated_by,
      updated_at
    FROM permissions
    ORDER BY
      COALESCE(module, ''),
      display_order ASC,
      id ASC
    `
  );

  return result.rows.map(mapPermission);
};

/*
|--------------------------------------------------------------------------
| CREATE
|--------------------------------------------------------------------------
*/

export const create = async (
  input: CreatePermissionInput,
  createdBy: number,
  client?: PoolClient
): Promise<Permission> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    INSERT INTO permissions
    (
      code,
      display_name,
      description,
      module,
      resource,
      action,
      display_order,
      is_system_permission,
      status,
      created_by,
      updated_by
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      COALESCE($7, 0),
      COALESCE($8, false),
      'ACTIVE',
      $9,
      $9
    )
    RETURNING
      id,
      code,
      display_name,
      description,
      module,
      resource,
      action,
      display_order,
      is_system_permission,
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
      input.module ?? null,
      input.resource ?? null,
      input.action ?? null,
      input.displayOrder ?? 0,
      input.isSystemPermission ?? false,
      createdBy
    ]
  );

  return mapPermission(result.rows[0]);
};

/*
|--------------------------------------------------------------------------
| UPDATE
|--------------------------------------------------------------------------
*/

export const update = async (
  id: number,
  input: UpdatePermissionInput,
  updatedBy: number,
  client?: PoolClient
): Promise<Permission | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    UPDATE permissions
    SET
      display_name = COALESCE($1, display_name),
      description = COALESCE($2, description),
      module = COALESCE($3, module),
      resource = COALESCE($4, resource),
      action = COALESCE($5, action),
      display_order = COALESCE($6, display_order),
      status = COALESCE($7, status),
      updated_by = $8,
      updated_at = NOW()
    WHERE id = $9
    RETURNING
      id,
      code,
      display_name,
      description,
      module,
      resource,
      action,
      display_order,
      is_system_permission,
      status,
      created_by,
      created_at,
      updated_by,
      updated_at
    `,
    [
      input.displayName ?? null,
      input.description ?? null,
      input.module ?? null,
      input.resource ?? null,
      input.action ?? null,
      input.displayOrder ?? null,
      input.status ?? null,
      updatedBy,
      id
    ]
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapPermission(result.rows[0]);
};

/*
|--------------------------------------------------------------------------
| ROLE-PERMISSION
|--------------------------------------------------------------------------
*/

export const assignToRole = async (
  roleId: number,
  permissionId: number,
  createdBy: number,
  client?: PoolClient
): Promise<void> => {
  const db = client ?? pool;

  await db.query(
    `
    INSERT INTO role_permissions
    (
      role_id,
      permission_id,
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
      role_id,
      permission_id
    )
    DO NOTHING
    `,
    [roleId, permissionId, createdBy]
  );
};

export const removeFromRole = async (
  roleId: number,
  permissionId: number,
  client?: PoolClient
): Promise<void> => {
  const db = client ?? pool;

  await db.query(
    `
      DELETE FROM role_permissions
      WHERE role_id = $1
        AND permission_id = $2
      `,
    [roleId, permissionId]
  );
};

export const findByRoleId = async (
  roleId: number,
  client?: PoolClient
): Promise<Permission[]> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT
      p.id,
      p.code,
      p.display_name,
      p.description,
      p.module,
      p.resource,
      p.action,
      p.display_order,
      p.is_system_permission,
      p.status,
      p.created_by,
      p.created_at,
      p.updated_by,
      p.updated_at
    FROM role_permissions rp
    INNER JOIN permissions p
      ON p.id = rp.permission_id
    WHERE rp.role_id = $1
    ORDER BY
      COALESCE(p.module, ''),
      p.display_order ASC,
      p.id ASC
    `,
    [roleId]
  );

  return result.rows.map(mapPermission);
};

/*
|--------------------------------------------------------------------------
| AUTHORIZATION LOOKUP
|--------------------------------------------------------------------------
*/

export const userHasPermission = async (
  userId: number,
  module: string,
  resource: string,
  action: string
): Promise<boolean> => {
  const result = await pool.query(
    `
      SELECT EXISTS
      (
        SELECT 1
        FROM user_roles ur

        INNER JOIN roles r
          ON r.id = ur.role_id

        INNER JOIN role_permissions rp
          ON rp.role_id = r.id

        INNER JOIN permissions p
          ON p.id = rp.permission_id

        WHERE ur.user_id = $1

          AND r.status = 'ACTIVE'

          AND p.status = 'ACTIVE'

          AND UPPER(
            COALESCE(p.module, '')
          ) = UPPER($2)

          AND UPPER(
            COALESCE(p.resource, '')
          ) = UPPER($3)

          AND UPPER(
            COALESCE(p.action, '')
          ) = UPPER($4)
      )
      `,
    [userId, module, resource, action]
  );

  return result.rows[0]?.exists === true;
};
