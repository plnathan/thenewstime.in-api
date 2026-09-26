BEGIN;

-- ============================================================
-- PHASE 8A
-- Advertisement Payment Management - Database Foundation
-- ============================================================


-- ============================================================
-- 1. advertisements
-- ============================================================

-- Rename the existing agreed amount column to the preferred
-- business terminology.
ALTER TABLE public.advertisements
    RENAME COLUMN agreed_amount TO advertisement_amount;


-- Rename the existing check constraint to match the new
-- column/business terminology.
ALTER TABLE public.advertisements
    RENAME CONSTRAINT advertisements_agreed_amount_check
    TO advertisements_advertisement_amount_check;


-- ------------------------------------------------------------
-- Discount
-- ------------------------------------------------------------

ALTER TABLE public.advertisements
    ADD COLUMN IF NOT EXISTS discount_percentage numeric(5,2)
        NOT NULL DEFAULT 0,

    ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2)
        NOT NULL DEFAULT 0;


-- ------------------------------------------------------------
-- Advance
-- ------------------------------------------------------------

ALTER TABLE public.advertisements
    ADD COLUMN IF NOT EXISTS advance_percentage numeric(5,2)
        NOT NULL DEFAULT 0,

    ADD COLUMN IF NOT EXISTS advance_amount numeric(14,2)
        NOT NULL DEFAULT 0;


-- ------------------------------------------------------------
-- Adjustment
-- ------------------------------------------------------------

ALTER TABLE public.advertisements
    ADD COLUMN IF NOT EXISTS adjustment_amount numeric(14,2)
        NOT NULL DEFAULT 0,

    ADD COLUMN IF NOT EXISTS adjustment_reason text,

    ADD COLUMN IF NOT EXISTS adjustment_by bigint,

    ADD COLUMN IF NOT EXISTS adjustment_at timestamp with time zone;


-- ============================================================
-- 2. advertisement_payments
-- ============================================================

ALTER TABLE public.advertisement_payments
    ADD COLUMN IF NOT EXISTS payment_type character varying(20)
        NOT NULL DEFAULT 'REGULAR';


-- ============================================================
-- 3. advertisement_clients
-- ============================================================

ALTER TABLE public.advertisement_clients
    ADD COLUMN IF NOT EXISTS payment_attention_required boolean
        NOT NULL DEFAULT false;


-- ============================================================
-- 4. advertisements - validation constraints
-- ============================================================

ALTER TABLE public.advertisements
    ADD CONSTRAINT advertisements_discount_percentage_check
    CHECK (
        discount_percentage >= 0
        AND discount_percentage <= 100
    );


ALTER TABLE public.advertisements
    ADD CONSTRAINT advertisements_discount_amount_check
    CHECK (
        discount_amount >= 0
        AND (
            advertisement_amount IS NULL
            OR discount_amount <= advertisement_amount
        )
    );


ALTER TABLE public.advertisements
    ADD CONSTRAINT advertisements_advance_percentage_check
    CHECK (
        advance_percentage >= 0
        AND advance_percentage <= 100
    );


ALTER TABLE public.advertisements
    ADD CONSTRAINT advertisements_advance_amount_check
    CHECK (
        advance_amount >= 0
        AND (
            advertisement_amount IS NULL
            OR advance_amount <= (
                advertisement_amount - discount_amount
            )
        )
    );


ALTER TABLE public.advertisements
    ADD CONSTRAINT advertisements_adjustment_amount_check
    CHECK (
        adjustment_amount >= 0
        AND (
            advertisement_amount IS NULL
            OR adjustment_amount <= (
                advertisement_amount - discount_amount
            )
        )
    );


-- ============================================================
-- 5. advertisement_payments - validation constraint
-- ============================================================

ALTER TABLE public.advertisement_payments
    ADD CONSTRAINT advertisement_payments_type_check
    CHECK (
        payment_type IN ('ADVANCE', 'REGULAR')
    );


-- ============================================================
-- 6. Indexes for payment calculations
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_advertisement_status
    ON public.advertisement_payments (
        advertisement_id,
        payment_status
    );


CREATE INDEX IF NOT EXISTS idx_advertisement_payments_advertisement_type_status
    ON public.advertisement_payments (
        advertisement_id,
        payment_type,
        payment_status
    );


CREATE INDEX IF NOT EXISTS idx_advertisements_payment_amounts
    ON public.advertisements (
        id,
        advertisement_amount,
        discount_amount,
        adjustment_amount
    );


CREATE INDEX IF NOT EXISTS idx_advertisement_clients_payment_attention
    ON public.advertisement_clients (
        payment_attention_required
    );


-- ============================================================
-- 7. Data normalization
-- ============================================================

-- Existing advertisements had no discount or advance information.
-- The defaults above therefore represent the existing state.

UPDATE public.advertisements
SET
    discount_percentage = 0,
    discount_amount = 0,
    advance_percentage = 0,
    advance_amount = 0,
    adjustment_amount = 0
WHERE
    discount_percentage IS NULL
    OR discount_amount IS NULL
    OR advance_percentage IS NULL
    OR advance_amount IS NULL
    OR adjustment_amount IS NULL;


-- Existing payments are treated as regular payments.
UPDATE public.advertisement_payments
SET payment_type = 'REGULAR'
WHERE payment_type IS NULL;


-- Existing clients are not marked for payment attention.
UPDATE public.advertisement_clients
SET payment_attention_required = false
WHERE payment_attention_required IS NULL;


COMMIT;