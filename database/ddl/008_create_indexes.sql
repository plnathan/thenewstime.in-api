/****************************************************************************************
 Project     : thenewstime.in
 File        : 008_create_indexes.sql
 Description : Performance Indexes
 Version     : 1.0
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    -----------------------------------------------------------------------------------------
    -- COUNTRIES
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_countries_display_order
ON countries(display_order);

    -----------------------------------------------------------------------------------------
    -- STATES
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_states_country
ON states(country_id);

    CREATE INDEX idx_states_display_order
ON states(display_order);

    -----------------------------------------------------------------------------------------
    -- DISTRICTS
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_districts_state
ON districts(state_id);

    CREATE INDEX idx_districts_display_order
ON districts(display_order);

    -----------------------------------------------------------------------------------------
    -- CATEGORIES
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_categories_display_order
ON categories(display_order);

    -----------------------------------------------------------------------------------------
    -- ROLES
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_roles_display_order
ON roles(display_order);

    -----------------------------------------------------------------------------------------
    -- USERS
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_users_role
ON users(role_id);

    CREATE INDEX idx_users_status
ON users(status);

    -----------------------------------------------------------------------------------------
    -- MEDIA ASSETS
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_media_assets_provider
ON media_assets(provider);

    CREATE INDEX idx_media_assets_asset_type
ON media_assets(asset_type);

    CREATE INDEX idx_media_assets_status
ON media_assets(status);

    CREATE INDEX idx_media_assets_uploaded_by
ON media_assets(uploaded_by);

    CREATE INDEX idx_media_assets_created_at
ON media_assets(created_at DESC);

    -----------------------------------------------------------------------------------------
    -- NEWS
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_news_scope
ON news(news_scope);

    CREATE INDEX idx_news_status
ON news(status);

    CREATE INDEX idx_news_country
ON news(country_id);

    CREATE INDEX idx_news_state
ON news(state_id);

    CREATE INDEX idx_news_district
ON news(district_id);

    CREATE INDEX idx_news_category
ON news(category_id);

    CREATE INDEX idx_news_drafted_by
ON news(drafted_by);

    CREATE INDEX idx_news_approved_by
ON news(approved_by);

    CREATE INDEX idx_news_published_by
ON news(published_by);

    CREATE INDEX idx_news_created_at
ON news(created_at DESC);

    CREATE INDEX idx_news_published_at
ON news(published_at DESC);

    CREATE INDEX idx_news_drafted_at
ON news(drafted_at DESC);

    -----------------------------------------------------------------------------------------
    -- NEWS SLUG LOOKUP
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_news_slug
ON news(slug);

    -----------------------------------------------------------------------------------------
    -- HOME PAGE
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_news_home_page
ON news
(
    status,
    published_at DESC
);

    -----------------------------------------------------------------------------------------
    -- CATEGORY PAGE
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_news_category_page
ON news
(
    category_id,
    published_at DESC
);

    -----------------------------------------------------------------------------------------
    -- STATE PAGE
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_news_state_page
ON news
(
    state_id,
    published_at DESC
);

    -----------------------------------------------------------------------------------------
    -- DISTRICT PAGE
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_news_district_page
ON news
(
    district_id,
    published_at DESC
);

    -----------------------------------------------------------------------------------------
    -- NEWS MEDIA
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_news_media_news
ON news_media(news_id);

    CREATE INDEX idx_news_media_asset
ON news_media(media_asset_id);

    CREATE INDEX idx_news_media_role
ON news_media(media_role);

    -----------------------------------------------------------------------------------------
    -- RELATED NEWS
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_related_news_news
ON related_news(news_id);

    CREATE INDEX idx_related_news_related
ON related_news(related_news_id);

    -----------------------------------------------------------------------------------------
    -- NEWS READS
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_news_reads_news
ON news_reads(news_id);

    CREATE INDEX idx_news_reads_read_at
ON news_reads(read_at DESC);

    -----------------------------------------------------------------------------------------
    -- SITE VISITS
    -----------------------------------------------------------------------------------------

    CREATE INDEX idx_site_visits_visited_at
ON site_visits(visited_at DESC);

    COMMIT;