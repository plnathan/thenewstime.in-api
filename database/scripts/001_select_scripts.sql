SELECT
    ordinal_position,
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'advertisements'
ORDER BY ordinal_position;

----------------------------

SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'advertisements'
ORDER BY tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

-----------------------------

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'advertisement_payments'
ORDER BY ordinal_position;

------------------------------
SELECT
    conname,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'advertisements'::regclass
ORDER BY conname;

------------------------------

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'advertisements'
  AND (
      column_name ILIKE '%workflow%'
      OR column_name ILIKE '%submitted%'
      OR column_name ILIKE '%approved%'
      OR column_name ILIKE '%rejected%'
      OR column_name ILIKE '%payment%'
      OR column_name ILIKE '%amount%'
      OR column_name ILIKE '%hold%'
  )
ORDER BY ordinal_position;

------------------------------

SELECT
    p.id,
    p.module,
    p.resource,
    p.action,
    p.code,
    p.status
FROM permissions p
WHERE LOWER(p.module) = 'advertisement'
  AND LOWER(p.resource) = 'advertisements'
ORDER BY p.action;

-------------------------------------

SELECT
    r.id AS role_id,
    r.code AS role_code,
    p.id AS permission_id,
    p.code AS permission_code,
    p.status AS permission_status
FROM roles r
JOIN role_permissions rp
    ON rp.role_id = r.id
JOIN permissions p
    ON p.id = rp.permission_id
WHERE LOWER(p.module) = 'advertisement'
  AND LOWER(p.resource) = 'advertisements'
ORDER BY r.code, p.action;

-----------------------------

SELECT
    u.id AS user_id,
    u.username,
    u.role_id,
    r.code AS role_code,
    r.status AS role_status
FROM users u
LEFT JOIN roles r
    ON r.id = u.role_id
WHERE u.username IN (
    'superadmin',
    'admin',
    'testadmin'
)
ORDER BY u.id;

-------------------------------

SELECT
    rp.role_id,
    r.code AS role_code,
    p.id AS permission_id,
    p.code AS permission_code,
    p.status AS permission_status
FROM role_permissions rp
JOIN roles r
    ON r.id = rp.role_id
JOIN permissions p
    ON p.id = rp.permission_id
WHERE p.id IN (
    180, 181, 182,
    231, 232, 233, 234, 235, 236
)
ORDER BY r.code, p.id;

-------------------------
SELECT
    r.id,
    p.id,
    1
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.module = 'SECURITY'
  AND p.status = 'ACTIVE'
-------------------------

SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
LEFT JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'advertisement_placement_rules'
ORDER BY tc.constraint_name, kcu.ordinal_position;

---------------------

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'advertisement_placement_rules'
ORDER BY ordinal_position;

----------------------

SELECT
    id,
    module,
    code,
    display_name,
    status
FROM permissions
WHERE module = 'ADVERTISEMENT'
ORDER BY code;

---------------------------SELECT
    id,
    module,
    resource,
    action,
    code,
    display_name,
    status
FROM permissions
WHERE module = 'ADVERTISEMENT'
ORDER BY resource, action, code;

---------------------------
SELECT
id,
module,
resource,
action,
code,
display_name,
status
FROM permissions
WHERE code IN (
'advertisements.create',
'advertisements.placement_rules.read',
'advertisements.placement_rules.create',
'advertisements.placement_rules.update',
'advertisements.placement_rules.delete'
)
ORDER BY code;

----------------------------

SELECT
r.id AS role_id,
r.code AS role_code,
p.id AS permission_id,
p.module,
p.resource,
p.action,
p.code AS permission_code,
p.status
FROM roles r
JOIN role_permissions rp
ON rp.role_id = r.id
JOIN permissions p
ON p.id = rp.permission_id
WHERE r.code LIKE 'TEST_AD_PLACEMENT_RULE_ROLE_%'
ORDER BY p.code;

-----------------------------

SELECT
    id,
    module,
    resource,
    action,
    code,
    display_name,
    status
FROM permissions
WHERE module = 'ADVERTISEMENT'
  AND (
      resource = 'advertisements'
      OR resource = 'advertisements.placement_rules'
  )
ORDER BY resource, action;

