-- Phase 1: persistence only. Does not alter existing balances or execute refunds.
-- Apply once in Neon PostgreSQL after reviewing a database backup.
BEGIN;

CREATE TABLE IF NOT EXISTS public.advertisement_refund_commercial_matches (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    advertisement_id bigint NOT NULL REFERENCES public.advertisements(id) ON DELETE RESTRICT,
    refund_id bigint NOT NULL REFERENCES public.advertisement_payment_refunds(id) ON DELETE RESTRICT,
    discount_approval_id bigint NOT NULL REFERENCES public.advertisement_financial_approvals(id) ON DELETE RESTRICT,
    matched_amount numeric(14,2) NOT NULL CHECK (matched_amount > 0),
    matched_by bigint NOT NULL,
    matched_at timestamptz NOT NULL DEFAULT now(),
    notes text,
    CONSTRAINT uq_refund_commercial_match_refund UNIQUE (refund_id),
    CONSTRAINT uq_refund_commercial_match_discount_approval UNIQUE (discount_approval_id)
);

CREATE INDEX IF NOT EXISTS idx_refund_commercial_matches_advertisement
    ON public.advertisement_refund_commercial_matches(advertisement_id);

COMMENT ON TABLE public.advertisement_refund_commercial_matches IS
'Links an executed refund to an approved discount; no commercial amount is changed by this table alone. The application must validate approval status, advertisement ownership, amount, and settlement transactionally.';

COMMIT;
