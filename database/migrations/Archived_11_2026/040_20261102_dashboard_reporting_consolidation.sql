-- Dashboard reporting consolidation, applied after 20261102_admin_dashboard_metrics.sql.
-- Read-only functions. Execute using the same trusted backend database role.
-- Payment allocation follows verified receipts minus recorded refunds; never treats
-- an unverified RECEIVED payment as settled.
CREATE OR REPLACE FUNCTION public.admin_dashboard_draft_payment_metrics(
  p_month integer DEFAULT NULL, p_year integer DEFAULT NULL
) RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
 WITH drafts AS (
   SELECT a.id, GREATEST(COALESCE(a.advance_amount, 0), 0)::numeric AS required,
          a.created_at
   FROM public.advertisements a WHERE a.workflow_status = 'DRAFT'
     AND (p_month IS NULL OR EXTRACT(MONTH FROM a.created_at) = p_month)
     AND (p_year IS NULL OR EXTRACT(YEAR FROM a.created_at) = p_year)
 ), receipts AS (
   SELECT p.advertisement_id,
          SUM(CASE WHEN p.payment_status = 'VERIFIED' THEN p.amount ELSE 0 END)::numeric AS verified
   FROM public.advertisement_payments p GROUP BY p.advertisement_id
 ), refunds AS (
   SELECT p.advertisement_id, SUM(r.amount)::numeric AS refunded
   FROM public.advertisement_payment_refunds r
   JOIN public.advertisement_payments p ON p.id = r.payment_id
   GROUP BY p.advertisement_id
 ), classified AS (
   SELECT d.id, d.required > GREATEST(COALESCE(v.verified,0)-COALESCE(r.refunded,0),0) AS pending
   FROM drafts d LEFT JOIN receipts v ON v.advertisement_id = d.id
   LEFT JOIN refunds r ON r.advertisement_id = d.id
 )
 SELECT 'paymentPending'::text, 'Payment Pending'::text,
        COUNT(*) FILTER (WHERE pending)::bigint FROM classified
 UNION ALL
 SELECT 'submissionPending'::text, 'Submission Pending'::text,
        COUNT(*) FILTER (WHERE NOT pending)::bigint FROM classified;
$$;

-- Current live counts are derived from the same eligibility joins used by public
-- delivery: approved + activated, active rule/placement/schedule, usable creative,
-- and rotation membership when enabled. Counts are DISTINCT to avoid double counting.
CREATE OR REPLACE FUNCTION public.admin_dashboard_live_metrics(
  p_month integer DEFAULT NULL, p_year integer DEFAULT NULL
) RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
 WITH eligible AS (
   SELECT DISTINCT a.id AS advertisement_id, a.is_house_ad, p.id AS placement_id,
          p.page_type, NULLIF(to_jsonb(a)->>'activated_at','')::timestamptz AS activated_at
   FROM public.advertisements a
   JOIN public.advertisement_placement_rules pr ON pr.advertisement_id = a.id AND pr.status = 'ACTIVE'
   JOIN public.advertisement_placements p ON p.id = pr.placement_id
       AND p.status = 'ACTIVE' AND p.is_enabled = TRUE
   JOIN public.advertisement_schedules s ON s.advertisement_id = a.id
       AND s.placement_id = p.id
       AND (s.placement_rule_id IS NULL OR s.placement_rule_id = pr.id)
       AND s.status = 'ACTIVE' AND s.start_at <= NOW() AND s.end_at > NOW()
   WHERE a.workflow_status = 'APPROVED' AND a.status = 'ACTIVE'
     AND (COALESCE(p.rotation_enabled,FALSE) = FALSE OR EXISTS (
       SELECT 1 FROM public.advertisement_rotation_members rm
       WHERE rm.advertisement_id = a.id AND rm.placement_id = p.id AND rm.status = 'ACTIVE'))
     AND EXISTS (SELECT 1 FROM public.advertisement_creatives c
       WHERE c.advertisement_id = a.id AND c.status = 'ACTIVE'
         AND NULLIF(BTRIM(c.media_url),'') IS NOT NULL
         AND (c.format_id IS NULL OR EXISTS (SELECT 1 FROM public.advertisement_formats f
           WHERE f.id = c.format_id AND f.status = 'ACTIVE')))
     AND (p_month IS NULL OR EXTRACT(MONTH FROM NULLIF(to_jsonb(a)->>'activated_at','')::timestamptz) = p_month)
     AND (p_year IS NULL OR EXTRACT(YEAR FROM NULLIF(to_jsonb(a)->>'activated_at','')::timestamptz) = p_year)
 )
 SELECT 'live'::text, 'Live Ad Count'::text,
   COUNT(DISTINCT advertisement_id) FILTER (WHERE NOT is_house_ad)::bigint FROM eligible
 UNION ALL
 SELECT 'housePages', 'In-House Pages (Live)',
   COUNT(DISTINCT page_type) FILTER (WHERE is_house_ad)::bigint FROM eligible
 UNION ALL
 SELECT 'houseSlots', 'In-House Slots (Live)',
   COUNT(DISTINCT placement_id) FILTER (WHERE is_house_ad)::bigint FROM eligible;
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_draft_payment_metrics(integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_dashboard_live_metrics(integer,integer) FROM PUBLIC;
-- GRANT EXECUTE to the trusted backend DB role when required by your deployment.

-- Role associations are a relationship, not a permission status.
CREATE OR REPLACE FUNCTION public.admin_dashboard_permission_associations(
  p_month integer DEFAULT NULL, p_year integer DEFAULT NULL
) RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
 WITH scoped AS (
   SELECT p.id, EXISTS (SELECT 1 FROM public.role_permissions rp WHERE rp.permission_id = p.id) AS associated
   FROM public.permissions p
   WHERE (p_month IS NULL OR EXTRACT(MONTH FROM p.created_at) = p_month)
     AND (p_year IS NULL OR EXTRACT(YEAR FROM p.created_at) = p_year)
 )
 SELECT 'associated'::text, 'Role Association'::text,
        COUNT(*) FILTER (WHERE associated)::bigint FROM scoped
 UNION ALL
 SELECT 'unassociated', 'Non-Role Association',
        COUNT(*) FILTER (WHERE NOT associated)::bigint FROM scoped;
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_permission_associations(integer,integer) FROM PUBLIC;
