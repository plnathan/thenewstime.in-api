/****************************************************************************************
 Project     : thenewstime.in
 File        : 001_create_enums.sql
 Description : Creates all PostgreSQL ENUM types used in the application.

 Execution   : 001

 Author      : Loganathan
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    -----------------------------------------------------------------------------------------
    -- Drop existing enums (Development Only)
    -- Comment these in Production
    -----------------------------------------------------------------------------------------

    DROP TYPE IF EXISTS news_scope
    CASCADE;
DROP TYPE IF EXISTS news_status
CASCADE;

DROP TYPE IF EXISTS user_status
CASCADE;

DROP TYPE IF EXISTS media_provider
CASCADE;

DROP TYPE IF EXISTS media_asset_type
CASCADE;

DROP TYPE IF EXISTS media_status
CASCADE;

DROP TYPE IF EXISTS media_role
CASCADE;

-----------------------------------------------------------------------------------------
-- Media Role
-----------------------------------------------------------------------------------------

CREATE TYPE media_role AS ENUM
(
    'LIST',
    'DETAIL',
    'GALLERY'
);

-----------------------------------------------------------------------------------------
-- News Scope
-----------------------------------------------------------------------------------------

CREATE TYPE news_scope AS ENUM
(
    'STATE',
    'INDIA',
    'WORLD'
);

COMMENT ON TYPE news_scope IS
'Defines where the news belongs.';

-----------------------------------------------------------------------------------------
-- News Status
-----------------------------------------------------------------------------------------

CREATE TYPE news_status AS ENUM
(
    'DRAFT',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'PUBLISHED'
);

COMMENT ON TYPE news_status IS
'Editorial workflow status.';

-----------------------------------------------------------------------------------------
-- User Status
-----------------------------------------------------------------------------------------

CREATE TYPE user_status AS ENUM
(
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED',
    'LOCKED'
);

COMMENT ON TYPE user_status IS
'User account status.';

-----------------------------------------------------------------------------------------
-- Role Status
-----------------------------------------------------------------------------------------

CREATE TYPE role_status AS ENUM
(
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);

COMMENT ON TYPE role_status IS
'Role status.';

-----------------------------------------------------------------------------------------
-- Country Status
-----------------------------------------------------------------------------------------

CREATE TYPE country_status AS ENUM
(
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);

COMMENT ON TYPE country_status IS
'Country status.';

-----------------------------------------------------------------------------------------
-- State Status
-----------------------------------------------------------------------------------------

CREATE TYPE state_status AS ENUM
(
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);

COMMENT ON TYPE state_status IS
'State status.';

-----------------------------------------------------------------------------------------
-- District Status
-----------------------------------------------------------------------------------------

CREATE TYPE district_status AS ENUM
(
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);

COMMENT ON TYPE district_status IS
'District status.';

-----------------------------------------------------------------------------------------
-- Category Status
-----------------------------------------------------------------------------------------

CREATE TYPE category_status AS ENUM
(
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);

COMMENT ON TYPE category_status IS
'Category status.';


//
COMMIT;

-----------------------------------------------------------------------------------------
-- Media Provider
-----------------------------------------------------------------------------------------

CREATE TYPE media_provider AS ENUM
(
    'CLOUDINARY'
    'AWS_S3'
    'AZURE_BLOB'
    'LOCAL'
);

COMMENT ON TYPE media_provider IS
'Media provider types.';

-----------------------------------------------------------------------------------------
-- Media Asset Type
-----------------------------------------------------------------------------------------

CREATE TYPE media_asset_type AS ENUM
(
    'IMAGE',
    'VIDEO',
    'DOCUMENT'
);

COMMENT ON TYPE media_asset_type IS
'Media asset types.';

-----------------------------------------------------------------------------------------
-- Media Status
-----------------------------------------------------------------------------------------

CREATE TYPE media_status  AS ENUM
(
    'ACTIVE',
    'DELETED'
);

COMMENT ON TYPE media_status IS
'Media status.';

COMMIT;

-------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'permission_status'
    ) THEN
        CREATE TYPE "permission_status"
        AS ENUM ('ACTIVE', 'INACTIVE');
    END IF;
END
$$;
-----------------------------------------------------