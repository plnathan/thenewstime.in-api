-- ============================================================
-- Advertisement Placement Rules Permissions
-- ============================================================
-- Module  : ADVERTISEMENT
-- Resource: advertisements.placement_rules
-- Actions : read, create, update, delete
-----------------------------------------

-- NOTE:
--   advertisements.placements.* is reserved for the
--   Advertisement Placement Management module.
-----------------------------------------------

--   Placement Rules intentionally use the separate resource:
--   advertisements.placement_rules
-- ============================================================

INSERT INTO permissions
(
module,
resource,
action,
code,
display_name,
display_order,
is_system_permission,
status
)
VALUES
(
'ADVERTISEMENT',
'advertisements.placement_rules',
'read',
'advertisements.placement_rules.read',
'View Advertisement Placement Rules',
1,
TRUE,
'ACTIVE'
),
(
'ADVERTISEMENT',
'advertisements.placement_rules',
'create',
'advertisements.placement_rules.create',
'Create Advertisement Placement Rules',
2,
TRUE,
'ACTIVE'
),
(
'ADVERTISEMENT',
'advertisements.placement_rules',
'update',
'advertisements.placement_rules.update',
'Update Advertisement Placement Rules',
3,
TRUE,
'ACTIVE'
),
(
'ADVERTISEMENT',
'advertisements.placement_rules',
'delete',
'advertisements.placement_rules.delete',
'Delete Advertisement Placement Rules',
4,
TRUE,
'ACTIVE'
)
ON CONFLICT (code) DO UPDATE
SET
module = EXCLUDED.module,
resource = EXCLUDED.resource,
action = EXCLUDED.action,
display_name = EXCLUDED.display_name,
display_order = EXCLUDED.display_order,
is_system_permission = EXCLUDED.is_system_permission,
status = EXCLUDED.status;
