Part 1 - Master Tables DDL
Naming Standards

Tables : plural
Columns : snake*case
Primary Key : id
Foreign Key : <table>\_id
Indexes : idx*<table>_<column>
Unique Keys : uq_<table>\_<column>

ENUMS

News Scope

CREATE TYPE "news_scope" AS ENUM('STATE', 'INDIA', 'WORLD');

News Status

DROP TYPE IF EXISTS news_status CASCADE;

CREATE TYPE news_status AS ENUM
(
'DRAFT',
'APPROVED',
'REJECTED',
'PUBLISHED'
);

MASTER TABLES
Countries

CREATE TABLE countries
(
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name            VARCHAR(100) NOT NULL,
    english_name    VARCHAR(100) NOT NULL,
    iso_code        VARCHAR(5),

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_countries_name UNIQUE(name),
    CONSTRAINT uq_countries_english_name UNIQUE(english_name),
    CONSTRAINT uq_countries_iso_code UNIQUE(iso_code)

);

CREATE INDEX idx_countries_english_name
ON countries(english_name);

States

CREATE TABLE states
(
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    country_id      BIGINT NOT NULL,

    name            VARCHAR(100) NOT NULL,
    english_name    VARCHAR(100) NOT NULL,

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_states_country
        FOREIGN KEY(country_id)
        REFERENCES countries(id),

    CONSTRAINT uq_states_country_name
        UNIQUE(country_id, name),

    CONSTRAINT uq_states_country_english_name
        UNIQUE(country_id, english_name)

);

CREATE INDEX idx_states_country
ON states(country_id);

CREATE INDEX idx_states_english_name
ON states(english_name);

Districts
CREATE TABLE districts
(
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    state_id        BIGINT NOT NULL,

    name            VARCHAR(100) NOT NULL,
    english_name    VARCHAR(100) NOT NULL,

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_district_state
        FOREIGN KEY(state_id)
        REFERENCES states(id),

    CONSTRAINT uq_district_state_name
        UNIQUE(state_id, name),

    CONSTRAINT uq_district_state_english_name
        UNIQUE(state_id, english_name)

);

CREATE INDEX idx_district_state
ON districts(state_id);

CREATE INDEX idx_district_english_name
ON districts(english_name);

Categories
CREATE TABLE categories
(
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name                VARCHAR(100) NOT NULL,
    english_name        VARCHAR(100) NOT NULL,

    display_order       INTEGER NOT NULL DEFAULT 0,

    is_active           BOOLEAN NOT NULL DEFAULT TRUE,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_category_name
        UNIQUE(name),

    CONSTRAINT uq_category_english_name
        UNIQUE(english_name)

);

CREATE INDEX idx_category_display_order
ON categories(display_order);

CREATE INDEX idx_category_english_name
ON categories(english_name);

Roles
CREATE TABLE roles
(
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name            VARCHAR(50) NOT NULL,

    description     VARCHAR(250),

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_roles_name
        UNIQUE(name)

);

Users
CREATE TABLE users
(
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    role_id             BIGINT NOT NULL,

    full_name           VARCHAR(200) NOT NULL,

    username            VARCHAR(100) NOT NULL,

    email               VARCHAR(200),

    mobile              VARCHAR(20),

    password_hash       TEXT NOT NULL,

    is_active           BOOLEAN NOT NULL DEFAULT TRUE,

    last_login_at       TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_users_role
        FOREIGN KEY(role_id)
        REFERENCES roles(id),

    CONSTRAINT uq_users_username
        UNIQUE(username),

    CONSTRAINT uq_users_email
        UNIQUE(email),

    CONSTRAINT uq_users_mobile
        UNIQUE(mobile)

);

CREATE INDEX idx_users_role
ON users(role_id);

Publishing Tables
media_assets
CREATE TABLE media_assets
(
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    provider            VARCHAR(30) NOT NULL DEFAULT 'CLOUDINARY',

    public_id           VARCHAR(500) NOT NULL,

    secure_url          TEXT NOT NULL,

    resource_type       VARCHAR(20) NOT NULL,

    format              VARCHAR(20),

    width               INTEGER,

    height              INTEGER,

    bytes               INTEGER,

    original_filename   VARCHAR(255),

    uploaded_by         BIGINT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_media_uploaded_by
        FOREIGN KEY(uploaded_by)
        REFERENCES users(id),

    CONSTRAINT uq_media_public_id
        UNIQUE(public_id)

);

CREATE INDEX idx_media_provider
ON media_assets(provider);

CREATE INDEX idx_media_resource_type
ON media_assets(resource_type);

CREATE SEQUENCE news_number_seq
START WITH 1000
INCREMENT BY 1
NO MINVALUE
NO MAXVALUE
CACHE 1;

