/****************************************************************************************
 Project     : thenewstime.in
 File        : 005_create_media_tables.sql
 Description : Media Management
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

-----------------------------------------------------------------------------------------
-- MEDIA ASSETS
-----------------------------------------------------------------------------------------

CREATE TABLE media_assets
(
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    provider                    media_provider NOT NULL,

    asset_type                  media_asset_type NOT NULL,

    public_id                   VARCHAR(500) NOT NULL,

    original_file_name          VARCHAR(500) NOT NULL,

    mime_type                   VARCHAR(100) NOT NULL,

    file_extension              VARCHAR(20),

    file_size_bytes             BIGINT,

    width                       INTEGER,

    height                      INTEGER,

    duration_seconds            INTEGER,

    alt_text                    VARCHAR(300),

    caption                     VARCHAR(500),

    file_url                    TEXT NOT NULL,

    thumbnail_url               TEXT,

    status                      media_status NOT NULL DEFAULT 'ACTIVE',

    uploaded_by                 BIGINT NOT NULL,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_media_uploaded_by
        FOREIGN KEY(uploaded_by)
        REFERENCES users(id),

    CONSTRAINT uq_media_public_id
        UNIQUE(public_id)
);

COMMENT ON TABLE media_assets IS
'Stores all uploaded media (images, videos, documents).';

COMMENT ON COLUMN media_assets.public_id IS
'Unique identifier from the storage provider (Cloudinary).';

COMMENT ON COLUMN media_assets.file_url IS
'Primary URL used by the application.';

COMMENT ON COLUMN media_assets.thumbnail_url IS
'Thumbnail URL for lists and previews.';

COMMENT ON COLUMN media_assets.alt_text IS
'SEO and accessibility description.';

COMMENT ON COLUMN media_assets.caption IS
'Optional media caption shown in UI.';

-----------------------------------------------------------------------------------------
-- INDEXES
-----------------------------------------------------------------------------------------

CREATE INDEX idx_media_provider
ON media_assets(provider);

CREATE INDEX idx_media_asset_type
ON media_assets(asset_type);

CREATE INDEX idx_media_status
ON media_assets(status);

CREATE INDEX idx_media_uploaded_by
ON media_assets(uploaded_by);

CREATE INDEX idx_media_created_at
ON media_assets(created_at DESC);

-----------------------------------------------------------------------------------------
-- news_media
-----------------------------------------------------------------------------------------

CREATE TABLE news_media
(
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    news_id             BIGINT NOT NULL,

    media_asset_id      BIGINT NOT NULL,

    media_role          media_role NOT NULL,

    display_order       INTEGER NOT NULL DEFAULT 1,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW
(),

    CONSTRAINT fk_news_media_news
        FOREIGN KEY
(news_id)
        REFERENCES news
(id)
        ON
DELETE CASCADE,

    CONSTRAINT fk_news_media_asset
        FOREIGN KEY
(media_asset_id)
        REFERENCES media_assets
(id)
);

CREATE INDEX idx_news_media_news
ON news_media(news_id);

CREATE INDEX idx_news_media_asset
ON news_media(media_asset_id);

CREATE INDEX idx_news_media_role
ON news_media(media_role);

-----------------------------------------------------------------------------------------
-- related_news
-----------------------------------------------------------------------------------------

CREATE TABLE related_news
(
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    news_id                 BIGINT NOT NULL,

    related_news_id         BIGINT NOT NULL,

    display_order           INTEGER NOT NULL DEFAULT 1,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW
(),

    CONSTRAINT fk_related_news
        FOREIGN KEY
(news_id)
        REFERENCES news
(id)
        ON
DELETE CASCADE,

    CONSTRAINT fk_related_news_item
        FOREIGN KEY
(related_news_id)
        REFERENCES news
(id)
        ON
DELETE CASCADE,

    CONSTRAINT uq_related_news
        UNIQUE
(news_id, related_news_id)
);

CREATE INDEX idx_related_news_news
ON related_news(news_id);

CREATE INDEX idx_related_news_related
ON related_news(related_news_id);

COMMIT;

