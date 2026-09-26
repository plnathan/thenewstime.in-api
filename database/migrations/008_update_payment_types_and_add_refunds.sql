-- ============================================================================
-- Advertisement Payment Management - 8B
-- Migration: Update payment types and add refund tracking
--
-- Existing table:
--   public.advertisement_payments
--
-- Design:
--   - ADVANCE / REGULAR / FINAL / INSTALLMENT are payment types.
--   - Full refunds may transition the payment to REFUNDED.
--   - Partial refunds are recorded separately in advertisement_payment_refunds.
--   - The original payment remains VERIFIED when only part of it is refunded.
-- ============================================================================


-- ============================================================================
-- 1. Replace the existing payment_type CHECK constraint
-- ============================================================================

ALTER TABLE public.advertisement_payments
    DROP CONSTRAINT IF EXISTS advertisement_payments_type_check;

ALTER TABLE public.advertisement_payments
    ADD CONSTRAINT advertisement_payments_type_check
    CHECK (
        payment_type::text = ANY (
            ARRAY[
                'ADVANCE'::character varying,
                'REGULAR'::character varying,
                'FINAL'::character varying,
                'INSTALLMENT'::character varying
            ]::text[]
        )
    );


-- ============================================================================
-- 2. Add cancellation audit fields to advertisement_payments
-- ============================================================================

ALTER TABLE public.advertisement_payments
    ADD COLUMN IF NOT EXISTS cancelled_by bigint;

ALTER TABLE public.advertisement_payments
    ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;

ALTER TABLE public.advertisement_payments
    ADD COLUMN IF NOT EXISTS cancellation_reason text;


-- ============================================================================
-- 3. Add full-refund audit fields to advertisement_payments
--
-- These fields are used when the entire payment is refunded.
--
-- Partial refunds are stored in advertisement_payment_refunds instead.
-- ============================================================================

ALTER TABLE public.advertisement_payments
    ADD COLUMN IF NOT EXISTS refunded_by bigint;

ALTER TABLE public.advertisement_payments
    ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone;

ALTER TABLE public.advertisement_payments
    ADD COLUMN IF NOT EXISTS refund_reference character varying(150);

ALTER TABLE public.advertisement_payments
    ADD COLUMN IF NOT EXISTS refund_reason text;


-- ============================================================================
-- 4. Create partial/full refund transaction table
--
-- One payment can have multiple refund records.
--
-- Example:
--
--   Payment #101
--   Amount: ₹50,000
--   Status: VERIFIED
--
--   Refund #1: ₹10,000
--   Refund #2: ₹5,000
--
--   Net received = ₹35,000
--
-- The original payment remains VERIFIED until the entire amount has been
-- refunded. At that point the payment may be changed to REFUNDED.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.advertisement_payment_refunds
(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY,

    payment_id bigint NOT NULL,

    amount numeric(14,2) NOT NULL,

    refund_date timestamp with time zone NOT NULL DEFAULT now(),

    refund_reference character varying(150),

    refund_reason text,

    refunded_by bigint,

    created_at timestamp with time zone NOT NULL DEFAULT now(),

    updated_at timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT advertisement_payment_refunds_pkey
        PRIMARY KEY (id),

    CONSTRAINT fk_advertisement_payment_refunds_payment
        FOREIGN KEY (payment_id)
        REFERENCES public.advertisement_payments (id)
        MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE RESTRICT,

    CONSTRAINT advertisement_payment_refunds_amount_check
        CHECK (amount > 0::numeric)
);


-- ============================================================================
-- 5. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_payment_refunds_payment_id
    ON public.advertisement_payment_refunds (payment_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_payment_refunds_refund_date
    ON public.advertisement_payment_refunds (refund_date);

CREATE INDEX IF NOT EXISTS idx_advertisement_payment_refunds_refund_reference
    ON public.advertisement_payment_refunds (refund_reference);


-- ============================================================================
-- 6. Helpful payment indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_advertisement_id
    ON public.advertisement_payments (advertisement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_payment_status
    ON public.advertisement_payments (payment_status);

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_payment_type
    ON public.advertisement_payments (payment_type);

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_payment_date
    ON public.advertisement_payments (payment_date);