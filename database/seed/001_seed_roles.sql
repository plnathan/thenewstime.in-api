/****************************************************************************************
 Project     : thenewstime.in
 File        : 001_seed_roles.sql
 Description : Seed Application Roles
 Version     : 1.0
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    -----------------------------------------------------------------------------------------
    -- ROLES
    -----------------------------------------------------------------------------------------

    INSERT INTO roles
        (
        code,
        display_name,
        description,
        display_order,
        status
        )
    VALUES

        (
            'SUPER_ADMIN',
            'Super Administrator',
            'Full system access.',
            1,
            'ACTIVE'
),

        (
            'ADMIN',
            'Administrator',
            'Manage users, master data and news.',
            2,
            'ACTIVE'
),

        (
            'EDITOR',
            'Editor',
            'Review, approve and publish news.',
            3,
            'ACTIVE'
),

        (
            'REPORTER',
            'Reporter',
            'Create and edit news drafts.',
            4,
            'ACTIVE'
)

        ON CONFLICT
        (code)
        DO
        UPDATE
    SET
        display_name  = EXCLUDED.display_name,
        description   = EXCLUDED.description,
        display_order = EXCLUDED.display_order,
        status        = EXCLUDED.status,
        updated_at    = NOW();

    COMMIT;

