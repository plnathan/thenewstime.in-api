CREATE TABLE IF NOT EXISTS "role_permissions" (
    "id" integer PRIMARY KEY
        GENERATED ALWAYS AS IDENTITY,
    "role_id" integer NOT NULL,

    "permission_id" integer NOT NULL,

    "created_by" bigint,

    "created_at" timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT "pk_role_permissions"
        PRIMARY KEY ("role_id", "permission_id"),

    CONSTRAINT "fk_role_permissions_role"
        FOREIGN KEY ("role_id")
        REFERENCES "roles" ("id")
        ON DELETE CASCADE,

    CONSTRAINT "fk_role_permissions_permission"
        FOREIGN KEY ("permission_id")
        REFERENCES "permissions" ("id")
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_role_permissions_permission_id"
    ON "role_permissions" ("permission_id");

----------------------------------------------------------------
-- Assign permissions to ADMIN
-------------------------------
BEGIN;

INSERT INTO "role_permissions"
(
    "role_id",
    "permission_id"
)
SELECT
    r.id,
    p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'ADMIN'
AND p.code IN (
    'users.read',
    'users.create',
    'users.update',
    'users.delete',

    'roles.read',
    'roles.create',
    'roles.update',
    'roles.delete',
    'roles.assign',

    'permissions.read',

    'news.read',
    'news.create',
    'news.update',
    'news.delete',
    'news.approve',
    'news.publish',
    'news.archive'
)
ON CONFLICT ("role_id", "permission_id")
DO NOTHING;

COMMIT;

------------------------------------------
-- Assign permissions to EDITOR
------------------------------------------
BEGIN;

INSERT INTO "role_permissions"
(
    "role_id",
    "permission_id"
)
SELECT
    r.id,
    p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'EDITOR'
AND p.code IN (
    'news.read',
    'news.update',
    'news.approve',
    'news.publish',
    'news.archive'
)
ON CONFLICT ("role_id", "permission_id")
DO NOTHING;

COMMIT;
------------------------------------------
-- Assign permissions to REPORTER
------------------------------------------
BEGIN;

INSERT INTO "role_permissions"
(
    "role_id",
    "permission_id"
)
SELECT
    r.id,
    p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'REPORTER'
AND p.code IN (
    'news.read',
    'news.create',
    'news.update'
)
ON CONFLICT ("role_id", "permission_id")
DO NOTHING;

COMMIT;

--------------------------------------------
-- Test Query
--------------------------------------------
SELECT
    r.code AS role_code,
    p.code AS permission_code
FROM "roles" r
JOIN "role_permissions" rp
    ON rp.role_id = r.id
JOIN "permissions" p
    ON p.id = rp.permission_id
ORDER BY
    r.display_order,
    p.display_order;
------------------------------------------------

Have to check
--------------
INSERT INTO role_permissions
(
    role_id,
    permission_id,
    created_by
)
SELECT
    r.id,
    p.id,
    1
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.module = 'SECURITY'
  AND p.status = 'ACTIVE'
ON CONFLICT
(
    role_id,
    permission_id
)
DO NOTHING;

--------------------------------


SELECT
    r.code AS role_code,
    p.code AS permission_code,
    p.module,
    p.resource,
    p.action,
    p.status
FROM role_permissions rp
JOIN roles r
    ON r.id = rp.role_id
JOIN permissions p
    ON p.id = rp.permission_id
WHERE r.code = 'SUPER_ADMIN'
  AND p.module = 'SECURITY'
ORDER BY
    p.display_order;