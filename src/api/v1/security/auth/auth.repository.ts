import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

export interface AuthUserRow {
  id: number;
  full_name: string;
  display_name: string;
  username: string;
  email: string | null;
  mobile: string | null;
  password_hash: string;
  status: string;
  failed_login_count: number;
  must_change_password: boolean;
  password_expires_at: Date | null;
}

export interface AuthRoleRow {
  id: number;
  code: string;
  display_name: string;
}

export interface SessionRow {
  id: number;
  user_id: number;
  refresh_token_hash: string;
  expires_at: Date;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

/*
|--------------------------------------------------------------------------
| USER
|--------------------------------------------------------------------------
*/

export const findUserById = async (
  userId: number,
  client?: PoolClient
): Promise<AuthUserRow | null> => {
  const db = client ?? pool;

  const result = await db.query<AuthUserRow>(
    `
    SELECT
      u.id,
      u.full_name,
      u.display_name,
      u.username,
      u.email,
      u.mobile,
      u.password_hash,
      u.status,
      u.failed_login_count,
      u.must_change_password,
      u.password_expires_at
    FROM users u
    WHERE u.id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] ?? null;
};

export const findUserByUsername = async (
  username: string,
  client?: PoolClient
): Promise<AuthUserRow | null> => {
  const db = client ?? pool;

  const result = await db.query<AuthUserRow>(
    `
    SELECT
      u.id,
      u.full_name,
      u.display_name,
      u.username,
      u.email,
      u.mobile,
      u.password_hash,
      u.status,
      u.failed_login_count,
      u.must_change_password,
      u.password_expires_at
    FROM users u
    WHERE LOWER(u.username) = LOWER($1)
    LIMIT 1
    `,
    [username]
  );

  return result.rows[0] ?? null;
};

/*
|--------------------------------------------------------------------------
| USER UNIQUENESS
|--------------------------------------------------------------------------
*/

export const existsByUsername = async (
  username: string,
  client?: PoolClient
): Promise<boolean> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT 1
    FROM users
    WHERE LOWER(username) = LOWER($1)
    LIMIT 1
    `,
    [username]
  );

  return (result.rowCount ?? 0) > 0;
};

export const existsByEmail = async (
  email: string,
  client?: PoolClient
): Promise<boolean> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT 1
    FROM users
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
    `,
    [email]
  );

  return (result.rowCount ?? 0) > 0;
};

export const existsByMobile = async (
  mobile: string,
  client?: PoolClient
): Promise<boolean> => {
  const db = client ?? pool;

  const result = await db.query(
    `
    SELECT 1
    FROM users
    WHERE mobile = $1
    LIMIT 1
    `,
    [mobile]
  );

  return (result.rowCount ?? 0) > 0;
};

/*
|--------------------------------------------------------------------------
| ROLES
|--------------------------------------------------------------------------
*/

export const findRoleByCode = async (
  roleCode: string,
  client: PoolClient
): Promise<number | null> => {
  const result = await client.query<{ id: number }>(
    `
    SELECT id
    FROM roles
    WHERE code = $1
      AND status = 'ACTIVE'
    LIMIT 1
    `,
    [roleCode]
  );

  return result.rows[0]?.id ?? null;
};

export const findRolesByUserId = async (
  userId: number,
  client?: PoolClient
): Promise<AuthRoleRow[]> => {
  const db = client ?? pool;

  const result = await db.query<AuthRoleRow>(
    `
    SELECT
      r.id,
      r.code,
      r.display_name
    FROM user_roles ur
    INNER JOIN roles r
      ON r.id = ur.role_id
    WHERE ur.user_id = $1
      AND r.status = 'ACTIVE'
    ORDER BY
      r.display_order ASC,
      r.id ASC
    `,
    [userId]
  );

  return result.rows;
};

export const assignRole = async (
  userId: number,
  roleId: number,
  client: PoolClient
): Promise<void> => {
  await client.query(
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
      $1
    )
    ON CONFLICT (user_id, role_id)
    DO NOTHING
    `,
    [userId, roleId]
  );
};

