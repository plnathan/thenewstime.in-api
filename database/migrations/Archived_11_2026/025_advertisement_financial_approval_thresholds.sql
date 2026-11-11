BEGIN;

ALTER TABLE public.advertisement_financial_approval_thresholds
  DROP CONSTRAINT IF EXISTS
    chk_advertisement_financial_approval_thresholds_type;

ALTER TABLE public.advertisement_financial_approval_thresholds
  ADD CONSTRAINT
    chk_advertisement_financial_approval_thresholds_type
  CHECK (
    approval_type IN (
      'DISCOUNT',
      'REFUND',
      'PARTIAL_REFUND',
      'ADJUSTMENT',
      'CREDIT_EXCEPTION'
    )
  );

ALTER TABLE public.advertisement_financial_approval_thresholds
  DROP CONSTRAINT IF EXISTS
    chk_advertisement_financial_approval_thresholds_credit_exception;

ALTER TABLE public.advertisement_financial_approval_thresholds
  ADD CONSTRAINT
    chk_advertisement_financial_approval_thresholds_credit_exception
  CHECK (
    approval_type <> 'CREDIT_EXCEPTION'
    OR (
      amount_threshold IS NOT NULL
      AND percentage_threshold IS NULL
    )
  );

ALTER TABLE public.advertisement_financial_approval_thresholds
  DROP CONSTRAINT IF EXISTS
    chk_advertisement_financial_approval_thresholds_type;

ALTER TABLE public.advertisement_financial_approval_thresholds
  ADD CONSTRAINT chk_advertisement_financial_approval_thresholds_type
  CHECK (
    approval_type IN (
      'DISCOUNT',
      'REFUND',
      'PARTIAL_REFUND',
      'ADJUSTMENT',
      'CREDIT_EXCEPTION'
    )
  );

-- PostgreSQL truncates identifiers longer than 63 bytes.
-- Remove the previously attempted long constraint name if it exists.
ALTER TABLE public.advertisement_financial_approval_thresholds
  DROP CONSTRAINT IF EXISTS
    chk_advertisement_financial_approval_thresholds_credit_exceptio;

ALTER TABLE public.advertisement_financial_approval_thresholds
  DROP CONSTRAINT IF EXISTS
    chk_advert_fin_approval_threshold_credit_exc;

ALTER TABLE public.advertisement_financial_approval_thresholds
  ADD CONSTRAINT chk_advert_fin_approval_threshold_credit_exc
  CHECK (
    approval_type <> 'CREDIT_EXCEPTION'
    OR (
      amount_threshold IS NOT NULL
      AND percentage_threshold IS NULL
    )
  );
  
ALTER TABLE public.advertisement_financial_approval_thresholds
    DROP CONSTRAINT IF EXISTS
        chk_advertisement_financial_approval_thresholds_value;

ALTER TABLE public.advertisement_financial_approval_thresholds
    ADD CONSTRAINT
        chk_advertisement_financial_approval_thresholds_value
    CHECK (
        (amount_threshold IS NOT NULL)
        <>
        (percentage_threshold IS NOT NULL)
    );

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_advert_fin_approval_threshold_one_active_per_type
ON public.advertisement_financial_approval_thresholds (approval_type)
WHERE status = 'ACTIVE';
  
COMMIT;