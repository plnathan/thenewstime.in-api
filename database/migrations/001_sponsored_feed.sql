-- Additive foundation only. Run on development/UAT first.

BEGIN;

CREATE TABLE public.advertisement_card_contents (
    advertisement_id bigint PRIMARY KEY
        REFERENCES public.advertisements(id) ON DELETE CASCADE,

    headline varchar(250),
    description varchar(1000),
    sponsor_display_name varchar(200),
    cta_label varchar(80),

    image_url text,
    headline_url text,
    description_url text,
    sponsor_url text,
    cta_url text,

    created_by bigint REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_by bigint REFERENCES public.users(id),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (image_url IS NULL OR image_url ~* '^https?://[^[:space:]]+$'),
    CHECK (headline_url IS NULL OR headline_url ~* '^https?://[^[:space:]]+$'),
    CHECK (description_url IS NULL OR description_url ~* '^https?://[^[:space:]]+$'),
    CHECK (sponsor_url IS NULL OR sponsor_url ~* '^https?://[^[:space:]]+$'),
    CHECK (cta_url IS NULL OR cta_url ~* '^https?://[^[:space:]]+$')
);

COMMENT ON COLUMN public.advertisement_card_contents.image_url
IS 'Click destination, not creative media URL; media remains in advertisement_creatives.';


CREATE TABLE public.advertisement_feed_batches (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    code varchar(100) NOT NULL UNIQUE,
    display_name varchar(150) NOT NULL,
    batch_order integer NOT NULL UNIQUE CHECK (batch_order > 0),

    pricing_placement_id bigint NOT NULL UNIQUE
        REFERENCES public.advertisement_placements(id),

    is_enabled boolean NOT NULL DEFAULT false,

    created_by bigint REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_by bigint REFERENCES public.users(id),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE public.advertisement_feed_assignments (
    advertisement_id bigint PRIMARY KEY
        REFERENCES public.advertisement_card_contents(advertisement_id)
        ON DELETE CASCADE,

    batch_id bigint NOT NULL
        REFERENCES public.advertisement_feed_batches(id),

    batch_assigned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    activated_at timestamptz,

    assigned_by bigint REFERENCES public.users(id),

    created_by bigint REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_by bigint REFERENCES public.users(id),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX idx_feed_assignments_batch_order
ON public.advertisement_feed_assignments(
    batch_id,
    batch_assigned_at,
    advertisement_id
);


CREATE TABLE public.advertisement_feed_upgrades (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    request_id uuid NOT NULL,

    advertisement_id bigint NOT NULL
        REFERENCES public.advertisement_feed_assignments(advertisement_id),

    source_batch_id bigint NOT NULL
        REFERENCES public.advertisement_feed_batches(id),

    target_batch_id bigint NOT NULL
        REFERENCES public.advertisement_feed_batches(id),

    source_rate_card_id bigint NOT NULL
        REFERENCES public.advertisement_rate_cards(id),

    target_rate_card_id bigint NOT NULL
        REFERENCES public.advertisement_rate_cards(id),

    source_rate_amount numeric(14,2) NOT NULL
        CHECK (source_rate_amount >= 0),

    target_rate_amount numeric(14,2) NOT NULL
        CHECK (target_rate_amount >= 0),

    additional_amount numeric(14,2) NOT NULL
        CHECK (additional_amount >= 0),

    currency_code char(3) NOT NULL,

    financial_approval_id bigint UNIQUE
        REFERENCES public.advertisement_financial_approvals(id),

    status varchar(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPLIED', 'CANCELLED', 'REJECTED')),

    requested_at timestamptz NOT NULL DEFAULT now(),
    requested_by bigint NOT NULL REFERENCES public.users(id),

    applied_at timestamptz,
    applied_by bigint REFERENCES public.users(id),

    created_by bigint REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_by bigint REFERENCES public.users(id),
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (request_id, advertisement_id),

    CHECK (source_batch_id <> target_batch_id),

    CHECK (
        status <> 'APPLIED'
        OR (applied_at IS NOT NULL AND applied_by IS NOT NULL)
    )
);


CREATE UNIQUE INDEX uq_feed_pending_upgrade
ON public.advertisement_feed_upgrades(advertisement_id)
WHERE status = 'PENDING';


ALTER TABLE public.advertisement_impressions

    ADD COLUMN feed_batch_id bigint
        REFERENCES public.advertisement_feed_batches(id),

    ADD COLUMN feed_position smallint
        CHECK (feed_position BETWEEN 1 AND 6),

    ADD CONSTRAINT chk_impression_feed_context
        CHECK (
            (feed_batch_id IS NULL) = (feed_position IS NULL)
        );


ALTER TABLE public.advertisement_clicks

    ADD COLUMN feed_batch_id bigint
        REFERENCES public.advertisement_feed_batches(id),

    ADD COLUMN feed_position smallint
        CHECK (feed_position BETWEEN 1 AND 6),

    ADD COLUMN feed_element varchar(20)
        CHECK (
            feed_element IN (
                'IMAGE',
                'HEADLINE',
                'DESCRIPTION',
                'SPONSOR',
                'CTA'
            )
        ),

    ADD CONSTRAINT chk_click_feed_context
        CHECK (
            (
                feed_batch_id IS NULL
                AND feed_position IS NULL
                AND feed_element IS NULL
            )
            OR
            (
                feed_batch_id IS NOT NULL
                AND feed_position IS NOT NULL
                AND feed_element IS NOT NULL
            )
        );

COMMIT;