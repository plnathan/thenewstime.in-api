CREATE SCHEMA "public";

CREATE TYPE "news_scope" AS ENUM('DISTRICT','STATE','INDIA','WORLD');
CREATE TYPE "news_status" AS ENUM('DRAFT', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "user_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOCKED');
CREATE TYPE "media_provider" AS ENUM('CLOUDINARY', 'AWS_S3', 'AZURE_BLOB', 'LOCAL');
CREATE TYPE "media_asset_type" AS ENUM('IMAGE', 'VIDEO', 'DOCUMENT');
CREATE TYPE "media_status" AS ENUM('ACTIVE', 'DELETED');
CREATE TYPE "media_role" AS ENUM('LIST', 'DETAIL', 'GALLERY');
CREATE TYPE "country_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "state_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "district_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "category_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "role_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');

-------------------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(30) NOT NULL CONSTRAINT "categories_code_key" UNIQUE,
	"display_name" varchar(100) NOT NULL CONSTRAINT "uq_categories_display_name" UNIQUE,
	"url_name" varchar(100) NOT NULL CONSTRAINT "uq_categories_url_name" UNIQUE,
	"description" varchar(500),
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" category_status DEFAULT 'ACTIVE' NOT NULL,
	"created_by" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "categories_code_key" ON "categories" ("code");
CREATE UNIQUE INDEX "categories_pkey" ON "categories" ("id");
CREATE UNIQUE INDEX "uq_categories_code" ON "categories" ("code");
CREATE UNIQUE INDEX "uq_categories_display_name" ON "categories" ("display_name");
CREATE UNIQUE INDEX "uq_categories_url_name" ON "categories" ("url_name");

-------------------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE "countries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "countries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(30) NOT NULL CONSTRAINT "countries_code_key" UNIQUE,
	"display_name" varchar(100) NOT NULL CONSTRAINT "uq_countries_display_name" UNIQUE,
	"url_name" varchar(100) NOT NULL CONSTRAINT "uq_countries_url_name" UNIQUE,
	"iso_code" varchar(5) CONSTRAINT "uq_countries_iso_code" UNIQUE,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" country_status DEFAULT 'ACTIVE' NOT NULL,
	"created_by" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "countries_code_key" ON "countries" ("code");
CREATE UNIQUE INDEX "countries_pkey" ON "countries" ("id");
CREATE UNIQUE INDEX "uq_countries_code" ON "countries" ("code");
CREATE UNIQUE INDEX "uq_countries_display_name" ON "countries" ("display_name");
CREATE UNIQUE INDEX "uq_countries_iso_code" ON "countries" ("iso_code");
CREATE UNIQUE INDEX "uq_countries_url_name" ON "countries" ("url_name");

-------------------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE "states" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "states_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"country_id" integer NOT NULL,
	"code" varchar(30) NOT NULL CONSTRAINT "states_code_key" UNIQUE,
	"display_name" varchar(100) NOT NULL,
	"url_name" varchar(100) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" state_status DEFAULT 'ACTIVE' NOT NULL,
	"created_by" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_states_country_code" UNIQUE("country_id","code"),
	CONSTRAINT "uq_states_country_display_name" UNIQUE("country_id","display_name"),
	CONSTRAINT "uq_states_country_url_name" UNIQUE("country_id","url_name")
);

CREATE UNIQUE INDEX "states_code_key" ON "states" ("code");
CREATE UNIQUE INDEX "states_pkey" ON "states" ("id");
CREATE UNIQUE INDEX "uq_states_country_code" ON "states" ("country_id","code");
CREATE UNIQUE INDEX "uq_states_country_display_name" ON "states" ("country_id","display_name");
CREATE UNIQUE INDEX "uq_states_country_url_name" ON "states" ("country_id","url_name");

ALTER TABLE "states" ADD CONSTRAINT "fk_states_country" FOREIGN KEY ("country_id") REFERENCES "countries"("id");

-------------------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE "districts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "districts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"state_id" integer NOT NULL,
	"code" varchar(30) NOT NULL CONSTRAINT "districts_code_key" UNIQUE,
	"display_name" varchar(100) NOT NULL,
	"url_name" varchar(100) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" district_status DEFAULT 'ACTIVE' NOT NULL,
	"created_by" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_district_state_display_name" UNIQUE("state_id","display_name"),
	CONSTRAINT "uq_district_state_url_name" UNIQUE("state_id","url_name"),
	CONSTRAINT "uq_districts_state_code" UNIQUE("state_id","code")
);

