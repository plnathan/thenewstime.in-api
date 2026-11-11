-- Dashboard Phase 2: deploy this migration before deploying the updated API.
-- PostgreSQL function, invoked only through authenticated and authorized API routes.
CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics(
  p_module text,
  p_month integer DEFAULT NULL,
  p_year integer DEFAULT NULL
)
RETURNS TABLE(metric_key text, metric_label text, metric_value bigint)
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table text;
BEGIN
  IF p_module NOT IN ('news','users','roles','permissions','advertisements') THEN
    RAISE EXCEPTION 'Unsupported dashboard module' USING ERRCODE = '22023';
  END IF;
  IF (p_month IS NOT NULL AND (p_month < 1 OR p_month > 12)) OR
     (p_year IS NOT NULL AND (p_year < 2000 OR p_year > 2100)) THEN
    RAISE EXCEPTION 'Invalid dashboard period' USING ERRCODE = '22023';
  END IF;
  v_table := CASE p_module
    WHEN 'news' THEN 'news' WHEN 'users' THEN 'users'
    WHEN 'roles' THEN 'roles' WHEN 'permissions' THEN 'permissions'
    ELSE 'advertisements' END;

  -- The source table is selected exclusively from the fixed allowlist above.
  -- JSON projection makes absent optional audit fields NULL instead of raising SQL errors.
  RETURN QUERY EXECUTE format($query$
    WITH source AS (
      SELECT to_jsonb(t) AS j FROM public.%I t
    ), events AS (
      SELECT j,
        upper(coalesce(j->>'status','')) AS status,
        upper(coalesce(j->>'workflow_status','')) AS workflow,
        CASE WHEN j->>'created_at' ~ '^[0-9]{4}-' THEN (j->>'created_at')::timestamptz END AS created_at,
        CASE WHEN j->>'drafted_at' ~ '^[0-9]{4}-' THEN (j->>'drafted_at')::timestamptz END AS drafted_at,
        CASE WHEN j->>'submitted_at' ~ '^[0-9]{4}-' THEN (j->>'submitted_at')::timestamptz END AS submitted_at,
        CASE WHEN j->>'approved_at' ~ '^[0-9]{4}-' THEN (j->>'approved_at')::timestamptz END AS approved_at,
        CASE WHEN j->>'published_at' ~ '^[0-9]{4}-' THEN (j->>'published_at')::timestamptz END AS published_at,
        CASE WHEN j->>'archived_at' ~ '^[0-9]{4}-' THEN (j->>'archived_at')::timestamptz END AS archived_at,
        CASE WHEN j->>'activated_at' ~ '^[0-9]{4}-' THEN (j->>'activated_at')::timestamptz END AS activated_at,
        CASE WHEN j->>'end_at' ~ '^[0-9]{4}-' THEN (j->>'end_at')::timestamptz END AS end_at,
        CASE WHEN j->>'start_at' ~ '^[0-9]{4}-' THEN (j->>'start_at')::timestamptz END AS start_at
      FROM source
    ), metrics AS (
      SELECT * FROM (VALUES
        ('total','Total ' || CASE %L WHEN 'news' THEN 'News' WHEN 'users' THEN 'Users' WHEN 'roles' THEN 'Roles' WHEN 'permissions' THEN 'Permissions' ELSE 'Advertisements' END, 'total', 'created_at'),
        ('draft','Draft News','DRAFT','drafted_at'),
        ('approved','Approved News','APPROVED','approved_at'),
        ('published','Published News','PUBLISHED','published_at'),
        ('deleted','Deleted News','UNSUPPORTED',''),
        ('active','Active','ACTIVE','created_at'),
        ('inactive','Inactive','INACTIVE','created_at'),
        ('suspended','Suspended','SUSPENDED','created_at'),
        ('locked','Locked','UNSUPPORTED',''),
        ('associated','Role Association','UNSUPPORTED',''),
        ('unassociated','Non-Role Association','UNSUPPORTED',''),
        ('submissionPending','Submission Pending','UNSUPPORTED',''),
        ('paymentPending','Payment Pending','UNSUPPORTED',''),
        ('approvalPending','Approval Pending','SUBMITTED','submitted_at'),
        ('activationPending','Activation Pending','ACTIVATION_PENDING','approved_at'),
        ('drafted','Overall Drafted','DRAFT','created_at'),
        ('submitted','Overall Submitted','SUBMITTED','submitted_at'),
        ('activated','Overall Activated','ACTIVATED','activated_at'),
        ('live','Live Ad Count','LIVE','created_at'),
        ('housePages','In-House Pages (Live)','UNSUPPORTED',''),
        ('houseSlots','In-House Slots (Live)','UNSUPPORTED',''),
        ('paused','Paused','UNSUPPORTED',''),
        ('hold','Hold','ON_HOLD','created_at'),
        ('expired','Schedule Expired','EXPIRED','end_at'),
        ('archived','Archived','ARCHIVED','archived_at')
      ) v(k,label,kind,date_key)
    ), selected AS (
      SELECT * FROM metrics WHERE CASE %L
        WHEN 'news' THEN k IN ('total','draft','approved','published','deleted')
        WHEN 'users' THEN k IN ('total','active','inactive','suspended','locked')
        WHEN 'roles' THEN k IN ('total','active','inactive','suspended')
        WHEN 'permissions' THEN k IN ('total','active','inactive','associated','unassociated')
        ELSE k IN ('total','submissionPending','paymentPending','approvalPending','activationPending','drafted','submitted','approved','activated','live','housePages','houseSlots','paused','hold','expired','archived') END
    )
    SELECT m.k::text, m.label::text,
      CASE WHEN m.kind = 'UNSUPPORTED' THEN NULL::bigint
           WHEN m.kind = 'ACTIVATED' AND NOT EXISTS (SELECT 1 FROM events WHERE activated_at IS NOT NULL) THEN NULL::bigint
           ELSE (SELECT count(*)::bigint FROM events e
             CROSS JOIN LATERAL (SELECT CASE m.date_key
               WHEN 'created_at' THEN e.created_at WHEN 'drafted_at' THEN e.drafted_at
               WHEN 'submitted_at' THEN e.submitted_at WHEN 'approved_at' THEN e.approved_at
               WHEN 'published_at' THEN e.published_at WHEN 'archived_at' THEN e.archived_at
               WHEN 'activated_at' THEN e.activated_at WHEN 'end_at' THEN e.end_at
               ELSE NULL END AS event_date) d
             WHERE (m.kind = 'total' OR
                (m.kind IN ('DRAFT','APPROVED','PUBLISHED','ACTIVE','INACTIVE','SUSPENDED','SUBMITTED','ON_HOLD','ARCHIVED')
                   AND (CASE WHEN %L = 'advertisements' THEN e.workflow ELSE e.status END) = m.kind) OR
                (m.kind = 'ACTIVATION_PENDING' AND e.workflow = 'APPROVED' AND e.status <> 'ACTIVE') OR
                (m.kind = 'ACTIVATED' AND e.activated_at IS NOT NULL) OR
                (m.kind = 'LIVE' AND e.workflow = 'APPROVED' AND e.status = 'ACTIVE'
                   AND (e.start_at IS NULL OR e.start_at <= now()) AND (e.end_at IS NULL OR e.end_at > now())) OR
                (m.kind = 'EXPIRED' AND e.end_at < now()))
             AND ($1 IS NULL OR extract(month from d.event_date) = $1)
             AND ($2 IS NULL OR extract(year from d.event_date) = $2)
           ) END AS metric_value
    FROM selected m
  $query$, v_table, p_module, p_module, p_module) USING p_month, p_year;
END;
$$;

-- Security boundary: revoke direct execution from client/database API roles.
REVOKE ALL ON FUNCTION public.admin_dashboard_metrics(text, integer, integer) FROM PUBLIC;
-- Grant EXECUTE only to the database role used by the trusted Node.js backend.
-- Example (replace with your actual backend DB role):
-- GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics(text, integer, integer) TO backend_app;
