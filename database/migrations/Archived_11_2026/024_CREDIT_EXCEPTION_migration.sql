
BEGIN;

-- 1. Allow CREDIT_EXCEPTION in the existing financial approval workflow.
ALTER TABLE public.advertisement_financial_approvals
    DROP CONSTRAINT IF EXISTS chk_ad_financial_approvals_type;

ALTER TABLE public.advertisement_financial_approvals
    ADD CONSTRAINT chk_ad_financial_approvals_type
    CHECK (
        approval_type IN (
            'DISCOUNT',
            'ADJUSTMENT',
            'REFUND',
            'PARTIAL_REFUND',
            'CREDIT_EXCEPTION'
        )
    );

-- 2. Store Credit Exception-specific request and audit data.
ALTER TABLE public.advertisement_financial_approvals
    ADD COLUMN IF NOT EXISTS credit_exception_reason text,
    ADD COLUMN IF NOT EXISTS expected_payment_due_date date,
    ADD COLUMN IF NOT EXISTS overdue_at timestamptz,
    ADD COLUMN IF NOT EXISTS revoked_by bigint,
    ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
    ADD COLUMN IF NOT EXISTS revocation_reason text;

-- Credit Exception requests must specify an amount, a reason, and a due date.
-- Existing approval types retain their current validation behavior.
ALTER TABLE public.advertisement_financial_approvals
    DROP CONSTRAINT IF EXISTS chk_ad_financial_approvals_credit_exception_terms;

ALTER TABLE public.advertisement_financial_approvals
    ADD CONSTRAINT chk_ad_financial_approvals_credit_exception_terms
    CHECK (
        approval_type <> 'CREDIT_EXCEPTION'
        OR (
            requested_amount IS NOT NULL
            AND requested_percentage IS NULL
            AND NULLIF(BTRIM(credit_exception_reason), '') IS NOT NULL
            AND expected_payment_due_date IS NOT NULL
        )
    );

ALTER TABLE public.advertisement_financial_approvals
    DROP CONSTRAINT IF EXISTS chk_ad_financial_approvals_credit_exception_review;

ALTER TABLE public.advertisement_financial_approvals
    ADD CONSTRAINT chk_ad_financial_approvals_credit_exception_review
    CHECK (
        approval_type <> 'CREDIT_EXCEPTION'
        OR status <> 'APPROVED'
        OR (
            approved_amount IS NOT NULL
            AND approved_amount > 0
        )
    );

-- Keep the exception's approved coverage within the requested amount.
-- The existing approved-amount limit constraint already enforces this.

-- 3. Add exception-specific fields to the immutable history trail.
ALTER TABLE public.advertisement_financial_approval_history
    ADD COLUMN IF NOT EXISTS credit_exception_reason text,
    ADD COLUMN IF NOT EXISTS expected_payment_due_date date,
    ADD COLUMN IF NOT EXISTS approved_amount numeric(14,2),
    ADD COLUMN IF NOT EXISTS overdue_at timestamptz,
    ADD COLUMN IF NOT EXISTS revoked_by bigint,
    ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
    ADD COLUMN IF NOT EXISTS revocation_reason text;

-- 4. Index exception requests by advertisement and status.
CREATE INDEX IF NOT EXISTS idx_ad_financial_approvals_credit_exception
    ON public.advertisement_financial_approvals
        (advertisement_id, status, expected_payment_due_date)
    WHERE approval_type = 'CREDIT_EXCEPTION';

CREATE INDEX IF NOT EXISTS idx_ad_financial_approvals_credit_exception_due
    ON public.advertisement_financial_approvals
        (expected_payment_due_date, status)
    WHERE approval_type = 'CREDIT_EXCEPTION'
      AND status = 'APPROVED';

CREATE INDEX IF NOT EXISTS idx_ad_financial_approval_history_due_audit
    ON public.advertisement_financial_approval_history
        (approval_id, action_at DESC);

COMMENT ON COLUMN public.advertisement_financial_approvals.credit_exception_reason
    IS 'Business reason for permitting an outstanding advertisement balance to remain unpaid.';

COMMENT ON COLUMN public.advertisement_financial_approvals.expected_payment_due_date
    IS 'Expected date by which the deferred balance should be paid.';

COMMENT ON COLUMN public.advertisement_financial_approvals.overdue_at
    IS 'Timestamp when an approved credit exception was first marked overdue. This does not mark the debt as paid.';

COMMENT ON COLUMN public.advertisement_financial_approvals.approved_amount
    IS 'For CREDIT_EXCEPTION, the approved amount of outstanding balance that may remain unpaid.';

COMMIT;
