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