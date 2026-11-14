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

CREATE SEQUENCE IF NOT EXISTS public.advertisement_creative_cleanup_id_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;


-- Step 1: Enable GiST equality support.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Step 2: Verify the extension.
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'btree_gist';

-- Step 3: Verify the sequence.
SELECT to_regclass(
    'public.advertisement_rate_cards_id_seq'
) AS sequence_name;

-- Step 4: Verify whether the table exists.
SELECT to_regclass(
    'public.advertisement_rate_cards'
) AS table_name;


CREATE SEQUENCE IF NOT EXISTS public.advertisement_rate_cards_id_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.advertisement_rate_cards_id_seq
    OWNER TO neondb_owner;


ALTER TABLE public.advertisement_rate_cards
    ALTER COLUMN id
    SET DEFAULT nextval(
        'public.advertisement_rate_cards_id_seq'::regclass
    );

ALTER SEQUENCE public.advertisement_rate_cards_id_seq
    OWNED BY public.advertisement_rate_cards.id;


CREATE SEQUENCE IF NOT EXISTS public.advertisement_pricing_snapshots_id_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.advertisement_pricing_snapshots_id_seq
    OWNER TO neondb_owner;


ALTER SEQUENCE public.advertisement_pricing_snapshots_id_seq
    OWNED BY public.advertisement_pricing_snapshots.id;
	

SELECT
    schemaname,
    sequencename,
    sequenceowner,
    data_type,
    start_value
FROM pg_sequences
WHERE sequencename = 'advertisement_pricing_snapshots_id_seq';

