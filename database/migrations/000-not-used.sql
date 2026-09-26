BEGIN;

-- ============================================================
-- THE NEWS TIME
-- Advertisement Management - Phase 1A
--
-- Adds:
--   1. Advertisement approval workflow
--   2. Advertiser payment hold
--   3. Advertisement payment ledger
--   4. Advertisement schedule history/reuse
--   5. Workflow audit history
--
-- Important:
--   Advertisements remain independent from News.
--   Existing advertisement creatives can be reused across
--   multiple schedules without creating duplicate Cloudinary
--   media records.
-- ============================================================


-- ============================================================
-- 1. ADVERTISER PAYMENT / AD CREATION HOLD
-- ============================================================

ALTER TABLE advertisers
    ADD COLUMN IF NOT EXISTS ad_creation_hold BOOLEAN
        NOT NULL DEFAULT FALSE,

    ADD COLUMN IF NOT EXISTS ad_creation_hold_reason TEXT,

    ADD COLUMN IF NOT EXISTS ad_creation_hold_at TIMESTAMPTZ,

    ADD COLUMN IF NOT EXISTS ad_creation_hold_by BIGINT;


COMMENT ON COLUMN advertisers.ad_creation_hold IS
    'Prevents creation/submission of new advertisements for this advertiser until the hold is released.';

COMMENT ON COLUMN advertisers.ad_creation_hold_reason IS
    'Reason for placing the advertiser on advertisement creation hold.';

COMMENT ON COLUMN advertisers.ad_creation_hold_at IS
    'Timestamp when advertisement creation hold was applied.';

COMMENT ON COLUMN advertisers.ad_creation_hold_by IS
    'User who applied the advertisement creation hold.';


-- ============================================================
-- 2. ADVERTISEMENT WORKFLOW STATUS
--
-- Existing advertisement status is operational status.
-- workflow_status controls the approval lifecycle.
--
-- DRAFT
--   Ad Creator is preparing the advertisement.
--
-- SUBMITTED
--   Submitted to Ad Manager for review.
--
-- APPROVED
--   Ad Manager approved it.
--   It is now eligible for scheduling.
--
-- REJECTED
--   Ad Manager rejected it.
--
-- ON_HOLD
--   Advertisement is temporarily prevented from progressing.
--
-- ARCHIVED
--   Advertisement is no longer intended for use.
-- ============================================================

ALTER TABLE advertisements
    ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(30)
        NOT NULL DEFAULT 'DRAFT',

    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,

    ADD COLUMN IF NOT EXISTS submitted_by BIGINT,

    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,

    ADD COLUMN IF NOT EXISTS approved_by BIGINT,

    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,

    ADD COLUMN IF NOT EXISTS rejected_by BIGINT,

    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;


ALTER TABLE advertisements
    DROP CONSTRAINT IF EXISTS chk_advertisements_workflow_status;


ALTER TABLE advertisements
    ADD CONSTRAINT chk_advertisements_workflow_status
    CHECK (
        workflow_status IN (
            'DRAFT',
            'SUBMITTED',
            'APPROVED',
            'REJECTED',
            'ON_HOLD',
            'ARCHIVED'
        )
    );


COMMENT ON COLUMN advertisements.workflow_status IS
    'Advertisement approval workflow state controlled by Ad Creator and Ad Manager.';


-- ============================================================
-- 3. WORKFLOW CONSISTENCY CONSTRAINTS
-- ============================================================

ALTER TABLE advertisements
    DROP CONSTRAINT IF EXISTS chk_advertisements_submitted_data;


ALTER TABLE advertisements
    ADD CONSTRAINT chk_advertisements_submitted_data
    CHECK (
        workflow_status = 'DRAFT'
        OR submitted_at IS NOT NULL
    );


ALTER TABLE advertisements
    DROP CONSTRAINT IF EXISTS chk_advertisements_approved_data;


ALTER TABLE advertisements
    ADD CONSTRAINT chk_advertisements_approved_data
    CHECK (
        workflow_status <> 'APPROVED'
        OR approved_at IS NOT NULL
    );


ALTER TABLE advertisements
    DROP CONSTRAINT IF EXISTS chk_advertisements_rejected_data;


ALTER TABLE advertisements
    ADD CONSTRAINT chk_advertisements_rejected_data
    CHECK (
        workflow_status <> 'REJECTED'
        OR rejected_at IS NOT NULL
    );


