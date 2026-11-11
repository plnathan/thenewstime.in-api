-- Restores the current paused metric function expected by dashboard.routes.ts.
-- Apply to the same Neon database/branch configured in the backend DATABASE_URL.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_dashboard_current_paused()
RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT 'paused'::text, 'Paused'::text,
         count(DISTINCT s.advertisement_id)::bigint
  FROM public.advertisement_schedules s
  JOIN public.advertisements a ON a.id = s.advertisement_id
  WHERE s.status = 'PAUSED'
    AND a.workflow_status <> 'ARCHIVED';
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_current_paused() FROM PUBLIC;
COMMIT;
