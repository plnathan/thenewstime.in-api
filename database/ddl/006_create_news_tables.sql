CREATE TABLE news
(
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    news_number             BIGINT NOT NULL
                                DEFAULT nextval('news_number_seq'),

    title                   VARCHAR(1000) NOT NULL,

    slug                    VARCHAR(300) NOT NULL,

    summary                 TEXT,

    content                 TEXT NOT NULL,

    news_scope              news_scope NOT NULL,

    country_id              INTEGER,

    state_id                INTEGER,

    district_id             INTEGER,

    category_id             INTEGER NOT NULL,

    status                  news_status NOT NULL DEFAULT 'DRAFT',

    drafted_by              BIGINT NOT NULL,

    approved_by             BIGINT,

    published_by            BIGINT,

    drafted_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    approved_at             TIMESTAMPTZ,

    published_at            TIMESTAMPTZ,

    created_by              BIGINT NOT NULL,

    updated_by              BIGINT,

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

    CONSTRAINT fk_news_drafted_by
        FOREIGN KEY(drafted_by)
        REFERENCES users(id),

    CONSTRAINT fk_news_approved_by
        FOREIGN KEY(approved_by)
        REFERENCES users(id),

    CONSTRAINT fk_news_published_by
        FOREIGN KEY(published_by)
        REFERENCES users(id),

    CONSTRAINT fk_news_created_by
        FOREIGN KEY(created_by)
        REFERENCES users(id),

    CONSTRAINT fk_news_updated_by
        FOREIGN KEY(updated_by)
        REFERENCES users(id)
);

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

CREATE INDEX idx_news_slug
ON news(slug);

CREATE INDEX idx_news_home_page
ON news
(
    status,
    published_at DESC
);

CREATE INDEX idx_news_category_page
ON news
(
    category_id,
    published_at DESC
);

CREATE INDEX idx_news_state_page
ON news
(
    state_id,
    published_at DESC
);

CREATE INDEX idx_news_district_page
ON news
(
    district_id,
    published_at DESC
);

