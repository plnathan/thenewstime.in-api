CREATE TABLE IF NOT EXISTS "permissions" (
    "id" integer PRIMARY KEY
        GENERATED ALWAYS AS IDENTITY
        (sequence name "permissions_id_seq"
         INCREMENT BY 1
         MINVALUE 1
         MAXVALUE 2147483647
         START WITH 1
         CACHE 1),

    "code" varchar(100) NOT NULL
        CONSTRAINT "uq_permissions_code" UNIQUE,

    "display_name" varchar(150) NOT NULL,

    "description" varchar(300),

    "module" varchar(50),

    "resource" varchar(50),

    "action" varchar(50),

    "display_order" integer DEFAULT 0 NOT NULL,

    "is_system_permission" boolean DEFAULT false NOT NULL,

    "status" permission_status DEFAULT 'ACTIVE' NOT NULL,

    "created_by" bigint,

    "created_at" timestamp with time zone DEFAULT now() NOT NULL,

    "updated_by" bigint,

    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_permissions_code
    ON permissions(code);

CREATE INDEX IF NOT EXISTS "idx_permissions_module"
    ON "permissions" ("module");

CREATE INDEX IF NOT EXISTS "idx_permissions_resource"
    ON "permissions" ("resource");

-------------------------------------------------------

BEGIN;

INSERT INTO "permissions"
(
    "code",
    "display_name",
    "description",
    "module",
    "resource",
    "action",
    "display_order",
    "is_system_permission",
    "status"
)
VALUES

-- USERS
(
    'users.read',
    'View Users',
    'View users.',
    'SECURITY',
    'users',
    'read',
    1,
    true,
    'ACTIVE'
),
(
    'users.create',
    'Create Users',
    'Create new users.',
    'SECURITY',
    'users',
    'create',
    2,
    true,
    'ACTIVE'
),
(
    'users.update',
    'Update Users',
    'Update user information.',
    'SECURITY',
    'users',
    'update',
    3,
    true,
    'ACTIVE'
),
(
    'users.delete',
    'Delete Users',
    'Deactivate or remove users.',
    'SECURITY',
    'users',
    'delete',
    4,
    true,
    'ACTIVE'
),

-- ROLES
(
    'roles.read',
    'View Roles',
    'View roles.',
    'SECURITY',
    'roles',
    'read',
    10,
    true,
    'ACTIVE'
),
(
    'roles.create',
    'Create Roles',
    'Create new roles.',
    'SECURITY',
    'roles',
    'create',
    11,
    true,
    'ACTIVE'
),
(
    'roles.update',
    'Update Roles',
    'Update roles.',
    'SECURITY',
    'roles',
    'update',
    12,
    true,
    'ACTIVE'
),
(
    'roles.delete',
    'Delete Roles',
    'Deactivate or remove roles.',
    'SECURITY',
    'roles',
    'delete',
    13,
    true,
    'ACTIVE'
),
(
    'roles.assign',
    'Assign Roles',
    'Assign roles to users.',
    'SECURITY',
    'roles',
    'assign',
    14,
    true,
    'ACTIVE'
),

-- PERMISSIONS
(
    'permissions.read',
    'View Permissions',
    'View permissions.',
    'SECURITY',
    'permissions',
    'read',
    20,
    true,
    'ACTIVE'
),

-- NEWS
(
    'news.read',
    'View News',
    'View news.',
    'NEWS',
    'news',
    'read',
    30,
    true,
    'ACTIVE'
),
(
    'news.create',
    'Create News',
    'Create news.',
    'NEWS',
    'news',
    'create',
    31,
    true,
    'ACTIVE'
),
(
    'news.update',
    'Update News',
    'Update news.',
    'NEWS',
    'news',
    'update',
    32,
    true,
    'ACTIVE'
),
(
    'news.delete',
    'Delete News',
    'Delete or deactivate news.',
    'NEWS',
    'news',
    'delete',
    33,
    true,
    'ACTIVE'
),
(
    'news.approve',
    'Approve News',
    'Approve news for publishing.',
    'NEWS',
    'news',
    'approve',
    34,
    true,
    'ACTIVE'
),
(
    'news.publish',
    'Publish News',
    'Publish news.',
    'NEWS',
    'news',
    'publish',
    35,
    true,
    'ACTIVE'
),
(
    'news.archive',
    'Archive News',
    'Archive published news.',
    'NEWS',
    'news',
    'archive',
    36,
    true,
    'ACTIVE'
)

ON CONFLICT ("code")
DO UPDATE SET
    "display_name"          = EXCLUDED."display_name",
    "description"           = EXCLUDED."description",
    "module"                = EXCLUDED."module",
    "resource"              = EXCLUDED."resource",
    "action"                = EXCLUDED."action",
    "display_order"         = EXCLUDED."display_order",
    "is_system_permission"  = EXCLUDED."is_system_permission",
    "status"                = EXCLUDED."status",
    "updated_at"            = NOW();

COMMIT;

--------------------
SELECT
    code,
    display_name,
    module,
    resource,
    action,
    display_order,
    is_system_permission,
    status
FROM permissions
WHERE module = 'SECURITY'
ORDER BY display_order;

----------------------------------

Have to check
-------------
BEGIN;

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
    'SECURITY_ROLE_VIEW',
    'View Roles',
    'Allows viewing roles.',
    'SECURITY',
    'ROLE',
    'VIEW',
    10,
    true,
    'ACTIVE',
    1,
    1
),

