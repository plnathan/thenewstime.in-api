/****************************************************************************************
 Project     : thenewstime.in
 File        : 006_seed_admin_user.sql
 Description : Seed Default Super Administrator
 Version     : 1.0
 Database    : PostgreSQL 16+

 import bcrypt
from "bcrypt";

const password = "Admin@123";

bcrypt.hash
(password, 12).then
(console.log);
npm install bcrypt
npx tsx hash.ts
****************************************************************************************/

BEGIN;

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
        last_login_at,
        password_changed_at,
        failed_login_count,
        status
        )
    VALUES
        (
            (
        SELECT id
            FROM roles
            WHERE code = 'SUPER_ADMIN'
    ),

            'System Administrator',

            'Administrator',

            'admin',

            'admin@thenewstime.in',

            NULL,

            '$2b$12$REPLACE_WITH_BCRYPT_HASH',

            NULL,

            NULL,

            NULL,

            0,

            'ACTIVE'
)

    ON CONFLICT
    (username)
DO
    UPDATE
SET
    role_id              = EXCLUDED.role_id,
    full_name            = EXCLUDED.full_name,
    display_name         = EXCLUDED.display_name,
    email                = EXCLUDED.email,
    mobile               = EXCLUDED.mobile,
    status               = EXCLUDED.status,
    updated_at           = NOW();

    COMMIT;