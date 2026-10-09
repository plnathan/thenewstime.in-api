SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'advertisement_placements'
ORDER BY ordinal_position;

-----------------------------------------

SELECT
    tc.table_name,
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
  AND tc.table_name IN (
      'advertisement_placements',
      'advertisement_placement_rules',
      'advertisement_schedules',
      'advertisement_targets',
      'advertisement_creatives',
      'advertisement_formats'
  )
ORDER BY
    tc.table_name,
    tc.constraint_type,
    tc.constraint_name,
    kcu.ordinal_position;
------------------------------------------------
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
      'advertisement_placements',
      'advertisement_placement_rules',
      'advertisement_schedules',
      'advertisement_targets',
      'advertisement_creatives',
      'advertisement_formats'
  )
ORDER BY tablename, indexname;
-------------------------------------------------    

SELECT
    conname,
    pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.advertisement_placements'::regclass
  AND contype = 'c';
---------------------------------------

SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE client_id IS NULL) AS client_id_null,
    COUNT(*) FILTER (WHERE advertiser_id IS NULL) AS advertiser_id_null,
    COUNT(*) FILTER (
        WHERE client_id IS DISTINCT FROM advertiser_id
    ) AS mismatched
FROM public.advertisements;

-------------------------------

SELECT
    current_database() AS database_name,
    current_schema() AS schema_name,
    current_user AS database_user;

------------------------------    

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'advertisement_clients'
ORDER BY ordinal_position;

---------------------------------
SELECT
    tc.table_name,
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
  AND tc.table_name IN (
    'advertisements',
    'advertisement_placements',
    'advertisement_placement_rules',
    'advertisement_schedules',
    'advertisement_creatives',
    'news_reads'
  )
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;

--------------------
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'roles'
ORDER BY ordinal_position;

-----------------------------------
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
----------------------------------------
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'advertisement_placements'
  AND column_name = 'format_id';
-----------------------------------------
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'advertisement_placements'
  AND indexname = 'idx_advertisement_placements_format_id';  
-------------------------------------
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
-----------------------------
SELECT
    conname,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'chk_advertisements_pricing_fields';	
----------------------------------      
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'advertisement_rate_cards'
ORDER BY ordinal_position;
------------------------------
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
WHERE tc.table_name = 'advertisement_rate_cards'
ORDER BY tc.constraint_name, kcu.ordinal_position;
------------------------------