----------------------------
SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'advertisements' ORDER BY ordinal_position;

--------------------------------
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'advertisements'
  AND column_name = 'is_house_ad';
  -------------------------------
  SELECT
    column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'advertisements'
  AND column_name = 'is_house_ad';
  --------------------------------
  SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'advertisements'
ORDER BY ordinal_position;

---------------------------------
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.advertisement_placements'::regclass
ORDER BY conname;
----------------------------------
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.advertisement_placements'::regclass
  AND conname = 'chk_advertisement_placements_type';
---------------------------------
  SELECT DISTINCT placement_type
FROM public.advertisement_placements
ORDER BY placement_type;
---------------------------------
SELECT COUNT(*) AS placement_count
FROM public.advertisement_placements;
----------------------------------
SELECT
    id,
    code,
    display_name,
    description,
    module,
    resource,
    action,
    display_order,
    is_system_permission,
    status
FROM permissions
WHERE resource = 'advertisements.schedules'
ORDER BY display_order, id;
---------------------------------
SELECT
    id,
    code,
    display_name,
    module,
    resource,
    action,
    display_order,
    is_system_permission,
    status
FROM permissions
WHERE code LIKE 'advertisements.%'
ORDER BY display_order, id;
------------------------------
SELECT
    id,
    advertisement_amount,
    discount_percentage,
    discount_amount,
    advance_percentage,
    advance_amount,
    adjustment_amount
FROM public.advertisements
ORDER BY id
LIMIT 10;
-------------------------------
SELECT
    id,
    advertisement_id,
    amount,
    payment_type,
    payment_status
FROM public.advertisement_payments
ORDER BY id
LIMIT 20;
------------------------------
SELECT
    id,
    client_code,
    payment_attention_required
FROM public.advertisement_clients
ORDER BY id
LIMIT 20;
------------------------------
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roles'
ORDER BY ordinal_position;

select * from permissions where module ='ADVERTISEMENT'
-- ====================
SELECT r.id AS role_id, r.display_name AS role_name, p.id AS permission_id, p.code AS permission_code, p.status AS permission_status FROM roles r JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id WHERE r.id = 773 AND p.code IN ( 'advertisements.creatives.read', 'advertisements.creatives.create', 'advertisements.creatives.update', 'advertisements.creatives.delete' ) ORDER BY p.code;
--INSERT INTO role_permissions ( role_id, permission_id ) SELECT 773, p.id FROM permissions p WHERE p.code IN ( 'advertisements.creatives.read', 'advertisements.creatives.create', 'advertisements.creatives.update', 'advertisements.creatives.delete' ) AND NOT EXISTS ( SELECT 1 FROM role_permissions rp WHERE rp.role_id = 773 AND rp.permission_id = p.id );
-- OR

-------------------------------

INSERT INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    773,
    p.id
FROM permissions p
WHERE p.code IN (
    'advertisements.creatives.read',
    'advertisements.creatives.create',
    'advertisements.creatives.update',
    'advertisements.creatives.delete'
)
AND p.status = 'ACTIVE'
AND NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_id = 773
      AND rp.permission_id = p.id
);
-------------------------
SELECT
    u.id AS user_id,
    u.username,
    r.id AS role_id,
    r.display_name AS role_name,
    p.id AS permission_id,
    p.code,
    p.module,
    p.resource,
    p.action,
    p.status AS permission_status
FROM users u
LEFT JOIN user_roles ur
    ON ur.user_id = u.id
LEFT JOIN roles r
    ON r.id = ur.role_id
LEFT JOIN role_permissions rp
    ON rp.role_id = r.id
LEFT JOIN permissions p
    ON p.id = rp.permission_id
WHERE u.username = 'threshold_creator_1790318984036'
  AND (
      p.resource = 'advertisements.creatives'
      OR p.resource = 'advertisements'
      OR p.resource IS NULL
  )
ORDER BY p.resource, p.action;
----------------------------------------------
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'role_permissions'
ORDER BY ordinal_position;
------------------------------
SELECT
    id,
    name
FROM roles
WHERE id = 773;
------------------------------
SELECT
    id,
    code,
    status
FROM permissions
WHERE code LIKE 'advertisements.creatives.%'
ORDER BY code;
-------------------------------
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

