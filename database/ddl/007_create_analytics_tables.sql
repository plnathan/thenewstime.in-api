/****************************************************************************************
 Project     : thenewstime.in
 File        : 007_create_analytics_tables.sql
 Description : Analytics Tables
 Version     : 1.0
 Database    : PostgreSQL 16+
****************************************************************************************/

BEGIN;

    -----------------------------------------------------------------------------------------
    -- SITE VISITS
    -----------------------------------------------------------------------------------------

    CREATE TABLE site_visits
(
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    session_id              VARCHAR
    (200) NOT NULL,

    visitor_id              UUID,

    landing_page            VARCHAR
    (1000) NOT NULL,

    referrer                VARCHAR
    (1000),

    ip_hash                 VARCHAR
    (255),

    country                 VARCHAR
    (100),

    state                   VARCHAR
    (100),

    district                VARCHAR
    (100),

    city                    VARCHAR
    (100),

    browser                 VARCHAR
    (150),

    operating_system        VARCHAR
    (150),

    device_type             VARCHAR
    (50),

    user_agent              TEXT,

    visited_at              TIMESTAMPTZ NOT NULL DEFAULT NOW
    ()
);

COMMENT ON TABLE site_visits IS
'Stores every website visit.';

-----------------------------------------------------------------------------------------
-- NEWS READS
-----------------------------------------------------------------------------------------

CREATE TABLE news_reads
(
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    news_id                 BIGINT NOT NULL,

    session_id              VARCHAR
(200) NOT NULL,

    visitor_id              UUID,

    ip_hash                 VARCHAR
(255),

    country                 VARCHAR
(100),

    state                   VARCHAR
(100),

    district                VARCHAR
(100),

    city                    VARCHAR
(100),

    browser                 VARCHAR
(150),

    operating_system        VARCHAR
(150),

    device_type             VARCHAR
(50),

    user_agent              TEXT,

    read_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW
(),

    CONSTRAINT fk_news_reads_news
        FOREIGN KEY
(news_id)
        REFERENCES news
(id)
        ON
DELETE CASCADE
);

COMMENT ON TABLE news_reads IS
'Stores every article read.';

-----------------------------------------------------------------------------------------
-- INDEXES : SITE VISITS
-----------------------------------------------------------------------------------------

CREATE INDEX idx_site_visits_session
ON site_visits(session_id);

CREATE INDEX idx_site_visits_visited_at
ON site_visits(visited_at DESC);

CREATE INDEX idx_site_visits_country
ON site_visits(country);

CREATE INDEX idx_site_visits_state
ON site_visits(state);

CREATE INDEX idx_site_visits_district
ON site_visits(district);

CREATE INDEX idx_site_visits_device
ON site_visits(device_type);

-----------------------------------------------------------------------------------------
-- INDEXES : NEWS READS
-----------------------------------------------------------------------------------------

CREATE INDEX idx_news_reads_news
ON news_reads(news_id);

CREATE INDEX idx_news_reads_session
ON news_reads(session_id);

CREATE INDEX idx_news_reads_read_at
ON news_reads(read_at DESC);

CREATE INDEX idx_news_reads_country
ON news_reads(country);

CREATE INDEX idx_news_reads_state
ON news_reads(state);

CREATE INDEX idx_news_reads_district
ON news_reads(district);

CREATE INDEX idx_news_reads_device
ON news_reads(device_type);

COMMIT;