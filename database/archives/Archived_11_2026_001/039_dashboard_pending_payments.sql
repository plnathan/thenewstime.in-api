-- Apply AFTER 20261102_admin_dashboard_metrics.sql.
-- Narrowly scoped extension: draft financial classification. Does not mutate advertisements/payments.
-- Uses the agreed advance requirement, not the full advertisement price.
CREATE OR REPLACE FUNCTION public.admin_dashboard_draft_payment_metrics(
  p_month integer DEFAULT NULL,
  p_year integer DEFAULT NULL
)
RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  WITH draft_ads AS (
    SELECT a.id,
           GREATEST(COALESCE(a.advance_amount, 0), 0)::numeric AS required_amount,
           a.created_at
    FROM public.advertisements a
    WHERE a.workflow_status = 'DRAFT'
      AND (p_month IS NULL OR EXTRACT(MONTH FROM a.created_at) = p_month)
      AND (p_year IS NULL OR EXTRACT(YEAR FROM a.created_at) = p_year)
  ), verified AS (
    SELECT p.advertisement_id,
           COALESCE(SUM(p.amount), 0)::numeric AS amount
    FROM public.advertisement_payments p
    WHERE p.payment_status = 'VERIFIED'
    GROUP BY p.advertisement_id
  ), classified AS (
    SELECT d.id,
           d.required_amount > COALESCE(v.amount, 0) AS payment_pending
    FROM draft_ads d
    LEFT JOIN verified v ON v.advertisement_id = d.id
  )
  SELECT 'paymentPending'::text, 'Payment Pending'::text,
         COUNT(*) FILTER (WHERE payment_pending)::bigint FROM classified
  UNION ALL
  SELECT 'submissionPending'::text, 'Submission Pending'::text,
         COUNT(*) FILTER (WHERE NOT payment_pending)::bigint FROM classified;
$$;
REVOKE ALL ON FUNCTION public.admin_dashboard_draft_payment_metrics(integer, integer) FROM PUBLIC;
-- Grant EXECUTE to the trusted backend DB role if needed, e.g.:
-- GRANT EXECUTE ON FUNCTION public.admin_dashboard_draft_payment_metrics(integer, integer) TO backend_app;
