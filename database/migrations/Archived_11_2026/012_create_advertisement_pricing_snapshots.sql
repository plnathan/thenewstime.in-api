BEGIN;

-- ============================================================
-- THE NEWS TIME
-- Advertisement Management - Phase 8C-4
--
-- PRICING SNAPSHOT
--
-- A pricing snapshot stores the exact rate-card information
-- used when an advertisement is priced.
--
-- Purpose:
--   Rate Card
--       ↓
--   Pricing Snapshot
--       ↓
--   Standard Amount
--       ↓
--   Agreed Amount
--
-- Important:
--   - Snapshot values are copied from the rate card.
--   - Later rate-card changes must not alter the snapshot.
--   - agreed_amount remains on advertisements.
--   - Standard amount calculation is implemented separately.
-- ============================================================


CREATE TABLE IF NOT EXISTS advertisement_pricing_snapshots (
    id BIGSERIAL PRIMARY KEY,

    advertisement_id BIGINT NOT NULL,

    placement_id BIGINT NOT NULL,

    rate_card_id BIGINT NOT NULL,

    pricing_unit VARCHAR(30) NOT NULL,

    rate_amount NUMERIC(14, 2) NOT NULL,

    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',

    rate_effective_from TIMESTAMPTZ NOT NULL,

    rate_effective_to TIMESTAMPTZ,

    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_by BIGINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT advertisement_pricing_snapshots_advertisement_fk
        FOREIGN KEY (advertisement_id)
        REFERENCES advertisements(id)
        ON DELETE RESTRICT,

    CONSTRAINT advertisement_pricing_snapshots_placement_fk
        FOREIGN KEY (placement_id)
        REFERENCES advertisement_placements(id)
        ON DELETE RESTRICT,

    CONSTRAINT advertisement_pricing_snapshots_rate_card_fk
        FOREIGN KEY (rate_card_id)
        REFERENCES advertisement_rate_cards(id)
        ON DELETE RESTRICT,

    CONSTRAINT advertisement_pricing_snapshots_created_by_fk
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT advertisement_pricing_snapshots_rate_amount_check
        CHECK (rate_amount >= 0),

    CONSTRAINT advertisement_pricing_snapshots_currency_code_check
        CHECK (char_length(currency_code) = 3),

    CONSTRAINT advertisement_pricing_snapshots_pricing_unit_check
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

    CONSTRAINT advertisement_pricing_snapshots_effective_period_check
        CHECK (
            rate_effective_to IS NULL
            OR rate_effective_to > rate_effective_from
        )
);

ALTER TABLE public.advertisement_pricing_snapshots
ADD COLUMN IF NOT EXISTS quantity NUMERIC(14,4),
ADD COLUMN IF NOT EXISTS standard_amount NUMERIC(14,2);

ALTER TABLE public.advertisement_pricing_snapshots
DROP CONSTRAINT IF EXISTS chk_advertisement_pricing_snapshots_quantity;

ALTER TABLE public.advertisement_pricing_snapshots
ADD CONSTRAINT chk_advertisement_pricing_snapshots_quantity
CHECK (quantity IS NULL OR quantity > 0);

ALTER TABLE public.advertisement_pricing_snapshots
DROP CONSTRAINT IF EXISTS chk_advertisement_pricing_snapshots_standard_amount;

ALTER TABLE public.advertisement_pricing_snapshots
ADD CONSTRAINT chk_advertisement_pricing_snapshots_standard_amount
CHECK (standard_amount IS NULL OR standard_amount >= 0);

CREATE INDEX IF NOT EXISTS
    idx_advertisement_pricing_snapshots_advertisement
    ON advertisement_pricing_snapshots (advertisement_id);


CREATE INDEX IF NOT EXISTS
    idx_advertisement_pricing_snapshots_placement
    ON advertisement_pricing_snapshots (placement_id);


CREATE INDEX IF NOT EXISTS
    idx_advertisement_pricing_snapshots_rate_card
    ON advertisement_pricing_snapshots (rate_card_id);


CREATE INDEX IF NOT EXISTS
    idx_advertisement_pricing_snapshots_snapshot_at
    ON advertisement_pricing_snapshots (snapshot_at DESC);


CREATE INDEX IF NOT EXISTS
    idx_advertisement_pricing_snapshots_advertisement_snapshot
    ON advertisement_pricing_snapshots (
        advertisement_id,
        snapshot_at DESC,
        id DESC
    );


COMMENT ON TABLE advertisement_pricing_snapshots IS
    'Immutable historical snapshot of the rate-card values used for advertisement pricing.';


COMMENT ON COLUMN advertisement_pricing_snapshots.rate_card_id IS
    'Source rate card from which the pricing values were captured.';


COMMENT ON COLUMN advertisement_pricing_snapshots.pricing_unit IS
    'Pricing unit copied from the source rate card.';


COMMENT ON COLUMN advertisement_pricing_snapshots.rate_amount IS
    'Rate amount copied from the source rate card at snapshot creation time.';


COMMENT ON COLUMN advertisement_pricing_snapshots.currency_code IS
    'Currency copied from the source rate card at snapshot creation time.';


COMMENT ON COLUMN advertisement_pricing_snapshots.rate_effective_from IS
    'Effective-from timestamp copied from the source rate card.';


COMMENT ON COLUMN advertisement_pricing_snapshots.rate_effective_to IS
    'Effective-to timestamp copied from the source rate card.';


COMMENT ON COLUMN advertisement_pricing_snapshots.snapshot_at IS
    'Timestamp when the pricing values were captured.';


COMMENT ON COLUMN advertisement_pricing_snapshots.created_by IS
    'User who created the pricing snapshot.';


COMMIT;