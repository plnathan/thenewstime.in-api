ALTER TABLE "users"
ALTER COLUMN "created_by" TYPE bigint
USING "created_by"::bigint;

ALTER TABLE "users"
ALTER COLUMN "updated_by" TYPE bigint
USING "updated_by"::bigint;

ALTER TABLE "users"
ALTER COLUMN "created_by" DROP DEFAULT;

ALTER TABLE "users"
ALTER COLUMN "updated_by" DROP DEFAULT;

ALTER TABLE "users"
DROP COLUMN IF EXISTS "role_id";

---------------------------------------------

CREATE TABLE "users" (
    "id" bigint PRIMARY KEY
        GENERATED ALWAYS AS IDENTITY
        (sequence name "users_id_seq"
         INCREMENT BY 1
         MINVALUE 1
         MAXVALUE 9223372036854775807
         START WITH 1
         CACHE 1),

    "full_name" varchar(200) NOT NULL,

    "display_name" varchar(200) NOT NULL,

    "username" varchar(100) NOT NULL
        CONSTRAINT "uq_users_username" UNIQUE,

    "email" varchar(200)
        CONSTRAINT "uq_users_email" UNIQUE,

    "mobile" varchar(20)
        CONSTRAINT "uq_users_mobile" UNIQUE,

    "password_hash" text NOT NULL,

    "profile_image_url" text,

    "last_login_at" timestamp with time zone,

    "password_changed_at" timestamp with time zone,

    "must_change_password" boolean DEFAULT true NOT NULL,

    "password_expires_at" timestamp with time zone,

    "failed_login_count" integer DEFAULT 0 NOT NULL,

    "status" user_status DEFAULT 'ACTIVE' NOT NULL,

    "created_by" bigint,

    "created_at" timestamp with time zone DEFAULT now() NOT NULL,

    "updated_by" bigint,

    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "uq_users_email"
    ON "users" ("email");

CREATE UNIQUE INDEX "uq_users_mobile"
    ON "users" ("mobile");

CREATE UNIQUE INDEX "uq_users_username"
    ON "users" ("username");

CREATE UNIQUE INDEX "users_pkey"
    ON "users" ("id");
--------------------------------
BEGIN;

INSERT INTO "users"
(
    "full_name",
    "display_name",
    "username",
    "email",
    "mobile",
    "password_hash",
    "profile_image_url",
    "last_login_at",
    "password_changed_at",
    "failed_login_count",
    "status",
  "created_by",
  "updated_by"
)
VALUES
(
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
    'ACTIVE',1,1
)
ON CONFLICT ("username")
DO UPDATE SET
    "full_name"           = EXCLUDED."full_name",
    "display_name"        = EXCLUDED."display_name",
    "email"               = EXCLUDED."email",
    "mobile"              = EXCLUDED."mobile",
    "status"              = EXCLUDED."status",
    "updated_at"          = NOW();

COMMIT;