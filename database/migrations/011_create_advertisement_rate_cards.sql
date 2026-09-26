-- ============================================================
-- Advertisement Pricing Architecture
-- Phase 8C-1: Rate Card Database Foundation
--
-- Purpose:
--   Stores system-defined advertisement pricing by placement.
--
-- Important:
--   - Rate cards are system-managed.
--   - Ad Creators do not enter the standard rate directly.
--   - Historical rates remain preserved.
--   - Effective dates prevent future pricing from altering
--     already-created pricing history.
--   - Negotiated/agreed amount remains separate from rate card
--     pricing and is NOT modified by this migration.
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_rate_cards (
    id BIGSERIAL PRIMARY KEY,

    placement_id BIGINT NOT NULL,

    pricing_unit VARCHAR(30) NOT NULL,

    rate_amount NUMERIC(14, 2) NOT NULL,

    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',

    effective_from TIMESTAMPTZ NOT NULL,

    effective_to TIMESTAMPTZ,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_by BIGINT NOT NULL,

    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT advertisement_rate_cards_placement_fk
        FOREIGN KEY (placement_id)
        REFERENCES advertisement_placements(id)
        ON DELETE RESTRICT,

    CONSTRAINT advertisement_rate_cards_created_by_fk
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT advertisement_rate_cards_updated_by_fk
        FOREIGN KEY (updated_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT advertisement_rate_cards_rate_amount_check
        CHECK (rate_amount >= 0),

    CONSTRAINT advertisement_rate_cards_currency_code_check
        CHECK (char_length(currency_code) = 3),

    CONSTRAINT advertisement_rate_cards_pricing_unit_check
        CHECK (
            pricing_unit IN (
                'DAY',
                'WEEK',
                'MONTH',
                'IMPRESSION',
                'CAMPAIGN',
                'FIXED'
            )
        ),

    CONSTRAINT advertisement_rate_cards_status_check
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'ARCHIVED'
            )
        ),

    CONSTRAINT advertisement_rate_cards_effective_period_check
        CHECK (
            effective_to IS NULL
            OR effective_to > effective_from
        )
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_rate_cards_placement
    ON advertisement_rate_cards (placement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_rate_cards_status
    ON advertisement_rate_cards (status);

CREATE INDEX IF NOT EXISTS idx_advertisement_rate_cards_effective_from
    ON advertisement_rate_cards (effective_from);

CREATE INDEX IF NOT EXISTS idx_advertisement_rate_cards_placement_effective
    ON advertisement_rate_cards (
        placement_id,
        effective_from,
        effective_to
    );

-- ============================================================
-- Prevent overlapping ACTIVE rate-card periods for the same
-- placement and pricing unit.
--
-- PostgreSQL EXCLUDE constraint is used instead of application-
-- only validation so concurrent inserts cannot create two
-- active rates for the same period.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE advertisement_rate_cards
    ADD CONSTRAINT advertisement_rate_cards_no_active_overlap
    EXCLUDE USING gist (
        placement_id WITH =,
        pricing_unit WITH =,
        tstzrange(
            effective_from,
            COALESCE(effective_to, 'infinity'::timestamptz),
            '[)'
        ) WITH &&
    )
    WHERE (status = 'ACTIVE');

-- ============================================================
-- Documentation
-- ============================================================

COMMENT ON TABLE advertisement_rate_cards IS
    'System-defined advertisement pricing rate cards by placement and pricing unit.';

COMMENT ON COLUMN advertisement_rate_cards.placement_id IS
    'Advertisement placement to which this rate applies.';

COMMENT ON COLUMN advertisement_rate_cards.pricing_unit IS
    'Unit used to calculate the standard advertisement amount.';

COMMENT ON COLUMN advertisement_rate_cards.rate_amount IS
    'System-defined rate for one pricing unit.';

COMMENT ON COLUMN advertisement_rate_cards.currency_code IS
    'ISO 4217 currency code for the rate.';

COMMENT ON COLUMN advertisement_rate_cards.effective_from IS
    'Timestamp from which this rate becomes applicable.';

COMMENT ON COLUMN advertisement_rate_cards.effective_to IS
    'Timestamp until which this rate remains applicable. NULL means no scheduled end.';

COMMENT ON COLUMN advertisement_rate_cards.status IS
    'Lifecycle status of the rate card.';

COMMENT ON COLUMN advertisement_rate_cards.created_by IS
    'User who created the rate card.';

COMMENT ON COLUMN advertisement_rate_cards.updated_by IS
    'User who most recently updated the rate card.';