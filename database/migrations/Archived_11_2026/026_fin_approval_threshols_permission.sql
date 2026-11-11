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
	'View Advertisement Financial Approval',
	'To View Advertisement Financial Approval',
	1,
    'ACTIVE',
	'TRUE'	
),
(
    'advertisements.financial_approval_thresholds.create',
    'ADVERTISEMENT',
    'advertisements.financial_approval_thresholds',
    'create',
    'CREATE Advertisement Financial Approval',
	'To CREATE Advertisement Financial Approval',
	1,
    'ACTIVE',
	'TRUE'	
),
(
    'advertisements.financial_approval_thresholds.update',
    'ADVERTISEMENT',
    'advertisements.financial_approval_thresholds',
    'update',
    'UPDATE Advertisement Financial Approval',
	'To UPDATE Advertisement Financial Approval',
	1,
    'ACTIVE',
	'TRUE'	
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