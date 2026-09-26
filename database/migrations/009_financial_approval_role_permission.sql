-- ============================================================================
-- TheNewsTime.in
-- 008B — Financial Approval Foundation
--
-- Purpose:
--   Introduce a dedicated approval workflow for:
--     - Discount
--     - Adjustment
--     - Refund
--     - Partial Refund
--
-- Workflow:
--
--   SUBMITTED
--       ├── APPROVED
--       ├── REJECTED
--       └── HOLD
--              ├── APPROVED
--              └── REJECTED
--
-- RBAC role:
--   AD_FINANCE_APPROVER
--
-- This migration is additive and does not modify the existing advertisement
-- or advertisement_payments workflow.
-- ============================================================================


-- ============================================================================
-- 1. FINANCIAL APPROVAL REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS advertisement_financial_approvals
(
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    advertisement_id BIGINT NOT NULL,

    client_id BIGINT NOT NULL,

    payment_id BIGINT,

    approval_type VARCHAR(30) NOT NULL,

    requested_amount NUMERIC(14, 2),

    requested_percentage NUMERIC(7, 4),

    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',

    requested_by BIGINT NOT NULL,

    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    reviewed_by BIGINT,

    reviewed_at TIMESTAMPTZ,

    hold_reason TEXT,

    rejection_reason TEXT,

    approval_remarks TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ad_financial_approvals_advertisement
        FOREIGN KEY (advertisement_id)
        REFERENCES advertisements(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_ad_financial_approvals_client
        FOREIGN KEY (client_id)
        REFERENCES advertisement_clients(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_ad_financial_approvals_payment
        FOREIGN KEY (payment_id)
        REFERENCES advertisement_payments(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_ad_financial_approvals_type
        CHECK
        (
            approval_type IN
            (
                'DISCOUNT',
                'ADJUSTMENT',
                'REFUND',
                'PARTIAL_REFUND'
            )
        ),

    CONSTRAINT chk_ad_financial_approvals_status
        CHECK
        (
            status IN
            (
                'SUBMITTED',
                'HOLD',
                'APPROVED',
                'REJECTED'
            )
        ),

    CONSTRAINT chk_ad_financial_approvals_amount
        CHECK
        (
            requested_amount IS NULL
            OR requested_amount > 0
        ),

    CONSTRAINT chk_ad_financial_approvals_percentage
        CHECK
        (
            requested_percentage IS NULL
            OR
            (
                requested_percentage >= 0
                AND requested_percentage <= 100
            )
        ),

    CONSTRAINT chk_ad_financial_approvals_review_data
        CHECK
        (
            status = 'SUBMITTED'
            OR reviewed_at IS NOT NULL
            OR status = 'HOLD'
        ),

    CONSTRAINT chk_ad_financial_approvals_hold_reason
        CHECK
        (
            status <> 'HOLD'
            OR NULLIF(BTRIM(hold_reason), '') IS NOT NULL
        ),

    CONSTRAINT chk_ad_financial_approvals_rejection_reason
        CHECK
        (
            status <> 'REJECTED'
            OR NULLIF(BTRIM(rejection_reason), '') IS NOT NULL
        )
);


COMMENT ON TABLE advertisement_financial_approvals IS
'Financial approval requests for advertisement discounts, adjustments, refunds and partial refunds.';


COMMENT ON COLUMN advertisement_financial_approvals.approval_type IS
'Financial operation requiring approval: DISCOUNT, ADJUSTMENT, REFUND or PARTIAL_REFUND.';


COMMENT ON COLUMN advertisement_financial_approvals.requested_amount IS
'Amount requested for the financial operation.';


COMMENT ON COLUMN advertisement_financial_approvals.requested_percentage IS
'Percentage requested when the financial operation is percentage-based, such as a discount.';


-- ============================================================================
-- 2. FINANCIAL APPROVAL HISTORY
--
-- Every workflow transition is retained.
--
-- Example:
--
--   SUBMITTED
--       ↓
--   HOLD
--       ↓
--   SUBMITTED
--       ↓
--   APPROVED
--
-- This provides an immutable audit trail.
-- ============================================================================

CREATE TABLE IF NOT EXISTS advertisement_financial_approval_history
(
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    approval_id BIGINT NOT NULL,

    from_status VARCHAR(20),

    to_status VARCHAR(20) NOT NULL,

    action_by BIGINT NOT NULL,

    action_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    remarks TEXT,

    hold_reason TEXT,

    rejection_reason TEXT,

    CONSTRAINT fk_ad_financial_approval_history_approval
        FOREIGN KEY (approval_id)
        REFERENCES advertisement_financial_approvals(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_ad_financial_approval_history_from_status
        CHECK
        (
            from_status IS NULL
            OR from_status IN
            (
                'SUBMITTED',
                'HOLD',
                'APPROVED',
                'REJECTED'
            )
        ),

    CONSTRAINT chk_ad_financial_approval_history_to_status
        CHECK
        (
            to_status IN
            (
                'SUBMITTED',
                'HOLD',
                'APPROVED',
                'REJECTED'
            )
        )
);


COMMENT ON TABLE advertisement_financial_approval_history IS
'Immutable workflow transition history for advertisement financial approvals.';


-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ad_financial_approvals_advertisement
    ON advertisement_financial_approvals (advertisement_id);

CREATE INDEX IF NOT EXISTS idx_ad_financial_approvals_client
    ON advertisement_financial_approvals (client_id);

CREATE INDEX IF NOT EXISTS idx_ad_financial_approvals_payment
    ON advertisement_financial_approvals (payment_id);

CREATE INDEX IF NOT EXISTS idx_ad_financial_approvals_status
    ON advertisement_financial_approvals (status);

CREATE INDEX IF NOT EXISTS idx_ad_financial_approvals_type
    ON advertisement_financial_approvals (approval_type);

CREATE INDEX IF NOT EXISTS idx_ad_financial_approvals_requested_by
    ON advertisement_financial_approvals (requested_by);

CREATE INDEX IF NOT EXISTS idx_ad_financial_approvals_reviewed_by
    ON advertisement_financial_approvals (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_ad_financial_approval_history_approval
    ON advertisement_financial_approval_history (approval_id);

CREATE INDEX IF NOT EXISTS idx_ad_financial_approval_history_action
    ON advertisement_financial_approval_history (action_by);


-- ============================================================================
-- 4. UPDATED_AT TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS set_ad_financial_approvals_updated_at
ON advertisement_financial_approvals;

CREATE TRIGGER set_ad_financial_approvals_updated_at
BEFORE UPDATE
ON advertisement_financial_approvals
FOR EACH ROW
EXECUTE FUNCTION set_advertisement_updated_at();


-- ============================================================================
-- 5. RBAC PERMISSIONS
--
-- Existing permission architecture:
--   module
--   resource
--   action
--   code
--   display_name
--   description
--   display_order
--   is_system_permission
--   status
--
-- These permissions are system permissions and therefore should be created
-- through migration rather than manually through the UI.
-- ============================================================================
-- TheNewsTime.in
-- 008B — Advertisement Financial Approval + Advertisement RBAC Foundation
--
-- Roles:
--
--   AD_CREATOR
--       Ad Creator
--
--   AD_MANAGER
--       Ad Manager
--
--   AD_FINANCE_APPROVER
--       Ad Finance Approver
--
-- The migration is intentionally idempotent.
-- ============================================================================


-- ============================================================================
-- 1. FINANCIAL APPROVAL PERMISSIONS
-- ============================================================================

INSERT INTO permissions
(
    code,
    display_name,
    description,
    module,
    resource,
    action,
    display_order,
    is_system_permission,
    status
)
VALUES
(
    'advertisements.financial_approvals.read',
    'View Financial Approvals',
    'View advertisement financial approval requests.',
    'ADVERTISEMENT',
    'advertisements.financial_approvals',
    'read',
    400,
    TRUE,
    'ACTIVE'
),
(
    'advertisements.financial_approvals.approve',
    'Approve Financial Requests',
    'Approve advertisement discount, adjustment, refund and partial refund requests.',
    'ADVERTISEMENT',
    'advertisements.financial_approvals',
    'approve',
    401,
    TRUE,
    'ACTIVE'
),
(
    'advertisements.financial_approvals.reject',
    'Reject Financial Requests',
    'Reject advertisement discount, adjustment, refund and partial refund requests.',
    'ADVERTISEMENT',
    'advertisements.financial_approvals',
    'reject',
    402,
    TRUE,
    'ACTIVE'
),
(
    'advertisements.financial_approvals.hold',
    'Hold Financial Requests',
    'Place advertisement financial approval requests on hold.',
    'ADVERTISEMENT',
    'advertisements.financial_approvals',
    'hold',
    403,
    TRUE,
    'ACTIVE'
),
(
    'advertisements.payments.read',
    'View Advertisement Payments',
    'View advertisement payment records.',
    'ADVERTISEMENT',
    'advertisements.payments',
    'read',
    200,
    TRUE,
    'ACTIVE'
),
(
    'advertisements.payments.create',
    'Record Advertisement Payments',
    'Record advertisement payments.',
    'ADVERTISEMENT',
    'advertisements.payments',
    'create',
    201,
    TRUE,
    'ACTIVE'
),
(
    'advertisements.payments.update',
    'Update Advertisement Payments',
    'Update advertisement payment records where permitted.',
    'ADVERTISEMENT',
    'advertisements.payments',
    'update',
    202,
    TRUE,
    'ACTIVE'
),
(
    'advertisements.payments.verify',
    'Verify Advertisement Payments',
    'Verify received advertisement payments.',
    'ADVERTISEMENT',
    'advertisements.payments',
    'verify',
    203,
    TRUE,
    'ACTIVE'
),
(
    'advertisements.payments.cancel',
    'Cancel Advertisement Payments',
    'Cancel advertisement payments where permitted.',
    'ADVERTISEMENT',
    'advertisements.payments',
    'cancel',
    204,
    TRUE,
    'ACTIVE'
),
(
    'advertisements.payments.refund',
    'Refund Advertisement Payments',
    'Execute approved advertisement payment refunds.',
    'ADVERTISEMENT',
    'advertisements.payments',
    'refund',
    205,
    TRUE,
    'ACTIVE'
),
(
    'advertisements.clients.read',
    'View Advertisement Clients',
    'View advertisement clients.',
    'ADVERTISEMENT',
    'advertisements.clients',
    'read',
    300,
    TRUE,
    'ACTIVE'
),
(
    'advertisements.clients.create',
    'Create Advertisement Clients',
    'Create advertisement clients.',
    'ADVERTISEMENT',
    'advertisements.clients',
    'create',
    301,
    TRUE,
    'ACTIVE'
),
(
    'advertisements.clients.update',
    'Update Advertisement Clients',
    'Update advertisement clients.',
    'ADVERTISEMENT',
    'advertisements.clients',
    'update',
    302,
    TRUE,
    'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;


-- ============================================================================
-- 6. AD FINANCE APPROVER ROLE
--
-- Existing roles use:
--   code
--   display_name
--   description
--   display_order
--   status
--   created_by
--   updated_by
--
-- created_by / updated_by are intentionally NULL here because this is a
-- system-defined migration role rather than a user-created role.
-- ============================================================================

INSERT INTO roles
(
    code,
    display_name,
    description,
    display_order,
    status,
    created_by,
    updated_by
)
VALUES
(
    'AD_CREATOR',
    'Ad Creator',
    'Creates advertisement clients, advertisements and related advertisement configuration, and submits advertisements for approval.',
    30,
    'ACTIVE',
    NULL,
    NULL
),
(
    'AD_MANAGER',
    'Ad Manager',
    'Manages advertisement operations, approvals, payments, schedules, placements and client payment status.',
    31,
    'ACTIVE',
    NULL,
    NULL
),
(
    'AD_FINANCE_APPROVER',
    'Ad Finance Approver',
    'Approves or rejects advertisement discounts, adjustments, refunds and partial refunds.',
    30,
    'ACTIVE',
    NULL,
    NULL
)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 9. AD CREATOR PERMISSIONS
--
-- Ad Creator:
--
--   CLIENTS
--     READ
--     CREATE
--     UPDATE
--
--   ADVERTISEMENTS
--     READ
--     CREATE
--     UPDATE
--     SUBMIT
--
--   PLACEMENTS
--     READ
--
--   PLACEMENT RULES
--     READ
--
--   SCHEDULES
--     READ
--     CREATE
--     UPDATE
--
--   PAYMENTS
--     READ
--
-- Ad Creator does NOT approve advertisements or financial operations.
-- ============================================================================

INSERT INTO role_permissions
(
    role_id,
    permission_id,
    created_by
)
SELECT
    r.id,
    p.id,
    NULL
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'AD_CREATOR'
  AND p.code IN
  (
      'advertisements.clients.read',
      'advertisements.clients.create',
      'advertisements.clients.update',

      'advertisements.read',
      'advertisements.create',
      'advertisements.update',
      'advertisements.submit',

      'advertisements.placements.read',

      'advertisements.placement_rules.read',

      'advertisements.schedules.read',
      'advertisements.schedules.create',
      'advertisements.schedules.update',

      'advertisement_payments.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- 10. AD MANAGER PERMISSIONS
--
-- Ad Manager has operational control.
--
-- IMPORTANT:
-- Ad Manager does NOT receive financial approval permissions.
--
-- Financial approval belongs exclusively to AD_FINANCE_APPROVER.
-- ============================================================================

INSERT INTO role_permissions
(
    role_id,
    permission_id,
    created_by
)
SELECT
    r.id,
    p.id,
    NULL
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'AD_MANAGER'
  AND p.code IN
  (
      'advertisements.clients.read',
      'advertisements.clients.create',
      'advertisements.clients.update',

      'advertisements.read',
      'advertisements.update',
      'advertisements.approve',
      'advertisements.reject',
      'advertisements.hold',
      'advertisements.activate',
      'advertisements.archive',

      'advertisements.placements.read',
      'advertisements.placements.create',
      'advertisements.placements.update',

      'advertisements.placement_rules.read',
      'advertisements.placement_rules.create',
      'advertisements.placement_rules.update',

      'advertisements.schedules.read',
      'advertisements.schedules.create',
      'advertisements.schedules.update',
      'advertisements.schedules.delete',
      'advertisements.schedules.activate',
      'advertisements.schedules.pause',
      'advertisements.schedules.resume',
      'advertisements.schedules.complete',

      'advertisements.payments.read',
      'advertisements.payments.create',
      'advertisements.payments.update',
      'advertisements.payments.verify',
      'advertisements.payments.cancel',
      'advertisements.payments.refund'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- 7. ASSIGN FINANCIAL APPROVAL PERMISSIONS TO THE ROLE
-- ============================================================================

INSERT INTO role_permissions
(
    role_id,
    permission_id,
    created_by
)
SELECT
    r.id,
    p.id,
    NULL
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'AD_FINANCE_APPROVER'
  AND p.code IN
  (
      'advertisements.financial_approvals.read',
      'advertisements.financial_approvals.approve',
      'advertisements.financial_approvals.reject',
      'advertisements.financial_approvals.hold'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- 12. VERIFICATION QUERIES
--
-- These are SELECT statements only and are useful when manually executing
-- the migration in pgAdmin.
-- ============================================================================

SELECT
    r.code,
    r.display_name,
    r.status
FROM roles r
WHERE r.code IN
(
    'AD_CREATOR',
    'AD_MANAGER',
    'AD_FINANCE_APPROVER'
)
ORDER BY r.display_order;


SELECT
    r.code AS role_code,
    p.code AS permission_code,
    p.display_name AS permission_name
FROM roles r
JOIN role_permissions rp
    ON rp.role_id = r.id
JOIN permissions p
    ON p.id = rp.permission_id
WHERE r.code IN
(
    'AD_CREATOR',
    'AD_MANAGER',
    'AD_FINANCE_APPROVER'
)
ORDER BY
    r.display_order,
    p.display_order;
	
-- ============================================================================
-- END
-- ============================================================================