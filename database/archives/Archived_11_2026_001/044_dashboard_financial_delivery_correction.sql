-- Apply AFTER the previously supplied dashboard reporting and audit migrations.
-- Financial classification follows the payment repository: VERIFIED and REFUNDED
-- are gross verified receipts, with refund ledger deducted once.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_dashboard_draft_payment_metrics(
 p_month integer DEFAULT NULL, p_year integer DEFAULT NULL
) RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
 WITH drafts AS (
  SELECT a.id, GREATEST(COALESCE(a.advance_amount,0),0)::numeric AS required
  FROM public.advertisements a
  WHERE a.workflow_status='DRAFT'
    AND (p_month IS NULL OR EXTRACT(MONTH FROM a.created_at)=p_month)
    AND (p_year IS NULL OR EXTRACT(YEAR FROM a.created_at)=p_year)
 ), receipts AS (
  SELECT p.advertisement_id,
    COALESCE(SUM(p.amount) FILTER (WHERE p.payment_status IN ('VERIFIED','REFUNDED')),0)::numeric AS gross
  FROM public.advertisement_payments p GROUP BY p.advertisement_id
 ), refunds AS (
  SELECT p.advertisement_id, COALESCE(SUM(r.amount),0)::numeric AS refunded
  FROM public.advertisement_payment_refunds r
  JOIN public.advertisement_payments p ON p.id=r.payment_id
  GROUP BY p.advertisement_id
 ), classified AS (
  SELECT d.id, d.required > GREATEST(COALESCE(v.gross,0)-COALESCE(r.refunded,0),0) AS pending
  FROM drafts d LEFT JOIN receipts v ON v.advertisement_id=d.id
  LEFT JOIN refunds r ON r.advertisement_id=d.id
 )
 SELECT 'paymentPending'::text,'Payment Pending'::text,
  COUNT(*) FILTER (WHERE pending)::bigint FROM classified
 UNION ALL
 SELECT 'submissionPending'::text,'Submission Pending'::text,
  COUNT(*) FILTER (WHERE NOT pending)::bigint FROM classified;
$$;

-- Match public delivery eligibility for current time, including campaign time
-- window and the house-ad fallback relationship. Distinct counts avoid duplicate
-- schedules, rules, and creatives inflating the dashboard.
CREATE OR REPLACE FUNCTION public.admin_dashboard_live_metrics(
 p_month integer DEFAULT NULL, p_year integer DEFAULT NULL
) RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
 WITH eligible AS (
  SELECT DISTINCT a.id AS advertisement_id, a.is_house_ad, p.id AS placement_id,
   p.page_type
  FROM public.advertisements a
  JOIN public.advertisement_placement_rules pr
   ON pr.advertisement_id=a.id AND pr.status='ACTIVE'
  JOIN public.advertisement_placements p
   ON p.id=pr.placement_id AND p.status='ACTIVE' AND p.is_enabled=TRUE
  JOIN public.advertisement_schedules s
   ON s.advertisement_id=a.id AND s.placement_id=p.id
   AND (s.placement_rule_id IS NULL OR s.placement_rule_id=pr.id)
   AND s.status='ACTIVE' AND s.start_at<=now() AND s.end_at>now()
  WHERE a.workflow_status='APPROVED' AND a.status='ACTIVE'
   AND a.start_at IS NOT NULL AND a.end_at IS NOT NULL
   AND a.end_at>a.start_at AND a.start_at<=now() AND a.end_at>now()
   AND (a.is_house_ad=FALSE OR
    (p.fallback_behavior='HOUSE_AD' AND p.fallback_advertisement_id=a.id))
   AND (COALESCE(p.rotation_enabled,FALSE)=FALSE OR EXISTS (
     SELECT 1 FROM public.advertisement_rotation_members rm
     WHERE rm.advertisement_id=a.id AND rm.placement_id=p.id AND rm.status='ACTIVE'))
   AND EXISTS (
     SELECT 1 FROM public.advertisement_creatives c
     LEFT JOIN public.advertisement_formats f
       ON f.id=c.format_id AND f.status='ACTIVE'
     WHERE c.advertisement_id=a.id AND c.status='ACTIVE'
       AND NULLIF(BTRIM(c.media_url),'') IS NOT NULL
       AND (c.format_id IS NULL OR f.id IS NOT NULL))
   AND (p_month IS NULL OR EXTRACT(MONTH FROM a.created_at)=p_month)
   AND (p_year IS NULL OR EXTRACT(YEAR FROM a.created_at)=p_year)
 )
 SELECT 'live'::text,'Live Ad Count'::text,
  COUNT(DISTINCT advertisement_id) FILTER (WHERE is_house_ad=FALSE)::bigint FROM eligible
 UNION ALL
 SELECT 'housePages','In-House Pages (Live)',
  COUNT(DISTINCT page_type) FILTER (WHERE is_house_ad=TRUE)::bigint FROM eligible
 UNION ALL
 SELECT 'houseSlots','In-House Slots (Live)',
  COUNT(DISTINCT placement_id) FILTER (WHERE is_house_ad=TRUE)::bigint FROM eligible;
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_draft_payment_metrics(integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_dashboard_live_metrics(integer,integer) FROM PUBLIC;
COMMIT;
