BEGIN;

INSERT INTO public.permissions
(
    code,
	display_name,
    module,
    resource,
    action,
    description
)
VALUES
(
    'advertisements.creatives.read',
	'READ CREATIVES',
    'ADVERTISEMENT',
    'advertisements.creatives',
    'read',
    'View advertisement creatives and creative previews.'
),
(
    'advertisements.creatives.create',
	'CREATE CREATIVES',
    'ADVERTISEMENT',
    'advertisements.creatives',
    'create',
    'Create advertisement creatives.'
),
(
    'advertisements.creatives.update',
	'UPDATE CREATIVES',
    'ADVERTISEMENT',
    'advertisements.creatives',
    'update',
    'Update advertisement creatives.'
),
(
    'advertisements.creatives.delete',
	'DELETE CREATIVES',
    'ADVERTISEMENT',
    'advertisements.creatives',
    'delete',
    'Deactivate advertisement creatives.'
)
ON CONFLICT (code) DO NOTHING;

COMMIT;