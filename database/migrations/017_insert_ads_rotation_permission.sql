/*
 * =============================================================================
 * TheNewsTime.in
 * Advertisement Rotation Permissions
 * =============================================================================
 *
 * Module   : ADVERTISEMENT
 * Resource : advertisements.rotation
 *
 * Permissions:
 *
 *   advertisements.rotation.read
 *   advertisements.rotation.create
 *   advertisements.rotation.update
 *   advertisements.rotation.delete
 *
 * Purpose:
 *   Registers RBAC permissions required by the Advertisement Rotation module.
 *
 * Safe to execute multiple times.
 * Existing permission records are not duplicated.
 * =============================================================================
 */

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
SELECT
  'advertisements.rotation.read',
  'ADVERTISEMENT',
  'advertisements.rotation',
  'read',
  'View Advertisement Rotation',
  'View rotation configuration and rotation members for advertisement placements.',
  1,
  'ACTIVE',
  TRUE
WHERE NOT EXISTS
(
  SELECT 1
  FROM permissions
  WHERE code = 'advertisements.rotation.read'
);

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
SELECT
  'advertisements.rotation.create',
  'ADVERTISEMENT',
  'advertisements.rotation',
  'create',
  'Create Advertisement Rotation Member',
  'Add an advertisement to a placement rotation.',
  2,
  'ACTIVE',
  TRUE
WHERE NOT EXISTS
(
  SELECT 1
  FROM permissions
  WHERE code = 'advertisements.rotation.create'
);

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
SELECT
  'advertisements.rotation.update',
  'ADVERTISEMENT',
  'advertisements.rotation',
  'update',
  'Update Advertisement Rotation',
  'Update placement rotation configuration and rotation member priority or status.',
  3,
  'ACTIVE',
  TRUE
WHERE NOT EXISTS
(
  SELECT 1
  FROM permissions
  WHERE code = 'advertisements.rotation.update'
);

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
SELECT
  'advertisements.rotation.delete',
  'ADVERTISEMENT',
  'advertisements.rotation',
  'delete',
  'Remove Advertisement Rotation Member',
  'Remove an advertisement from a placement rotation.',
  4,
  'ACTIVE',
  TRUE
WHERE NOT EXISTS
(
  SELECT 1
  FROM permissions
  WHERE code = 'advertisements.rotation.delete'
);