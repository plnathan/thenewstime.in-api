CREATE TABLE IF NOT EXISTS advertisement_impressions (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,

    advertisement_id bigint NOT NULL,
    placement_id bigint,
    placement_rule_id bigint,
    schedule_id bigint,
    creative_id bigint,

    page_type character varying(30) NOT NULL,

    session_id character varying(200),
    visitor_id uuid,

    ip_hash character varying(128),

    browser character varying(150),
    operating_system character varying(150),
    device_type character varying(50),

    user_agent text,
    page_url text,
    referrer_url text,

    impression_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT advertisement_impressions_pkey
        PRIMARY KEY (id),

    CONSTRAINT advertisement_impressions_advertisement_fk
        FOREIGN KEY (advertisement_id)
        REFERENCES advertisements (id)
        ON DELETE RESTRICT,

    CONSTRAINT advertisement_impressions_placement_fk
        FOREIGN KEY (placement_id)
        REFERENCES advertisement_placements (id)
        ON DELETE SET NULL,

    CONSTRAINT advertisement_impressions_placement_rule_fk
        FOREIGN KEY (placement_rule_id)
        REFERENCES advertisement_placement_rules (id)
        ON DELETE SET NULL,

    CONSTRAINT advertisement_impressions_schedule_fk
        FOREIGN KEY (schedule_id)
        REFERENCES advertisement_schedules (id)
        ON DELETE SET NULL,

    CONSTRAINT advertisement_impressions_creative_fk
        FOREIGN KEY (creative_id)
        REFERENCES advertisement_creatives (id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_advertisement_impressions_advertisement_at
    ON advertisement_impressions (advertisement_id, impression_at DESC);

CREATE INDEX IF NOT EXISTS idx_advertisement_impressions_schedule_at
    ON advertisement_impressions (schedule_id, impression_at DESC);

CREATE INDEX IF NOT EXISTS idx_advertisement_impressions_placement_at
    ON advertisement_impressions (placement_id, impression_at DESC);

CREATE INDEX IF NOT EXISTS idx_advertisement_impressions_creative_at
    ON advertisement_impressions (creative_id, impression_at DESC);

CREATE INDEX IF NOT EXISTS idx_advertisement_impressions_visitor_at
    ON advertisement_impressions (visitor_id, impression_at DESC);

CREATE TABLE IF NOT EXISTS advertisement_clicks (
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,

    advertisement_id bigint NOT NULL,
    placement_id bigint,
    placement_rule_id bigint,
    schedule_id bigint,
    creative_id bigint,

    page_type character varying(30) NOT NULL,

    session_id character varying(200),
    visitor_id uuid,

    ip_hash character varying(128),

    browser character varying(150),
    operating_system character varying(150),
    device_type character varying(50),

    user_agent text,
    page_url text,
    referrer_url text,

    click_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT advertisement_clicks_pkey
        PRIMARY KEY (id),

    CONSTRAINT advertisement_clicks_advertisement_fk
        FOREIGN KEY (advertisement_id)
        REFERENCES advertisements (id)
        ON DELETE RESTRICT,

    CONSTRAINT advertisement_clicks_placement_fk
        FOREIGN KEY (placement_id)
        REFERENCES advertisement_placements (id)
        ON DELETE SET NULL,

    CONSTRAINT advertisement_clicks_placement_rule_fk
        FOREIGN KEY (placement_rule_id)
        REFERENCES advertisement_placement_rules (id)
        ON DELETE SET NULL,

    CONSTRAINT advertisement_clicks_schedule_fk
        FOREIGN KEY (schedule_id)
        REFERENCES advertisement_schedules (id)
        ON DELETE SET NULL,

    CONSTRAINT advertisement_clicks_creative_fk
        FOREIGN KEY (creative_id)
        REFERENCES advertisement_creatives (id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_advertisement_clicks_advertisement_at
    ON advertisement_clicks (advertisement_id, click_at DESC);

CREATE INDEX IF NOT EXISTS idx_advertisement_clicks_schedule_at
    ON advertisement_clicks (schedule_id, click_at DESC);

CREATE INDEX IF NOT EXISTS idx_advertisement_clicks_placement_at
    ON advertisement_clicks (placement_id, click_at DESC);

CREATE INDEX IF NOT EXISTS idx_advertisement_clicks_creative_at
    ON advertisement_clicks (creative_id, click_at DESC);

CREATE INDEX IF NOT EXISTS idx_advertisement_clicks_visitor_at
    ON advertisement_clicks (visitor_id, click_at DESC);
    