-- Read-only UAT verification. Run as the backend DB role after migration.
SELECT metric_key, metric_label, metric_value
FROM public.admin_dashboard_event_metrics('advertisements',11,2026);
SELECT metric_key, metric_label, metric_value
FROM public.admin_dashboard_event_metrics('news',11,2026);
-- A year that began before capture should remain N/A.
SELECT metric_key, metric_value
FROM public.admin_dashboard_event_metrics('advertisements',NULL,2026);
-- Inspect first available capture timestamp per entity type.
SELECT entity_type,min(event_at) AS first_captured_at,count(*) AS events_recorded
FROM public.admin_dashboard_events GROUP BY entity_type;
-------------------
-- Verify event coverage; both rows must have an independently verified started_at
SELECT entity_type, started_at, verified_at, verification_note
FROM public.admin_dashboard_audit_coverage ORDER BY entity_type;
-- Unverified or pre-capture periods must return NULL, not zero
SELECT * FROM public.admin_dashboard_event_metrics('news', 1, 2026);
SELECT * FROM public.admin_dashboard_event_metrics('advertisements', 1, 2026);
-- Inspect current event stream
SELECT entity_type, event_type, COUNT(*) AS events, MIN(event_at), MAX(event_at)
FROM public.admin_dashboard_events GROUP BY 1,2 ORDER BY 1,2;
--------------------------------
-- Run read-only in UAT. Compare the results to known records and public delivery.
SELECT * FROM public.admin_dashboard_draft_payment_metrics(NULL,NULL);
SELECT * FROM public.admin_dashboard_live_metrics(NULL,NULL);
SELECT * FROM public.admin_dashboard_event_metrics('news',11,2026);
SELECT * FROM public.admin_dashboard_event_metrics('advertisements',11,2026);
SELECT entity_type, started_at, verified_at, verification_note
 FROM public.admin_dashboard_audit_coverage ORDER BY entity_type;
-- Inspect historic deletion evidence, not currently-existing news rows:
SELECT entity_id, event_at FROM public.admin_dashboard_events
 WHERE entity_type='news' AND event_type='DELETED'
 ORDER BY event_at DESC LIMIT 20;
-- Inspect current delivery schedules, including paused/expired:
SELECT status, COUNT(*) FROM public.advertisement_schedules GROUP BY status ORDER BY status;
--------------------------------
-- Run manually against UAT after applying migration.
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgname='trg_dashboard_schedule_transition';
SELECT * FROM public.admin_dashboard_current_paused();
SELECT * FROM public.admin_dashboard_event_metrics('advertisements', 11, 2026);
SELECT * FROM public.admin_dashboard_event_metrics('news', 11, 2026);
SELECT entity_type, started_at, verification_note
FROM public.admin_dashboard_audit_coverage ORDER BY entity_type;
-- Compare against the current schedule state:
SELECT COUNT(DISTINCT advertisement_id) AS paused_schedule_advertisements
FROM public.advertisement_schedules WHERE status='PAUSED';
--------------------------------
SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n
    ON n.oid = p.pronamespace
WHERE p.proname ILIKE '%dashboard%'
ORDER BY p.proname;

--------------------------
-- 1. Overall Dashboard metrics
SELECT *
FROM public.admin_dashboard_metrics(
    'advertisements', NULL, NULL
);

-- 2. Financial classification
SELECT *
FROM public.admin_dashboard_draft_payment_metrics(
    NULL, NULL
);

-- 3. Live advertisements and in-house ads
SELECT *
FROM public.admin_dashboard_live_metrics(
    NULL, NULL
);

-- 4. Advertisement lifecycle events
SELECT *
FROM public.admin_dashboard_event_metrics(
    'advertisements', NULL, NULL
);

-- 5. Permission associations
SELECT *
FROM public.admin_dashboard_permission_associations(
    NULL, NULL
);
--------------------------
-- November 2026
SELECT *
FROM public.admin_dashboard_metrics(
    'advertisements', 11, 2026
);

SELECT *
FROM public.admin_dashboard_event_metrics(
    'advertisements', 11, 2026
);

-- Year 2026 only
SELECT *
FROM public.admin_dashboard_event_metrics(
    'advertisements', NULL, 2026
);
------------------------------

SELECT metric_key, metric_label, metric_value
FROM public.admin_dashboard_current_paused();

------------------------------
SELECT to_regprocedure('public.admin_dashboard_current_paused()') AS function_exists;
SELECT * FROM public.admin_dashboard_current_paused();
-- Confirm the API connects to this exact database/branch:
SELECT current_database(), current_schema(), current_user, inet_server_addr();
------------------------------
SELECT *
FROM public.admin_dashboard_advertisement_lifecycle_totals();
------------------------------
SELECT * FROM public.admin_dashboard_advertisement_period_metrics(NULL, NULL);
SELECT * FROM public.admin_dashboard_advertisement_period_metrics(10, 2026);
SELECT * FROM public.admin_dashboard_advertisement_period_metrics(11, 2026);
