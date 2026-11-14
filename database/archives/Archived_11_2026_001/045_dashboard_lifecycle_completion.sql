-- Dashboard lifecycle reporting: schedule pause/resume transitions and current paused counts.
-- Prerequisites: dashboard event audit + period accuracy + audit coverage migrations.
-- Execute in UAT first. Does not alter advertisement business-state transitions.
BEGIN;

-- A schedule can pause without changing advertisements.status. Capture those
-- transitions in the existing append-only dashboard event stream.
CREATE OR REPLACE FUNCTION public.capture_dashboard_schedule_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.admin_dashboard_events
      (entity_type, entity_id, event_type, event_at, actor_id,
       old_status, new_status, old_workflow, new_workflow)
    VALUES
      ('advertisements', NEW.advertisement_id,
       CASE WHEN NEW.status = 'PAUSED' THEN 'SCHEDULE_PAUSED'
            WHEN OLD.status = 'PAUSED' THEN 'SCHEDULE_RESUMED'
            ELSE 'SCHEDULE_STATUS_CHANGED' END,
       clock_timestamp(), NEW.updated_by,
       OLD.status, NEW.status, NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_dashboard_schedule_transition ON public.advertisement_schedules;
CREATE TRIGGER trg_dashboard_schedule_transition
AFTER UPDATE OF status ON public.advertisement_schedules
FOR EACH ROW EXECUTE FUNCTION public.capture_dashboard_schedule_transition();

-- Current paused = distinct ads with a paused schedule, not number of schedules.
CREATE OR REPLACE FUNCTION public.admin_dashboard_current_paused()
RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT 'paused'::text, 'Paused'::text,
         count(DISTINCT s.advertisement_id)::bigint
  FROM public.advertisement_schedules s
  JOIN public.advertisements a ON a.id = s.advertisement_id
  WHERE s.status = 'PAUSED' AND a.workflow_status <> 'ARCHIVED';
$$;

-- Historical counts are only authoritative when coverage was independently
-- verified. Distinct entity counts avoid inflating metrics with repeat events.
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
 IF (p_month IS NOT NULL AND p_month NOT BETWEEN 1 AND 12)
    OR (p_year IS NOT NULL AND p_year NOT BETWEEN 2000 AND 2100)
    OR (p_month IS NOT NULL AND p_year IS NULL) THEN
   RAISE EXCEPTION 'Dashboard month requires a valid year' USING ERRCODE='22023';
 END IF;
 IF p_year IS NOT NULL THEN
   period_start := make_timestamptz(p_year,coalesce(p_month,1),1,0,0,0,'UTC');
   period_end := CASE WHEN p_month IS NULL THEN period_start + interval '1 year'
     ELSE period_start + interval '1 month' END;
 END IF;
 SELECT started_at INTO coverage FROM public.admin_dashboard_audit_coverage
 WHERE entity_type=p_module;
 complete_period := coverage IS NOT NULL AND period_start IS NOT NULL
   AND period_start >= coverage AND period_end <= clock_timestamp();
 RETURN QUERY
 WITH requested AS (
   SELECT * FROM (VALUES
    ('news','deleted','Deleted News','DELETED'),
    ('advertisements','drafted','Overall Drafted','DRAFT'),
    ('advertisements','submitted','Overall Submitted','SUBMITTED'),
    ('advertisements','approved','Overall Approved','APPROVED'),
    ('advertisements','activated','Overall Activated','ACTIVE'),
    ('advertisements','paused','Paused','SCHEDULE_PAUSED'),
    ('advertisements','hold','Hold','ON_HOLD'),
    ('advertisements','archived','Archived','ARCHIVED')
   ) AS v(module,key,label,desired) WHERE module=p_module
 ), counted AS (
   SELECT r.key,r.label,count(DISTINCT e.entity_id)::bigint AS amount
   FROM requested r LEFT JOIN public.admin_dashboard_events e
    ON e.entity_type=p_module AND e.event_at >= period_start
    AND e.event_at < period_end AND (
      (r.desired='DELETED' AND e.event_type='DELETED') OR
      (r.desired='DRAFT' AND e.new_workflow='DRAFT'
        AND (e.event_type='CREATED' OR e.old_workflow IS DISTINCT FROM 'DRAFT')) OR
      (r.desired='ACTIVE' AND e.new_status='ACTIVE'
        AND e.event_type <> 'SCHEDULE_STATUS_CHANGED'
        AND e.old_status IS DISTINCT FROM 'ACTIVE') OR
      (r.desired='SCHEDULE_PAUSED' AND e.event_type='SCHEDULE_PAUSED') OR
      (r.desired NOT IN ('DELETED','DRAFT','ACTIVE','SCHEDULE_PAUSED')
        AND e.new_workflow=r.desired AND e.old_workflow IS DISTINCT FROM r.desired)
    ) GROUP BY r.key,r.label
 )
 SELECT c.key::text,c.label::text,
   CASE WHEN complete_period THEN c.amount ELSE NULL::bigint END FROM counted c;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_current_paused() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_dashboard_event_metrics(text,integer,integer) FROM PUBLIC;
COMMIT;
