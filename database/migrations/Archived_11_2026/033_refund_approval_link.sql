-- thenewstime.in: refund execution to financial approval linkage.
-- Additive migration: historical refunds remain unlinked and unchanged.
-- IMPORTANT: Do not enforce NOT NULL until historical records are reconciled.
BEGIN;

ALTER TABLE public.advertisement_payment_refunds
  ADD COLUMN IF NOT EXISTS financial_approval_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'advertisement_payment_refunds_financial_approval_fk'
      AND conrelid = 'public.advertisement_payment_refunds'::regclass
  ) THEN
    ALTER TABLE public.advertisement_payment_refunds
      ADD CONSTRAINT advertisement_payment_refunds_financial_approval_fk
      FOREIGN KEY (financial_approval_id)
      REFERENCES public.advertisement_financial_approvals(id);
  END IF;
END $$;

-- One completed refund per approved request; multiple legacy NULLs remain allowed.
CREATE UNIQUE INDEX IF NOT EXISTS
  ux_advertisement_payment_refunds_financial_approval_id
ON public.advertisement_payment_refunds(financial_approval_id)
WHERE financial_approval_id IS NOT NULL;

COMMIT;
