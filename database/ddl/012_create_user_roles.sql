CREATE TABLE IF NOT EXISTS "user_roles" (
    "id" integer PRIMARY KEY
        GENERATED ALWAYS AS IDENTITY,
    "user_id" bigint NOT NULL,
    "role_id" integer NOT NULL,

    "created_by" bigint,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT "pk_user_roles"
        PRIMARY KEY ("user_id", "role_id"),

    CONSTRAINT "fk_user_roles_user"
        FOREIGN KEY ("user_id")
        REFERENCES "users" ("id")
        ON DELETE CASCADE,

    CONSTRAINT "fk_user_roles_role"
        FOREIGN KEY ("role_id")
        REFERENCES "roles" ("id")
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id
ON user_roles(user_id);

CREATE INDEX IF NOT EXISTS "idx_user_roles_role_id"
    ON "user_roles" ("role_id");

---------------------------------
INSERT INTO "user_roles"
(
    "user_id",
    "role_id",
    "created_by"
)
SELECT
    "id",
    "role_id",
    NULL
FROM "users"
WHERE "role_id" IS NOT NULL
ON CONFLICT ("user_id", "role_id")
DO NOTHING;
-------------------------------------
ALTER TABLE "users"
DROP COLUMN IF EXISTS "role_id";
-------------------------------------

---------------------------------------
-- Assign SUPER_ADMIN to admin(copy the existing role assignment)
---------------------------------------
BEGIN;

INSERT INTO "user_roles"
(
    "user_id",
    "role_id",
    "created_by"
)
SELECT
    u.id,
    r.id
    1
FROM "users" u
CROSS JOIN "roles" r
WHERE u.username = 'admin'
AND r.code = 'SUPER_ADMIN'
ON CONFLICT ("user_id", "role_id")
DO NOTHING;

COMMIT;

----------------------------------------------
-- Test Query
----------------------------------------------
SELECT
    u.id AS user_id,
    u.username,
    r.code AS role_code,
    r.display_name AS role_name
FROM "users" u
JOIN "user_roles" ur
    ON ur.user_id = u.id
JOIN "roles" r
    ON r.id = ur.role_id
ORDER BY u.id, r.display_order;