(
    'SECURITY_ROLE_CREATE',
    'Create Roles',
    'Allows creating roles.',
    'SECURITY',
    'ROLE',
    'CREATE',
    20,
    true,
    'ACTIVE',
    1,
    1
),

(
    'SECURITY_ROLE_UPDATE',
    'Update Roles',
    'Allows updating roles.',
    'SECURITY',
    'ROLE',
    'UPDATE',
    30,
    true,
    'ACTIVE',
    1,
    1
),

(
    'SECURITY_PERMISSION_VIEW',
    'View Permissions',
    'Allows viewing permissions.',
    'SECURITY',
    'PERMISSION',
    'VIEW',
    40,
    true,
    'ACTIVE',
    1,
    1
),

(
    'SECURITY_PERMISSION_CREATE',
    'Create Permissions',
    'Allows creating permissions.',
    'SECURITY',
    'PERMISSION',
    'CREATE',
    50,
    true,
    'ACTIVE',
    1,
    1
),

(
    'SECURITY_PERMISSION_UPDATE',
    'Update Permissions',
    'Allows updating permissions.',
    'SECURITY',
    'PERMISSION',
    'UPDATE',
    60,
    true,
    'ACTIVE',
    1,
    1
),

(
    'SECURITY_ROLE_PERMISSION_ASSIGN',
    'Assign Permission to Role',
    'Allows assigning permissions to roles.',
    'SECURITY',
    'ROLE_PERMISSION',
    'ASSIGN',
    70,
    true,
    'ACTIVE',
    1,
    1
),

(
    'SECURITY_ROLE_PERMISSION_REMOVE',
    'Remove Permission from Role',
    'Allows removing permissions from roles.',
    'SECURITY',
    'ROLE_PERMISSION',
    'REMOVE',
    80,
    true,
    'ACTIVE',
    1,
    1
),

(
    'SECURITY_USER_ROLE_VIEW',
    'View User Roles',
    'Allows viewing roles assigned to users.',
    'SECURITY',
    'USER_ROLE',
    'VIEW',
    90,
    true,
    'ACTIVE',
    1,
    1
),

(
    'SECURITY_USER_ROLE_ASSIGN',
    'Assign Role to User',
    'Allows assigning roles to users.',
    'SECURITY',
    'USER_ROLE',
    'ASSIGN',
    100,
    true,
    'ACTIVE',
    1,
    1
),

(
    'SECURITY_USER_ROLE_REMOVE',
    'Remove Role from User',
    'Allows removing roles from users.',
    'SECURITY',
    'USER_ROLE',
    'REMOVE',
    110,
    true,
    'ACTIVE',
    1,
    1
)

ON CONFLICT (code)
DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    module = EXCLUDED.module,
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    display_order = EXCLUDED.display_order,
    is_system_permission = EXCLUDED.is_system_permission,
    status = EXCLUDED.status,
    updated_by = 1,
    updated_at = NOW();

COMMIT;