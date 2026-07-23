thenewstime.in DB Design V1
Raw SQL
Neon PostgreSQL

ALTER TABLE districts
ADD CONSTRAINT uq_districts_state_code
UNIQUE(state_id, code);

neon.com

signup ->

Document
--------

https://neon.com/docs/cli

Connect your app with one command

npx neonctl@latest init

or

Connect your app manually

connection string:
------------------

postgresql://neondb_owner:npg_GDqzV1RywN4X@ep-winter-river-ao83ag46.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

connection parameters:
----------------------

Host
ep-winter-river-ao83ag46.c-2.ap-southeast-1.aws.neon.tech
Database
neondb
Role
neondb_owner
Password

---

Pooler host
ep-winter-river-ao83ag46-pooler.c-2.ap-southeast-1.aws.neon.tech

For SSL Security:
To prepare for this change:

- If you want the current behavior, explicitly use 'sslmode=verify-full'
- If you want libpq compatibility now, use 'uselibpqcompat=true&sslmode=require'
  See https://www.postgresql.org/docs/current/libpq-ssl.html for libpq SSL mode definitions.
  (Use `node --trace-warnings ...` to show where the warning was created)

/*
In Neon, databases are stored on branches. By default, a project has one branch and one database.
You can select the branch and database to use from the drop-down menus above.

Try generating sample data and querying it by running the example statements below, or click
New Query to clear the editor.
*/
CREATE TABLE IF NOT EXISTS playing_with_neon(id SERIAL PRIMARY KEY, name TEXT NOT NULL, value REAL);
INSERT INTO playing_with_neon(name, value)
SELECT LEFT(md5(i::TEXT), 10), random() FROM generate_series(1, 10) s(i);
SELECT * FROM playing_with_neon;
----------------------------------------

CREATE SCHEMA "public";
CREATE TABLE "news" (
"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "news_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
"title" varchar(1000),
"news_content" text,
"content_order" integer,
"drafted_by" integer,
"drafted_date" date,
"approved_by" integer,
"approved_date" date,
"thumbnail_path_id" integer,
"is_active" integer
);
CREATE UNIQUE INDEX "news_pkey" ON "news" ("id");

Alter table change column data type
-----------------------------------

ALTER TABLE "news"
ALTER COLUMN "is_active"
SET DATA TYPE integer USING "is_active"::integer;

Alter table rename column name
------------------------------

ALTER TABLE "news"
RENAME COLUMN "new_content" TO "news_content";

ALTER TABLE "news"
RENAME COLUMN "thumpnail_path_id" TO "thumbnail_path_id";

ALTER TABLE "news"
RENAME TO "news_bk";

DROP TABLE "public"."news" CASCADE

---

SELECT column_name,
data_type
FROM information_schema.columns
WHERE table_name = 'news'
ORDER BY ordinal_position;