---------------------------

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
------------------------------    
SELECT
    id,
    code,
    module,
    resource,
    action,
    status
FROM permissions
WHERE resource = 'advertisements.creatives'
ORDER BY action;
-----------------------------
SELECT
  id,
  code,
  module,
  resource,
  action,
  display_name,
  status,
  is_system_permission
FROM permissions
WHERE resource = 'advertisements.rotation'
ORDER BY display_order, id;
---------------------------------------------
SELECT
    id,
    code,
    format_id
FROM advertisement_placements
ORDER BY id;
------------------------------
SELECT
    *
FROM advertisement_placements
select * from public.advertisement_formats
select * from advertisements
ORDER BY id;
SELECT
    constraint_name,
    table_name,
    column_name,
    foreign_table_name,
    foreign_column_name
FROM information_schema.key_column_usage
WHERE table_name = 'advertisement_placements'
  AND column_name = 'format_id';
------------------------------
SELECT
    kcu.constraint_name,
    kcu.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.key_column_usage AS kcu
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = kcu.constraint_name
    AND ccu.constraint_schema = kcu.constraint_schema
WHERE kcu.table_name = 'advertisement_placements'
  AND kcu.column_name = 'format_id';  
------------------------------
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'advertisement_placements'
  AND column_name = 'format_id';
------------------------------
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'advertisement_placements'
  AND indexname = 'idx_advertisement_placements_format_id'; 
-------------------------------
SELECT
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'advertisements'
ORDER BY ordinal_position;  
------------------------------
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'advertisements'
  AND column_name IN (
      'pricing_unit',
      'pricing_quantity',
      'standard_amount',
      'agreed_amount',
      'advertisement_amount',
      'discount_percentage',
      'discount_amount',
      'advance_percentage',
      'advance_amount',
      'adjustment_amount',
      'currency_code'
  )
ORDER BY column_name;
------------------------------
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
      column_name ILIKE '%rate%'
      OR column_name ILIKE '%pricing%'
      OR column_name IN (
          'pricing_unit',
          'pricing_quantity',
          'pricing_placement_id',
          'standard_amount'
      )
  )
ORDER BY
    table_name,
    ordinal_position;
-------------------------------          
SELECT
    ordinal_position,
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'advertisements'
ORDER BY ordinal_position;
------------------------------
SELECT
    *
FROM public.advertisement_placements
ORDER BY id;
------------------------------
SELECT
    id,
    advertisement_id,
    placement_id,
    status,
    created_at
FROM advertisement_placement_rules
WHERE advertisement_id = 1688
ORDER BY id DESC;
-------------------------------
SELECT
    id,
    advertisement_id,
    placement_id,
    placement_rule_id,
    start_at,
    end_at,
    status,
    priority,
    created_at,
    updated_at
FROM advertisement_schedules
WHERE advertisement_id = 1692
ORDER BY id DESC;

SELECT
    id,
    advertisement_id,
    amount,
    payment_type,
    payment_method,
    transaction_reference,
    payment_status,
    payment_date,
    created_at
FROM advertisement_payments
WHERE BTRIM(transaction_reference) = BTRIM('cash')
ORDER BY created_at DESC;
------------------------------------
SELECT
    id,
    name,
    pricing_placement_id,
    pricing_unit,
    pricing_quantity,
    standard_amount,
    advertisement_amount
FROM advertisements
WHERE id = 1525;
------------------------------------
SELECT
    approval_type,
    COUNT(*) AS active_count,
    ARRAY_AGG(id ORDER BY updated_at DESC NULLS LAST, id DESC) AS threshold_ids
FROM public.advertisement_financial_approval_thresholds
WHERE status = 'ACTIVE'
GROUP BY approval_type
HAVING COUNT(*) > 1
ORDER BY approval_type;
-------------------------------------
SELECT
    id,
    approval_type,
    amount_threshold,
    percentage_threshold,
    status,
    created_at,
    updated_at,
    created_by,
    updated_by
FROM public.advertisement_financial_approval_thresholds
WHERE approval_type in('DISCOUNT','REFUND') 
  AND status = 'ACTIVE'
