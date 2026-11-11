ALTER TABLE advertisement_financial_approvals
  ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS approved_percentage NUMERIC(7, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_financial_approval_approved_terms'
  ) THEN
    ALTER TABLE advertisement_financial_approvals
      ADD CONSTRAINT chk_financial_approval_approved_terms
      CHECK (
        (approved_amount IS NULL OR approved_amount >= 0)
        AND (
          approved_percentage IS NULL
          OR (
            approved_percentage >= 0
            AND approved_percentage <= 100
          )
        )
      );
  END IF;
END
$$;

----------------------------

BEGIN;

ALTER TABLE public.advertisement_financial_approvals
    ALTER COLUMN approved_percentage
    TYPE numeric(7,4)
    USING approved_percentage::numeric(7,4);

ALTER TABLE public.advertisement_financial_approvals
    DROP CONSTRAINT IF EXISTS chk_financial_approval_approved_amount_limit;

ALTER TABLE public.advertisement_financial_approvals
    ADD CONSTRAINT chk_financial_approval_approved_amount_limit
    CHECK (
        approved_amount IS NULL
        OR (
            approved_amount >= 0
            AND (
                requested_amount IS NULL
                OR approved_amount <= requested_amount
            )
        )
    );

ALTER TABLE public.advertisement_financial_approvals
    DROP CONSTRAINT IF EXISTS chk_financial_approval_approved_percentage_limit;

ALTER TABLE public.advertisement_financial_approvals
    ADD CONSTRAINT chk_financial_approval_approved_percentage_limit
    CHECK (
        approved_percentage IS NULL
        OR (
            approved_percentage >= 0
            AND approved_percentage <= 100
            AND (
                requested_percentage IS NULL
                OR approved_percentage <= requested_percentage
            )
        )
    );

COMMIT;