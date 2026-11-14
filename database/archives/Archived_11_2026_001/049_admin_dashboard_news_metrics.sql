-- News Dashboard: lifecycle totals and current-state metrics.
-- Requires public.admin_dashboard_events from the existing dashboard audit migration.
-- "De-Activated" maps to the existing news status ARCHIVED.
-- Historical promotion/deletion activity before audit installation may be incomplete.
BEGIN;

-- The existing generic dashboard trigger records status changes, but not
-- promotion changes. Capture NEW promotions separately for future accuracy.
CREATE OR REPLACE FUNCTION public.capture_admin_dashboard_news_promotion()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp AS $$
DECLARE
  was_promoted boolean;
  is_promoted boolean;
BEGIN
  was_promoted := coalesce(OLD.display_priority, 0) > 0
    AND OLD.display_priority_until IS NOT NULL
    AND OLD.display_priority_until > statement_timestamp()
    AND OLD.status::text = 'PUBLISHED';
  is_promoted := coalesce(NEW.display_priority, 0) > 0
    AND NEW.display_priority_until IS NOT NULL
    AND NEW.display_priority_until > statement_timestamp()
    AND NEW.status::text = 'PUBLISHED';
  -- Record a new promotion or renewal, not routine edits of a promoted article.
  IF is_promoted AND (NOT was_promoted OR
      OLD.display_priority_until IS DISTINCT FROM NEW.display_priority_until) THEN
    INSERT INTO public.admin_dashboard_events
      (entity_type, entity_id, event_type, actor_id, old_status, new_status)
    VALUES
      ('news', NEW.id, 'PROMOTED', NEW.updated_by,
       OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_dashboard_news_promotion ON public.news;
CREATE TRIGGER trg_admin_dashboard_news_promotion
AFTER UPDATE OF display_priority, display_priority_until ON public.news
FOR EACH ROW EXECUTE FUNCTION public.capture_admin_dashboard_news_promotion();

CREATE OR REPLACE FUNCTION public.admin_dashboard_news_metrics(
  p_month integer DEFAULT NULL, p_year integer DEFAULT NULL
)
RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
WITH source AS (
  SELECT
    n.id,
    upper(n.status::text) AS status,
    n.created_at,
    n.drafted_at,
    n.approved_at,
    n.published_at,
    n.display_priority,
    n.display_priority_until
  FROM public.news n
), audit AS (
  SELECT entity_id, event_type, upper(coalesce(new_status, '')) AS new_status,
         event_at
  FROM public.admin_dashboard_events
  WHERE entity_type = 'news'
), news_events AS (
  SELECT id, 'drafted'::text AS milestone, coalesce(drafted_at, created_at) AS occurred_at FROM source
  UNION ALL
  SELECT id, 'approved', approved_at FROM source WHERE approved_at IS NOT NULL
  UNION ALL
  SELECT id, 'published', published_at FROM source WHERE published_at IS NOT NULL
  UNION ALL
  SELECT entity_id, 'drafted', event_at FROM audit
    WHERE new_status = 'DRAFT' OR event_type = 'CREATED'
  UNION ALL
  SELECT entity_id, 'approved', event_at FROM audit WHERE new_status = 'APPROVED'
  UNION ALL
  SELECT entity_id, 'published', event_at FROM audit WHERE new_status = 'PUBLISHED'
  UNION ALL
  SELECT entity_id, 'deactivated', event_at FROM audit WHERE new_status = 'ARCHIVED'
  UNION ALL
  SELECT entity_id, 'promoted', event_at FROM audit WHERE event_type = 'PROMOTED'
  UNION ALL
  SELECT entity_id, 'deleted', event_at FROM audit WHERE event_type = 'DELETED'
  UNION ALL
  -- All-time evidence from surviving records without reliable event dates.
  SELECT id, 'approved', NULL::timestamptz FROM source
    WHERE approved_at IS NULL AND (published_at IS NOT NULL OR status IN ('APPROVED','PUBLISHED','ARCHIVED'))
  UNION ALL
  SELECT id, 'published', NULL::timestamptz FROM source
    WHERE published_at IS NULL AND status = 'PUBLISHED'
  UNION ALL
  SELECT id, 'promoted', NULL::timestamptz FROM source
    WHERE display_priority_until IS NOT NULL
  UNION ALL
  SELECT id, 'deactivated', NULL::timestamptz FROM source
    WHERE status = 'ARCHIVED'
), historical AS (
  SELECT milestone, count(DISTINCT id)::bigint AS amount
  FROM news_events
  WHERE (p_month IS NULL OR extract(month FROM occurred_at) = p_month)
    AND (p_year IS NULL OR extract(year FROM occurred_at) = p_year)
  GROUP BY milestone
), current_news AS (
  SELECT * FROM source
  WHERE (p_month IS NULL OR extract(month FROM created_at) = p_month)
    AND (p_year IS NULL OR extract(year FROM created_at) = p_year)
), current_metrics AS (
  SELECT
    count(*)::bigint AS total,
    count(*) FILTER (WHERE status = 'DRAFT')::bigint AS draft,
    count(*) FILTER (WHERE status = 'APPROVED')::bigint AS approved,
    count(*) FILTER (WHERE status = 'PUBLISHED')::bigint AS published,
    count(*) FILTER (WHERE status = 'PUBLISHED' AND coalesce(display_priority, 0) > 0
      AND display_priority_until > now())::bigint AS promoted,
    count(*) FILTER (WHERE status = 'ARCHIVED')::bigint AS deactivated
  FROM current_news
), computed AS (
  SELECT * FROM (VALUES
    ('total', 'Total News', (SELECT total FROM current_metrics)),
    ('overallDrafted', 'Overall Drafted', coalesce((SELECT amount FROM historical WHERE milestone='drafted'),0)),
    ('overallApproved', 'Overall Approved', coalesce((SELECT amount FROM historical WHERE milestone='approved'),0)),
    ('overallPublished', 'Overall Published', coalesce((SELECT amount FROM historical WHERE milestone='published'),0)),
    ('overallPromoted', 'Overall Promoted', coalesce((SELECT amount FROM historical WHERE milestone='promoted'),0)),
    ('overallDeactivated', 'Overall De-Activated', coalesce((SELECT amount FROM historical WHERE milestone='deactivated'),0)),
    ('overallDeleted', 'Overall Deleted', coalesce((SELECT amount FROM historical WHERE milestone='deleted'),0)),
    ('draft', 'Draft News', (SELECT draft FROM current_metrics)),
    ('approved', 'Approved News', (SELECT approved FROM current_metrics)),
    ('published', 'Published News', (SELECT published FROM current_metrics)),
    ('promoted', 'Promoted News', (SELECT promoted FROM current_metrics)),
    ('deactivated', 'De-Activated', (SELECT deactivated FROM current_metrics)),
    ('deleted', 'Deleted News', coalesce((SELECT amount FROM historical WHERE milestone='deleted'),0))
  ) AS v(k, label, value)
)
SELECT k::text, label::text, value::bigint FROM computed;
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_news_metrics(integer, integer) FROM PUBLIC;
COMMIT;
