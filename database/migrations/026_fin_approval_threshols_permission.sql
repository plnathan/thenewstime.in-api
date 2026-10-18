BEGIN;

INSERT INTO permissions
(
    code,
    module,
    resource,
    action,
	display_name,
  	description,
  	display_order,
    status,
	is_system_permission
)
VALUES
(
    'advertisements.financial_approval_thresholds.read',
    'ADVERTISEMENT',
    'advertisements.financial_approval_thresholds',
    'read',
    'ACTIVE',
	'View Advertisement Financial Approva'
),
(
    'advertisements.financial_approval_thresholds.create',
    'ADVERTISEMENT',
    'advertisements.financial_approval_thresholds',
    'create',
    'ACTIVE'
),
(
    'advertisements.financial_approval_thresholds.update',
    'ADVERTISEMENT',
    'advertisements.financial_approval_thresholds',
    'update',
    'ACTIVE'
)
ON CONFLICT (code)
DO UPDATE SET
    module = EXCLUDED.module,
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    status = 'ACTIVE';

COMMIT;

-- Verify the inserted permissions.
SELECT
    id,
    code,
    module,
    resource,
    action,
    status
FROM permissions
WHERE resource = 'advertisements.financial_approval_thresholds'
ORDER BY action;