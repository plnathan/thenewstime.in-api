-- Run after reviewing your existing advertisement_formats schema and permission seed structure.

ALTER TABLE advertisement_formats ADD COLUMN IF NOT EXISTS created_by INTEGER;
ALTER TABLE advertisement_formats ADD COLUMN IF NOT EXISTS updated_by INTEGER;
ALTER TABLE advertisement_formats ADD CONSTRAINT advertisement_formats_mobile_dimensions_check CHECK ((mobile_width_px IS NULL AND mobile_height_px IS NULL) OR (mobile_width_px > 0 AND mobile_height_px > 0));
-- Seed permissions advertisements.formats.read/create/update through your existing RBAC seeding mechanism.

INSERT INTO permissions
    (code, module, resource, action, description,display_name,
		display_order,status,is_system_permission)
VALUES
    (
        'advertisements.formats.read',
        'ADVERTISEMENT',
        'advertisements.formats',
        'read',
        'View advertisement format configuration',
		'View Advertisement Format',
		1,
		'ACTIVE',
		TRUE
    ),
    (
        'advertisements.formats.create',
        'ADVERTISEMENT',
        'advertisements.formats',
        'create',
        'Create advertisement formats',
		'Create Advertisement Format',
		1,
		'ACTIVE',
		TRUE
    ),
    (
        'advertisements.formats.update',
        'ADVERTISEMENT',
        'advertisements.formats',
        'update',
        'Update and activate/deactivate advertisement formats',
		'Update Advertisement Format',
		1,
		'ACTIVE',
		TRUE
    )
ON CONFLICT (code) DO NOTHING;
