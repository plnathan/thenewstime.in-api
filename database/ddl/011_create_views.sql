/****************************************************************************************
 Project     : thenewstime.in
 File        : 011_create_views.sql
 Description : Database Views
 Version     : 1.0
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    -----------------------------------------------------------------------------------------
    -- LATEST NEWS
    -----------------------------------------------------------------------------------------

    CREATE OR REPLACE VIEW vw_latest_news AS
    SELECT
        n.id,
        n.news_number,
        n.title,
        n.slug,
        n.summary,
        n.news_scope,
        n.status,
        n.published_at,

        c.display_name      AS category_name,
        c.url_name          AS category_slug,

        co.display_name     AS country_name,
        co.url_name         AS country_slug,

        s.display_name      AS state_name,
        s.url_name          AS state_slug,

        d.display_name      AS district_name,
        d.url_name          AS district_slug

    FROM news n
        LEFT JOIN categories c
        ON n.category_id = c.id
        LEFT JOIN countries co
        ON n.country_id = co.id
        LEFT JOIN states s
        ON n.state_id = s.id
        LEFT JOIN districts d
        ON n.district_id = d.id
    WHERE n.status='PUBLISHED';

    -----------------------------------------------------------------------------------------
    -- HOME PAGE NEWS
    -----------------------------------------------------------------------------------------

    CREATE OR REPLACE VIEW vw_home_news AS
    SELECT *
    FROM vw_latest_news
    ORDER BY published_at DESC;

    -----------------------------------------------------------------------------------------
    -- STATE NEWS
    -----------------------------------------------------------------------------------------

    CREATE OR REPLACE VIEW vw_state_news AS
    SELECT *
    FROM vw_latest_news
    WHERE news_scope='STATE';

    -----------------------------------------------------------------------------------------
    -- INDIA NEWS
    -----------------------------------------------------------------------------------------

    CREATE OR REPLACE VIEW vw_india_news AS
    SELECT *
    FROM vw_latest_news
    WHERE news_scope='INDIA';

    -----------------------------------------------------------------------------------------
    -- WORLD NEWS
    -----------------------------------------------------------------------------------------

    CREATE OR REPLACE VIEW vw_world_news AS
    SELECT *
    FROM vw_latest_news
    WHERE news_scope='WORLD';

    -----------------------------------------------------------------------------------------
    -- NEWS WITH THUMBNAIL
    -----------------------------------------------------------------------------------------

    CREATE OR REPLACE VIEW vw_news_thumbnail AS
    SELECT

        n.id,
        n.news_number,
        n.title,
        n.slug,
        n.summary,

        ma.file_url,
        ma.thumbnail_url,

        n.published_at

    FROM news n

        INNER JOIN news_media nm
        ON n.id = nm.news_id

        INNER JOIN media_assets ma
        ON nm.media_asset_id = ma.id

    WHERE
nm.media_role='LIST'
        AND n.status='PUBLISHED';

    -----------------------------------------------------------------------------------------
    -- RELATED NEWS
    -----------------------------------------------------------------------------------------

    CREATE OR REPLACE VIEW vw_related_news AS
    SELECT

        rn.news_id,

        n2.news_number,

        n2.title,

        n2.slug,

        n2.summary,

        ma.thumbnail_url,

        rn.display_order

    FROM related_news rn

        INNER JOIN news n2
        ON rn.related_news_id=n2.id

        LEFT JOIN news_media nm
        ON n2.id=nm.news_id
            AND nm.media_role='LIST'

        LEFT JOIN media_assets ma
        ON nm.media_asset_id=ma.id

    WHERE n2.status='PUBLISHED';

    COMMIT;