/*
|--------------------------------------------------------------------------
| CREATE USER
|--------------------------------------------------------------------------
|
| users.role_id is still NOT NULL in the existing schema.
| We temporarily populate it with the assigned role.
|
| RBAC itself uses user_roles.
|
*/

export const createUser = async (
  data: {
    fullName: string;
    displayName: string;
    username: string;
    email: string | null;
    mobile: string | null;
    passwordHash: string;
    roleId: number;
  },
  client: PoolClient
): Promise<number> => {
  const result = await client.query<{ id: number }>(
    `
    INSERT INTO users
    (
      role_id,
      full_name,
      display_name,
      username,
      email,
      mobile,
      password_hash,
      status,
      failed_login_count,
      must_change_password,
      password_changed_at
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
      'ACTIVE',
      0,
      false,
      NOW()
    )
    RETURNING id
    `,
    [
      data.roleId,
      data.fullName,
      data.displayName,
      data.username,
      data.email,
      data.mobile,
      data.passwordHash
    ]
  );

  const createdUser = result.rows[0];

  if (!createdUser?.id) {
    throw new Error('Failed to create user: no id returned from insert');
  }

  return Number(createdUser.id);
};

/*
|--------------------------------------------------------------------------
| LOGIN TRACKING
|--------------------------------------------------------------------------
*/

export const updateSuccessfulLogin = async (
  userId: number,
  client?: PoolClient
): Promise<void> => {
  const db = client ?? pool;

  await db.query(
    `
    UPDATE users
    SET
      last_login_at = NOW(),
      failed_login_count = 0,
      updated_at = NOW()
    WHERE id = $1
    `,
    [userId]
  );
};

export const updateFailedLogin = async (
  userId: number,
  client?: PoolClient
): Promise<void> => {
  const db = client ?? pool;

  await db.query(
    `
    UPDATE users
    SET
      failed_login_count = failed_login_count + 1,
      updated_at = NOW()
    WHERE id = $1
    `,
    [userId]
  );
};

/*
|--------------------------------------------------------------------------
| SESSIONS
|--------------------------------------------------------------------------
*/

export const createSession = async (
  data: {
    userId: number;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  },
  client?: PoolClient
): Promise<number> => {
  const db = client ?? pool;

  const result = await db.query<{ id: number }>(
    `
    INSERT INTO user_sessions
    (
      user_id,
      refresh_token_hash,
      expires_at,
      ip_address,
      user_agent
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4::inet,
      $5
    )
    RETURNING id
    `,
    [
      data.userId,
      data.refreshTokenHash,
      data.expiresAt,
      data.ipAddress,
      data.userAgent
    ]
  );

  const createdSession = result.rows[0];

  if (!createdSession?.id) {
    throw new Error('Failed to create session: no id returned from insert');
  }

  return Number(createdSession.id);
};

export const findSessionByRefreshTokenHash = async (
  refreshTokenHash: string,
  client?: PoolClient
): Promise<SessionRow | null> => {
  const db = client ?? pool;

  const result = await db.query<SessionRow>(
    `
        SELECT
          id,
          user_id,
          refresh_token_hash,
          expires_at,
          created_at,
          last_used_at,
          revoked_at
        FROM user_sessions
        WHERE refresh_token_hash = $1
        LIMIT 1
        `,
    [refreshTokenHash]
  );

  return result.rows[0] ?? null;
};

export const rotateSession = async (
  sessionId: number,
  refreshTokenHash: string,
  expiresAt: Date,
  client?: PoolClient
): Promise<void> => {
  const db = client ?? pool;

  await db.query(
    `
    UPDATE user_sessions
    SET
      refresh_token_hash = $1,
      expires_at = $2,
      last_used_at = NOW()
    WHERE id = $3
      AND revoked_at IS NULL
    `,
    [refreshTokenHash, expiresAt, sessionId]
  );
};

export const revokeSession = async (
  sessionId: number,
  client?: PoolClient
): Promise<void> => {
  const db = client ?? pool;

  await db.query(
    `
    UPDATE user_sessions
    SET
      revoked_at = COALESCE(revoked_at, NOW())
    WHERE id = $1
    `,
    [sessionId]
  );
};
