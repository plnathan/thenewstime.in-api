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
    'advertisements.submit',
    'Submit Advertisements',
    'Submit advertisements for manager approval.',
    'ADVERTISEMENT',
    'advertisements',
    'submit',
    10,
    true,
    'ACTIVE'
),
(
    'advertisements.approve',
    'Approve Advertisements',
    'Approve submitted advertisements.',
    'ADVERTISEMENT',
    'advertisements',
    'approve',
    11,
    true,
    'ACTIVE'
),
(
    'advertisements.reject',
    'Reject Advertisements',
    'Reject submitted advertisements with a reason.',
    'ADVERTISEMENT',
    'advertisements',
    'reject',
    12,
    true,
    'ACTIVE'
),
(
    'advertisements.hold',
    'Hold Advertisements',
    'Place approved advertisements on hold.',
    'ADVERTISEMENT',
    'advertisements',
    'hold',
    13,
    true,
    'ACTIVE'
),
(
    'advertisements.resume',
    'Resume Advertisements',
    'Resume advertisements from hold.',
    'ADVERTISEMENT',
    'advertisements',
    'resume',
    14,
    true,
    'ACTIVE'
),
(
    'advertisements.archive',
    'Archive Advertisements',
    'Archive advertisements from the approval workflow.',
    'ADVERTISEMENT',
    'advertisements',
    'archive',
    15,
    true,
    'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

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
    'advertisements.activate',
    'Activate Advertisements',
    'Activate archived advertisements for reuse.',
    'ADVERTISEMENT',
    'advertisements',
    'activate',
    16,
    true,
    'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

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
    'advertisements.schedules.read',
    'View Advertisement Schedules',
    'View advertisement schedules.',
    'ADVERTISEMENT',
    'advertisements.schedules',
    'read',
    1,
    true,
    'ACTIVE'
),
(
    'advertisements.schedules.create',
    'Create Advertisement Schedules',
    'Create advertisement schedules.',
    'ADVERTISEMENT',
    'advertisements.schedules',
    'create',
    2,
    true,
    'ACTIVE'
),
(
    'advertisements.schedules.update',
    'Update Advertisement Schedules',
    'Update advertisement schedules.',
    'ADVERTISEMENT',
    'advertisements.schedules',
    'update',
    3,
    true,
    'ACTIVE'
),
(
    'advertisements.schedules.delete',
    'Delete Advertisement Schedules',
    'Delete advertisement schedules.',
    'ADVERTISEMENT',
    'advertisements.schedules',
    'delete',
    4,
    true,
    'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;

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
    'advertisements.schedules.activate',
    'Activate Advertisement Schedules',
    'Activate scheduled advertisements.',
    'ADVERTISEMENT',
    'advertisements.schedules',
    'activate',
    10,
    true,
    'ACTIVE'
),
(
    'advertisements.schedules.pause',
    'Pause Advertisement Schedules',
    'Pause active advertisement schedules.',
    'ADVERTISEMENT',
    'advertisements.schedules',
    'pause',
    11,
    true,
    'ACTIVE'
),
(
    'advertisements.schedules.resume',
    'Resume Advertisement Schedules',
    'Resume paused advertisement schedules.',
    'ADVERTISEMENT',
    'advertisements.schedules',
    'resume',
    12,
    true,
    'ACTIVE'
),
(
    'advertisements.schedules.complete',
    'Complete Advertisement Schedules',
    'Complete active advertisement schedules.',
    'ADVERTISEMENT',
    'advertisements.schedules',
    'complete',
    13,
    true,
    'ACTIVE'
),
(
    'advertisements.schedules.cancel',
    'Cancel Advertisement Schedules',
    'Cancel advertisement schedules.',
    'ADVERTISEMENT',
    'advertisements.schedules',
    'cancel',
    14,
    true,
    'ACTIVE'
)
ON CONFLICT (code) DO NOTHING;