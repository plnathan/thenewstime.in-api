-- ============================================================
-- TheNewsTime.in
-- Advertisement Management
-- Phase 1B Migration
---------------------

-- Purpose:
--   1. Introduce Advertisement Client / Business entity
--   2. Introduce Advertisement Business Type master
--   3. Rename Advertiser -> Client
--   4. Add client-level Advertisement Creation Hold
--   5. Add Hold / Un-Hold history
--   6. Add Advertisement workflow / approval state
--   7. Add Advertisement payment ledger
--   8. Add Advertisement schedules
--   9. Add workflow history
--  10. Add financial summary
--  11. Support automatic payment-based hold release
----------------------------------------------------

-- IMPORTANT:
--   Phase 1 has already been applied.
--   This migration EVOLVES the existing Phase 1 schema.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ADVERTISEMENT BUSINESS TYPES
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_business_types (
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,


code VARCHAR(50) NOT NULL,
display_name VARCHAR(150) NOT NULL,
description TEXT,

display_order INTEGER NOT NULL DEFAULT 0,

status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE')),

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

created_by BIGINT,
updated_by BIGINT,

CONSTRAINT uq_advertisement_business_types_code
    UNIQUE (code),

CONSTRAINT chk_advertisement_business_types_status
        CHECK (status IN ('ACTIVE', 'INACTIVE')),

    CONSTRAINT chk_advertisement_business_types_display_order
        CHECK (display_order >= 0)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_business_types_status
ON advertisement_business_types(status);

CREATE INDEX IF NOT EXISTS idx_advertisement_business_types_display_order
ON advertisement_business_types(display_order);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS trg_advertisement_business_types_updated_at
    ON advertisement_business_types;

CREATE TRIGGER trg_advertisement_business_types_updated_at
BEFORE UPDATE ON advertisement_business_types
FOR EACH ROW
EXECUTE FUNCTION set_advertisement_updated_at();

-- ============================================================
-- 2. RENAME ADVERTISERS -> ADVERTISEMENT CLIENTS
-- ============================================================
---------------------------------------------------------------

-- Phase 1 created "advertisers".
-- We retain the existing data and evolve the table instead of
-- creating a second parallel business entity.
----------------------------------------------

-- ============================================================

ALTER TABLE IF EXISTS advertisers
RENAME TO advertisement_clients;

-- Rename primary identifying column if it exists.
ALTER TABLE advertisement_clients
RENAME COLUMN id TO id;

-- ============================================================
-- 3. ADD / NORMALIZE CLIENT COLUMNS
-- ============================================================
////////////
ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS client_code VARCHAR(30);

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS business_name VARCHAR(250);

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS display_name VARCHAR(250);

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS business_type_id BIGINT;

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS website VARCHAR(500);

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS primary_address TEXT;

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS communication_address TEXT;

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS contact_person VARCHAR(200);

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS contact_no VARCHAR(50);

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS mobile VARCHAR(30);

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS alternate_mobile VARCHAR(30);

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS alternate_email VARCHAR(255);

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS ad_creation_hold BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS ad_creation_hold_type VARCHAR(20);

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS ad_creation_hold_reason VARCHAR(100);

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS ad_creation_hold_remarks TEXT;

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS ad_creation_hold_at TIMESTAMPTZ;

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS ad_creation_hold_by BIGINT;

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS ad_creation_unhold_at TIMESTAMPTZ;

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS ad_creation_unhold_by BIGINT;

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS ad_creation_unhold_reason TEXT;

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS created_by BIGINT;

ALTER TABLE advertisement_clients
ADD COLUMN IF NOT EXISTS updated_by BIGINT;

-- ============================================================
-- 4. CLIENT STATUS / HOLD CONSTRAINTS
-- ============================================================

ALTER TABLE advertisement_clients
DROP CONSTRAINT IF EXISTS advertisement_clients_status_check;

ALTER TABLE advertisement_clients
ADD CONSTRAINT advertisement_clients_status_check
CHECK (
status IN ('ACTIVE', 'INACTIVE', 'BLOCKED')
);

ALTER TABLE advertisement_clients
DROP CONSTRAINT IF EXISTS advertisement_clients_hold_type_check;

ALTER TABLE advertisement_clients
ADD CONSTRAINT advertisement_clients_hold_type_check
CHECK (
ad_creation_hold_type IS NULL
OR ad_creation_hold_type IN ('AUTOMATIC', 'MANUAL')
);

-- ============================================================
-- 5. CLIENT CODE
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_advertisement_clients_client_code
ON advertisement_clients(client_code)
WHERE client_code IS NOT NULL;

-- Generate client codes for existing rows.
UPDATE advertisement_clients
SET client_code =
'CL-' || LPAD(id::TEXT, 6, '0')
WHERE client_code IS NULL;

ALTER TABLE advertisement_clients
ALTER COLUMN client_code SET NOT NULL;

-- ============================================================
-- 6. BUSINESS TYPE FOREIGN KEY
-- ============================================================

ALTER TABLE advertisement_clients
DROP CONSTRAINT IF EXISTS fk_advertisement_clients_business_type;

ALTER TABLE advertisement_clients
ADD CONSTRAINT fk_advertisement_clients_business_type
FOREIGN KEY (business_type_id)
REFERENCES advertisement_business_types(id)
ON DELETE SET NULL;

-- ============================================================
-- 7. CLIENT HOLD INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_clients_hold
ON advertisement_clients(ad_creation_hold);

CREATE INDEX IF NOT EXISTS idx_advertisement_clients_status
ON advertisement_clients(status);

-- ============================================================
-- 8. DEFAULT BUSINESS TYPES
-- ============================================================
||||||||||||||||||||||||||||||||||||||||||||||
INSERT INTO advertisement_business_types
(code, display_name, description, display_order)
VALUES
('RETAIL', 'Retail', 'Retail business', 10),
('EDUCATION', 'Education', 'Schools, colleges, coaching and education businesses', 20),
('HEALTHCARE', 'Healthcare', 'Hospitals, clinics, pharmacies and healthcare businesses', 30),
('REAL_ESTATE', 'Real Estate', 'Property, builders and real estate businesses', 40),
('AUTOMOTIVE', 'Automotive', 'Automobile dealers, service centres and related businesses', 50),
('HOSPITALITY', 'Hospitality', 'Hotels, restaurants, resorts and hospitality businesses', 60),
('FINANCE', 'Finance', 'Banks, financial institutions and related businesses', 70),
('SERVICES', 'Services', 'Professional and general service businesses', 80),
('GOVERNMENT', 'Government', 'Government and public-sector organisations', 90),
('POLITICAL', 'Political', 'Political organisations and election-related advertisers', 100),
('NGO', 'NGO / Non-Profit', 'Non-governmental and non-profit organisations', 110),
('OTHER', 'Other', 'Other business types', 999)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 9. ADVERTISEMENTS -> CLIENT
-- ============================================================
---------------------------------------------------------------

-- Phase 1 had advertiser_id.
-- The application should now use client_id.
--------------------------------------------

-- We keep advertiser_id temporarily to avoid destructive migration
-- and populate client_id from the existing relationship.
---------------------------------------------------------

-- ============================================================

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS client_id BIGINT;

DO $$
BEGIN
IF EXISTS (
SELECT 1
FROM information_schema.columns
WHERE table_name = 'advertisements'
AND column_name = 'advertiser_id'
) THEN


    UPDATE advertisements
    SET client_id = advertiser_id
    WHERE client_id IS NULL;

END IF;


END $$;

ALTER TABLE advertisements
DROP CONSTRAINT IF EXISTS fk_advertisements_client;

ALTER TABLE advertisements
ADD CONSTRAINT fk_advertisements_client
FOREIGN KEY (client_id)
REFERENCES advertisement_clients(id)
ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_advertisements_client_id
ON advertisements(client_id);

-- ============================================================
-- 10. CAMPAIGNS -> CLIENT
-- ============================================================

ALTER TABLE advertisement_campaigns
ADD COLUMN IF NOT EXISTS client_id BIGINT;

DO $$
BEGIN
IF EXISTS (
SELECT 1
FROM information_schema.columns
WHERE table_name = 'advertisement_campaigns'
AND column_name = 'advertiser_id'
) THEN


    UPDATE advertisement_campaigns
    SET client_id = advertiser_id
    WHERE client_id IS NULL;

END IF;


END $$;

ALTER TABLE advertisement_campaigns
DROP CONSTRAINT IF EXISTS fk_advertisement_campaigns_client;

ALTER TABLE advertisement_campaigns
ADD CONSTRAINT fk_advertisement_campaigns_client
FOREIGN KEY (client_id)
REFERENCES advertisement_clients(id)
ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_advertisement_campaigns_client_id
ON advertisement_campaigns(client_id);

-- ============================================================
-- 11. ADVERTISEMENT WORKFLOW STATUS
-- ============================================================

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(20)
NOT NULL DEFAULT 'DRAFT';

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS submitted_by BIGINT;

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS approved_by BIGINT;

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS rejected_by BIGINT;

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS on_hold_at TIMESTAMPTZ;

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS on_hold_by BIGINT;

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS on_hold_reason TEXT;

ALTER TABLE advertisements
DROP CONSTRAINT IF EXISTS advertisements_workflow_status_check;

ALTER TABLE advertisements
ADD CONSTRAINT advertisements_workflow_status_check
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

CREATE INDEX IF NOT EXISTS idx_advertisements_workflow_status
ON advertisements(workflow_status);

-- ============================================================
-- 12. ADVERTISING AGREED PAYMENT
-- ============================================================

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS agreed_amount NUMERIC(14,2);

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS currency_code CHAR(3) NOT NULL DEFAULT 'INR';

ALTER TABLE advertisements
DROP CONSTRAINT IF EXISTS advertisements_agreed_amount_check;

ALTER TABLE advertisements
ADD CONSTRAINT advertisements_agreed_amount_check
CHECK (
agreed_amount IS NULL
OR agreed_amount >= 0
);

-- ============================================================
-- 13. ADVERTISEMENT PAYMENTS
-- ============================================================
---------------------------------------------------------------

## -- Multiple payment entries are intentionally supported.

-- Example:
--   Agreed = 100,000
--   Payment #1 = 40,000
--   Payment #2 = 30,000
--   Payment #3 = 30,000
------------------------

## -- Pending automatically becomes 0.

-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_payments (
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,


advertisement_id BIGINT NOT NULL,

amount NUMERIC(14,2) NOT NULL,

payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

payment_method VARCHAR(50),

payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

transaction_reference VARCHAR(150),

notes TEXT,

recorded_by BIGINT,
recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

verified_by BIGINT,
verified_at TIMESTAMPTZ,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

CONSTRAINT fk_advertisement_payments_advertisement
    FOREIGN KEY (advertisement_id)
    REFERENCES advertisements(id)
    ON DELETE RESTRICT,

CONSTRAINT advertisement_payments_amount_check
    CHECK (amount > 0),

CONSTRAINT advertisement_payments_status_check
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

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_advertisement
ON advertisement_payments(advertisement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_status
ON advertisement_payments(payment_status);

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_payment_date
ON advertisement_payments(payment_date DESC);

-- ============================================================
-- 14. CLIENT HOLD HISTORY
-- ============================================================
---------------------------------------------------------------

## -- Every hold/unhold event is retained permanently.

-- Important:
--   Manual UNHOLD requires remarks.
--   Automatic payment reconciliation can release a hold without
--   manual remarks.
--------------------

-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_client_hold_history (
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,


client_id BIGINT NOT NULL,

action VARCHAR(20) NOT NULL,

hold_type VARCHAR(20),

reason VARCHAR(100),

remarks TEXT,

outstanding_amount NUMERIC(14,2),
currency_code CHAR(3) NOT NULL DEFAULT 'INR',

performed_by BIGINT,

performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

CONSTRAINT fk_ad_client_hold_history_client
    FOREIGN KEY (client_id)
    REFERENCES advertisement_clients(id)
    ON DELETE RESTRICT,

CONSTRAINT advertisement_client_hold_action_check
    CHECK (
        action IN ('HOLD', 'UNHOLD')
    ),

CONSTRAINT advertisement_client_hold_type_check
    CHECK (
        hold_type IS NULL
        OR hold_type IN ('AUTOMATIC', 'MANUAL')
    ),

CONSTRAINT advertisement_client_unhold_remarks_check
    CHECK (
        action <> 'UNHOLD'
        OR (
            reason = 'PAYMENT_SETTLED'
            OR (
                remarks IS NOT NULL
                AND LENGTH(BTRIM(remarks)) > 0
            )
        )
    )


);

CREATE INDEX IF NOT EXISTS idx_ad_client_hold_history_client
ON advertisement_client_hold_history(client_id);

CREATE INDEX IF NOT EXISTS idx_ad_client_hold_history_performed_at
ON advertisement_client_hold_history(performed_at DESC);

-- ============================================================
-- 15. ADVERTISEMENT SCHEDULES
-- ============================================================
---------------------------------------------------------------

## -- Scheduling is independent from the advertisement itself.

-- The same approved advertisement can therefore be scheduled
-- multiple times without creating another advertisement or
-- uploading another creative.
------------------------------

-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_schedules (
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,


advertisement_id BIGINT NOT NULL,

placement_id BIGINT,

placement_rule_id BIGINT,

start_at TIMESTAMPTZ NOT NULL,
end_at TIMESTAMPTZ NOT NULL,

status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',

priority INTEGER NOT NULL DEFAULT 0,

rescheduled_from_id BIGINT,

notes TEXT,

created_by BIGINT,
updated_by BIGINT,

created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

CONSTRAINT fk_advertisement_schedules_advertisement
    FOREIGN KEY (advertisement_id)
    REFERENCES advertisements(id)
    ON DELETE RESTRICT,

CONSTRAINT fk_advertisement_schedules_placement
    FOREIGN KEY (placement_id)
    REFERENCES advertisement_placements(id)
    ON DELETE SET NULL,

CONSTRAINT fk_advertisement_schedules_placement_rule
    FOREIGN KEY (placement_rule_id)
    REFERENCES advertisement_placement_rules(id)
    ON DELETE SET NULL,

CONSTRAINT fk_advertisement_schedules_rescheduled_from
    FOREIGN KEY (rescheduled_from_id)
    REFERENCES advertisement_schedules(id)
    ON DELETE SET NULL,

CONSTRAINT advertisement_schedules_dates_check
    CHECK (end_at > start_at),

CONSTRAINT advertisement_schedules_status_check
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

CREATE INDEX IF NOT EXISTS idx_advertisement_schedules_advertisement
ON advertisement_schedules(advertisement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_schedules_time
ON advertisement_schedules(start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_advertisement_schedules_status
ON advertisement_schedules(status);

-- ============================================================
-- 16. ADVERTISEMENT WORKFLOW HISTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS advertisement_workflow_history (
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,


advertisement_id BIGINT NOT NULL,

from_status VARCHAR(20),
to_status VARCHAR(20) NOT NULL,

remarks TEXT,

performed_by BIGINT,
performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

CONSTRAINT fk_advertisement_workflow_history_advertisement
    FOREIGN KEY (advertisement_id)
    REFERENCES advertisements(id)
    ON DELETE RESTRICT


);

CREATE INDEX IF NOT EXISTS idx_advertisement_workflow_history_ad
ON advertisement_workflow_history(advertisement_id);

CREATE INDEX IF NOT EXISTS idx_advertisement_workflow_history_date
ON advertisement_workflow_history(performed_at DESC);

-- ============================================================
-- 17. FINANCIAL SUMMARY VIEW
-- ============================================================
---------------------------------------------------------------

## -- Paid amount includes RECEIVED + VERIFIED.

## -- PENDING payment entries are not treated as settled money.

## -- CANCELLED / REFUNDED are excluded.

## -- pending_amount = agreed_amount - paid_amount

## -- The value is never allowed below zero.

-- ============================================================

CREATE OR REPLACE VIEW advertisement_financial_summary AS
SELECT
a.id AS advertisement_id,
a.client_id,


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
)::NUMERIC(14,2) AS paid_amount,

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
)::NUMERIC(14,2) AS pending_amount


FROM advertisements a

LEFT JOIN advertisement_payments p
ON p.advertisement_id = a.id

GROUP BY
a.id,
a.client_id,
a.agreed_amount,
a.currency_code;

-- ============================================================
-- 18. CLIENT FINANCIAL SUMMARY
-- ============================================================
---------------------------------------------------------------

## -- This is important for client-level AD CREATION HOLD.

## -- A client can have many advertisements.

## -- Example:

-- Ad #101  Agreed 100,000  Paid 100,000  Pending 0
-- Ad #102  Agreed  50,000  Paid  20,000  Pending 30,000
--------------------------------------------------------

## -- Client outstanding = 30,000

## -- Therefore payment-based automatic hold remains active.

-- ============================================================

CREATE OR REPLACE VIEW advertisement_client_financial_summary AS
SELECT
c.id AS client_id,
c.client_code,
c.business_name,


COALESCE(
    SUM(afs.agreed_amount),
    0
)::NUMERIC(14,2) AS total_agreed_amount,

COALESCE(
    SUM(afs.paid_amount),
    0
)::NUMERIC(14,2) AS total_paid_amount,

COALESCE(
    SUM(afs.pending_amount),
    0
)::NUMERIC(14,2) AS total_pending_amount


FROM advertisement_clients c

LEFT JOIN advertisement_financial_summary afs
ON afs.client_id = c.id

GROUP BY
c.id,
c.client_code,
c.business_name;

-- ============================================================
-- 19. TRIGGER FUNCTION: UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION set_advertisement_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ============================================================
-- 20. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_advertisement_clients_updated_at
    ON advertisement_clients;

CREATE TRIGGER trg_advertisement_clients_updated_at
BEFORE UPDATE ON advertisement_clients
FOR EACH ROW
EXECUTE FUNCTION set_advertisement_updated_at();


DROP TRIGGER IF EXISTS trg_advertisement_payments_updated_at
    ON advertisement_payments;

CREATE TRIGGER trg_advertisement_payments_updated_at
BEFORE UPDATE ON advertisement_payments
FOR EACH ROW
EXECUTE FUNCTION set_advertisement_updated_at();


DROP TRIGGER IF EXISTS trg_advertisement_schedules_updated_at
    ON advertisement_schedules;

CREATE TRIGGER trg_advertisement_schedules_updated_at
BEFORE UPDATE ON advertisement_schedules
FOR EACH ROW
EXECUTE FUNCTION set_advertisement_updated_at();


-- ============================================================
-- 21. PAYMENT SETTLEMENT / AUTOMATIC HOLD RELEASE
-- ============================================================
--
-- When a payment is recorded/updated and the client's total
-- outstanding amount becomes zero, a PAYMENT-related client hold
-- is automatically released.
--
-- This function intentionally does NOT:
--   - modify payment rows
--   - change advertisement workflow status
--   - modify agreed_amount
--   - modify schedules
--
-- It only releases an active client-level ad-creation hold.
--
-- ============================================================

CREATE OR REPLACE FUNCTION release_client_ad_hold_on_payment_settlement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_client_id BIGINT;
    v_pending_amount NUMERIC(14,2);
    v_hold_reason VARCHAR(100);
BEGIN

    SELECT a.client_id
    INTO v_client_id
    FROM advertisements a
    WHERE a.id = NEW.advertisement_id;


    IF v_client_id IS NULL THEN
        RETURN NEW;
    END IF;


    SELECT total_pending_amount
    INTO v_pending_amount
    FROM advertisement_client_financial_summary
    WHERE client_id = v_client_id;


    IF COALESCE(v_pending_amount, 0) <= 0 THEN

        SELECT ad_creation_hold_reason
        INTO v_hold_reason
        FROM advertisement_clients
        WHERE id = v_client_id
          AND ad_creation_hold = TRUE;


        IF v_hold_reason IN (
            'PAYMENT_DEFAULT',
            'PAYMENT_OVERDUE',
            'CREDIT_LIMIT_EXCEEDED'
        ) THEN

            UPDATE advertisement_clients
            SET
                ad_creation_hold = FALSE,
                ad_creation_unhold_at = NOW(),
                ad_creation_unhold_by = NULL,
                ad_creation_unhold_reason =
                    'Automatically released after payment settlement.',
                updated_at = NOW()
            WHERE id = v_client_id
              AND ad_creation_hold = TRUE;


            INSERT INTO advertisement_client_hold_history (
                client_id,
                action,
                hold_type,
                reason,
                remarks,
                outstanding_amount,
                currency_code,
                performed_by
            )
            SELECT
                v_client_id,
                'UNHOLD',
                'AUTOMATIC',
                'PAYMENT_SETTLED',
                'Advertisement creation hold automatically released after the client payment was fully settled.',
                0,
                COALESCE(
                    (
                        SELECT currency_code
                        FROM advertisements
                        WHERE client_id = v_client_id
                        ORDER BY id DESC
                        LIMIT 1
                    ),
                    'INR'
                ),
                NULL;

        END IF;

    END IF;


    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_release_client_ad_hold_on_payment
    ON advertisement_payments;

CREATE TRIGGER trg_release_client_ad_hold_on_payment
AFTER INSERT OR UPDATE OF amount, payment_status
ON advertisement_payments
FOR EACH ROW
EXECUTE FUNCTION release_client_ad_hold_on_payment_settlement();


-- ============================================================
-- 22. PROTECT APPROVED ADVERTISEMENTS FROM CREATOR EDITING
-- ============================================================
--
-- This is an application/RBAC rule primarily enforced by the API.
--
-- The database additionally records the immutable approval timestamp.
--
-- AD_CREATOR must NOT update an APPROVED advertisement.
--
-- AD_MANAGER / SUPER_ADMIN may perform explicitly permitted
-- administrative updates.
--
-- We intentionally DO NOT create a blanket database trigger here,
-- because PostgreSQL does not know the application's RBAC role
-- without passing trusted session context.
--
-- The service layer will enforce:
--
--   DRAFT      -> creator can edit
--   REJECTED   -> creator can edit
--   SUBMITTED  -> creator cannot edit
--   APPROVED   -> creator cannot edit
--   ON_HOLD    -> creator cannot edit
--   ARCHIVED   -> creator cannot edit
--
-- ============================================================


-- ============================================================
-- 23. APPROVED AD INDEX
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisements_client_workflow
    ON advertisements(client_id, workflow_status);


-- ============================================================
-- 24. SCHEDULE APPROVED ADS LOOKUP
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_schedules_approved_ads
    ON advertisement_schedules(advertisement_id, start_at, end_at);


-- ============================================================
-- 25. PAYMENT RECONCILIATION LOOKUP
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_advertisement_payments_ad_status
    ON advertisement_payments(advertisement_id, payment_status);


-- ============================================================
-- 26. DATA INTEGRITY CHECK
-- ============================================================
--
-- Existing advertisements should have a client after migration.
--
-- We deliberately do not make client_id NOT NULL here if legacy
-- Phase 1 data can contain orphaned advertisements.
--
-- Before Phase 2A API development, existing orphan records should
-- be reviewed and assigned to a client.
--
-- ============================================================


COMMIT;


-- ============================================================
-- END OF PHASE 1B
-- ============================================================
$$$