ORDER BY updated_at DESC NULLS LAST, id DESC;  
--------------------------------------------
SELECT
    id,
    approval_type,
    amount_threshold,
    percentage_threshold,
    status
FROM public.advertisement_financial_approval_thresholds
WHERE amount_threshold IS NOT NULL
  AND percentage_threshold IS NOT NULL;
--------------------------------------------
SELECT
    approval_type,
    COUNT(*) AS active_count,
    ARRAY_AGG(id ORDER BY id) AS threshold_ids
FROM public.advertisement_financial_approval_thresholds
WHERE status = 'ACTIVE'
GROUP BY approval_type
HAVING COUNT(*) > 1;
--------------------------------------------
SELECT
    payment_status,
    payment_type,
    COUNT(*) AS payment_count,
    COALESCE(SUM(amount), 0) AS total_amount
FROM advertisement_payments
WHERE advertisement_id = 2122 
GROUP BY payment_status, payment_type
ORDER BY payment_status, payment_type;
------------------------------------------
SELECT
    a.id AS advertisement_id,
    a.name AS advertisement_name,
    a.advertisement_amount,
    a.discount_amount,
    a.adjustment_amount,
    a.advance_amount,

    COALESCE(
        (
            SELECT SUM(p.amount)
            FROM advertisement_payments p
            WHERE p.advertisement_id = a.id
              AND p.payment_status IN ('VERIFIED', 'REFUNDED')
        ),
        0
    ) AS verified_payment_amount,

    COALESCE(
        (
            SELECT SUM(pr.amount)
            FROM advertisement_payment_refunds pr
            INNER JOIN advertisement_payments p
                ON p.id = pr.payment_id
            WHERE p.advertisement_id = a.id
        ),
        0
    ) AS refunded_amount,

    (
        SELECT COUNT(*)
        FROM advertisement_payments p
        WHERE p.advertisement_id = a.id
    ) AS total_payment_records

FROM advertisements a
WHERE a.id = 2122;
------------------------------------------
SELECT
    current_database() AS database_name,
    current_schema() AS schema_name,
    current_user AS connected_user,
    current_setting('search_path') AS search_path;
	
SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_name = 'advertisement_placements';
----------------------------------
SELECT
    conname,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.advertisement_placements'::regclass
  AND conname = 'chk_advertisement_placements_type';

------------------
SELECT
    a.id,
    a.name,
    a.workflow_status,
    a.status,
    a.start_at,
    a.end_at,
    oa.event_type AS latest_event,
    oa.performed_by,
    oa.created_at AS event_date
FROM public.advertisements a
LEFT JOIN LATERAL (
    SELECT event_type, performed_by, created_at
    FROM public.advertisement_operational_audit
    WHERE advertisement_id = a.id
    ORDER BY id DESC
    LIMIT 1
) oa ON TRUE
WHERE a.id = 2351;
-------------------
SELECT
    id,
    approval_type,
    amount_threshold,
    percentage_threshold,
    status
FROM advertisement_financial_approval_thresholds
WHERE approval_type = 'DISCOUNT'
ORDER BY id;
---------------------
SELECT
    id,
    workflow_status,
    pricing_placement_id,
    pricing_unit,
    pricing_quantity,
    standard_amount,
    discount_percentage,
    discount_amount,
    advertisement_amount,
    advance_percentage,
    advance_amount
FROM advertisements
WHERE id = 1692;
--------------------------
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
      column_name = 'client_event_id'
      OR column_name ILIKE '%impression%'
  )
ORDER BY table_name, column_name;
---------------------------------
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef ILIKE '%client_event_id%';
----------------------------------
SELECT
    client_event_id,
    COUNT(*) AS record_count
FROM advertisement_impressions
WHERE client_event_id = 'ce790284-a7a1-468c-b0b7-3964ef7e523c'
GROUP BY client_event_id;

-------------------------
SELECT *
FROM advertisement_creative_cleanup
WHERE advertisement_id = 2340;

SELECT
    id AS creative_id,
    advertisement_id,
    status AS creative_status,
    media_url
FROM advertisement_creatives
WHERE advertisement_id = 2340
ORDER BY id;

SELECT
    id,
    advertisement_id,
    creative_id,
    status,
    attempts,
    last_error,
    next_attempt_at,
    NOW() AS current_db_time
