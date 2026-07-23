/****************************************************************************************
 Project     : thenewstime.in
 File        : 010_create_triggers.sql
 Description : Database Triggers
 Version     : 1.0
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    -----------------------------------------------------------------------------------------
    -- COUNTRIES
    -----------------------------------------------------------------------------------------

    DROP TRIGGER IF EXISTS trg_countries_updated_at
    ON countries;

CREATE TRIGGER trg_countries_updated_at
BEFORE
UPDATE
ON countries
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at
();

-----------------------------------------------------------------------------------------
-- STATES
-----------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_states_updated_at
ON states;

CREATE TRIGGER trg_states_updated_at
BEFORE
UPDATE
ON states
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at
();

-----------------------------------------------------------------------------------------
-- DISTRICTS
-----------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_districts_updated_at
ON districts;

CREATE TRIGGER trg_districts_updated_at
BEFORE
UPDATE
ON districts
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at
();

-----------------------------------------------------------------------------------------
-- CATEGORIES
-----------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_categories_updated_at
ON categories;

CREATE TRIGGER trg_categories_updated_at
BEFORE
UPDATE
ON categories
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at
();

-----------------------------------------------------------------------------------------
-- ROLES
-----------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_roles_updated_at
ON roles;

CREATE TRIGGER trg_roles_updated_at
BEFORE
UPDATE
ON roles
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at
();

-----------------------------------------------------------------------------------------
-- USERS
-----------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_users_updated_at
ON users;

CREATE TRIGGER trg_users_updated_at
BEFORE
UPDATE
ON users
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at
();

-----------------------------------------------------------------------------------------
-- MEDIA ASSETS
-----------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_media_assets_updated_at
ON media_assets;

CREATE TRIGGER trg_media_assets_updated_at
BEFORE
UPDATE
ON media_assets
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at
();

-----------------------------------------------------------------------------------------
-- NEWS
-----------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_news_updated_at
ON news;

CREATE TRIGGER trg_news_updated_at
BEFORE
UPDATE
ON news
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at
();

-----------------------------------------------------------------------------------------
-- NEWS LOCATION VALIDATION
-----------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_news_validate_location
ON news;

CREATE TRIGGER trg_news_validate_location
BEFORE
INSERT OR
UPDATE
ON news
FOR EACH ROW
EXECUTE FUNCTION fn_validate_news_location
();

-----------------------------------------------------------------------------------------
-- RELATED NEWS VALIDATION
-----------------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_related_news_validate
ON related_news;

CREATE TRIGGER trg_related_news_validate
BEFORE
INSERT OR
UPDATE
ON related_news
FOR EACH ROW
EXECUTE FUNCTION fn_validate_related_news
();

COMMIT;