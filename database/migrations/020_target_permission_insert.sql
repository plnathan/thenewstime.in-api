BEGIN;

INSERT INTO permissions
(
    module,
    resource,
    action,
    code,
    display_name,
    description,
    display_order,
    status,
    is_system_permission
)
VALUES
(
    'ADVERTISEMENT',
    'advertisements.targets',
    'read',
    'advertisements.targets.read',
    'View Advertisement Targeting',
    'View targeting rules configured for advertisements.',
    1,
    'ACTIVE',
    TRUE
),
(
    'ADVERTISEMENT',
    'advertisements.targets',
    'create',
    'advertisements.targets.create',
    'Create Advertisement Targeting',
    'Create targeting rules for advertisements.',
    2,
    'ACTIVE',
    TRUE
),
(
    'ADVERTISEMENT',
    'advertisements.targets',
    'update',
    'advertisements.targets.update',
    'Update Advertisement Targeting',
    'Update targeting rules or replace an advertisement targeting configuration.',
    3,
    'ACTIVE',
    TRUE
),
(
    'ADVERTISEMENT',
    'advertisements.targets',
    'delete',
    'advertisements.targets.delete',
    'Delete Advertisement Targeting',
    'Delete targeting rules configured for advertisements.',
    4,
    'ACTIVE',
    TRUE
)
ON CONFLICT (code) DO UPDATE
SET
    module = EXCLUDED.module,
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    status = 'ACTIVE',
    is_system_permission = TRUE;

COMMIT;