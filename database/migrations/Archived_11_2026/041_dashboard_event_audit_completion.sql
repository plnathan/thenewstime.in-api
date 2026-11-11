-- Apply AFTER 20261102_dashboard_reporting_consolidation.sql.
-- Additive audit trail for FUTURE transitions and permanent deletions.
-- Historical events which were not persisted cannot be reconstructed.
BEGIN;
CREATE TABLE IF NOT EXISTS public.admin_dashboard_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('news', 'advertisements')),
  entity_id bigint NOT NULL,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_id bigint NULL,
  old_status text NULL,
  new_status text NULL,
  old_workflow text NULL,
  new_workflow text NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_dashboard_events_lookup
  ON public.admin_dashboard_events(entity_type, event_type, event_at, entity_id);

CREATE OR REPLACE FUNCTION public.capture_admin_dashboard_event()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  before_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  old_status text := upper(coalesce(before_row->>'status',''));
  new_status text := upper(coalesce(after_row->>'status',''));
  old_workflow text := upper(coalesce(before_row->>'workflow_status',''));
  new_workflow text := upper(coalesce(after_row->>'workflow_status',''));
  entity text := TG_TABLE_NAME;
  entity_id bigint := coalesce((after_row->>'id')::bigint,(before_row->>'id')::bigint);
  actor bigint := nullif(coalesce(after_row->>'updated_by', after_row->>'published_by',after_row->>'approved_by',after_row->>'created_by'), '')::bigint;
  kind text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    kind := 'DELETED';
  ELSIF TG_OP = 'INSERT' THEN
    kind := 'CREATED';
  ELSIF old_status IS DISTINCT FROM new_status OR old_workflow IS DISTINCT FROM new_workflow THEN
    kind := 'STATUS_CHANGED';
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO public.admin_dashboard_events
    (entity_type,entity_id,event_type,actor_id,old_status,new_status,old_workflow,new_workflow)
  VALUES (entity,entity_id,kind,actor,old_status,new_status,old_workflow,new_workflow);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_admin_dashboard_news_events ON public.news;
CREATE TRIGGER trg_admin_dashboard_news_events AFTER INSERT OR UPDATE OR DELETE ON public.news
FOR EACH ROW EXECUTE FUNCTION public.capture_admin_dashboard_event();
DROP TRIGGER IF EXISTS trg_admin_dashboard_advertisement_events ON public.advertisements;
CREATE TRIGGER trg_admin_dashboard_advertisement_events AFTER INSERT OR UPDATE OR DELETE ON public.advertisements
FOR EACH ROW EXECUTE FUNCTION public.capture_admin_dashboard_event();

-- Counts based on durable transitions. All-time event counts remain N/A because
-- historical records predating this trigger cannot be reconstructed.
-- Pause delivery is represented in schedule state, not necessarily ad status,
-- and is intentionally not overridden by this function.
CREATE OR REPLACE FUNCTION public.admin_dashboard_event_metrics(
 p_module text, p_month integer DEFAULT NULL, p_year integer DEFAULT NULL
) RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE
 coverage timestamptz;
BEGIN
 IF p_module NOT IN ('news','advertisements') THEN RETURN; END IF;
 IF (p_month IS NOT NULL AND (p_month < 1 OR p_month > 12)) OR
    (p_year IS NOT NULL AND (p_year < 2000 OR p_year > 2100)) THEN
   RAISE EXCEPTION 'Invalid dashboard period' USING ERRCODE='22023';
 END IF;
 SELECT min(event_at) INTO coverage FROM public.admin_dashboard_events WHERE entity_type=p_module;
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
   SELECT r.key, r.label, r.desired,
    count(DISTINCT e.entity_id) FILTER (
      WHERE e.event_at IS NOT NULL
        AND (p_month IS NULL OR extract(month FROM e.event_at)=p_month)
        AND (p_year IS NULL OR extract(year FROM e.event_at)=p_year)
    )::bigint AS amount
   FROM requested r LEFT JOIN public.admin_dashboard_events e
     ON e.entity_type=p_module AND (
       (r.desired='DELETED' AND e.event_type='DELETED') OR
       (r.desired='DRAFT' AND (e.new_workflow='DRAFT' OR (e.event_type='CREATED' AND e.new_workflow=''))) OR
       (r.desired='ACTIVE' AND e.new_status='ACTIVE' AND e.old_status IS DISTINCT FROM 'ACTIVE') OR
       (r.desired='PAUSED' AND e.new_status='PAUSED' AND e.old_status IS DISTINCT FROM 'PAUSED') OR
       (r.desired NOT IN ('DELETED','DRAFT','ACTIVE','PAUSED')
         AND e.new_workflow=r.desired AND e.old_workflow IS DISTINCT FROM r.desired)
     )
   GROUP BY r.key,r.label,r.desired
 )
 SELECT c.key::text,c.label::text,
  CASE WHEN coverage IS NULL OR (p_month IS NULL AND p_year IS NULL) THEN NULL::bigint
       WHEN p_year IS NOT NULL AND make_date(p_year,coalesce(p_month,1),1)::timestamptz < date_trunc('month',coverage)
         THEN NULL::bigint
       ELSE c.amount END
 FROM counted c;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_event_metrics(text,integer,integer) FROM PUBLIC;
COMMIT;
