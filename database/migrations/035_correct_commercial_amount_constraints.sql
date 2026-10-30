-- Apply in a development database first. Take a backup before production.
-- advertisement_amount stores the FINAL amount after discount.
-- Never subtract discount_amount from advertisement_amount again.
BEGIN;

ALTER TABLE public.advertisements
  DROP CONSTRAINT IF EXISTS advertisements_discount_amount_check,
  DROP CONSTRAINT IF EXISTS advertisements_advance_amount_check,
  DROP CONSTRAINT IF EXISTS advertisements_adjustment_amount_check;

ALTER TABLE public.advertisements
  ADD CONSTRAINT advertisements_discount_amount_check
    CHECK (discount_amount >= 0 AND
      (standard_amount IS NULL OR discount_amount <= standard_amount)) NOT VALID,
  ADD CONSTRAINT advertisements_advance_amount_check
    CHECK (advance_amount >= 0 AND
      (advertisement_amount IS NULL OR advance_amount <= advertisement_amount)) NOT VALID,
  ADD CONSTRAINT advertisements_adjustment_amount_check
    CHECK (adjustment_amount >= 0 AND
      (advertisement_amount IS NULL OR adjustment_amount <= advertisement_amount)) NOT VALID;

-- NOT VALID preserves historical records without failing deployment.
-- PostgreSQL enforces these constraints on all new INSERT/UPDATE operations.
-- Validate historical rows separately after reviewing existing commercial data.
COMMIT;
