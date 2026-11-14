-- Apply after existing dashboard migrations. Creation-period cohort reporting.
BEGIN;
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
), cohort AS (
  SELECT * FROM source
  WHERE (p_month IS NULL OR extract(month FROM created_at) = p_month)
    AND (p_year IS NULL OR extract(year FROM created_at) = p_year)
), deleted_cohort AS (
  -- Only deleted IDs with a recorded creation event can be attributed
  -- reliably to a creation-period cohort.
  SELECT DISTINCT e.entity_id AS id
  FROM public.admin_dashboard_events e
  JOIN public.admin_dashboard_events c
    ON c.entity_type = 'news' AND c.entity_id = e.entity_id
   AND c.event_type = 'CREATED'
  WHERE e.entity_type = 'news' AND e.event_type = 'DELETED'
    AND (p_month IS NULL OR extract(month FROM c.event_at) = p_month)
    AND (p_year IS NULL OR extract(year FROM c.event_at) = p_year)
), cohort_events AS (
  SELECT ne.* FROM news_events ne JOIN cohort c ON c.id = ne.id
  UNION ALL
  SELECT ne.* FROM news_events ne JOIN deleted_cohort dc ON dc.id = ne.id
), historical AS (
  SELECT milestone, count(DISTINCT id)::bigint AS amount
  FROM cohort_events GROUP BY milestone
), current_news AS (
  SELECT * FROM cohort
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
    ('total', 'Total News', (SELECT total FROM current_metrics) + (SELECT count(*) FROM deleted_cohort)),
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
