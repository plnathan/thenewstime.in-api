-- Apply AFTER 20261102_dashboard_event_audit_completion.sql.
-- Fix year-only coverage checks and event-date counting. Historical periods that
-- overlap the start of audit capture remain unknown (NULL), never a false zero.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_dashboard_event_metrics(
 p_module text, p_month integer DEFAULT NULL, p_year integer DEFAULT NULL
) RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE
 coverage timestamptz;
 period_start timestamptz;
 period_end timestamptz;
 complete_period boolean := false;
BEGIN
 IF p_module NOT IN ('news','advertisements') THEN RETURN; END IF;
 IF (p_month IS NOT NULL AND (p_month NOT BETWEEN 1 AND 12)) OR
    (p_year IS NOT NULL AND (p_year NOT BETWEEN 2000 AND 2100)) THEN
   RAISE EXCEPTION 'Invalid dashboard period' USING ERRCODE='22023';
 END IF;
 -- A month without a year spans several years; a complete historical range
 -- cannot be established from a partial audit trail.
 IF p_year IS NOT NULL THEN
   period_start := make_timestamptz(p_year,coalesce(p_month,1),1,0,0,0,'UTC');
   period_end := CASE WHEN p_month IS NULL
     THEN period_start + interval '1 year'
     ELSE period_start + interval '1 month' END;
 END IF;
 SELECT min(event_at) INTO coverage
 FROM public.admin_dashboard_events WHERE entity_type=p_module;
 complete_period := coverage IS NOT NULL
   AND period_start IS NOT NULL AND period_start >= coverage;
 RETURN QUERY
 WITH requested AS (
   SELECT * FROM (VALUES
    ('news','deleted','Deleted News','DELETED'),
    ('advertisements','drafted','Overall Drafted','DRAFT'),
    ('advertisements','submitted','Overall Submitted','SUBMITTED'),
    ('advertisements','approved','Overall Approved','APPROVED'),
    ('advertisements','activated','Overall Activated','ACTIVE'),
    ('advertisements','hold','Hold','ON_HOLD'),
    ('advertisements','archived','Archived','ARCHIVED')
   ) AS v(module,key,label,desired)
   WHERE module=p_module
 ), counted AS (
   SELECT r.key,r.label,
     count(DISTINCT e.entity_id)::bigint AS amount
   FROM requested r
   LEFT JOIN public.admin_dashboard_events e
     ON e.entity_type=p_module
     AND (period_start IS NULL OR e.event_at >= period_start)
     AND (period_end IS NULL OR e.event_at < period_end)
     AND (
       (r.desired='DELETED' AND e.event_type='DELETED') OR
       (r.desired='DRAFT' AND (e.new_workflow='DRAFT'
          AND (e.event_type='CREATED' OR e.old_workflow IS DISTINCT FROM 'DRAFT'))) OR
       (r.desired='ACTIVE' AND e.new_status='ACTIVE'
          AND e.old_status IS DISTINCT FROM 'ACTIVE') OR
       (r.desired NOT IN ('DELETED','DRAFT','ACTIVE')
          AND e.new_workflow=r.desired
          AND e.old_workflow IS DISTINCT FROM r.desired)
     )
   GROUP BY r.key,r.label
 )
 SELECT c.key::text,c.label::text,
   CASE WHEN complete_period THEN c.amount ELSE NULL::bigint END
 FROM counted c;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_event_metrics(text,integer,integer) FROM PUBLIC;
COMMIT;