CREATE UNIQUE INDEX "districts_code_key" ON "districts" ("code");
CREATE UNIQUE INDEX "districts_pkey" ON "districts" ("id");
CREATE UNIQUE INDEX "uq_district_state_display_name" ON "districts" ("state_id","display_name");
CREATE UNIQUE INDEX "uq_district_state_url_name" ON "districts" ("state_id","url_name");
CREATE UNIQUE INDEX "uq_districts_state_code" ON "districts" ("state_id","code");

ALTER TABLE "districts" ADD CONSTRAINT "fk_districts_state" FOREIGN KEY ("state_id") REFERENCES "states"("id");

-------------------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"role_id" integer NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"username" varchar(100) NOT NULL CONSTRAINT "uq_users_username" UNIQUE,
	"email" varchar(200) CONSTRAINT "uq_users_email" UNIQUE,
	"mobile" varchar(20) CONSTRAINT "uq_users_mobile" UNIQUE,
	"password_hash" text NOT NULL,
	"profile_image_url" text,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"password_expires_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"status" user_status DEFAULT 'ACTIVE' NOT NULL,
	"created_by" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email");
CREATE UNIQUE INDEX "uq_users_mobile" ON "users" ("mobile");
CREATE UNIQUE INDEX "uq_users_username" ON "users" ("username");
CREATE UNIQUE INDEX "users_pkey" ON "users" ("id");

-------------------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE "roles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "roles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(30) NOT NULL CONSTRAINT "uq_roles_code" UNIQUE,
	"display_name" varchar(100) NOT NULL CONSTRAINT "uq_roles_display_name" UNIQUE,
	"description" varchar(300),
	"display_order" integer DEFAULT 0 NOT NULL,
	"status" role_status DEFAULT 'ACTIVE' NOT NULL,
	"created_by" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "roles_pkey" ON "roles" ("id");
CREATE UNIQUE INDEX "uq_roles_code" ON "roles" ("code");
CREATE UNIQUE INDEX "uq_roles_display_name" ON "roles" ("display_name");

-------------------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE "news" (
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "news_id_seq1" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"news_number" bigserial CONSTRAINT "uq_news_number" UNIQUE,
	"title" varchar(1000) NOT NULL,
	"slug" varchar(300) NOT NULL CONSTRAINT "uq_news_slug" UNIQUE,
	"summary" text,
	"content" text NOT NULL,
	"news_scope" news_scope NOT NULL,
	"category_id" integer NOT NULL,
	"district_id" integer,
	"state_id" integer,
	"country_id" integer,
	"status" news_status DEFAULT 'DRAFT' NOT NULL,
	"drafted_by" integer NOT NULL,
	"drafted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"published_by" integer,
	"published_at" timestamp with time zone,
	"rejected_by" integer,
	"rejected_at" timestamp with time zone,
	"archived_by" integer,
	"archived_at" timestamp with time zone,
	"created_by" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"display_priority" integer DEFAULT 0 NOT NULL,
	"display_priority_until" timestamp with time zone,
	CONSTRAINT "news_pkey1" PRIMARY KEY("id")
);

CREATE INDEX "idx_news_approved_by" ON "news" ("approved_by");
CREATE INDEX "idx_news_category" ON "news" ("category_id");
CREATE INDEX "idx_news_category_page" ON "news" ("category_id","published_at");
CREATE INDEX "idx_news_country" ON "news" ("country_id");
CREATE INDEX "idx_news_created_at" ON "news" ("created_at");
CREATE INDEX "idx_news_display_priority" ON "news" ("display_priority","display_priority_until");
CREATE INDEX "idx_news_district" ON "news" ("district_id");
CREATE INDEX "idx_news_district_page" ON "news" ("district_id","published_at");
CREATE INDEX "idx_news_drafted_at" ON "news" ("drafted_at");
CREATE INDEX "idx_news_drafted_by" ON "news" ("drafted_by");
CREATE INDEX "idx_news_home_page" ON "news" ("status","published_at");
CREATE INDEX "idx_news_published_at" ON "news" ("published_at");
CREATE INDEX "idx_news_published_by" ON "news" ("published_by");
CREATE INDEX "idx_news_scope" ON "news" ("news_scope");
CREATE INDEX "idx_news_slug" ON "news" ("slug");
CREATE INDEX "idx_news_state" ON "news" ("state_id");
CREATE INDEX "idx_news_state_page" ON "news" ("state_id","published_at");
CREATE INDEX "idx_news_status" ON "news" ("status");
CREATE UNIQUE INDEX "news_pkey1" ON "news" ("id");
CREATE UNIQUE INDEX "uq_news_number" ON "news" ("news_number");
CREATE UNIQUE INDEX "uq_news_slug" ON "news" ("slug");