-- ============================================================
-- 4. ADVERTISEMENT PAYMENTS
--
-- Payment transactions are stored individually.
--
-- Example:
--
--   Advertisement total = Rs. 50,000
--
--   Payment #1 = Rs. 20,000
--   Payment #2 = Rs. 15,000
--
--   Paid    = Rs. 35,000
--   Pending = Rs. 15,000
--
-- The application calculates totals from this ledger.
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    advertisement_id BIGINT NOT NULL,

    payment_reference VARCHAR(150),

    payment_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    amount NUMERIC(14, 2) NOT NULL,

    payment_method VARCHAR(40),

    payment_status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',

    transaction_reference VARCHAR(200),

    notes TEXT,

    recorded_by BIGINT,
    verified_by BIGINT,

    verified_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_advertisement_payments_advertisement
        FOREIGN KEY (advertisement_id)
        REFERENCES advertisements(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_advertisement_payments_amount
        CHECK (amount > 0),

    CONSTRAINT chk_advertisement_payments_status
        CHECK (
            payment_status IN (
                'PENDING',
                'RECEIVED',
                'VERIFIED',
                'CANCELLED',
                'REFUNDED'
            )
        )
);


COMMENT ON TABLE advertisement_payments IS
    'Payment transaction ledger for advertisements. Multiple payments may be recorded against one advertisement.';


-- ============================================================
-- 5. ADVERTISEMENT FINANCIAL INFORMATION
--
-- Financial agreement belongs to the advertisement.
--
-- paid amount is intentionally NOT stored here because it is
-- derived from advertisement_payments.
-- ============================================================

ALTER TABLE advertisements
    ADD COLUMN IF NOT EXISTS agreed_amount NUMERIC(14, 2),

    ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3)
        NOT NULL DEFAULT 'INR';


ALTER TABLE advertisements
    DROP CONSTRAINT IF EXISTS chk_advertisements_agreed_amount;


ALTER TABLE advertisements
    ADD CONSTRAINT chk_advertisements_agreed_amount
    CHECK (
        agreed_amount IS NULL
        OR agreed_amount >= 0
    );


ALTER TABLE advertisements
    DROP CONSTRAINT IF EXISTS chk_advertisements_currency_code;


ALTER TABLE advertisements
    ADD CONSTRAINT chk_advertisements_currency_code
    CHECK (
        length(currency_code) = 3
    );


COMMENT ON COLUMN advertisements.agreed_amount IS
    'Total agreed advertising amount for this advertisement.';

COMMENT ON COLUMN advertisements.currency_code IS
    'ISO-style three-character currency code. Defaults to INR.';


