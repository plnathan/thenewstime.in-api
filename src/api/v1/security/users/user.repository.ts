import type { PoolClient } from "pg";

import { pool } from "../../../../shared/config/db.js";

import type {
  CreateUserInput,
  UpdateUserInput,
  User,
  UserListItem
} from "./user.types.js";

const USER_SELECT = `
  SELECT
    u.id,
    u.role_id,
    u.full_name,
    u.display_name,
    u.username,
    u.email,
    u.mobile,
    u.profile_image_url,
    u.last_login_at,
    u.password_changed_at,
    u.must_change_password,
    u.password_expires_at,
    u.failed_login_count,
    u.status,
    u.created_by,
    u.created_at,
    u.updated_by,
    u.updated_at
  FROM users u
`;

const mapUser = (row: any): User => ({
  id: Number(row.id),
  roleId: row.role_id === null ? null : Number(row.role_id),
  fullName: row.full_name,
  displayName: row.display_name,
  username: row.username,
  email: row.email,
  mobile: row.mobile,
  profileImageUrl: row.profile_image_url,
  lastLoginAt: row.last_login_at,
  passwordChangedAt: row.password_changed_at,
  mustChangePassword: row.must_change_password,
  passwordExpiresAt: row.password_expires_at,
  failedLoginCount: Number(row.failed_login_count),
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
): Promise<User | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
      ${USER_SELECT}
      WHERE u.id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

export const findByUsername = async (
  username: string,
  client?: PoolClient
): Promise<User | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
      ${USER_SELECT}
      WHERE LOWER(u.username) = LOWER($1)
      LIMIT 1
    `,
    [username]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

export const findByEmail = async (
  email: string,
  client?: PoolClient
): Promise<User | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
      ${USER_SELECT}
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

export const findByMobile = async (
  mobile: string,
  client?: PoolClient
): Promise<User | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
      ${USER_SELECT}
      WHERE u.mobile = $1
      LIMIT 1
    `,
    [mobile]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

/*
|--------------------------------------------------------------------------
| LIST
|--------------------------------------------------------------------------
*/

export const findAll = async (): Promise<UserListItem[]> => {
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.role_id,
        u.full_name,
        u.display_name,
        u.username,
        u.email,
        u.mobile,
        u.profile_image_url,
        u.last_login_at,
        u.password_changed_at,
        u.must_change_password,
        u.password_expires_at,
        u.failed_login_count,
        u.status,
        u.created_by,
        u.created_at,
        u.updated_by,
        u.updated_at,
        r.code AS role_code,
        r.display_name AS role_display_name
      FROM users u
      LEFT JOIN roles r
        ON r.id = u.role_id
      ORDER BY
        u.created_at DESC,
        u.id DESC
    `
  );

  return result.rows.map((row) => ({
    ...mapUser(row),
    roleCode: row.role_code,
    roleDisplayName: row.role_display_name
  }));
};

/*
|--------------------------------------------------------------------------
| CREATE
|--------------------------------------------------------------------------
*/

export const create = async (
  input: CreateUserInput,
  passwordHash: string,
  createdBy: number,
  client?: PoolClient
): Promise<User> => {
  /*
   * If a transaction client is supplied by the caller,
   * use it directly.
   */
  if (client) {
    return createWithClient(input, passwordHash, createdBy, client);
  }

  /*
   * User creation and user-role assignment must succeed
   * or fail together.
   */
  const transactionClient = await pool.connect();

  try {
    await transactionClient.query("BEGIN");

    const user = await createWithClient(
      input,
      passwordHash,
      createdBy,
      transactionClient
    );

    await transactionClient.query(
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
      `,
      [user.id, input.roleId, createdBy]
    );

    await transactionClient.query("COMMIT");

    return user;
  } catch (error) {
    await transactionClient.query("ROLLBACK");
    throw error;
  } finally {
    transactionClient.release();
  }
};

const createWithClient = async (
  input: CreateUserInput,
  passwordHash: string,
  createdBy: number,
  client: PoolClient
): Promise<User> => {
  const result = await client.query(
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
        profile_image_url,
        must_change_password,
        password_expires_at,
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
        $7,
        $8,
        COALESCE($9, true),
        $10,
        $11,
        $11
      )
      RETURNING
        id,
        role_id,
        full_name,
        display_name,
        username,
        email,
        mobile,
        profile_image_url,
        last_login_at,
        password_changed_at,
        must_change_password,
        password_expires_at,
        failed_login_count,
        status,
        created_by,
        created_at,
        updated_by,
        updated_at
    `,
    [
      input.roleId,
      input.fullName,
      input.displayName,
      input.username,
      input.email ?? null,
      input.mobile ?? null,
      passwordHash,
      input.profileImageUrl ?? null,
      input.mustChangePassword ?? true,
      input.passwordExpiresAt ?? null,
      createdBy
    ]
  );

  return mapUser(result.rows[0]);
};

/*
|--------------------------------------------------------------------------
| UPDATE
|--------------------------------------------------------------------------
*/

export const update = async (
  id: number,
  input: UpdateUserInput,
  passwordHash: string | null,
  updatedBy: number,
  client?: PoolClient
): Promise<User | null> => {
  const db = client ?? pool;

  const result = await db.query(
    `
      UPDATE users
      SET
        full_name =
          COALESCE($1, full_name),

        display_name =
          COALESCE($2, display_name),

        email =
          COALESCE($3, email),

        mobile =
          COALESCE($4, mobile),

        profile_image_url =
          COALESCE($5, profile_image_url),

        status =
          COALESCE($6, status),

        must_change_password =
          COALESCE($7, must_change_password),

        password_hash =
          COALESCE($8, password_hash),

        password_changed_at =
          CASE
            WHEN $8 IS NOT NULL THEN NOW()
            ELSE password_changed_at
          END,

        password_expires_at =
          COALESCE($9, password_expires_at),

        updated_by = $10,
        updated_at = NOW()

      WHERE id = $11

      RETURNING
        id,
        role_id,
        full_name,
        display_name,
        username,
        email,
        mobile,
        profile_image_url,
        last_login_at,
        password_changed_at,
        must_change_password,
        password_expires_at,
        failed_login_count,
        status,
        created_by,
        created_at,
        updated_by,
        updated_at
    `,
    [
      input.fullName ?? null,
      input.displayName ?? null,
      input.email ?? null,
      input.mobile ?? null,
      input.profileImageUrl ?? null,
      input.status ?? null,
      input.mustChangePassword ?? null,
      passwordHash,
      input.passwordExpiresAt ?? null,
      updatedBy,
      id
    ]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

/*
|--------------------------------------------------------------------------
| DEACTIVATE
|--------------------------------------------------------------------------
*/

export const deactivate = async (
  id: number,
  updatedBy: number
): Promise<User | null> => {
  const result = await pool.query(
    `
      UPDATE users
      SET
        status = 'INACTIVE',
        updated_by = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        role_id,
        full_name,
        display_name,
        username,
        email,
        mobile,
        profile_image_url,
        last_login_at,
        password_changed_at,
        must_change_password,
        password_expires_at,
        failed_login_count,
        status,
        created_by,
        created_at,
        updated_by,
        updated_at
    `,
    [updatedBy, id]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};
