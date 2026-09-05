ALTER TABLE "roles"
ADD COLUMN IF NOT EXISTS "is_system_role"
boolean DEFAULT false NOT NULL;

ALTER TABLE "roles"
ALTER COLUMN "code" TYPE varchar(50);

ALTER TABLE "roles"
ALTER COLUMN "created_by" TYPE bigint
USING "created_by"::bigint;

ALTER TABLE "roles"
ALTER COLUMN "updated_by" TYPE bigint
USING "updated_by"::bigint;

ALTER TABLE "roles"
ALTER COLUMN "created_by" DROP DEFAULT;

ALTER TABLE "roles"
ALTER COLUMN "updated_by" DROP DEFAULT;

UPDATE "roles"
SET
    "is_system_role" = true,
    "updated_at" = NOW()
WHERE "code" IN (
    'SUPER_ADMIN',
    'ADMIN',
    'EDITOR',
    'REPORTER'
);
----------------------------
CREATE TABLE "roles" (
    "id" integer PRIMARY KEY
        GENERATED ALWAYS AS IDENTITY
        (sequence name "roles_id_seq"
         INCREMENT BY 1
         MINVALUE 1
         MAXVALUE 2147483647
         START WITH 1
         CACHE 1),

    "code" varchar(50) NOT NULL
        CONSTRAINT "uq_roles_code" UNIQUE,

    "display_name" varchar(100) NOT NULL
        CONSTRAINT "uq_roles_display_name" UNIQUE,

    "description" varchar(300),

    "display_order" integer DEFAULT 0 NOT NULL,

    "is_system_role" boolean DEFAULT false NOT NULL,

    "status" role_status DEFAULT 'ACTIVE' NOT NULL,

    "created_by" bigint,

    "created_at" timestamp with time zone DEFAULT now() NOT NULL,

    "updated_by" bigint,

    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "roles_pkey"
    ON "roles" ("id");

CREATE UNIQUE INDEX "uq_roles_code"
    ON "roles" ("code");

CREATE UNIQUE INDEX "uq_roles_display_name"
    ON "roles" ("display_name");
----------------------------
SEED:
-----
BEGIN;

INSERT INTO "roles"
(
    "code",
    "display_name",
    "description",
    "display_order",
    "is_system_role",
    "status",
  "created_by",
  "updated_by"
)
VALUES
(
    'SUPER_ADMIN',
    'Super Administrator',
    'Full system access.',
    1,
    true,
    'ACTIVE',
  1,
  1
),
(
    'ADMIN',
    'Administrator',
    'Manage users, master data and news.',
    2,
    true,
    'ACTIVE',
  1,1
),
(
    'EDITOR',
    'Editor',
    'Review, approve and publish news.',
    3,
    true,
    'ACTIVE',
  1,1
),
(
    'REPORTER',
    'Reporter',
    'Create and edit news drafts.',
    4,
    true,
    'ACTIVE',
  1,1
)
ON CONFLICT ("code")
DO UPDATE SET
    "display_name"   = EXCLUDED."display_name",
    "description"    = EXCLUDED."description",
    "display_order"  = EXCLUDED."display_order",
    "is_system_role" = EXCLUDED."is_system_role",
    "status"         = EXCLUDED."status",
    "updated_at"     = NOW();

COMMIT;