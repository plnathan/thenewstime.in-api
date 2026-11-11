-- Apply to the same Neon database used by the API. Run in UAT first.
-- Unfiltered lifecycle totals are based on persisted advertisements and their
-- workflow/operational histories, not on the date the dashboard audit began.
-- Does not fabricate events for deleted records or missing historical audits.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_dashboard_advertisement_lifecycle_totals()
RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
 WITH evidence AS (
   SELECT a.id,
     a.workflow_status,
     a.status,
     a.submitted_at,
     a.approved_at,
     EXISTS (SELECT 1 FROM public.advertisement_workflow_history h
             WHERE h.advertisement_id = a.id AND h.to_status = 'SUBMITTED') AS ever_submitted,
     EXISTS (SELECT 1 FROM public.advertisement_workflow_history h
             WHERE h.advertisement_id = a.id AND h.to_status = 'APPROVED') AS ever_approved,
     EXISTS (SELECT 1 FROM public.advertisement_operational_audit o
             WHERE o.advertisement_id = a.id AND o.event_type = 'ACTIVATED') AS ever_activated
   FROM public.advertisements a
 )
 SELECT v.metric_key, v.metric_label, v.metric_value FROM (
   SELECT 1 AS ord, 'drafted'::text AS metric_key, 'Overall Drafted'::text AS metric_label, COUNT(*)::bigint AS metric_value FROM evidence
   UNION ALL SELECT 2, 'submitted', 'Overall Submitted', COUNT(*) FILTER (
      WHERE submitted_at IS NOT NULL OR ever_submitted OR workflow_status IN ('SUBMITTED','APPROVED','ON_HOLD','ARCHIVED'))::bigint FROM evidence
   UNION ALL SELECT 3, 'approved', 'Overall Approved', COUNT(*) FILTER (
      WHERE approved_at IS NOT NULL OR ever_approved OR workflow_status IN ('APPROVED','ON_HOLD')
         OR status IN ('ACTIVE','PAUSED','COMPLETED'))::bigint FROM evidence
   UNION ALL SELECT 4, 'activated', 'Overall Activated', COUNT(*) FILTER (
      WHERE ever_activated OR status IN ('ACTIVE','PAUSED','COMPLETED'))::bigint FROM evidence
   UNION ALL SELECT 5, 'hold', 'Hold', COUNT(*) FILTER (WHERE workflow_status = 'ON_HOLD')::bigint FROM evidence
   UNION ALL SELECT 6, 'archived', 'Archived', COUNT(*) FILTER (
      WHERE workflow_status = 'ARCHIVED' OR status = 'ARCHIVED')::bigint FROM evidence
 ) v ORDER BY v.ord;
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_advertisement_lifecycle_totals() FROM PUBLIC;
COMMIT;
-- SELECT * FROM public.admin_dashboard_advertisement_lifecycle_totals();