-------------------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE "media_assets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "media_assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"provider" media_provider NOT NULL,
	"asset_type" media_asset_type NOT NULL,
	"public_id" varchar(500) NOT NULL CONSTRAINT "uq_media_public_id" UNIQUE,
	"original_file_name" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_extension" varchar(20),
	"file_size_bytes" bigint,
	"width" integer,
	"height" integer,
	"duration_seconds" integer,
	"alt_text" varchar(300),
	"caption" varchar(500),
	"file_url" text NOT NULL,
	"thumbnail_url" text,
	"status" media_status DEFAULT 'ACTIVE' NOT NULL,
	"uploaded_by" bigint NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "idx_media_assets_asset_type" ON "media_assets" ("asset_type");
CREATE INDEX "idx_media_assets_created_at" ON "media_assets" ("created_at");
CREATE INDEX "idx_media_assets_provider" ON "media_assets" ("provider");
CREATE INDEX "idx_media_assets_status" ON "media_assets" ("status");
CREATE INDEX "idx_media_assets_uploaded_by" ON "media_assets" ("uploaded_by");
CREATE UNIQUE INDEX "media_assets_pkey" ON "media_assets" ("id");
CREATE UNIQUE INDEX "uq_media_public_id" ON "media_assets" ("public_id");

ALTER TABLE "news_media" ADD CONSTRAINT "fk_news_media_asset" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id");

-------------------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE "news_media" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "news_media_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"news_id" bigint NOT NULL,
	"media_asset_id" bigint NOT NULL,
	"media_role" media_role NOT NULL,
	"display_order" integer DEFAULT 1 NOT NULL,
	"created_by" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "idx_news_media_asset" ON "news_media" ("media_asset_id");
CREATE INDEX "idx_news_media_news" ON "news_media" ("news_id");
CREATE INDEX "idx_news_media_role" ON "news_media" ("media_role");
CREATE UNIQUE INDEX "news_media_pkey" ON "news_media" ("id");

ALTER TABLE "news_media" ADD CONSTRAINT "fk_news_media_news" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE;

-------------------------------------------------------------------------------------------------------------------------------------------

CREATE TABLE "news_reads" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "news_reads_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"news_id" bigint NOT NULL,
	"session_id" varchar(200) NOT NULL,
	"visitor_id" uuid,
	"ip_hash" varchar(255),
	"browser" varchar(150),
	"operating_system" varchar(150),
	"device_type" varchar(50),
	"user_agent" text,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "idx_news_reads_news" ON "news_reads" ("news_id");
CREATE INDEX "idx_news_reads_news_id" ON "news_reads" ("news_id");
CREATE INDEX "idx_news_reads_news_id_read_at" ON "news_reads" ("news_id","read_at");
CREATE INDEX "idx_news_reads_read_at" ON "news_reads" ("read_at");
CREATE INDEX "idx_news_reads_session_news" ON "news_reads" ("session_id","news_id");
CREATE INDEX "idx_news_reads_session_news_read_at" ON "news_reads" ("session_id","news_id","read_at");
CREATE UNIQUE INDEX "news_reads_pkey" ON "news_reads" ("id");

ALTER TABLE "news_reads" ADD CONSTRAINT "fk_news_reads_news" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE;
ALTER TABLE "news_reads" ADD CONSTRAINT "news_reads_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE CASCADE;

-------------------------------------------------------------------------------------------------------------------------------------------