FROM advertisement_creative_cleanup
WHERE advertisement_id = 2340;

SELECT
    advertisement_id,
    creative_id,
    public_id,
    status,
    attempts,
    last_error,
    deleted_at
FROM advertisement_creative_cleanup
WHERE advertisement_id = 2340;


SELECT
    id,
    workflow_status,
    start_at,
    end_at,
    pricing_placement_id,
    pricing_unit,
    pricing_quantity,
    standard_amount,
    advertisement_amount
FROM advertisements
WHERE id = 1692;
------------------------
SELECT *
FROM advertisement_placement_rules
WHERE advertisement_id = 1692;

--------------------
SELECT
    table_name,
    column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('advertisement_id', 'placement_id')
ORDER BY table_name, column_name;
------------------------------
select * from roles
select * from permissions where resource = 'advertisements.formats'
select * from user_roles
select * from role_permissions
select * from users
select * from news
select * from media_assets
select * from news_media
select * from categories

select * from advertisements order by id desc
select * from advertisements where id = 2782   
select * from public.advertisement_clients where id = 120
select * from advertisement_payment_refunds
select * from advertisement_placements where page_typ = 'HOME_BETWEEN_SECTIONS_SLOT_1'
select * from advertisement_placement_rules where placement_id = 506
select * from advertisement_creatives where advertisement_id = 2341 
select * from advertisement_schedules where advertisement_id = 2350
select * from advertisement_rate_cards
select * from advertisement_rotation_members
select * from advertisement_targets
select * from advertisement_payments
select * from advertisement_pricing_snapshots
select * from advertisement_workflow_history
select * from advertisement_campaigns
select * from advertisement_financial_approval_thresholds where approval_type='REFUND';
select * from public.advertisement_schedules wher
select * from public.advertisement_formats
select * from public.advertisement_impressions order by impression_at desc limit 100
select * from advertisement_operational_audit
--------------------
SELECT
    advertisement_id,
    placement_id,
    status,
    start_at,
    end_at
FROM advertisement_schedules
WHERE advertisement_id = 1;

SELECT
    NOW() AS current_database_time,
    id,
    start_at,
    end_at,
    NOW() >= start_at AS has_started,
    NOW() < end_at AS has_not_expired
FROM advertisements
WHERE id = 1;

SELECT
    NOW() AS current_utc,
    NOW() AT TIME ZONE 'Asia/Kolkata' AS current_ist,

    a.start_at AS stored_start_utc,
    a.start_at AT TIME ZONE 'Asia/Kolkata'
        AS stored_start_ist,

    a.end_at AS stored_end_utc,
    a.end_at AT TIME ZONE 'Asia/Kolkata'
        AS stored_end_ist

FROM advertisements a
WHERE a.id = 1;
SELECT
    a.id,
    a.is_house_ad,
    a.workflow_status,
    a.status,
    a.start_at,
    a.end_at,
    NOW() BETWEEN a.start_at AND a.end_at
        AS within_advertisement_schedule
FROM advertisements a
WHERE a.id = 1;

SELECT
    p.id AS placement_id,
    p.code AS placement_code,
    p.page_type,
    p.placement_type,
    p.status AS placement_status,
    p.is_enabled,
    p.fallback_behavior,
    p.fallback_advertisement_id,
    p.rotation_enabled,
    pr.id AS placement_rule_id,
    pr.status AS placement_rule_status,
    s.id AS schedule_id,
    s.status AS schedule_status,
    s.start_at AS schedule_start,
    s.end_at AS schedule_end,
    c.id AS creative_id,
    c.status AS creative_status,
    c.media_url
FROM advertisement_placements p
LEFT JOIN advertisement_placement_rules pr
    ON pr.placement_id = p.id
    AND pr.advertisement_id = 1
LEFT JOIN advertisement_schedules s
    ON s.placement_id = p.id
    AND s.advertisement_id = 1
LEFT JOIN advertisement_creatives c
    ON c.advertisement_id = 1
WHERE p.fallback_advertisement_id = 1
   OR pr.advertisement_id = 1
   OR s.advertisement_id = 1
ORDER BY p.id, pr.id, s.id, c.id;
