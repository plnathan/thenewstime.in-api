-- Apply after existing dashboard migrations. Creation-period cohort reporting.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_dashboard_advertisement_period_metrics(
  p_month integer DEFAULT NULL, p_year integer DEFAULT NULL
)
RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
WITH ads AS (
 SELECT a.id, to_jsonb(a) AS j,
        upper(coalesce(to_jsonb(a)->>'workflow_status','')) AS workflow,
        upper(coalesce(to_jsonb(a)->>'status','')) AS operational,
        a.created_at
 FROM public.advertisements a
), events AS (
 SELECT id, 'drafted'::text AS milestone, created_at AS happened FROM ads
 UNION ALL SELECT id, 'submitted', (j->>'submitted_at')::timestamptz FROM ads WHERE j->>'submitted_at' IS NOT NULL
 UNION ALL SELECT id, 'approved', (j->>'approved_at')::timestamptz FROM ads WHERE j->>'approved_at' IS NOT NULL
 UNION ALL SELECT id, 'activated', (j->>'activated_at')::timestamptz FROM ads WHERE j->>'activated_at' IS NOT NULL
 UNION ALL
 SELECT a.id, CASE upper(e.new_status) WHEN 'DRAFT' THEN 'drafted' WHEN 'SUBMITTED' THEN 'submitted' WHEN 'APPROVED' THEN 'approved' WHEN 'ON_HOLD' THEN 'hold' WHEN 'ARCHIVED' THEN 'archived' END,
        e.event_at
 FROM public.admin_dashboard_events e JOIN ads a ON a.id = e.entity_id
 WHERE e.entity_type = 'advertisements' AND upper(e.new_status) IN ('DRAFT','SUBMITTED','APPROVED','ON_HOLD','ARCHIVED')
 UNION ALL
 SELECT a.id, 'activated', e.event_at
 FROM public.admin_dashboard_events e JOIN ads a ON a.id = e.entity_id
 WHERE e.entity_type = 'advertisements' AND upper(e.event_type) IN ('ACTIVATED','ACTIVATE')
 UNION ALL
 SELECT a.id, CASE upper(h.to_status::text) WHEN 'DRAFT' THEN 'drafted' WHEN 'SUBMITTED' THEN 'submitted' WHEN 'APPROVED' THEN 'approved' WHEN 'ON_HOLD' THEN 'hold' WHEN 'ARCHIVED' THEN 'archived' END,
        CASE WHEN to_jsonb(h)->>'created_at' IS NOT NULL THEN (to_jsonb(h)->>'created_at')::timestamptz
             WHEN to_jsonb(h)->>'changed_at' IS NOT NULL THEN (to_jsonb(h)->>'changed_at')::timestamptz
             ELSE NULL END
 FROM public.advertisement_workflow_history h JOIN ads a ON a.id = h.advertisement_id
 WHERE upper(h.to_status::text) IN ('DRAFT','SUBMITTED','APPROVED','ON_HOLD','ARCHIVED')
 UNION ALL
 SELECT a.id, 'activated',
        CASE WHEN to_jsonb(o)->>'created_at' IS NOT NULL THEN (to_jsonb(o)->>'created_at')::timestamptz
             WHEN to_jsonb(o)->>'event_at' IS NOT NULL THEN (to_jsonb(o)->>'event_at')::timestamptz
             ELSE NULL END
 FROM public.advertisement_operational_audit o JOIN ads a ON a.id = o.advertisement_id
 WHERE upper(o.event_type::text) = 'ACTIVATED'
 UNION ALL
 -- Undated fallback for surviving records; never invent a historical month.
 SELECT id, 'submitted', NULL::timestamptz FROM ads WHERE workflow IN ('SUBMITTED','APPROVED','ON_HOLD','ARCHIVED') AND j->>'submitted_at' IS NULL
 UNION ALL SELECT id, 'approved', NULL::timestamptz FROM ads WHERE workflow IN ('APPROVED','ON_HOLD') OR operational IN ('ACTIVE','PAUSED','COMPLETED')
 UNION ALL SELECT id, 'activated', NULL::timestamptz FROM ads WHERE operational IN ('ACTIVE','PAUSED','COMPLETED')
), current_ads AS (
 SELECT * FROM ads
 WHERE (p_month IS NULL OR extract(month FROM created_at) = p_month)
   AND (p_year IS NULL OR extract(year FROM created_at) = p_year)
), historical AS (
 SELECT e.milestone, count(DISTINCT e.id)::bigint AS amount
 FROM events e JOIN current_ads a ON a.id = e.id
 WHERE e.milestone IS NOT NULL
 GROUP BY e.milestone
), current_counts AS (
 SELECT count(*)::bigint AS total,
        count(*) FILTER (WHERE workflow = 'SUBMITTED')::bigint AS pending,
        count(*) FILTER (WHERE workflow = 'ON_HOLD')::bigint AS hold,
        count(*) FILTER (WHERE workflow = 'ARCHIVED' OR operational = 'ARCHIVED')::bigint AS archived,
        count(*) FILTER (WHERE workflow = 'APPROVED' AND operational = 'ACTIVE'
          AND ((j->>'start_at') IS NULL OR (j->>'start_at')::timestamptz <= now())
          AND ((j->>'end_at') IS NULL OR (j->>'end_at')::timestamptz > now()))::bigint AS live,
        count(*) FILTER (WHERE (j->>'end_at') IS NOT NULL
          AND (j->>'end_at')::timestamptz < now())::bigint AS expired
 FROM current_ads
)
SELECT v.k, v.label, v.amount FROM (VALUES
 ('total'::text, 'Total Advertisements'::text, (SELECT total FROM current_counts)),
 ('drafted', 'Overall Drafted', coalesce((SELECT amount FROM historical WHERE milestone='drafted'),0)),
 ('submitted', 'Overall Submitted', coalesce((SELECT amount FROM historical WHERE milestone='submitted'),0)),
 ('approved', 'Overall Approved', coalesce((SELECT amount FROM historical WHERE milestone='approved'),0)),
 ('activated', 'Overall Activated', coalesce((SELECT amount FROM historical WHERE milestone='activated'),0)),
 ('approvalPending', 'Approval Pending', (SELECT pending FROM current_counts)),
 ('hold', 'Hold', (SELECT hold FROM current_counts)),
 ('archived', 'Archived', (SELECT archived FROM current_counts)),
 ('live', 'Live Ad Count', (SELECT live FROM current_counts)),
 ('expired', 'Schedule Expired', (SELECT expired FROM current_counts))
) AS v(k,label,amount);
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_advertisement_period_metrics(integer, integer) FROM PUBLIC;
COMMIT;
