/****************************************************************************************
 Project     : thenewstime.in
 File        : 004_create_security_tables.sql
 Description : Security Tables
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    -----------------------------------------------------------------------------------------
    -- ROLES
    -----------------------------------------------------------------------------------------

    CREATE TABLE roles
(
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    code                VARCHAR
    (30) NOT NULL,

    display_name        VARCHAR
    (100) NOT NULL,

    description         VARCHAR
    (300),

    display_order       INTEGER NOT NULL DEFAULT 0,

    status           role_status NOT NULL DEFAULT 'ACTIVE',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW
    (),

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW
    (),

    CONSTRAINT uq_roles_code
        UNIQUE
    (code),

    CONSTRAINT uq_roles_display_name
        UNIQUE
    (display_name)
);

COMMENT ON TABLE roles IS
'Application Roles';

-----------------------------------------------------------------------------------------
-- USERS
-----------------------------------------------------------------------------------------

CREATE TABLE users
(
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    role_id                 INTEGER NOT NULL,

    full_name              VARCHAR
(200) NOT NULL,

    display_name            VARCHAR
(200) NOT NULL,

    username                VARCHAR
(100) NOT NULL,

    email                   VARCHAR
(200),

    mobile                  VARCHAR
(20),

    password_hash           TEXT NOT NULL,

    profile_image_url       TEXT,

    last_login_at           TIMESTAMPTZ,

    password_changed_at     TIMESTAMPTZ,
must_change_password    BOOLEAN NOT NULL DEFAULT TRUE,
password_expires_at     TIMESTAMPTZ,
    failed_login_count      INTEGER NOT NULL DEFAULT 0,

    status               user_status NOT NULL DEFAULT 'ACTIVE',

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW
(),

    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW
(),

    CONSTRAINT fk_users_role
        FOREIGN KEY
(role_id)
        REFERENCES roles
(id),

    CONSTRAINT uq_users_username
        UNIQUE
(username),

    CONSTRAINT uq_users_email
        UNIQUE
(email),

    CONSTRAINT uq_users_mobile
        UNIQUE
(mobile)
);

COMMENT ON TABLE users IS
'Application Users';

COMMENT ON COLUMN users.password_hash IS
'Stores bcrypt hashed password only.';

-----------------------------------------------------------------------------------------
-- INDEXES
-----------------------------------------------------------------------------------------

CREATE INDEX idx_users_role
ON users(role_id);

CREATE INDEX idx_users_username
ON users(username);

CREATE INDEX idx_users_email
ON users(email);

CREATE INDEX idx_users_mobile
ON users(mobile);

CREATE INDEX idx_users_status
ON users(status);

CREATE INDEX idx_roles_display_order
ON roles(display_order);

COMMIT;