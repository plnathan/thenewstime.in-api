/****************************************************************************************
 Project     : thenewstime.in
 File        : 003_create_master_tables.sql
 Description : Master Tables
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    -----------------------------------------------------------------------------------------
    -- COUNTRIES
    -----------------------------------------------------------------------------------------

    CREATE TABLE countries
(
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR (30) NOT NULL UNIQUE,

    display_name        VARCHAR
    (100) NOT NULL,
    url_name            VARCHAR
    (100) NOT NULL,

    iso_code            VARCHAR
    (5),

    display_order       INTEGER NOT NULL DEFAULT 0,

    status               country_status NOT NULL DEFAULT 'ACTIVE',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW
    (),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW
    (),

    CONSTRAINT uq_countries_display_name
        UNIQUE
    (display_name),

    CONSTRAINT uq_countries_url_name
        UNIQUE
    (url_name),

    CONSTRAINT uq_countries_iso_code
        UNIQUE
    (iso_code)
);

COMMENT ON TABLE countries IS
'Master table for countries.';

COMMENT ON COLUMN countries.url_name IS
'URL friendly value used in routing.';

-----------------------------------------------------------------------------------------
-- STATES
-----------------------------------------------------------------------------------------

CREATE TABLE states
(
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    country_id          INTEGER NOT NULL,
code VARCHAR
(30) NOT NULL UNIQUE,
    display_name        VARCHAR
(100) NOT NULL,

    url_name            VARCHAR
(100) NOT NULL,

    display_order       INTEGER NOT NULL DEFAULT 0,

    status              state_status NOT NULL DEFAULT 'ACTIVE',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW
(),

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW
(),

    CONSTRAINT fk_states_country
        FOREIGN KEY
(country_id)
        REFERENCES countries
(id),

    CONSTRAINT uq_states_country_display_name
        UNIQUE
(country_id, display_name),

    CONSTRAINT uq_states_country_url_name
        UNIQUE
(country_id, url_name)
);

COMMENT ON TABLE states IS
'Master table for states.';

-----------------------------------------------------------------------------------------
-- DISTRICTS
-----------------------------------------------------------------------------------------

CREATE TABLE districts
(
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    state_id            INTEGER NOT NULL,
code VARCHAR
(30) NOT NULL UNIQUE,
    display_name        VARCHAR
(100) NOT NULL,

    url_name            VARCHAR
(100) NOT NULL,

    display_order       INTEGER NOT NULL DEFAULT 0,

    status              district_status NOT NULL DEFAULT 'ACTIVE',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW
(),

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW
(),

    CONSTRAINT fk_districts_state
        FOREIGN KEY
(state_id)
        REFERENCES states
(id),

    CONSTRAINT uq_district_state_display_name
        UNIQUE
(state_id, display_name),

    CONSTRAINT uq_district_state_url_name
        UNIQUE
(state_id, url_name)
);

COMMENT ON TABLE districts IS
'Master table for districts.';

-----------------------------------------------------------------------------------------
-- CATEGORIES
-----------------------------------------------------------------------------------------

CREATE TABLE categories
(
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
code VARCHAR
(30) NOT NULL UNIQUE,
    display_name        VARCHAR
(100) NOT NULL,

    url_name            VARCHAR
(100) NOT NULL,

    description         VARCHAR
(500),

    display_order       INTEGER NOT NULL DEFAULT 0,

    status              category_status NOT NULL DEFAULT 'ACTIVE',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW
(),

    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW
(),

    CONSTRAINT uq_categories_display_name
        UNIQUE
(display_name),

    CONSTRAINT uq_categories_url_name
        UNIQUE
(url_name)
);

COMMENT ON TABLE categories IS
'News categories.';

-----------------------------------------------------------------------------------------
-- INDEXES
-----------------------------------------------------------------------------------------

CREATE INDEX idx_states_country
ON states(country_id);

CREATE INDEX idx_states_url_name
ON states(url_name);

CREATE INDEX idx_states_display_order
ON states(display_order);

CREATE INDEX idx_districts_state
ON districts(state_id);

CREATE INDEX idx_districts_url_name
ON districts(url_name);

CREATE INDEX idx_districts_display_order
ON districts(display_order);

CREATE INDEX idx_categories_url_name
ON categories(url_name);

CREATE INDEX idx_categories_display_order
ON categories(display_order);

CREATE INDEX idx_countries_url_name
ON countries(url_name);

CREATE INDEX idx_countries_display_order
ON countries(display_order);

COMMIT;