news
CREATE TABLE news
(
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    news_number             BIGINT NOT NULL DEFAULT nextval('news_number_seq'),

    title                   VARCHAR(1000) NOT NULL,

    url_name                VARCHAR(300) NOT NULL,

    summary                 TEXT,

    content                 TEXT NOT NULL,

    coverage_type           coverage_type NOT NULL,

    country_id              BIGINT,

    state_id                BIGINT,

    district_id             BIGINT,

    category_id             BIGINT NOT NULL,

    list_image_asset_id     BIGINT,

    detail_image_asset_id   BIGINT,

    status                  news_status NOT NULL DEFAULT 'DRAFT',

    drafted_by              BIGINT NOT NULL,

    approved_by             BIGINT,

    drafted_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    approved_at             TIMESTAMPTZ,

    published_at            TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_news_number
        UNIQUE(news_number),

    CONSTRAINT fk_news_country
        FOREIGN KEY(country_id)
        REFERENCES countries(id),

    CONSTRAINT fk_news_state
        FOREIGN KEY(state_id)
        REFERENCES states(id),

    CONSTRAINT fk_news_district
        FOREIGN KEY(district_id)
        REFERENCES districts(id),

    CONSTRAINT fk_news_category
        FOREIGN KEY(category_id)
        REFERENCES categories(id),

    CONSTRAINT fk_news_list_image
        FOREIGN KEY(list_image_asset_id)
        REFERENCES media_assets(id),

    CONSTRAINT fk_news_detail_image
        FOREIGN KEY(detail_image_asset_id)
        REFERENCES media_assets(id),

    CONSTRAINT fk_news_drafted_by
        FOREIGN KEY(drafted_by)
        REFERENCES users(id),

    CONSTRAINT fk_news_approved_by
        FOREIGN KEY(approved_by)
        REFERENCES users(id)

);

CREATE INDEX idx_news_number
ON news(news_number);

CREATE INDEX idx_news_url_name
ON news(url_name);

CREATE INDEX idx_news_status
ON news(status);

CREATE INDEX idx_news_scope
ON news(news_scope);

CREATE INDEX idx_news_category
ON news(category_id);

CREATE INDEX idx_news_country
ON news(country_id);

CREATE INDEX idx_news_state
ON news(state_id);

CREATE INDEX idx_news_district
ON news(district_id);

CREATE INDEX idx_news_published
ON news(published_at DESC);

news_images
CREATE TABLE news_images
(
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    news_id             BIGINT NOT NULL,

    media_asset_id      BIGINT NOT NULL,

    caption             VARCHAR(500),

    display_order       INTEGER NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_news_images_news
        FOREIGN KEY(news_id)
        REFERENCES news(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_news_images_media
        FOREIGN KEY(media_asset_id)
        REFERENCES media_assets(id)

);

CREATE INDEX idx_news_images_news
ON news_images(news_id);

related_news
CREATE TABLE related_news
(
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    news_id                 BIGINT NOT NULL,

    related_news_id         BIGINT NOT NULL,

    display_order           INTEGER NOT NULL DEFAULT 0,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_related_news
        FOREIGN KEY(news_id)
        REFERENCES news(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_related_news_item
        FOREIGN KEY(related_news_id)
        REFERENCES news(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_related_news
        UNIQUE(news_id, related_news_id)

);

Users
│
├──────────────┐
│ │
Drafted By Approved By
│
▼
News
│
├──────────── Category
│
├──────────── Country
│
├──────────── State
│
├──────────── District
│
├──────────── List Image
│
├──────────── Detail Image
│
├──────────── Additional Images
│
└──────────── Related News

site_visits
CREATE TABLE site_visits
(
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    session_id          VARCHAR(200) NOT NULL,

    landing_page        TEXT NOT NULL,

    referrer            TEXT,

    country             VARCHAR(100),

    state               VARCHAR(100),

    district            VARCHAR(100),

    city                VARCHAR(100),

    ip_hash             VARCHAR(128),

    browser             VARCHAR(100),

    operating_system    VARCHAR(100),

    device_type         VARCHAR(30),

    visited_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

CREATE TABLE news_reads
(
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    news_id                 BIGINT NOT NULL,

    session_id              VARCHAR(200) NOT NULL,

    country                 VARCHAR(100),

    state                   VARCHAR(100),

    district                VARCHAR(100),

    city                    VARCHAR(100),

    browser                 VARCHAR(100),

    operating_system        VARCHAR(100),

    device_type             VARCHAR(30),

    read_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_news_reads_news
        FOREIGN KEY(news_id)
        REFERENCES news(id)
        ON DELETE CASCADE

);

CREATE INDEX idx_news_reads_news
ON news_reads(news_id);

CREATE INDEX idx_news_reads_session
ON news_reads(session_id);

CREATE INDEX idx_news_reads_date
ON news_reads(read_at DESC);

CREATE INDEX idx_site_visits_session
ON site_visits(session_id);

CREATE INDEX idx_site_visits_date
ON site_visits(visited_at DESC);