-- ============================================================
-- 6. ADVERTISEMENT SCHEDULES
--
-- A single advertisement can have many schedules.
--
-- This allows:
--
--   Original advertisement
--       Schedule #1 -> last month
--       Schedule #2 -> last week
--       Schedule #3 -> next month
--
-- The advertisement and creative are reused.
-- No duplicate advertisement or Cloudinary creative is required.
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_schedules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    advertisement_id BIGINT NOT NULL,

    placement_id BIGINT NOT NULL,

    placement_rule_id BIGINT,

    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',

    priority INTEGER NOT NULL DEFAULT 0,

    rescheduled_from_id BIGINT,

    notes TEXT,

    created_by BIGINT,
    updated_by BIGINT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_advertisement_schedules_advertisement
        FOREIGN KEY (advertisement_id)
        REFERENCES advertisements(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_advertisement_schedules_placement
        FOREIGN KEY (placement_id)
        REFERENCES advertisement_placements(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_advertisement_schedules_placement_rule
        FOREIGN KEY (placement_rule_id)
        REFERENCES advertisement_placement_rules(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_advertisement_schedules_rescheduled_from
        FOREIGN KEY (rescheduled_from_id)
        REFERENCES advertisement_schedules(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_advertisement_schedules_dates
        CHECK (
            end_at > start_at
        ),

    CONSTRAINT chk_advertisement_schedules_priority
        CHECK (
            priority >= 0
        ),

    CONSTRAINT chk_advertisement_schedules_status
        CHECK (
            status IN (
                'SCHEDULED',
                'ACTIVE',
                'PAUSED',
                'COMPLETED',
                'CANCELLED'
            )
        )
);


COMMENT ON TABLE advertisement_schedules IS
    'Scheduling history for advertisements. Multiple schedules may reuse the same advertisement and creative.';

COMMENT ON COLUMN advertisement_schedules.rescheduled_from_id IS
    'Previous schedule from which this schedule was rescheduled.';


-- ============================================================
-- 7. WORKFLOW HISTORY
--
-- Keeps an audit trail of important workflow transitions.
--
-- Example:
--
--   DRAFT -> SUBMITTED
--   SUBMITTED -> APPROVED
--   APPROVED -> ON_HOLD
--   ON_HOLD -> APPROVED
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_workflow_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    advertisement_id BIGINT NOT NULL,

    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,

    action VARCHAR(50) NOT NULL,

    comments TEXT,

    changed_by BIGINT,

    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_advertisement_workflow_history_advertisement
        FOREIGN KEY (advertisement_id)
        REFERENCES advertisements(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_advertisement_workflow_history_to_status
        CHECK (
            to_status IN (
                'DRAFT',
                'SUBMITTED',
                'APPROVED',
                'REJECTED',
                'ON_HOLD',
                'ARCHIVED'
            )
        )
);


COMMENT ON TABLE advertisement_workflow_history IS
    'Audit history of advertisement workflow transitions.';


-- ============================================================
-- 8. INDEXES - ADVERTISEMENT WORKFLOW
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisements_workflow_status
    ON advertisements (workflow_status);

CREATE INDEX IF NOT EXISTS idx_advertisements_submitted_by
    ON advertisements (submitted_by);

CREATE INDEX IF NOT EXISTS idx_advertisements_approved_by
    ON advertisements (approved_by);

CREATE INDEX IF NOT EXISTS idx_advertisements_workflow_status_priority
    ON advertisements (workflow_status, priority DESC);


-- ============================================================
-- 9. INDEXES - AD CREATION HOLD
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisers_ad_creation_hold
    ON advertisers (ad_creation_hold);


-- ============================================================
-- 10. INDEXES - PAYMENTS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_advertisement
    ON advertisement_payments (advertisement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_date
    ON advertisement_payments (payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_status
    ON advertisement_payments (payment_status);

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_reference
    ON advertisement_payments (payment_reference);


-- ============================================================
-- 11. INDEXES - SCHEDULES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_schedules_advertisement
    ON advertisement_schedules (advertisement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_schedules_placement
    ON advertisement_schedules (placement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_schedules_period
    ON advertisement_schedules (start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_advertisement_schedules_status
    ON advertisement_schedules (status);

CREATE INDEX IF NOT EXISTS idx_advertisement_schedules_active
    ON advertisement_schedules (
        placement_id,
        status,
        start_at,
        end_at
    );

CREATE INDEX IF NOT EXISTS idx_advertisement_schedules_rescheduled_from
    ON advertisement_schedules (rescheduled_from_id);


-- ============================================================
-- 12. INDEXES - WORKFLOW HISTORY
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_workflow_history_advertisement
    ON advertisement_workflow_history (
        advertisement_id,
        changed_at DESC
    );


-- ============================================================
-- 13. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_advertisement_payments_updated_at
    ON advertisement_payments;

CREATE TRIGGER trg_advertisement_payments_updated_at
BEFORE UPDATE ON advertisement_payments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS trg_advertisement_schedules_updated_at
    ON advertisement_schedules;

CREATE TRIGGER trg_advertisement_schedules_updated_at
BEFORE UPDATE ON advertisement_schedules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 14. FINANCIAL VIEW
--
-- Provides:
--   agreed amount
--   paid amount
--   pending amount
--
-- Only RECEIVED and VERIFIED payments are counted as paid.
-- ============================================================

CREATE OR REPLACE VIEW advertisement_financial_summary AS
SELECT
    a.id AS advertisement_id,

    a.advertiser_id,

    a.agreed_amount,

    a.currency_code,

    COALESCE(
        SUM(
            CASE
                WHEN p.payment_status IN ('RECEIVED', 'VERIFIED')
                THEN p.amount
                ELSE 0
            END
        ),
        0
    ) AS paid_amount,

    GREATEST(
        COALESCE(a.agreed_amount, 0)
        -
        COALESCE(
            SUM(
                CASE
                    WHEN p.payment_status IN ('RECEIVED', 'VERIFIED')
                    THEN p.amount
                    ELSE 0
                END
            ),
            0
        ),
        0
    ) AS pending_amount

FROM advertisements a

LEFT JOIN advertisement_payments p
    ON p.advertisement_id = a.id

GROUP BY
    a.id,
    a.advertiser_id,
    a.agreed_amount,
    a.currency_code;


COMMENT ON VIEW advertisement_financial_summary IS
    'Calculated financial summary showing agreed, paid and pending advertisement amounts.';


COMMIT;